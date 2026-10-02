package inventory

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	SourceBackpack = "backpack"
	SourceBank     = "bank"

	HolderAuction = "auction"
	HolderRaffle  = "raffle"
)

type Ref struct {
	BackpackItemID string
	BankItemID     string
}

func (r Ref) IsZero() bool {
	return r.BackpackItemID == "" && r.BankItemID == ""
}

type Holder struct {
	Type string
	ID   uuid.UUID
}

type Locked struct {
	SourceType string
	ItemID     uuid.UUID
	Item       models.Item
	RawItem    []byte
}

func Lock(ctx context.Context, qtx *db.Queries, guildID, actorID uuid.UUID, ref Ref, holder Holder, rejectNote string) (*Locked, error) {
	var (
		sourceType string
		itemID     uuid.UUID
		rawItem    []byte
		err        error
	)
	switch {
	case ref.BackpackItemID != "":
		if itemID, err = uuid.Parse(ref.BackpackItemID); err != nil {
			return nil, fmt.Errorf("%w: backpack item", errs.ErrNotFound)
		}
		rawItem, err = qtx.LockBackpackItem(ctx, db.LockBackpackItemParams{
			HolderType: holder.Type, HolderID: holder.ID, ID: itemID, OwnerID: actorID, GuildID: guildID,
		})
		if err != nil {
			return nil, lockError(err, "backpack item", func() (bool, error) {
				return qtx.BackpackItemOwned(ctx, db.BackpackItemOwnedParams{ID: itemID, OwnerID: actorID, GuildID: guildID})
			})
		}
		sourceType = SourceBackpack
	case ref.BankItemID != "":
		if itemID, err = uuid.Parse(ref.BankItemID); err != nil {
			return nil, fmt.Errorf("%w: bank item", errs.ErrNotFound)
		}
		rawItem, err = qtx.LockBankItem(ctx, db.LockBankItemParams{
			HolderType: holder.Type, HolderID: holder.ID, ID: itemID, GuildID: guildID,
		})
		if err != nil {
			return nil, lockError(err, "bank item", func() (bool, error) {
				return qtx.BankItemExists(ctx, db.BankItemExistsParams{ID: itemID, GuildID: guildID})
			})
		}
		if _, err := qtx.RejectPendingRequestsForBankItem(ctx, db.RejectPendingRequestsForBankItemParams{
			ReviewerID: &actorID, ReviewNote: rejectNote, BankItemID: &itemID, GuildID: guildID,
		}); err != nil {
			return nil, fmt.Errorf("%w: reject pending requests: %v", errs.ErrInternal, err)
		}
		sourceType = SourceBank
	default:
		return nil, nil
	}

	if err := qtx.InsertItemEvent(ctx, db.InsertItemEventParams{
		GuildID: guildID, ItemID: itemID, Kind: holder.Type + "_listed", ActorID: &actorID,
		Source: holder.Type, ReferenceID: &holder.ID,
	}); err != nil {
		return nil, fmt.Errorf("%w: log listing: %v", errs.ErrInternal, err)
	}

	var item models.Item
	if err := json.Unmarshal(rawItem, &item); err != nil {
		return nil, fmt.Errorf("%w: decode item: %v", errs.ErrInternal, err)
	}
	return &Locked{SourceType: sourceType, ItemID: itemID, Item: item, RawItem: rawItem}, nil
}

func Release(ctx context.Context, qtx *db.Queries, sourceType string, itemID *uuid.UUID, holder Holder) error {
	if itemID == nil {
		return nil
	}
	switch sourceType {
	case SourceBackpack:
		rows, err := qtx.ReleaseBackpackItem(ctx, db.ReleaseBackpackItemParams{ID: *itemID, HolderType: holder.Type, HolderID: holder.ID})
		if err != nil {
			return fmt.Errorf("%w: release backpack item: %v", errs.ErrInternal, err)
		}
		for _, guildID := range rows {
			if err := logEvent(ctx, qtx, guildID, *itemID, "returned", SourceBackpack, nil); err != nil {
				return err
			}
		}
	case SourceBank:
		dropped, err := qtx.DeleteReleasedCancelledLoot(ctx, db.DeleteReleasedCancelledLootParams{ID: *itemID, HolderType: holder.Type, HolderID: holder.ID})
		if err != nil {
			return fmt.Errorf("%w: drop cancelled loot: %v", errs.ErrInternal, err)
		}
		for _, r := range dropped {
			if err := logEvent(ctx, qtx, r.GuildID, *itemID, "retracted", "roll_call", r.RollCallID); err != nil {
				return err
			}
		}
		if len(dropped) > 0 {
			return nil
		}
		rows, err := qtx.ReleaseBankItem(ctx, db.ReleaseBankItemParams{ID: *itemID, HolderType: holder.Type, HolderID: holder.ID})
		if err != nil {
			return fmt.Errorf("%w: release bank item: %v", errs.ErrInternal, err)
		}
		for _, guildID := range rows {
			if err := logEvent(ctx, qtx, guildID, *itemID, "returned", SourceBank, nil); err != nil {
				return err
			}
		}
	}
	return nil
}

func Consume(ctx context.Context, qtx *db.Queries, sourceType string, itemID *uuid.UUID, holder Holder) ([]byte, error) {
	if itemID == nil {
		return nil, nil
	}
	var (
		rawItem []byte
		err     error
	)
	switch sourceType {
	case SourceBackpack:
		rawItem, err = qtx.ConsumeBackpackItem(ctx, db.ConsumeBackpackItemParams{ID: *itemID, HolderType: holder.Type, HolderID: holder.ID})
	case SourceBank:
		rawItem, err = qtx.ConsumeBankItem(ctx, db.ConsumeBankItemParams{ID: *itemID, HolderType: holder.Type, HolderID: holder.ID})
	default:
		return nil, nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("%w: consume %s item: %v", errs.ErrInternal, sourceType, err)
	}
	return rawItem, nil
}

func logEvent(ctx context.Context, qtx *db.Queries, guildID, itemID uuid.UUID, kind, source string, referenceID *uuid.UUID) error {
	if err := qtx.InsertItemEvent(ctx, db.InsertItemEventParams{
		GuildID: guildID, ItemID: itemID, Kind: kind, Source: source, ReferenceID: referenceID,
	}); err != nil {
		return fmt.Errorf("%w: log item event: %v", errs.ErrInternal, err)
	}
	return nil
}

func lockError(err error, what string, exists func() (bool, error)) error {
	if !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("%w: lock %s: %v", errs.ErrInternal, what, err)
	}
	found, existsErr := exists()
	if existsErr != nil {
		return fmt.Errorf("%w: load %s: %v", errs.ErrInternal, what, existsErr)
	}
	if found {
		return fmt.Errorf("%w: %s is already listed or awaiting delivery", errs.ErrFailedPrecondition, what)
	}
	return fmt.Errorf("%w: %s", errs.ErrNotFound, what)
}
