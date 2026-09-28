package bank

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

type ItemEvent struct {
	ID             string
	Kind           string
	Source         string
	ActorID        string
	ActorName      string
	SubjectID      string
	SubjectName    string
	ReferenceID    string
	ReferenceLabel string
	CreatedAt      time.Time
}

func (s *Service) GetItemHistory(ctx context.Context, guildIDStr, viewerIDStr, itemIDStr string) ([]ItemEvent, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	viewerID, err := uuid.Parse(viewerIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: viewer", errs.ErrInvalidArgument)
	}
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: item", errs.ErrNotFound)
	}
	if err := s.requireRole(ctx, guildID, viewerID); err != nil {
		return nil, err
	}

	if err := s.authorizeItemHistory(ctx, guildID, viewerID, itemID); err != nil {
		return nil, err
	}

	rows, err := s.q.ListItemEvents(ctx, db.ListItemEventsParams{GuildID: guildID, ItemID: itemID})
	if err != nil {
		return nil, fmt.Errorf("%w: list item events: %v", errs.ErrInternal, err)
	}
	events := make([]ItemEvent, 0, len(rows))
	for _, r := range rows {
		events = append(events, ItemEvent{
			ID:             fmt.Sprintf("%d", r.Seq),
			Kind:           r.Kind,
			Source:         r.Source,
			ActorID:        uuidString(r.ActorID),
			ActorName:      r.ActorName,
			SubjectID:      uuidString(r.SubjectID),
			SubjectName:    r.SubjectName,
			ReferenceID:    uuidString(r.ReferenceID),
			ReferenceLabel: r.ReferenceLabel,
			CreatedAt:      r.CreatedAt,
		})
	}
	return events, nil
}

func (s *Service) authorizeItemHistory(ctx context.Context, guildID, viewerID, itemID uuid.UUID) error {
	inBank, err := s.q.BankItemExists(ctx, db.BankItemExistsParams{ID: itemID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: load bank item: %v", errs.ErrInternal, err)
	}
	if inBank {
		return nil
	}

	ownerID, err := s.q.GetBackpackItemOwner(ctx, db.GetBackpackItemOwnerParams{ID: itemID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: item", errs.ErrNotFound)
		}
		return fmt.Errorf("%w: load backpack item: %v", errs.ErrInternal, err)
	}
	if ownerID != viewerID {
		if err := s.requireRole(ctx, guildID, viewerID, reviewerRoles...); err != nil {
			return fmt.Errorf("%w: item", errs.ErrNotFound)
		}
	}
	return nil
}

func uuidString(id *uuid.UUID) string {
	if id == nil {
		return ""
	}
	return id.String()
}
