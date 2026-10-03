package handlers

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/ids"
	auctionsvc "github.com/kia280/guma/internal/services/auction"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/session"
)

func requireCode(t *testing.T, err error, want codes.Code) {
	t.Helper()
	require.Error(t, err)
	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, want, st.Code())
}

func TestUpdateAuction_Validation(t *testing.T) {
	h := NewAuctionService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), uuid.MustParse("00000000-0000-0000-0000-000000000001"))
	const guildID = "00000000-0000-0000-0000-000000000002"
	const auctionID = "00000000-0000-0000-0000-000000000003"
	positive := int64(100)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.UpdateAuctionRequest
		wantCode codes.Code
	}{
		{name: "malformed auction id", ctx: authed, req: &gumav1.UpdateAuctionRequest{GuildId: guildID, AuctionId: "bad", StartingBid: &positive}, wantCode: codes.InvalidArgument},
		{name: "malformed guild id", ctx: authed, req: &gumav1.UpdateAuctionRequest{GuildId: "bad", AuctionId: auctionID, StartingBid: &positive}, wantCode: codes.InvalidArgument},
		{name: "unauthenticated", ctx: context.Background(), req: &gumav1.UpdateAuctionRequest{GuildId: guildID, AuctionId: auctionID, StartingBid: &positive}, wantCode: codes.Unauthenticated},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.UpdateAuction(tt.ctx, tt.req)
			requireCode(t, err, tt.wantCode)
		})
	}
}

func TestCancelAndDeleteAuction_Validation(t *testing.T) {
	h := NewAuctionService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), uuid.MustParse("00000000-0000-0000-0000-000000000001"))
	const guildID = "00000000-0000-0000-0000-000000000002"

	_, err := h.CancelAuction(authed, &gumav1.CancelAuctionRequest{GuildId: guildID, AuctionId: "bad"})
	requireCode(t, err, codes.InvalidArgument)

	_, err = h.DeleteAuction(authed, &gumav1.DeleteAuctionRequest{GuildId: guildID, AuctionId: "bad"})
	requireCode(t, err, codes.InvalidArgument)
}

func TestAuctionHandler_MalformedIDs(t *testing.T) {
	h := NewAuctionService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), testUserID)
	const guildID = "00000000-0000-0000-0000-000000000002"
	const auctionID = "00000000-0000-0000-0000-000000000003"

	calls := map[string]func() error{
		"list bad guild": func() error {
			_, err := h.ListAuctions(authed, &gumav1.ListAuctionsRequest{GuildId: "bad"})
			return err
		},
		"get bad guild": func() error {
			_, err := h.GetAuction(authed, &gumav1.GetAuctionRequest{GuildId: "bad", AuctionId: auctionID})
			return err
		},
		"get bad auction": func() error {
			_, err := h.GetAuction(authed, &gumav1.GetAuctionRequest{GuildId: guildID, AuctionId: "bad"})
			return err
		},
		"create bad guild": func() error {
			_, err := h.CreateAuction(authed, &gumav1.CreateAuctionRequest{GuildId: "bad"})
			return err
		},
		"create bad backpack item": func() error {
			_, err := h.CreateAuction(authed, &gumav1.CreateAuctionRequest{GuildId: guildID, Source: &gumav1.ItemSourceRef{BackpackItemId: "bad"}})
			return err
		},
		"create bad bank item": func() error {
			_, err := h.CreateAuction(authed, &gumav1.CreateAuctionRequest{GuildId: guildID, Source: &gumav1.ItemSourceRef{BankItemId: "bad"}})
			return err
		},
		"bid bad auction": func() error {
			_, err := h.PlaceBid(authed, &gumav1.PlaceBidRequest{GuildId: guildID, AuctionId: "bad", Amount: 100})
			return err
		},
		"bid history bad auction": func() error {
			_, err := h.GetBidHistory(authed, &gumav1.GetBidHistoryRequest{GuildId: guildID, AuctionId: "bad"})
			return err
		},
		"cancel bad guild": func() error {
			_, err := h.CancelAuction(authed, &gumav1.CancelAuctionRequest{GuildId: "bad", AuctionId: auctionID})
			return err
		},
	}
	for name, call := range calls {
		t.Run(name, func(t *testing.T) {
			requireCode(t, call(), codes.InvalidArgument)
		})
	}
}

func TestSourceRefFromProto(t *testing.T) {
	backpackID := uuid.MustParse("00000000-0000-0000-0000-000000000004")

	var p ids.Parser
	assert.True(t, sourceRefFromProto(&p, "source", nil).IsZero())
	assert.True(t, sourceRefFromProto(&p, "source", &gumav1.ItemSourceRef{}).IsZero())
	ref := sourceRefFromProto(&p, "source", &gumav1.ItemSourceRef{BackpackItemId: backpackID.String()})
	require.NoError(t, p.Err())
	require.NotNil(t, ref.BackpackItemID)
	assert.Equal(t, backpackID, *ref.BackpackItemID)
	assert.Nil(t, ref.BankItemID)

	sourceRefFromProto(&p, "source", &gumav1.ItemSourceRef{BankItemId: "bad"})
	require.ErrorIs(t, p.Err(), errs.ErrInvalidArgument)
	assert.Contains(t, p.Err().Error(), "source.bank_item_id")
}

func TestAuctionToProtoIncludesParticipantNames(t *testing.T) {
	got := auctionToProto(&auctionsvc.AuctionItem{
		ID:                     "auction",
		SellerID:               "seller",
		SellerName:             "Seller",
		SellerAvatarURL:        "https://cdn.example.com/s.png",
		CurrentBidderID:        "bidder",
		CurrentBidderName:      "Bidder",
		CurrentBidderAvatarURL: "https://cdn.example.com/b.png",
	})

	assert.Equal(t, "seller", got.GetSellerId())
	assert.Equal(t, "Seller", got.GetSellerName())
	assert.Equal(t, "https://cdn.example.com/s.png", got.GetSellerAvatarUrl())
	assert.Equal(t, "bidder", got.GetCurrentBidderId())
	assert.Equal(t, "Bidder", got.GetCurrentBidderName())
	assert.Equal(t, "https://cdn.example.com/b.png", got.GetCurrentBidderAvatarUrl())
}

func TestBidToProtoIncludesBidderName(t *testing.T) {
	got := bidToProto(&auctionsvc.Bid{
		ID:              "bid",
		BidderID:        "bidder",
		BidderName:      "Bidder",
		BidderAvatarURL: "https://cdn.example.com/b.png",
	})

	assert.Equal(t, "bidder", got.GetBidderId())
	assert.Equal(t, "Bidder", got.GetBidderUsername())
	assert.Equal(t, "https://cdn.example.com/b.png", got.GetBidderAvatarUrl())
}
