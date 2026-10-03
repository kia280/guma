package handlers

import (
	"context"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	auctionsvc "github.com/kia280/guma/internal/services/auction"
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
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const auctionID = "00000000-0000-0000-0000-000000000003"
	positive := int64(100)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.UpdateAuctionRequest
		wantCode codes.Code
	}{
		{name: "unauthenticated", ctx: context.Background(), req: &gumav1.UpdateAuctionRequest{GuildId: guildID, AuctionId: auctionID}, wantCode: codes.Unauthenticated},
		{name: "malformed auction id", ctx: authed, req: &gumav1.UpdateAuctionRequest{GuildId: guildID, AuctionId: "bad", StartingBid: &positive}, wantCode: codes.NotFound},
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
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"

	_, err := h.CancelAuction(context.Background(), &gumav1.CancelAuctionRequest{GuildId: guildID, AuctionId: "a"})
	requireCode(t, err, codes.Unauthenticated)
	_, err = h.CancelAuction(authed, &gumav1.CancelAuctionRequest{GuildId: guildID, AuctionId: "bad"})
	requireCode(t, err, codes.NotFound)

	_, err = h.DeleteAuction(context.Background(), &gumav1.DeleteAuctionRequest{GuildId: guildID, AuctionId: "a"})
	requireCode(t, err, codes.Unauthenticated)
	_, err = h.DeleteAuction(authed, &gumav1.DeleteAuctionRequest{GuildId: guildID, AuctionId: "bad"})
	requireCode(t, err, codes.NotFound)
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
