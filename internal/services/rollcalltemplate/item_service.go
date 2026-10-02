package rollcalltemplate

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const itemEntity = "item template"

type ItemTemplate struct {
	ID          string
	GuildID     string
	Name        string
	Description string
	Category    string
	Rarity      string
	CreatedBy   string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type ItemFields struct {
	Name        string
	Description string
	Category    string
	Rarity      string
}

type ItemService struct {
	q      store
	az     authz.Checker
	logger zerolog.Logger
}

func NewItemService(pool *database.Pool, az authz.Checker, logger zerolog.Logger) *ItemService {
	return newItemService(newStore(pool), az, logger)
}

func newItemService(q store, az authz.Checker, logger zerolog.Logger) *ItemService {
	return &ItemService{q: q, az: az, logger: logger.With().Str("service", "itemtemplate").Logger()}
}

func (s *ItemService) List(ctx context.Context, guildIDStr, userIDStr string) ([]*ItemTemplate, error) {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageRollCallTemplates); err != nil {
		return nil, err
	}
	rows, err := s.q.ListItemTemplates(ctx, guildID)
	if err != nil {
		return nil, fmt.Errorf("%w: list item templates: %v", errs.ErrInternal, err)
	}
	templates := make([]*ItemTemplate, 0, len(rows))
	for _, r := range rows {
		templates = append(templates, toItemTemplate(r))
	}
	return templates, nil
}

func (s *ItemService) Create(ctx context.Context, guildIDStr, userIDStr string, f ItemFields) (*ItemTemplate, error) {
	f = normalizeItemFields(f)
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageRollCallTemplates); err != nil {
		return nil, err
	}
	r, err := s.q.CreateItemTemplate(ctx, db.CreateItemTemplateParams{
		GuildID: guildID, CreatedBy: userID,
		Name: f.Name, Description: f.Description, Category: f.Category, Rarity: f.Rarity,
	})
	if err != nil {
		return nil, writeError(itemEntity, err)
	}
	s.logger.Info().Str("template_id", r.ID.String()).Str("guild_id", guildIDStr).Msg("item template created")
	return toItemTemplate(r), nil
}

func (s *ItemService) Update(ctx context.Context, guildIDStr, templateIDStr, userIDStr string, f ItemFields) (*ItemTemplate, error) {
	f = normalizeItemFields(f)
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	templateID, err := uuid.Parse(templateIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", errs.ErrNotFound, itemEntity)
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageRollCallTemplates); err != nil {
		return nil, err
	}
	r, err := s.q.UpdateItemTemplate(ctx, db.UpdateItemTemplateParams{
		ID: templateID, GuildID: guildID,
		Name: f.Name, Description: f.Description, Category: f.Category, Rarity: f.Rarity,
	})
	if err != nil {
		return nil, writeError(itemEntity, err)
	}
	return toItemTemplate(r), nil
}

func (s *ItemService) Delete(ctx context.Context, guildIDStr, templateIDStr, userIDStr string) error {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return err
	}
	templateID, err := uuid.Parse(templateIDStr)
	if err != nil {
		return fmt.Errorf("%w: %s", errs.ErrNotFound, itemEntity)
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageRollCallTemplates); err != nil {
		return err
	}
	n, err := s.q.DeleteItemTemplate(ctx, db.DeleteItemTemplateParams{ID: templateID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: delete item template: %v", errs.ErrInternal, err)
	}
	if n == 0 {
		return fmt.Errorf("%w: %s", errs.ErrNotFound, itemEntity)
	}
	return nil
}

func normalizeItemFields(f ItemFields) ItemFields {
	return ItemFields{
		Name:        strings.TrimSpace(f.Name),
		Description: strings.TrimSpace(f.Description),
		Category:    strings.ToLower(strings.TrimSpace(f.Category)),
		Rarity:      strings.ToLower(strings.TrimSpace(f.Rarity)),
	}
}

func toItemTemplate(r db.ItemTemplate) *ItemTemplate {
	return &ItemTemplate{
		ID: r.ID.String(), GuildID: r.GuildID.String(),
		Name: r.Name, Description: r.Description, Category: r.Category, Rarity: r.Rarity,
		CreatedBy: r.CreatedBy.String(), CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}
