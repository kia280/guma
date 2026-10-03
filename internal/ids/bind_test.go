package ids

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/services/errs"
)

var (
	guildA = uuid.MustParse("00000000-0000-0000-0000-00000000000a")
	itemB  = uuid.MustParse("00000000-0000-0000-0000-00000000000b")
	itemC  = uuid.MustParse("00000000-0000-0000-0000-00000000000c")
)

type sourceIDs struct {
	BackpackItemID *uuid.UUID
	BankItemID     *uuid.UUID
}

func TestBindRequiredAndNested(t *testing.T) {
	var in struct {
		GuildID uuid.UUID
		Source  *sourceIDs
	}
	err := Bind(&gumav1.CreateAuctionRequest{
		GuildId: guildA.String(),
		Source:  &gumav1.ItemSourceRef{BankItemId: itemB.String()},
	}, &in)

	require.NoError(t, err)
	assert.Equal(t, guildA, in.GuildID)
	require.NotNil(t, in.Source)
	assert.Nil(t, in.Source.BackpackItemID)
	assert.Equal(t, itemB, *in.Source.BankItemID)
}

func TestBindAbsentOptionalMessage(t *testing.T) {
	var in struct {
		GuildID uuid.UUID
		Source  *sourceIDs
	}
	require.NoError(t, Bind(&gumav1.CreateAuctionRequest{GuildId: guildA.String()}, &in))
	assert.Nil(t, in.Source)
}

func TestBindOptional(t *testing.T) {
	var in struct{ GuildID *uuid.UUID }
	require.NoError(t, Bind(&gumav1.ListMyTicketsRequest{}, &in))
	assert.Nil(t, in.GuildID)

	require.NoError(t, Bind(&gumav1.ListMyTicketsRequest{GuildId: guildA.String()}, &in))
	assert.Equal(t, guildA, *in.GuildID)
}

func TestBindLists(t *testing.T) {
	var in struct {
		ItemIDs []uuid.UUID
	}
	require.NoError(t, Bind(&gumav1.AdminTransferBackpackItemsRequest{ItemIds: []string{itemB.String(), itemC.String()}}, &in))
	assert.Equal(t, []uuid.UUID{itemB, itemC}, in.ItemIDs)
}

func TestBindRepeatedMessages(t *testing.T) {
	var in struct {
		Prizes []struct{ Source *sourceIDs }
	}
	require.NoError(t, Bind(&gumav1.CreateRaffleRequest{Prizes: []*gumav1.RafflePrize{
		{},
		{Source: &gumav1.ItemSourceRef{BackpackItemId: itemC.String()}},
	}}, &in))
	require.Len(t, in.Prizes, 2)
	assert.Nil(t, in.Prizes[0].Source)
	assert.Equal(t, itemC, *in.Prizes[1].Source.BackpackItemID)
}

func TestBindMalformedIsInvalidArgument(t *testing.T) {
	tests := []struct {
		name string
		bind func() error
		want string
	}{
		{name: "required", want: "invalid argument: guild_id must be a UUID", bind: func() error {
			var in struct{ GuildID uuid.UUID }
			return Bind(&gumav1.CreateAuctionRequest{GuildId: "bad"}, &in)
		}},
		{name: "missing required", want: "invalid argument: guild_id must be a UUID", bind: func() error {
			var in struct{ GuildID uuid.UUID }
			return Bind(&gumav1.CreateAuctionRequest{}, &in)
		}},
		{name: "optional", want: "invalid argument: guild_id must be a UUID", bind: func() error {
			var in struct{ GuildID *uuid.UUID }
			return Bind(&gumav1.ListMyTicketsRequest{GuildId: "bad"}, &in)
		}},
		{name: "list", want: "invalid argument: item_ids must be a UUID", bind: func() error {
			var in struct{ ItemIDs []uuid.UUID }
			return Bind(&gumav1.AdminTransferBackpackItemsRequest{ItemIds: []string{itemB.String(), "bad"}}, &in)
		}},
		{name: "nested", want: "invalid argument: prizes[1].source.bank_item_id must be a UUID", bind: func() error {
			var in struct {
				Prizes []struct{ Source *sourceIDs }
			}
			return Bind(&gumav1.CreateRaffleRequest{Prizes: []*gumav1.RafflePrize{{}, {Source: &gumav1.ItemSourceRef{BankItemId: "bad"}}}}, &in)
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.bind()
			assert.True(t, errors.Is(err, errs.ErrInvalidArgument), "got %v", err)
			assert.EqualError(t, err, tt.want)
		})
	}
}

func TestBindProgrammingErrorsAreInternal(t *testing.T) {
	tests := []struct {
		name string
		dst  any
	}{
		{name: "not a pointer", dst: struct{ GuildID uuid.UUID }{}},
		{name: "unknown field", dst: &struct{ AuctionID uuid.UUID }{}},
		{name: "renamed field", dst: &struct {
			Guild uuid.UUID `proto:"guild"`
		}{}},
		{name: "non-string field", dst: &struct{ StartingBid uuid.UUID }{}},
		{name: "unsupported type", dst: &struct{ GuildID string }{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Bind(&gumav1.CreateAuctionRequest{GuildId: guildA.String()}, tt.dst)
			assert.True(t, errors.Is(err, errs.ErrInternal), "got %v", err)
		})
	}
}

func TestBindTagOverride(t *testing.T) {
	var in struct {
		Guild uuid.UUID `proto:"guild_id"`
	}
	require.NoError(t, Bind(&gumav1.CreateAuctionRequest{GuildId: guildA.String()}, &in))
	assert.Equal(t, guildA, in.Guild)
}

func TestProtoName(t *testing.T) {
	for goName, want := range map[string]string{
		"GuildID":        "guild_id",
		"ItemIDs":        "item_ids",
		"BackpackItemID": "backpack_item_id",
		"RollCallID":     "roll_call_id",
		"Source":         "source",
	} {
		assert.Equal(t, want, protoName(goName), goName)
	}
}
