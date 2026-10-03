package rollcalltemplate

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

type store interface {
	ListRollCallTemplates(ctx context.Context, guildID uuid.UUID) ([]db.ListRollCallTemplatesRow, error)
	GetRollCallTemplate(ctx context.Context, arg db.GetRollCallTemplateParams) (db.GetRollCallTemplateRow, error)
	CreateRollCallTemplate(ctx context.Context, arg db.CreateRollCallTemplateParams) (uuid.UUID, error)
	UpdateRollCallTemplate(ctx context.Context, arg db.UpdateRollCallTemplateParams) (uuid.UUID, error)
	DeleteRollCallTemplate(ctx context.Context, arg db.DeleteRollCallTemplateParams) (int64, error)
	ListItemTemplates(ctx context.Context, guildID uuid.UUID) ([]db.ItemTemplate, error)
	CreateItemTemplate(ctx context.Context, arg db.CreateItemTemplateParams) (db.ItemTemplate, error)
	UpdateItemTemplate(ctx context.Context, arg db.UpdateItemTemplateParams) (db.ItemTemplate, error)
	DeleteItemTemplate(ctx context.Context, arg db.DeleteItemTemplateParams) (int64, error)
	CountGuildItemTemplates(ctx context.Context, arg db.CountGuildItemTemplatesParams) (int64, error)
}

func newStore(pool *database.Pool) store {
	if pool == nil {
		return nil
	}
	return db.New(pool.Pool)
}

func parseGuildAndUser(guildIDStr, userIDStr string) (uuid.UUID, uuid.UUID, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	return guildID, userID, nil
}

func writeError(entity string, err error) error {
	var pgErr *pgconn.PgError
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return fmt.Errorf("%w: %s", errs.ErrNotFound, entity)
	case errors.As(err, &pgErr) && pgErr.Code == "23505":
		return fmt.Errorf("%w: %s name is already taken", errs.ErrAlreadyExists, entity)
	}
	return fmt.Errorf("%w: save %s: %v", errs.ErrInternal, entity, err)
}
