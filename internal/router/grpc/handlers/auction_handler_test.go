package handlers

import (
	"testing"

	"github.com/stretchr/testify/assert"

	auctionsvc "github.com/kia280/guma/internal/services/auction"
)

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
