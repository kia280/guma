package auction

import (
	"github.com/google/uuid"

	"github.com/kia280/guma/internal/authz"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/inventory"
)

func createPermission(source inventory.Ref) authz.Permission {
	if source.BankItemID != "" {
		return authz.ManageAuctions
	}
	return authz.View
}

func managePermission(a db.Auction, userID uuid.UUID) authz.Permission {
	if a.SellerID == userID {
		return authz.View
	}
	return authz.ManageAuctions
}

func cancelPermission(a db.Auction, userID uuid.UUID) authz.Permission {
	if a.CurrentBidderID != nil {
		return authz.ManageAuctions
	}
	return managePermission(a, userID)
}
