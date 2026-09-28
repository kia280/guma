package rollcalltemplate

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const maxNameLength = 100

var managerRoles = []string{"owner", "admin", "moderator"}

type store interface {
	GetGuildMemberRole(ctx context.Context, arg db.GetGuildMemberRoleParams) (string, error)
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

func requireManager(ctx context.Context, q store, guildID, userID uuid.UUID) error {
	role, err := q.GetGuildMemberRole(ctx, db.GetGuildMemberRoleParams{GuildID: guildID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: not a member of this guild", errs.ErrPermissionDenied)
		}
		return fmt.Errorf("%w: get member role: %v", errs.ErrInternal, err)
	}
	if slices.Contains(managerRoles, role) {
		return nil
	}
	return fmt.Errorf("%w: requires role %v", errs.ErrPermissionDenied, managerRoles)
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

func requiredText(field, value string, maxLength int) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("%w: %s is required", errs.ErrInvalidArgument, field)
	}
	if utf8.RuneCountInString(value) > maxLength {
		return "", fmt.Errorf("%w: %s must be at most %d characters", errs.ErrInvalidArgument, field, maxLength)
	}
	return value, nil
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
