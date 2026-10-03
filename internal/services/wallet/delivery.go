package wallet

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

func (s *Service) WithdrawBackpackItem(ctx context.Context, ownerID, guildID, itemID uuid.UUID) (*BackpackItem, error) {
	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	row, err := qtx.RequestBackpackWithdrawal(ctx, db.RequestBackpackWithdrawalParams{
		ID: itemID, OwnerID: ownerID, GuildID: guildID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: backpack item is missing or already awaiting delivery", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: request withdrawal: %v", errs.ErrInternal, err)
	}
	if err := qtx.InsertItemEvent(ctx, db.InsertItemEventParams{
		GuildID: guildID, ItemID: row.ID, Kind: "withdrawal_requested", ActorID: &ownerID,
	}); err != nil {
		return nil, fmt.Errorf("%w: log withdrawal: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	item := toBackpackItem(row.ID, row.OwnerID, row.GuildID, row.Item, row.Source, row.SourceID, row.Note, row.AcquiredAt)
	item.DeliveryRequestedAt = timestampPtr(row.DeliveryRequestedAt)
	return item, nil
}

func (s *Service) CancelBackpackWithdrawal(ctx context.Context, ownerID, guildID, itemID uuid.UUID) (*BackpackItem, error) {
	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	row, err := qtx.CancelBackpackWithdrawal(ctx, db.CancelBackpackWithdrawalParams{
		ID: itemID, OwnerID: ownerID, GuildID: guildID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: item is not awaiting delivery", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: cancel withdrawal: %v", errs.ErrInternal, err)
	}
	if err := qtx.InsertItemEvent(ctx, db.InsertItemEventParams{
		GuildID: guildID, ItemID: row.ID, Kind: "withdrawal_cancelled", ActorID: &ownerID,
	}); err != nil {
		return nil, fmt.Errorf("%w: log cancellation: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	return toBackpackItem(row.ID, row.OwnerID, row.GuildID, row.Item, row.Source, row.SourceID, row.Note, row.AcquiredAt), nil
}

func (s *Service) ListPendingDeliveries(ctx context.Context, guildID uuid.UUID) ([]*BackpackItem, error) {
	rows, err := s.q.ListPendingDeliveries(ctx, guildID)
	if err != nil {
		return nil, fmt.Errorf("%w: list pending deliveries: %v", errs.ErrInternal, err)
	}
	items := make([]*BackpackItem, 0, len(rows))
	for _, r := range rows {
		item := toBackpackItem(r.ID, r.OwnerID, r.GuildID, r.Item, r.Source, r.SourceID, r.Note, r.AcquiredAt)
		item.DeliveryRequestedAt = timestampPtr(r.DeliveryRequestedAt)
		item.OwnerName = r.OwnerName
		items = append(items, item)
	}
	return items, nil
}

func (s *Service) ConfirmBackpackDelivery(ctx context.Context, officerID, guildID, itemID uuid.UUID) (*BackpackItem, error) {
	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	row, err := qtx.LockPendingDelivery(ctx, db.LockPendingDeliveryParams{ID: itemID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: item is not awaiting delivery", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: load delivery: %v", errs.ErrInternal, err)
	}
	if err := qtx.InsertItemEvent(ctx, db.InsertItemEventParams{
		GuildID: guildID, ItemID: row.ID, Kind: "delivered", ActorID: &officerID, SubjectID: &row.OwnerID,
	}); err != nil {
		return nil, fmt.Errorf("%w: log delivery: %v", errs.ErrInternal, err)
	}
	if err := qtx.DeleteDeliveredItem(ctx, db.DeleteDeliveredItemParams{ID: itemID, GuildID: guildID}); err != nil {
		return nil, fmt.Errorf("%w: remove delivered item: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("item_id", itemID.String()).Str("officer_id", officerID.String()).Msg("backpack item delivered")
	item := toBackpackItem(row.ID, row.OwnerID, row.GuildID, row.Item, row.Source, row.SourceID, row.Note, row.AcquiredAt)
	item.DeliveryRequestedAt = timestampPtr(row.DeliveryRequestedAt)
	return item, nil
}

func timestampPtr(t pgtype.Timestamptz) *time.Time {
	if !t.Valid {
		return nil
	}
	return &t.Time
}
