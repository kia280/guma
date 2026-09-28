package rollcalltemplate

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	itemEntity           = "item template"
	maxDescriptionLength = 500
)

var (
	itemCategories = []string{"weapon", "armor", "accessory", "consumable", "skill_scroll", "material", "misc"}
	itemRarities   = []string{"common", "uncommon", "rare", "epic", "legendary", "mythic"}
)

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
	logger zerolog.Logger
}

func NewItemService(pool *database.Pool, logger zerolog.Logger) *ItemService {
	return newItemService(newStore(pool), logger)
}

func newItemService(q store, logger zerolog.Logger) *ItemService {
	return &ItemService{q: q, logger: logger.With().Str("service", "itemtemplate").Logger()}
}

func (s *ItemService) List(ctx context.Context, guildIDStr, userIDStr string) ([]*ItemTemplate, error) {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	if err := requireManager(ctx, s.q, guildID, userID); err != nil {
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
	f, err := normalizeItemFields(f)
	if err != nil {
		return nil, err
	}
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	if err := requireManager(ctx, s.q, guildID, userID); err != nil {
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
	f, err := normalizeItemFields(f)
	if err != nil {
		return nil, err
	}
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	templateID, err := uuid.Parse(templateIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", errs.ErrNotFound, itemEntity)
	}
	if err := requireManager(ctx, s.q, guildID, userID); err != nil {
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
	if err := requireManager(ctx, s.q, guildID, userID); err != nil {
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

func normalizeItemFields(f ItemFields) (ItemFields, error) {
	name, err := requiredText("name", f.Name, maxNameLength)
	if err != nil {
		return ItemFields{}, err
	}
	description := strings.TrimSpace(f.Description)
	if utf8.RuneCountInString(description) > maxDescriptionLength {
		return ItemFields{}, fmt.Errorf("%w: description must be at most %d characters", errs.ErrInvalidArgument, maxDescriptionLength)
	}
	category := strings.ToLower(strings.TrimSpace(f.Category))
	if !slices.Contains(itemCategories, category) {
		return ItemFields{}, fmt.Errorf("%w: category must be one of %v", errs.ErrInvalidArgument, itemCategories)
	}
	rarity := strings.ToLower(strings.TrimSpace(f.Rarity))
	if !slices.Contains(itemRarities, rarity) {
		return ItemFields{}, fmt.Errorf("%w: rarity must be one of %v", errs.ErrInvalidArgument, itemRarities)
	}
	return ItemFields{Name: name, Description: description, Category: category, Rarity: rarity}, nil
}

func toItemTemplate(r db.ItemTemplate) *ItemTemplate {
	return &ItemTemplate{
		ID: r.ID.String(), GuildID: r.GuildID.String(),
		Name: r.Name, Description: r.Description, Category: r.Category, Rarity: r.Rarity,
		CreatedBy: r.CreatedBy.String(), CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
}
