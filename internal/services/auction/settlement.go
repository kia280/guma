package auction

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
)

const (
	SourceBackpack = "backpack"
	SourceBank     = "bank"

	statusActive = "ACTIVE"

	dueAuctionBatchSize = 100
)

type SettlementResult struct {
	Activated int64
	Ended     int
}

func (s *Service) ProcessDueAuctions(ctx context.Context) (SettlementResult, error) {
	var result SettlementResult
	activated, err := s.q.ActivateDueAuctions(ctx)
	if err != nil {
		return result, fmt.Errorf("activate due auctions: %w", err)
	}
	result.Activated = activated

	ids, err := s.q.ListDueAuctions(ctx, dueAuctionBatchSize)
	if err != nil {
		return result, fmt.Errorf("list due auctions: %w", err)
	}
	var failed error
	for _, id := range ids {
		if ctx.Err() != nil {
			return result, ctx.Err()
		}
		ended, err := s.settle(ctx, id, time.Now().UTC())
		if err != nil {
			s.logger.Error().Err(err).Str("auction_id", id.String()).Msg("auction settlement failed")
			failed = errors.Join(failed, err)
			continue
		}
		if ended {
			result.Ended++
		}
	}
	return result, failed
}

func (s *Service) settle(ctx context.Context, auctionID uuid.UUID, now time.Time) (bool, error) {
	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("begin tx: %w", err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	a, err := qtx.LockAuctionForSettlement(ctx, auctionID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil
		}
		return false, fmt.Errorf("lock auction: %w", err)
	}
	if a.Status != statusActive || a.EndTime.After(now) {
		return false, nil
	}

	if a.CurrentBidderID != nil && a.CurrentBid > 0 {
		if err := s.deliverToWinner(ctx, qtx, a); err != nil {
			return false, err
		}
	} else if err := restoreSource(ctx, qtx, a.SourceType.String, a.SourceSnapshot); err != nil {
		return false, err
	}

	if err := qtx.MarkAuctionEnded(ctx, auctionID); err != nil {
		return false, fmt.Errorf("mark auction ended: %w", err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return false, fmt.Errorf("commit: %w", err)
	}
	s.logger.Info().Str("auction_id", auctionID.String()).Bool("sold", a.CurrentBidderID != nil && a.CurrentBid > 0).Msg("auction ended")
	return true, nil
}

func (s *Service) deliverToWinner(ctx context.Context, qtx *db.Queries, a db.LockAuctionForSettlementRow) error {
	winnerID := *a.CurrentBidderID
	auctionID := a.ID
	if _, err := qtx.InsertBackpackItem(ctx, db.InsertBackpackItemParams{
		OwnerID: winnerID, GuildID: a.GuildID, Item: a.Item,
		Source: "auction", SourceID: &auctionID,
	}); err != nil {
		return fmt.Errorf("deliver item to winner: %w", err)
	}

	if a.SourceType.String == SourceBackpack {
		return creditSeller(ctx, qtx, a)
	}
	return creditGuildBank(ctx, qtx, a)
}

func creditSeller(ctx context.Context, qtx *db.Queries, a db.LockAuctionForSettlementRow) error {
	if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: a.SellerID, GuildID: a.GuildID}); err != nil {
		return fmt.Errorf("ensure seller wallet: %w", err)
	}
	balance, err := qtx.CreditWallet(ctx, db.CreditWalletParams{Amount: a.CurrentBid, UserID: a.SellerID, GuildID: a.GuildID})
	if err != nil {
		return fmt.Errorf("credit seller: %w", err)
	}
	if _, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
		UserID: a.SellerID, GuildID: a.GuildID, Type: "AUCTION_SALE",
		Amount: a.CurrentBid, BalanceAfter: balance,
		Description: itemName(a.Item), ReferenceID: a.ID.String(), ReferenceType: "auction",
	}); err != nil {
		return fmt.Errorf("record sale transaction: %w", err)
	}
	return nil
}

func creditGuildBank(ctx context.Context, qtx *db.Queries, a db.LockAuctionForSettlementRow) error {
	if err := qtx.EnsureGuildBank(ctx, a.GuildID); err != nil {
		return fmt.Errorf("ensure guild bank: %w", err)
	}
	if err := qtx.CreditGuildBank(ctx, db.CreditGuildBankParams{Amount: a.CurrentBid, GuildID: a.GuildID}); err != nil {
		return fmt.Errorf("credit guild bank: %w", err)
	}
	winnerName, _ := qtx.GetUserDisplayName(ctx, *a.CurrentBidderID)
	if err := qtx.InsertBankProceeds(ctx, db.InsertBankProceedsParams{
		GuildID: a.GuildID, UserID: *a.CurrentBidderID, Username: winnerName,
		Amount: a.CurrentBid, Note: itemName(a.Item), Kind: "auction_proceeds",
		ReferenceType: "auction", ReferenceID: a.ID,
	}); err != nil {
		return fmt.Errorf("record auction proceeds: %w", err)
	}
	return nil
}

func restoreSource(ctx context.Context, qtx *db.Queries, sourceType string, snapshot []byte) error {
	if len(snapshot) == 0 {
		return nil
	}
	switch sourceType {
	case SourceBackpack:
		if _, err := qtx.RestoreBackpackItemSnapshot(ctx, snapshot); err != nil {
			return fmt.Errorf("restore backpack item: %w", err)
		}
	case SourceBank:
		if _, err := qtx.RestoreBankItemSnapshot(ctx, snapshot); err != nil {
			return fmt.Errorf("restore bank item: %w", err)
		}
	}
	return nil
}

func itemName(raw []byte) string {
	var item models.Item
	if err := json.Unmarshal(raw, &item); err != nil {
		return ""
	}
	return item.Name
}
