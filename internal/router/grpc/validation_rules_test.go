package grpc

import (
	"errors"
	"strings"
	"testing"
	"time"

	"buf.build/go/protovalidate"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
)

const (
	testUUID      = "123e4567-e89b-12d3-a456-426614174000"
	otherTestUUID = "123e4567-e89b-12d3-a456-426614174001"
)

func newTestValidator(t *testing.T) protovalidate.Validator {
	t.Helper()
	validator, err := protovalidate.New()
	require.NoError(t, err)
	return validator
}

func TestAllRequestRulesCompile(t *testing.T) {
	validator := newTestValidator(t)
	checked := 0

	protoregistry.GlobalFiles.RangeFilesByPackage("guma.v1", func(file protoreflect.FileDescriptor) bool {
		for i := 0; i < file.Services().Len(); i++ {
			methods := file.Services().Get(i).Methods()
			for j := 0; j < methods.Len(); j++ {
				input := methods.Get(j).Input()
				msgType, err := protoregistry.GlobalTypes.FindMessageByName(input.FullName())
				require.NoError(t, err)

				err = validator.Validate(msgType.New().Interface())
				var validationErr *protovalidate.ValidationError
				if err != nil && !errors.As(err, &validationErr) {
					t.Errorf("%s: %v", input.FullName(), err)
				}
				checked++
			}
		}
		return true
	})

	assert.Greater(t, checked, 100)
}

type violation struct {
	field  string
	ruleID string
}

func violationsOf(t *testing.T, err error) []violation {
	t.Helper()
	var validationErr *protovalidate.ValidationError
	require.ErrorAs(t, err, &validationErr)

	var out []violation
	for _, v := range validationErr.ToProto().GetViolations() {
		field := ""
		if elements := v.GetField().GetElements(); len(elements) > 0 {
			field = elements[0].GetFieldName()
		}
		out = append(out, violation{field: field, ruleID: v.GetRuleId()})
	}
	return out
}

func TestRequestRules(t *testing.T) {
	validator := newTestValidator(t)

	invalid := []struct {
		name string
		req  proto.Message
		want violation
	}{
		{
			name: "guild id too long for a uuid",
			req:  &gumav1.GetGuildRequest{GuildId: strings.Repeat("a", 65)},
			want: violation{"guild_id", "string.uuid"},
		},
		{
			name: "braced guild uuid",
			req:  &gumav1.ListMembersRequest{GuildId: "{" + testUUID + "}"},
			want: violation{"guild_id", "string.uuid"},
		},
		{
			name: "malformed optional guild id",
			req:  &gumav1.ListMyTicketsRequest{GuildId: "guild-1"},
			want: violation{"guild_id", "string.uuid"},
		},
		{
			name: "malformed repeated item id",
			req:  &gumav1.AdminTransferBackpackItemsRequest{GuildId: testUUID, UserId: testUUID, ItemIds: []string{"i1"}, ToGuildBank: true},
			want: violation{"item_ids", "string.uuid"},
		},
		{
			name: "missing auction guild id",
			req:  &gumav1.GetAuctionRequest{AuctionId: testUUID},
			want: violation{"guild_id", "required"},
		},
		{
			name: "zero ticket quantity",
			req:  &gumav1.PurchaseTicketsRequest{GuildId: testUUID, RaffleId: testUUID},
			want: violation{"quantity", "int32.gt"},
		},
		{
			name: "zero starting bid on auction update",
			req:  &gumav1.UpdateAuctionRequest{GuildId: testUUID, AuctionId: testUUID, StartingBid: proto.Int64(0)},
			want: violation{"starting_bid", "int64.gt"},
		},
		{
			name: "auction end before start",
			req: &gumav1.UpdateAuctionRequest{
				GuildId:   testUUID,
				AuctionId: testUUID,
				StartTime: timestamppb.New(time.Unix(1900003600, 0)),
				EndTime:   timestamppb.New(time.Unix(1900000000, 0)),
			},
			want: violation{"", "update_auction.end_after_start"},
		},
		{
			name: "empty raffle update",
			req:  &gumav1.UpdateRaffleRequest{GuildId: testUUID, RaffleId: testUUID},
			want: violation{"", "update_raffle.nothing_to_update"},
		},
		{
			name: "blank raffle title",
			req:  &gumav1.UpdateRaffleRequest{GuildId: testUUID, RaffleId: testUUID, Title: proto.String("  ")},
			want: violation{"title", "update_raffle.title_required"},
		},
		{
			name: "auction from two inventory sources",
			req: &gumav1.CreateAuctionRequest{
				GuildId: testUUID,
				Source:  &gumav1.ItemSourceRef{BackpackItemId: testUUID, BankItemId: testUUID},
			},
			want: violation{"source", "item_source_ref.single_source"},
		},
		{
			name: "auction item without name",
			req:  &gumav1.CreateAuctionRequest{GuildId: testUUID, Item: &gumav1.Item{}},
			want: violation{"", "create_auction.item_name_required"},
		},
		{
			name: "missing wallet guild id",
			req:  &gumav1.GetWalletRequest{},
			want: violation{"guild_id", "required"},
		},
		{
			name: "unknown fund request status",
			req:  &gumav1.ListFundRequestsRequest{GuildId: testUUID, Status: "cancelled"},
			want: violation{"status", "string.in"},
		},
		{
			name: "blank fund request reason",
			req:  &gumav1.RequestFundsRequest{GuildId: testUUID, Amount: 1, Reason: " \t "},
			want: violation{"reason", "string.pattern"},
		},
		{
			name: "admin transfer to user and bank",
			req:  &gumav1.AdminTransferFundsRequest{GuildId: testUUID, UserId: testUUID, Amount: 5, ToUserId: testUUID, ToGuildBank: true},
			want: violation{"", "message.oneof"},
		},
		{
			name: "admin transfer to same user",
			req:  &gumav1.AdminTransferFundsRequest{GuildId: testUUID, UserId: testUUID, Amount: 5, ToUserId: testUUID},
			want: violation{"", "to_user_id_differs_from_user_id"},
		},
		{
			name: "admin item transfer without items",
			req:  &gumav1.AdminTransferBackpackItemsRequest{GuildId: testUUID, UserId: testUUID, ToGuildBank: true},
			want: violation{"item_ids", "repeated.min_items"},
		},
		{
			name: "blank display name",
			req:  &gumav1.UpdateMeRequest{DisplayName: "  \t"},
			want: violation{"display_name", "display_name.not_blank"},
		},
		{
			name: "unsupported logo type",
			req:  &gumav1.UploadGuildLogoRequest{GuildId: testUUID, Data: []byte{1}, ContentType: "image/svg+xml"},
			want: violation{"content_type", "string.pattern"},
		},
		{
			name: "unknown member role filter",
			req:  &gumav1.ListMembersRequest{GuildId: testUUID, Role: "guest"},
			want: violation{"role", "string.in"},
		},
		{
			name: "empty notification preferences patch",
			req:  &gumav1.UpdateMyPreferencesRequest{Notifications: &gumav1.NotificationPreferencesPatch{}},
			want: violation{"", "notifications.not_empty"},
		},
		{
			name: "missing guild settings",
			req:  &gumav1.UpdateGuildSettingsRequest{GuildId: testUUID},
			want: violation{"settings", "required"},
		},
		{
			name: "malformed notification id",
			req:  &gumav1.MarkNotificationReadRequest{NotificationId: "nope"},
			want: violation{"notification_id", "string.uuid"},
		},
		{
			name: "blank event title",
			req:  &gumav1.CreateEventRequest{GuildId: testUUID, Title: "  \t"},
			want: violation{"title", "string.pattern"},
		},
		{
			name: "two gold loot entries",
			req: &gumav1.CreateRollCallRequest{
				GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b",
				Loot: []*gumav1.RollCallLootEntry{{Kind: " GOLD ", Amount: 5}, {Kind: "gold", Amount: 1}},
			},
			want: violation{"", "loot.single_gold_entry"},
		},
		{
			name: "gold loot without amount",
			req: &gumav1.CreateRollCallRequest{
				GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b",
				Loot: []*gumav1.RollCallLootEntry{{Kind: "Gold"}},
			},
			want: violation{"loot", "loot_entry.gold_amount_positive"},
		},
		{
			name: "loot update item without name",
			req: &gumav1.UpdateRollCallLootRequest{
				GuildId: testUUID, RollCallId: testUUID,
				LootList: []*gumav1.Item{{Name: "n"}, {}},
			},
			want: violation{"loot_list", "loot_item.name_required"},
		},
		{
			name: "duplicate gold payout users",
			req: &gumav1.DistributeRollCallGoldRequest{
				GuildId: testUUID, RollCallId: testUUID, RequestId: testUUID,
				Payouts: []*gumav1.RollCallGoldPayout{{UserId: testUUID, Amount: 1}, {UserId: testUUID, Amount: 2}},
			},
			want: violation{"payouts", "payouts.unique_user_ids"},
		},
		{
			name: "unknown item template category",
			req:  &gumav1.CreateItemTemplateRequest{GuildId: testUUID, Name: "n", Category: "ſkill_scroll", Rarity: "rare"},
			want: violation{"category", "string.pattern"},
		},
	}

	for _, tt := range invalid {
		t.Run(tt.name, func(t *testing.T) {
			assert.Contains(t, violationsOf(t, validator.Validate(tt.req)), tt.want)
		})
	}

	valid := []struct {
		name string
		req  proto.Message
	}{
		{
			name: "auction update",
			req: &gumav1.UpdateAuctionRequest{
				GuildId:     testUUID,
				AuctionId:   testUUID,
				Item:        &gumav1.Item{Name: "Sword"},
				StartingBid: proto.Int64(10),
				StartTime:   timestamppb.New(time.Unix(1900000000, 0)),
				EndTime:     timestamppb.New(time.Unix(1900003600, 0)),
			},
		},
		{
			name: "admin item transfer",
			req:  &gumav1.AdminTransferBackpackItemsRequest{GuildId: testUUID, UserId: testUUID, ItemIds: []string{testUUID}, ToUserId: otherTestUUID},
		},
		{
			name: "padded logo content type",
			req:  &gumav1.UploadGuildLogoRequest{GuildId: testUUID, Data: []byte{0x89, 'P', 'N', 'G'}, ContentType: " IMAGE/PNG "},
		},
		{
			name: "optional guild id left empty",
			req:  &gumav1.ListMyTicketsRequest{},
		},
		{
			name: "single notification preference",
			req:  &gumav1.UpdateMyPreferencesRequest{Notifications: &gumav1.NotificationPreferencesPatch{AuctionAlerts: proto.Bool(false)}},
		},
		{
			name: "mixed case item template enums",
			req:  &gumav1.CreateItemTemplateRequest{GuildId: testUUID, Name: "n", Category: "SKILL_SCROLL", Rarity: "Epİc"},
		},
		{
			name: "loot list ignored when loot entries are set",
			req: &gumav1.CreateRollCallRequest{
				GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b",
				LootList: []*gumav1.Item{{Name: "  "}},
				Loot:     []*gumav1.RollCallLootEntry{{Kind: "gold", Amount: 5}},
			},
		},
		{
			name: "list guilds at page size limit",
			req:  &gumav1.ListGuildsRequest{PageSize: 1000},
		},
	}

	for _, tt := range valid {
		t.Run(tt.name, func(t *testing.T) {
			assert.NoError(t, validator.Validate(tt.req))
		})
	}
}
