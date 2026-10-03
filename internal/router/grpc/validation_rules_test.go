package grpc

import (
	"errors"
	"strconv"
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
			name: "zero starting bid on auction create",
			req:  &gumav1.CreateAuctionRequest{GuildId: testUUID, Item: &gumav1.Item{Name: "Sword"}, MinBidIncrement: 1, DurationHours: 1},
			want: violation{"starting_bid", "int64.amount"},
		},
		{
			name: "unknown auction create status",
			req:  &gumav1.CreateAuctionRequest{GuildId: testUUID, Item: &gumav1.Item{Name: "Sword"}, StartingBid: 1, MinBidIncrement: 1, DurationHours: 1, Status: "ENDED"},
			want: violation{"status", "string.in"},
		},
		{
			name: "zero bid amount",
			req:  &gumav1.PlaceBidRequest{GuildId: testUUID, AuctionId: testUUID},
			want: violation{"amount", "int64.amount"},
		},
		{
			name: "auction search too long",
			req:  &gumav1.ListAuctionsRequest{GuildId: testUUID, Search: strings.Repeat("s", 201)},
			want: violation{"search", "string.line"},
		},
		{
			name: "item name too long",
			req:  &gumav1.CreateAuctionRequest{GuildId: testUUID, Item: &gumav1.Item{Name: strings.Repeat("n", 101)}, StartingBid: 1, MinBidIncrement: 1, DurationHours: 1},
			want: violation{"item", "string.name"},
		},
		{
			name: "blank raffle title on create",
			req:  &gumav1.CreateRaffleRequest{GuildId: testUUID, Title: " ", DrawDate: "2030-01-01T00:00:00Z"},
			want: violation{"title", "string.not_blank"},
		},
		{
			name: "missing raffle draw date",
			req:  &gumav1.CreateRaffleRequest{GuildId: testUUID, Title: "Raffle"},
			want: violation{"draw_date", "required"},
		},
		{
			name: "empty invite code",
			req:  &gumav1.JoinGuildRequest{},
			want: violation{"invite_code", "required"},
		},
		{
			name: "unknown loot kind",
			req: &gumav1.CreateRollCallRequest{
				GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b",
				Loot: []*gumav1.RollCallLootEntry{{Kind: "silver", Item: &gumav1.Item{Name: "n"}}},
			},
			want: violation{"loot", "kind.allowed"},
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
			want: violation{"starting_bid", "int64.amount"},
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
			want: violation{"title", "string.not_blank"},
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
			want: violation{"reason", "string.not_blank"},
		},
		{
			name: "admin transfer to user and bank",
			req:  &gumav1.AdminTransferFundsRequest{GuildId: testUUID, UserId: testUUID, Amount: 5, ToUserId: testUUID, ToGuildBank: true},
			want: violation{"", "message.oneof"},
		},
		{
			name: "admin transfer to same user",
			req:  &gumav1.AdminTransferFundsRequest{GuildId: testUUID, UserId: testUUID, Amount: 5, ToUserId: testUUID},
			want: violation{"", "admin_transfer_funds.to_user_id_differs"},
		},
		{
			name: "admin item transfer without items",
			req:  &gumav1.AdminTransferBackpackItemsRequest{GuildId: testUUID, UserId: testUUID, ToGuildBank: true},
			want: violation{"item_ids", "repeated.min_items"},
		},
		{
			name: "blank display name",
			req:  &gumav1.UpdateMeRequest{DisplayName: "  \t"},
			want: violation{"display_name", "string.not_blank"},
		},
		{
			name: "unsupported logo type",
			req:  &gumav1.UploadGuildLogoRequest{GuildId: testUUID, Data: []byte{1}, ContentType: "image/svg+xml"},
			want: violation{"content_type", "content_type.allowed"},
		},
		{
			name: "unknown member role filter",
			req:  &gumav1.ListMembersRequest{GuildId: testUUID, Role: "guest"},
			want: violation{"role", "string.in"},
		},
		{
			name: "empty notification preferences patch",
			req:  &gumav1.UpdateMyPreferencesRequest{Notifications: &gumav1.NotificationPreferencesPatch{}},
			want: violation{"", "update_my_preferences.notifications_not_empty"},
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
			want: violation{"title", "string.not_blank"},
		},
		{
			name: "two gold loot entries",
			req: &gumav1.CreateRollCallRequest{
				GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b",
				Loot: []*gumav1.RollCallLootEntry{{Kind: " GOLD ", Amount: 5}, {Kind: "gold", Amount: 1}},
			},
			want: violation{"", "create_roll_call.single_gold_entry"},
		},
		{
			name: "gold loot without amount",
			req: &gumav1.CreateRollCallRequest{
				GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b",
				Loot: []*gumav1.RollCallLootEntry{{Kind: "Gold"}},
			},
			want: violation{"loot", "roll_call_loot_entry.gold_amount_positive"},
		},
		{
			name: "loot update item without name",
			req: &gumav1.UpdateRollCallLootRequest{
				GuildId: testUUID, RollCallId: testUUID,
				LootList: []*gumav1.Item{{Name: "n"}, {}},
			},
			want: violation{"loot_list", "loot_list.item_name_required"},
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
			want: violation{"category", "string.item_category"},
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
			req:  &gumav1.CreateItemTemplateRequest{GuildId: testUUID, Name: "n", Category: " SKILL_SCROLL ", Rarity: "Epic"},
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
			name: "auction create",
			req:  &gumav1.CreateAuctionRequest{GuildId: testUUID, Item: &gumav1.Item{Name: "Sword"}, StartingBid: 1, MinBidIncrement: 1, DurationHours: 1, Status: "ACTIVE"},
		},
		{
			name: "raffle create",
			req:  &gumav1.CreateRaffleRequest{GuildId: testUUID, Title: "Raffle", DrawDate: "2030-01-01T00:00:00Z", TicketPrice: 10, MaxTickets: 100},
		},
		{
			name: "list guilds at page size limit",
			req:  &gumav1.ListGuildsRequest{PageSize: 100},
		},
	}

	for _, tt := range valid {
		t.Run(tt.name, func(t *testing.T) {
			assert.NoError(t, validator.Validate(tt.req))
		})
	}
}

func TestRequestRulesReplaceHandlerChecks(t *testing.T) {
	validator := newTestValidator(t)
	gold := func(amount int64) []*gumav1.RollCallLootEntry {
		return []*gumav1.RollCallLootEntry{{Kind: "gold", Amount: amount}}
	}

	tests := []struct {
		name string
		req  proto.Message
		want violation
	}{
		{"deposit zero amount", &gumav1.DepositFundsRequest{GuildId: testUUID}, violation{"amount", "int64.amount"}},
		{"transfer negative amount", &gumav1.TransferFundsRequest{GuildId: testUUID, ToUserId: testUUID, Amount: -1}, violation{"amount", "int64.amount"}},
		{"deposit note too long", &gumav1.DepositFundsRequest{GuildId: testUUID, Amount: 1, Note: strings.Repeat("n", 201)}, violation{"note", "string.line"}},
		{"request item reason too long", &gumav1.RequestItemRequest{GuildId: testUUID, BankItemId: testUUID, Reason: strings.Repeat("r", 501)}, violation{"reason", "string.paragraph"}},
		{"review withdrawal pending", &gumav1.ReviewWithdrawalRequestRequest{GuildId: testUUID, RequestId: testUUID, Status: "pending"}, violation{"status", "string.in"}},
		{"review fund request empty", &gumav1.ReviewFundRequestRequest{GuildId: testUUID, RequestId: testUUID}, violation{"status", "string.in"}},
		{"withdrawal status filter", &gumav1.ListWithdrawalRequestsRequest{GuildId: testUUID, Status: "done"}, violation{"status", "string.in"}},
		{"admin item transfer too many", &gumav1.AdminTransferBackpackItemsRequest{GuildId: testUUID, UserId: testUUID, ToGuildBank: true, ItemIds: make([]string, 101)}, violation{"item_ids", "repeated.max_items"}},
		{"admin funds transfer without destination", &gumav1.AdminTransferFundsRequest{GuildId: testUUID, UserId: testUUID, Amount: 1}, violation{"", "message.oneof"}},
		{"missing guild name", &gumav1.CreateGuildRequest{}, violation{"name", "required"}},
		{"guild name too long", &gumav1.CreateGuildRequest{Name: strings.Repeat("名", 101)}, violation{"name", "string.name"}},
		{"missing member role", &gumav1.UpdateMemberRoleRequest{GuildId: testUUID, UserId: testUUID}, violation{"role", "string.in"}},
		{"unknown member role", &gumav1.UpdateMemberRoleRequest{GuildId: testUUID, UserId: testUUID, Role: "king"}, violation{"role", "string.in"}},
		{"missing invite email", &gumav1.InviteMemberRequest{GuildId: testUUID}, violation{"email", "required"}},
		{"missing search query", &gumav1.SearchGlobalRequest{}, violation{"query", "required"}},
		{"missing user preferences", &gumav1.UpdateUserPreferencesRequest{}, violation{"preferences", "required"}},
		{"missing notification patch", &gumav1.UpdateMyPreferencesRequest{}, violation{"notifications", "required"}},
		{"empty display name", &gumav1.UpdateMeRequest{}, violation{"display_name", "string.not_blank"}},
		{"avatar url too long", &gumav1.UpdateMeRequest{DisplayName: "n", AvatarUrl: strings.Repeat("a", 2049)}, violation{"avatar_url", "string.url"}},
		{"announcement title too long", &gumav1.UpdateAnnouncementRequest{GuildId: testUUID, AnnouncementId: testUUID, Title: strings.Repeat("t", 201)}, violation{"title", "string.line"}},
		{"unknown event type", &gumav1.CreateEventRequest{GuildId: testUUID, Title: "t", Type: "party"}, violation{"type", "string.in"}},
		{"unknown event priority", &gumav1.CreateEventRequest{GuildId: testUUID, Title: "t", Priority: "urgent"}, violation{"priority", "string.in"}},
		{"too many recurring days", &gumav1.CreateEventRequest{GuildId: testUUID, Title: "t", RecurringPattern: &gumav1.RecurringPattern{Type: "weekly", DaysOfWeek: []int32{0, 1, 2, 3, 4, 5, 6, 0}}}, violation{"recurring_pattern", "repeated.max_items"}},
		{"empty recurring type", &gumav1.CreateEventRequest{GuildId: testUUID, Title: "t", RecurringPattern: &gumav1.RecurringPattern{}}, violation{"recurring_pattern", "string.in"}},
		{"gold loot negative", &gumav1.CreateRollCallRequest{GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b", Loot: gold(-1)}, violation{"loot", "int64.amount_or_zero"}},
		{"gold loot too large", &gumav1.CreateRollCallRequest{GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b", Loot: gold(100000000000001)}, violation{"loot", "int64.amount_or_zero"}},
		{"item loot without name", &gumav1.CreateRollCallRequest{GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b", Loot: []*gumav1.RollCallLootEntry{{Kind: "item"}}}, violation{"loot", "roll_call_loot_entry.item_name_required"}},
		{"blank legacy loot item", &gumav1.CreateRollCallRequest{GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b", LootList: []*gumav1.Item{{Name: " "}}}, violation{"", "create_roll_call.loot_list_item_name_required"}},
		{"loot change on update", &gumav1.UpdateRollCallRequest{GuildId: testUUID, RollCallId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b", Loot: gold(1)}, violation{"loot", "repeated.max_items"}},
		{"check-in notes too long", &gumav1.CheckInRequest{GuildId: testUUID, RollCallId: testUUID, Notes: strings.Repeat("n", 501)}, violation{"notes", "string.paragraph"}},
		{"no payouts", &gumav1.DistributeRollCallGoldRequest{GuildId: testUUID, RollCallId: testUUID, RequestId: testUUID}, violation{"payouts", "repeated.min_items"}},
		{"all zero payouts", &gumav1.DistributeRollCallGoldRequest{GuildId: testUUID, RollCallId: testUUID, RequestId: testUUID, Payouts: []*gumav1.RollCallGoldPayout{{UserId: testUUID}}}, violation{"payouts", "payouts.positive_total"}},
		{"negative payout", &gumav1.DistributeRollCallGoldRequest{GuildId: testUUID, RollCallId: testUUID, RequestId: testUUID, Payouts: []*gumav1.RollCallGoldPayout{{UserId: testUUID, Amount: -1}, {UserId: otherTestUUID, Amount: 2}}}, violation{"payouts", "int64.amount_or_zero"}},
		{"blank roll call template name", &gumav1.CreateRollCallTemplateRequest{GuildId: testUUID, Name: " ", Title: "t"}, violation{"name", "string.not_blank"}},
		{"too many template items", &gumav1.CreateRollCallTemplateRequest{GuildId: testUUID, Name: "n", Title: "t", ItemTemplateIds: make([]string, 101)}, violation{"item_template_ids", "repeated.max_items"}},
		{"missing item template rarity", &gumav1.CreateItemTemplateRequest{GuildId: testUUID, Name: "n", Category: "misc"}, violation{"rarity", "required"}},
		{"item template description too long", &gumav1.CreateItemTemplateRequest{GuildId: testUUID, Name: "n", Category: "misc", Rarity: "rare", Description: strings.Repeat("d", 501)}, violation{"description", "string.paragraph"}},
		{"auction increment zero on update", &gumav1.UpdateAuctionRequest{GuildId: testUUID, AuctionId: testUUID, MinBidIncrement: proto.Int64(0)}, violation{"min_bid_increment", "int64.amount"}},
		{"auction end equals start", &gumav1.UpdateAuctionRequest{GuildId: testUUID, AuctionId: testUUID, StartTime: timestamppb.New(time.Unix(1900000000, 0)), EndTime: timestamppb.New(time.Unix(1900000000, 0))}, violation{"", "update_auction.end_after_start"}},
		{"blank auction item name on update", &gumav1.UpdateAuctionRequest{GuildId: testUUID, AuctionId: testUUID, Item: &gumav1.Item{Name: " "}}, violation{"item", "item.name_required"}},
		{"negative raffle ticket price", &gumav1.UpdateRaffleRequest{GuildId: testUUID, RaffleId: testUUID, TicketPrice: proto.Int64(-1)}, violation{"ticket_price", "int64.amount_or_zero"}},
		{"raffle prize from two sources", &gumav1.CreateRaffleRequest{GuildId: testUUID, Title: "t", DrawDate: "d", Prizes: []*gumav1.RafflePrize{{Source: &gumav1.ItemSourceRef{BackpackItemId: testUUID, BankItemId: testUUID}}}}, violation{"prizes", "item_source_ref.single_source"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Contains(t, violationsOf(t, validator.Validate(tt.req)), tt.want)
		})
	}
}

func manySettings(n int) map[string]string {
	settings := make(map[string]string, n)
	for i := range n {
		settings[strconv.Itoa(i)] = "v"
	}
	return settings
}

func TestPredefinedRules(t *testing.T) {
	validator := newTestValidator(t)
	rollCall := func(imageURL string) *gumav1.CreateRollCallRequest {
		return &gumav1.CreateRollCallRequest{GuildId: testUUID, Title: "t", Datetime: "a", ExpireTime: "b", ImageUrl: imageURL}
	}

	invalid := []struct {
		name string
		req  proto.Message
		want violation
	}{
		{"page size above standard limit", &gumav1.ListGuildsRequest{PageSize: 101}, violation{"page_size", "int32.max_page_size"}},
		{"negative page size", &gumav1.ListGuildsRequest{PageSize: -1}, violation{"page_size", "int32.max_page_size"}},
		{"member page size above member limit", &gumav1.ListMembersRequest{GuildId: testUUID, PageSize: 501}, violation{"page_size", "int32.max_page_size"}},
		{"handle too long", &gumav1.UpdateMeRequest{DisplayName: strings.Repeat("名", 33)}, violation{"display_name", "string.handle"}},
		{"keyword too long", &gumav1.ListRafflesRequest{GuildId: testUUID, Status: strings.Repeat("s", 51)}, violation{"status", "string.keyword"}},
		{"code too long", &gumav1.CreateRollCallRequest{GuildId: testUUID, Title: "t", Datetime: strings.Repeat("1", 65), ExpireTime: "b"}, violation{"datetime", "string.code"}},
		{"text too long", &gumav1.CreateGuildRequest{Name: "g", Description: strings.Repeat("d", 2001)}, violation{"description", "string.text"}},
		{"too many settings", &gumav1.CreateGuildRequest{Name: "g", Settings: manySettings(51)}, violation{"settings", "map.settings_map"}},
		{"settings value too long", &gumav1.CreateGuildRequest{Name: "g", Settings: map[string]string{"k": strings.Repeat("v", 2001)}}, violation{"settings", "map.settings_map"}},
		{"unknown auction item category", &gumav1.CreateAuctionRequest{GuildId: testUUID, Item: &gumav1.Item{Name: "Sword", Category: "gun"}, StartingBid: 1, MinBidIncrement: 1, DurationHours: 1}, violation{"item", "string.item_category"}},
		{"unknown loot item rarity", &gumav1.UpdateRollCallLootRequest{GuildId: testUUID, RollCallId: testUUID, LootList: []*gumav1.Item{{Name: "n", Rarity: "ultra"}}}, violation{"loot_list", "string.item_rarity"}},
		{"unknown auction category filter", &gumav1.ListAuctionsRequest{GuildId: testUUID, Category: "gun"}, violation{"category", "string.item_category"}},
		{"unknown bank rarity filter", &gumav1.ListBankItemsRequest{GuildId: testUUID, Rarity: "ultra"}, violation{"rarity", "string.item_rarity"}},
		{"blank item template rarity", &gumav1.CreateItemTemplateRequest{GuildId: testUUID, Name: "n", Category: "misc", Rarity: "  "}, violation{"rarity", "string.item_rarity"}},
		{"amount above cap", &gumav1.DepositFundsRequest{GuildId: testUUID, Amount: 100000000000001}, violation{"amount", "int64.amount"}},
		{"negative contribution", &gumav1.ContributeFundsRequest{GuildId: testUUID, Amount: -1}, violation{"amount", "int64.amount"}},
		{"non-numeric page token", &gumav1.ListGuildsRequest{PageToken: "abc"}, violation{"page_token", "string.page_token"}},
		{"signed page token", &gumav1.ListGuildsRequest{PageToken: "+5"}, violation{"page_token", "string.page_token"}},
		{"page token above int32", &gumav1.ListGuildsRequest{PageToken: "2147483648"}, violation{"page_token", "string.page_token"}},
		{"page token too long", &gumav1.ListGuildsRequest{PageToken: "00000000001"}, violation{"page_token", "string.page_token"}},
		{"http image url", rollCall("http://example.com/a.png"), violation{"image_url", "string.https_url"}},
		{"image url without host", rollCall("https:///a.png"), violation{"image_url", "string.https_url"}},
		{"bare https scheme", rollCall("https://"), violation{"image_url", "string.https_url"}},
		{"image url too long", rollCall("https://example.com/" + strings.Repeat("a", 2048)), violation{"image_url", "string.url"}},
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
		{"empty page token", &gumav1.ListGuildsRequest{}},
		{"member page size at member limit", &gumav1.ListMembersRequest{GuildId: testUUID, PageSize: 500}},
		{"announcement page size at announcement limit", &gumav1.ListAnnouncementsRequest{GuildId: testUUID, PageSize: 200}},
		{"handle at limit", &gumav1.UpdateMeRequest{DisplayName: strings.Repeat("名", 32)}},
		{"settings at limit", &gumav1.CreateGuildRequest{Name: "g", Settings: manySettings(50)}},
		{"item without category or rarity", &gumav1.CreateAuctionRequest{GuildId: testUUID, Item: &gumav1.Item{Name: "Sword"}, StartingBid: 1, MinBidIncrement: 1, DurationHours: 1}},
		{"upper case item category", &gumav1.CreateAuctionRequest{GuildId: testUUID, Item: &gumav1.Item{Name: "Sword", Category: "WEAPON", Rarity: "Rare"}, StartingBid: 1, MinBidIncrement: 1, DurationHours: 1}},
		{"empty category filter", &gumav1.ListBankItemsRequest{GuildId: testUUID}},
		{"amount at cap", &gumav1.DepositFundsRequest{GuildId: testUUID, Amount: 100000000000000}},
		{"zero ticket price", &gumav1.UpdateRaffleRequest{GuildId: testUUID, RaffleId: testUUID, TicketPrice: proto.Int64(0)}},
		{"numeric page token", &gumav1.ListGuildsRequest{PageToken: "40"}},
		{"page token at int32 max", &gumav1.ListGuildsRequest{PageToken: "2147483647"}},
		{"empty image url", rollCall("")},
		{"https image url", rollCall("https://example.com/a.png?size=2")},
	}

	for _, tt := range valid {
		t.Run(tt.name, func(t *testing.T) {
			assert.NoError(t, validator.Validate(tt.req))
		})
	}
}
