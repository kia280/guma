package checkintemplate

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	maxNameLength  = 100
	maxTitleLength = 200
	maxLootItems   = 100
)

var managerRoles = []string{"owner", "admin", "moderator"}

type Template struct {
	ID        string
	GuildID   string
	Name      string
	Title     string
	LootList  []models.Item
	CreatedBy string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type CreateParams struct {
	GuildID  string
	UserID   string
	Name     string
	Title    string
	LootList []models.Item
}

type UpdateParams struct {
	GuildID    string
	TemplateID string
	UserID     string
	Name       string
	Title      string
	LootList   []models.Item
}

type store interface {
	GetGuildMemberRole(ctx context.Context, arg db.GetGuildMemberRoleParams) (string, error)
	ListCheckinTemplates(ctx context.Context, guildID uuid.UUID) ([]db.CheckinTemplate, error)
	CreateCheckinTemplate(ctx context.Context, arg db.CreateCheckinTemplateParams) (db.CheckinTemplate, error)
	UpdateCheckinTemplate(ctx context.Context, arg db.UpdateCheckinTemplateParams) (db.CheckinTemplate, error)
	DeleteCheckinTemplate(ctx context.Context, arg db.DeleteCheckinTemplateParams) (int64, error)
}

type Service struct {
	q      store
	logger zerolog.Logger
}

func New(pool *database.Pool, logger zerolog.Logger) *Service {
	var q store
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return newService(q, logger)
}

func newService(q store, logger zerolog.Logger) *Service {
	return &Service{
		q:      q,
		logger: logger.With().Str("service", "checkintemplate").Logger(),
	}
}

func (s *Service) List(ctx context.Context, guildIDStr, userIDStr string) ([]*Template, error) {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	if err := s.requireManager(ctx, guildID, userID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListCheckinTemplates(ctx, guildID)
	if err != nil {
		return nil, fmt.Errorf("%w: list checkin templates: %v", errs.ErrInternal, err)
	}
	templates := make([]*Template, 0, len(rows))
	for _, r := range rows {
		templates = append(templates, toTemplate(r))
	}
	return templates, nil
}

func (s *Service) Create(ctx context.Context, p CreateParams) (*Template, error) {
	name, title, loot, err := normalizeFields(p.Name, p.Title, p.LootList)
	if err != nil {
		return nil, err
	}
	guildID, userID, err := parseGuildAndUser(p.GuildID, p.UserID)
	if err != nil {
		return nil, err
	}
	if err := s.requireManager(ctx, guildID, userID); err != nil {
		return nil, err
	}
	lootJSON, err := json.Marshal(loot)
	if err != nil {
		return nil, fmt.Errorf("%w: encode loot: %v", errs.ErrInternal, err)
	}
	r, err := s.q.CreateCheckinTemplate(ctx, db.CreateCheckinTemplateParams{
		GuildID: guildID, CreatedBy: userID, Name: name, Title: title, LootList: lootJSON,
	})
	if err != nil {
		return nil, writeError(err)
	}
	s.logger.Info().Str("template_id", r.ID.String()).Str("guild_id", p.GuildID).Msg("checkin template created")
	return toTemplate(r), nil
}

func (s *Service) Update(ctx context.Context, p UpdateParams) (*Template, error) {
	name, title, loot, err := normalizeFields(p.Name, p.Title, p.LootList)
	if err != nil {
		return nil, err
	}
	guildID, userID, err := parseGuildAndUser(p.GuildID, p.UserID)
	if err != nil {
		return nil, err
	}
	templateID, err := uuid.Parse(p.TemplateID)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin template", errs.ErrNotFound)
	}
	if err := s.requireManager(ctx, guildID, userID); err != nil {
		return nil, err
	}
	lootJSON, err := json.Marshal(loot)
	if err != nil {
		return nil, fmt.Errorf("%w: encode loot: %v", errs.ErrInternal, err)
	}
	r, err := s.q.UpdateCheckinTemplate(ctx, db.UpdateCheckinTemplateParams{
		ID: templateID, GuildID: guildID, Name: name, Title: title, LootList: lootJSON,
	})
	if err != nil {
		return nil, writeError(err)
	}
	return toTemplate(r), nil
}

func (s *Service) Delete(ctx context.Context, guildIDStr, templateIDStr, userIDStr string) error {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return err
	}
	templateID, err := uuid.Parse(templateIDStr)
	if err != nil {
		return fmt.Errorf("%w: checkin template", errs.ErrNotFound)
	}
	if err := s.requireManager(ctx, guildID, userID); err != nil {
		return err
	}
	n, err := s.q.DeleteCheckinTemplate(ctx, db.DeleteCheckinTemplateParams{ID: templateID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: delete checkin template: %v", errs.ErrInternal, err)
	}
	if n == 0 {
		return fmt.Errorf("%w: checkin template", errs.ErrNotFound)
	}
	return nil
}

func (s *Service) requireManager(ctx context.Context, guildID, userID uuid.UUID) error {
	role, err := s.q.GetGuildMemberRole(ctx, db.GetGuildMemberRoleParams{GuildID: guildID, UserID: userID})
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

func normalizeFields(name, title string, loot []models.Item) (string, string, []models.Item, error) {
	name = strings.TrimSpace(name)
	title = strings.TrimSpace(title)
	switch {
	case name == "":
		return "", "", nil, fmt.Errorf("%w: name is required", errs.ErrInvalidArgument)
	case utf8.RuneCountInString(name) > maxNameLength:
		return "", "", nil, fmt.Errorf("%w: name must be at most %d characters", errs.ErrInvalidArgument, maxNameLength)
	case title == "":
		return "", "", nil, fmt.Errorf("%w: title is required", errs.ErrInvalidArgument)
	case utf8.RuneCountInString(title) > maxTitleLength:
		return "", "", nil, fmt.Errorf("%w: title must be at most %d characters", errs.ErrInvalidArgument, maxTitleLength)
	case len(loot) > maxLootItems:
		return "", "", nil, fmt.Errorf("%w: loot list must have at most %d items", errs.ErrInvalidArgument, maxLootItems)
	}
	items := make([]models.Item, 0, len(loot))
	for _, item := range loot {
		item.Name = strings.TrimSpace(item.Name)
		if item.Name == "" {
			return "", "", nil, fmt.Errorf("%w: loot item name is required", errs.ErrInvalidArgument)
		}
		items = append(items, item)
	}
	return name, title, items, nil
}

func writeError(err error) error {
	var pgErr *pgconn.PgError
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return fmt.Errorf("%w: checkin template", errs.ErrNotFound)
	case errors.As(err, &pgErr) && pgErr.Code == "23505":
		return fmt.Errorf("%w: a template with this name already exists", errs.ErrAlreadyExists)
	}
	return fmt.Errorf("%w: save checkin template: %v", errs.ErrInternal, err)
}

func toTemplate(r db.CheckinTemplate) *Template {
	t := &Template{
		ID: r.ID.String(), GuildID: r.GuildID.String(),
		Name: r.Name, Title: r.Title, CreatedBy: r.CreatedBy.String(),
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
	if len(r.LootList) > 0 {
		_ = json.Unmarshal(r.LootList, &t.LootList)
	}
	if t.LootList == nil {
		t.LootList = []models.Item{}
	}
	return t
}
