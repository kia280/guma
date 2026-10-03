package auction

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/authz/authztest"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/services/inventory"
)

func TestCreatePermission(t *testing.T) {
	tests := []struct {
		name   string
		source inventory.Ref
		want   authz.Permission
	}{
		{name: "free-form item", want: authz.View},
		{name: "own backpack item", source: inventory.Ref{BackpackItemID: uuid.NewString()}, want: authz.View},
		{name: "guild bank item", source: inventory.Ref{BankItemID: uuid.NewString()}, want: authz.ManageAuctions},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := createPermission(tt.source); got != tt.want {
				t.Fatalf("createPermission = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestManagePermission(t *testing.T) {
	seller, other := uuid.New(), uuid.New()
	auction := db.Auction{SellerID: seller}
	tests := []struct {
		name string
		user uuid.UUID
		want authz.Permission
	}{
		{name: "seller", user: seller, want: authz.View},
		{name: "someone else", user: other, want: authz.ManageAuctions},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := managePermission(auction, tt.user); got != tt.want {
				t.Fatalf("managePermission = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestCancelPermission(t *testing.T) {
	seller, other, bidder := uuid.New(), uuid.New(), uuid.New()
	tests := []struct {
		name    string
		auction db.Auction
		user    uuid.UUID
		want    authz.Permission
	}{
		{name: "seller without bids", auction: db.Auction{SellerID: seller}, user: seller, want: authz.View},
		{name: "seller with bids", auction: db.Auction{SellerID: seller, CurrentBidderID: &bidder}, user: seller, want: authz.ManageAuctions},
		{name: "someone else without bids", auction: db.Auction{SellerID: seller}, user: other, want: authz.ManageAuctions},
		{name: "someone else with bids", auction: db.Auction{SellerID: seller, CurrentBidderID: &bidder}, user: other, want: authz.ManageAuctions},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := cancelPermission(tt.auction, tt.user); got != tt.want {
				t.Fatalf("cancelPermission = %s, want %s", got, tt.want)
			}
		})
	}
}

func TestNonMembersAreDenied(t *testing.T) {
	guild, outsider, auctionID := uuid.NewString(), uuid.NewString(), uuid.NewString()
	s := New(nil, authztest.New(), zerolog.Nop())
	ctx := context.Background()

	calls := map[string]func() error{
		"list": func() error {
			_, err := s.List(ctx, ListParams{GuildID: guild, UserID: outsider})
			return err
		},
		"get": func() error {
			_, err := s.Get(ctx, guild, auctionID, outsider)
			return err
		},
		"bid history": func() error {
			_, err := s.GetBidHistory(ctx, guild, auctionID, outsider, 20, 0)
			return err
		},
		"place bid": func() error {
			_, _, err := s.PlaceBid(ctx, guild, auctionID, outsider, 100)
			return err
		},
		"create": func() error {
			_, err := s.Create(ctx, CreateParams{GuildID: guild, SellerID: outsider, Item: models.Item{Name: "Sword"}})
			return err
		},
	}
	for name, call := range calls {
		t.Run(name, func(t *testing.T) {
			if err := call(); !errors.Is(err, errs.ErrPermissionDenied) {
				t.Fatalf("expected permission denied, got %v", err)
			}
		})
	}
}
