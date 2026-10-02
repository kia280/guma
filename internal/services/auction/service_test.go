package auction

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/authz/authztest"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
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

func TestAuthorizeManage(t *testing.T) {
	guild, seller, other := uuid.New(), uuid.New(), uuid.New()
	auction := db.Auction{SellerID: seller}
	tests := []struct {
		name    string
		user    uuid.UUID
		checker *authztest.Fake
		wantErr error
	}{
		{name: "seller member", user: seller, checker: authztest.New().Grant(guild, seller, authz.View)},
		{name: "seller no longer member", user: seller, checker: authztest.New(), wantErr: errs.ErrPermissionDenied},
		{name: "officer", user: other, checker: authztest.New().Grant(guild, other, authz.View, authz.ManageAuctions)},
		{name: "other member", user: other, checker: authztest.New().Grant(guild, other, authz.View), wantErr: errs.ErrPermissionDenied},
		{name: "checker failure", user: other, checker: &authztest.Fake{CanErr: errors.New("keto down")}, wantErr: errs.ErrInternal},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := New(nil, tt.checker, zerolog.Nop())
			err := s.authorizeManage(context.Background(), guild, tt.user, auction)
			if tt.wantErr == nil && err != nil {
				t.Fatalf("unexpected error %v", err)
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Fatalf("expected %v, got %v", tt.wantErr, err)
			}
		})
	}
}
