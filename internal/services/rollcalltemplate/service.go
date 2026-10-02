package rollcalltemplate

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

const rollCallTemplateEntity = "roll call template"

type Template struct {
	ID        string
	GuildID   string
	Name      string
	Title     string
	Items     []models.Item
	CreatedBy string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Fields struct {
	Name            string
	Title           string
	ItemTemplateIDs []string
}

type Service struct {
	q      store
	az     authz.Checker
	logger zerolog.Logger
}

func New(pool *database.Pool, az authz.Checker, logger zerolog.Logger) *Service {
	return newService(newStore(pool), az, logger)
}

func newService(q store, az authz.Checker, logger zerolog.Logger) *Service {
	return &Service{q: q, az: az, logger: logger.With().Str("service", "rollcalltemplate").Logger()}
}

func (s *Service) List(ctx context.Context, guildIDStr, userIDStr string) ([]*Template, error) {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageRollCallTemplates); err != nil {
		return nil, err
	}
	rows, err := s.q.ListRollCallTemplates(ctx, guildID)
	if err != nil {
		return nil, fmt.Errorf("%w: list roll call templates: %v", errs.ErrInternal, err)
	}
	templates := make([]*Template, 0, len(rows))
	for _, r := range rows {
		templates = append(templates, toTemplate(db.GetRollCallTemplateRow(r)))
	}
	return templates, nil
}

func (s *Service) Create(ctx context.Context, guildIDStr, userIDStr string, f Fields) (*Template, error) {
	name, title, itemIDs, err := normalizeFields(f)
	if err != nil {
		return nil, err
	}
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageRollCallTemplates); err != nil {
		return nil, err
	}
	if err := s.requireGuildItems(ctx, guildID, itemIDs); err != nil {
		return nil, err
	}
	id, err := s.q.CreateRollCallTemplate(ctx, db.CreateRollCallTemplateParams{
		GuildID: guildID, CreatedBy: userID, Name: name, Title: title, ItemTemplateIds: itemIDs,
	})
	if err != nil {
		return nil, writeError(rollCallTemplateEntity, err)
	}
	s.logger.Info().Str("template_id", id.String()).Str("guild_id", guildIDStr).Msg("roll call template created")
	return s.get(ctx, guildID, id)
}

func (s *Service) Update(ctx context.Context, guildIDStr, templateIDStr, userIDStr string, f Fields) (*Template, error) {
	name, title, itemIDs, err := normalizeFields(f)
	if err != nil {
		return nil, err
	}
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	templateID, err := uuid.Parse(templateIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: %s", errs.ErrNotFound, rollCallTemplateEntity)
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageRollCallTemplates); err != nil {
		return nil, err
	}
	if err := s.requireGuildItems(ctx, guildID, itemIDs); err != nil {
		return nil, err
	}
	id, err := s.q.UpdateRollCallTemplate(ctx, db.UpdateRollCallTemplateParams{
		ID: templateID, GuildID: guildID, Name: name, Title: title, ItemTemplateIds: itemIDs,
	})
	if err != nil {
		return nil, writeError(rollCallTemplateEntity, err)
	}
	return s.get(ctx, guildID, id)
}

func (s *Service) Delete(ctx context.Context, guildIDStr, templateIDStr, userIDStr string) error {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return err
	}
	templateID, err := uuid.Parse(templateIDStr)
	if err != nil {
		return fmt.Errorf("%w: %s", errs.ErrNotFound, rollCallTemplateEntity)
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageRollCallTemplates); err != nil {
		return err
	}
	n, err := s.q.DeleteRollCallTemplate(ctx, db.DeleteRollCallTemplateParams{ID: templateID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: delete roll call template: %v", errs.ErrInternal, err)
	}
	if n == 0 {
		return fmt.Errorf("%w: %s", errs.ErrNotFound, rollCallTemplateEntity)
	}
	return nil
}

func (s *Service) get(ctx context.Context, guildID, templateID uuid.UUID) (*Template, error) {
	r, err := s.q.GetRollCallTemplate(ctx, db.GetRollCallTemplateParams{ID: templateID, GuildID: guildID})
	if err != nil {
		return nil, writeError(rollCallTemplateEntity, err)
	}
	return toTemplate(r), nil
}

func (s *Service) requireGuildItems(ctx context.Context, guildID uuid.UUID, itemIDs []uuid.UUID) error {
	distinct := make([]uuid.UUID, 0, len(itemIDs))
	seen := make(map[uuid.UUID]bool, len(itemIDs))
	for _, id := range itemIDs {
		if !seen[id] {
			seen[id] = true
			distinct = append(distinct, id)
		}
	}
	if len(distinct) == 0 {
		return nil
	}
	n, err := s.q.CountGuildItemTemplates(ctx, db.CountGuildItemTemplatesParams{GuildID: guildID, Ids: distinct})
	if err != nil {
		return fmt.Errorf("%w: count item templates: %v", errs.ErrInternal, err)
	}
	if n != int64(len(distinct)) {
		return fmt.Errorf("%w: unknown item template", errs.ErrInvalidArgument)
	}
	return nil
}

func normalizeFields(f Fields) (string, string, []uuid.UUID, error) {
	itemIDs := make([]uuid.UUID, 0, len(f.ItemTemplateIDs))
	for _, raw := range f.ItemTemplateIDs {
		id, err := uuid.Parse(raw)
		if err != nil {
			return "", "", nil, fmt.Errorf("%w: item template id", errs.ErrInvalidArgument)
		}
		itemIDs = append(itemIDs, id)
	}
	return strings.TrimSpace(f.Name), strings.TrimSpace(f.Title), itemIDs, nil
}

func toTemplate(r db.GetRollCallTemplateRow) *Template {
	t := &Template{
		ID: r.ID.String(), GuildID: r.GuildID.String(),
		Name: r.Name, Title: r.Title, CreatedBy: r.CreatedBy.String(),
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
	if len(r.Items) > 0 {
		_ = json.Unmarshal(r.Items, &t.Items)
	}
	if t.Items == nil {
		t.Items = []models.Item{}
	}
	return t
}
