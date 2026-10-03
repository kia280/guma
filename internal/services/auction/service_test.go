package auction

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWithParticipants(t *testing.T) {
	tests := []struct {
		name             string
		item             AuctionItem
		wantBidderName   string
		wantBidderAvatar string
	}{
		{
			name:             "leading bidder gets a name",
			item:             AuctionItem{SellerID: "seller", CurrentBidderID: "bidder"},
			wantBidderName:   "Bidder",
			wantBidderAvatar: "https://cdn.example.com/b.png",
		},
		{
			name: "no bids leaves the bidder unnamed",
			item: AuctionItem{SellerID: "seller"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			item := tt.item
			got := withParticipants(&item, "Seller", "https://cdn.example.com/s.png", "Bidder", "https://cdn.example.com/b.png")

			assert.Equal(t, "Seller", got.SellerName)
			assert.Equal(t, "https://cdn.example.com/s.png", got.SellerAvatarURL)
			assert.Equal(t, tt.wantBidderName, got.CurrentBidderName)
			assert.Equal(t, tt.wantBidderAvatar, got.CurrentBidderAvatarURL)
		})
	}
}
