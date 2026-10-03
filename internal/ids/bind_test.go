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
	BackpackItemID *uuid.UUID `proto:"backpack_item_id"`
	BankItemID     *uuid.UUID `proto:"bank_item_id"`
}

type prizeIDs struct {
	Source *sourceIDs `proto:"source"`
}

func TestBindRequiredAndNested(t *testing.T) {
	var in struct {
		GuildID uuid.UUID  `proto:"guild_id"`
		Source  *sourceIDs `proto:"source"`
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
		GuildID uuid.UUID  `proto:"guild_id"`
		Source  *sourceIDs `proto:"source"`
	}
	require.NoError(t, Bind(&gumav1.CreateAuctionRequest{GuildId: guildA.String()}, &in))
	assert.Nil(t, in.Source)
}

func TestBindOptional(t *testing.T) {
	var in struct {
		GuildID *uuid.UUID `proto:"guild_id"`
	}
	require.NoError(t, Bind(&gumav1.ListMyTicketsRequest{}, &in))
	assert.Nil(t, in.GuildID)

	require.NoError(t, Bind(&gumav1.ListMyTicketsRequest{GuildId: guildA.String()}, &in))
	assert.Equal(t, guildA, *in.GuildID)
}

func TestBindLists(t *testing.T) {
	var in struct {
		ItemIDs []uuid.UUID `proto:"item_ids"`
	}
	require.NoError(t, Bind(&gumav1.AdminTransferBackpackItemsRequest{ItemIds: []string{itemB.String(), itemC.String()}}, &in))
	assert.Equal(t, []uuid.UUID{itemB, itemC}, in.ItemIDs)
}

func TestBindRepeatedMessages(t *testing.T) {
	var in struct {
		Prizes []prizeIDs `proto:"prizes"`
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
			var in struct {
				GuildID uuid.UUID `proto:"guild_id"`
			}
			return Bind(&gumav1.CreateAuctionRequest{GuildId: "bad"}, &in)
		}},
		{name: "missing required", want: "invalid argument: guild_id must be a UUID", bind: func() error {
			var in struct {
				GuildID uuid.UUID `proto:"guild_id"`
			}
			return Bind(&gumav1.CreateAuctionRequest{}, &in)
		}},
		{name: "optional", want: "invalid argument: guild_id must be a UUID", bind: func() error {
			var in struct {
				GuildID *uuid.UUID `proto:"guild_id"`
			}
			return Bind(&gumav1.ListMyTicketsRequest{GuildId: "bad"}, &in)
		}},
		{name: "list", want: "invalid argument: item_ids must be a UUID", bind: func() error {
			var in struct {
				ItemIDs []uuid.UUID `proto:"item_ids"`
			}
			return Bind(&gumav1.AdminTransferBackpackItemsRequest{ItemIds: []string{itemB.String(), "bad"}}, &in)
		}},
		{name: "nested", want: "invalid argument: prizes[1].source.bank_item_id must be a UUID", bind: func() error {
			var in struct {
				Prizes []prizeIDs `proto:"prizes"`
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
		{name: "not a pointer", dst: struct {
			GuildID uuid.UUID `proto:"guild_id"`
		}{}},
		{name: "missing tag", dst: &struct{ GuildID uuid.UUID }{}},
		{name: "unknown field", dst: &struct {
			AuctionID uuid.UUID `proto:"auction_id"`
		}{}},
		{name: "non-string field", dst: &struct {
			StartingBid uuid.UUID `proto:"starting_bid"`
		}{}},
		{name: "unsupported type", dst: &struct {
			GuildID string `proto:"guild_id"`
		}{}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := Bind(&gumav1.CreateAuctionRequest{GuildId: guildA.String()}, tt.dst)
			assert.True(t, errors.Is(err, errs.ErrInternal), "got %v", err)
		})
	}
}

func TestBindUsesTagNotFieldName(t *testing.T) {
	var in struct {
		Guild uuid.UUID `proto:"guild_id"`
	}
	require.NoError(t, Bind(&gumav1.CreateAuctionRequest{GuildId: guildA.String()}, &in))
	assert.Equal(t, guildA, in.Guild)
}
