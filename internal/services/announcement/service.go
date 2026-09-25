package announcement

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	StatusDraft     = "draft"
	StatusPublished = "published"

	defaultPageSize = 50
	maxPageSize     = 200

	maxTitleLength   = 200
	maxContentLength = 20000
)

var managerRoles = []string{"owner", "admin", "moderator"}

type Announcement struct {
	ID          string
	GuildID     string
	AuthorID    string
	AuthorName  string
	Title       string
	Content     string
	Pinned      bool
	Status      string
	PublishedAt *time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type ListParams struct {
	GuildID       string
	UserID        string
	IncludeDrafts bool
	PageSize      int32
}

type DraftUpdate struct {
	GuildID        string
	AnnouncementID string
	UserID         string
	Title          string
	Content        string
	Pinned         bool
}

type Service struct {
	q      *db.Queries
	logger zerolog.Logger
}

func New(pool *database.Pool, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{q: q, logger: logger.With().Str("service", "announcement").Logger()}
}

func (s *Service) List(ctx context.Context, p ListParams) ([]*Announcement, error) {
	guildID, userID, err := parseGuildAndUser(p.GuildID, p.UserID)
	if err != nil {
		return nil, err
	}
	roles := []string(nil)
	if p.IncludeDrafts {
		roles = managerRoles
	}
	if err := s.requireRole(ctx, guildID, userID, roles...); err != nil {
		return nil, err
	}

	rows, err := s.q.ListGuildAnnouncements(ctx, db.ListGuildAnnouncementsParams{
		GuildID:       guildID,
		IncludeDrafts: p.IncludeDrafts,
		PageSize:      clampPageSize(p.PageSize),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list announcements: %v", errs.ErrInternal, err)
	}
	out := make([]*Announcement, 0, len(rows))
	for _, r := range rows {
		out = append(out, toAnnouncement(db.GetAnnouncementRow(r)))
	}
	return out, nil
}

func (s *Service) Get(ctx context.Context, guildIDStr, announcementIDStr, userIDStr string) (*Announcement, error) {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	announcementID, err := parseAnnouncementID(announcementIDStr)
	if err != nil {
		return nil, err
	}
	if err := s.requireRole(ctx, guildID, userID); err != nil {
		return nil, err
	}

	a, err := s.load(ctx, guildID, announcementID)
	if err != nil {
		return nil, err
	}
	if a.Status == StatusDraft {
		if err := s.requireRole(ctx, guildID, userID, managerRoles...); err != nil {
			return nil, fmt.Errorf("%w: announcement", errs.ErrNotFound)
		}
	}
	return a, nil
}

func (s *Service) CreateDraft(ctx context.Context, guildIDStr, userIDStr string) (*Announcement, error) {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	if err := s.requireRole(ctx, guildID, userID, managerRoles...); err != nil {
		return nil, err
	}

	id, err := s.q.CreateAnnouncementDraft(ctx, db.CreateAnnouncementDraftParams{GuildID: guildID, AuthorID: userID})
	if err != nil {
		return nil, fmt.Errorf("%w: create announcement draft: %v", errs.ErrInternal, err)
	}
	return s.load(ctx, guildID, id)
}

func (s *Service) UpdateDraft(ctx context.Context, p DraftUpdate) (*Announcement, error) {
	guildID, userID, err := parseGuildAndUser(p.GuildID, p.UserID)
	if err != nil {
		return nil, err
	}
	announcementID, err := parseAnnouncementID(p.AnnouncementID)
	if err != nil {
		return nil, err
	}
	if err := validateDraft(p.Title, p.Content); err != nil {
		return nil, err
	}
	if err := s.requireRole(ctx, guildID, userID, managerRoles...); err != nil {
		return nil, err
	}

	n, err := s.q.UpdateAnnouncementDraft(ctx, db.UpdateAnnouncementDraftParams{
		ID:      announcementID,
		GuildID: guildID,
		Title:   p.Title,
		Content: p.Content,
		Pinned:  p.Pinned,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: update announcement draft: %v", errs.ErrInternal, err)
	}
	a, err := s.load(ctx, guildID, announcementID)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, fmt.Errorf("%w: only drafts can be edited", errs.ErrFailedPrecondition)
	}
	return a, nil
}

func (s *Service) Publish(ctx context.Context, guildIDStr, announcementIDStr, userIDStr string) (*Announcement, error) {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return nil, err
	}
	announcementID, err := parseAnnouncementID(announcementIDStr)
	if err != nil {
		return nil, err
	}
	if err := s.requireRole(ctx, guildID, userID, managerRoles...); err != nil {
		return nil, err
	}

	n, err := s.q.PublishAnnouncement(ctx, db.PublishAnnouncementParams{ID: announcementID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: publish announcement: %v", errs.ErrInternal, err)
	}
	a, err := s.load(ctx, guildID, announcementID)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, publishRejection(a)
	}
	return a, nil
}

func (s *Service) DeleteDraft(ctx context.Context, guildIDStr, announcementIDStr, userIDStr string) error {
	guildID, userID, err := parseGuildAndUser(guildIDStr, userIDStr)
	if err != nil {
		return err
	}
	announcementID, err := parseAnnouncementID(announcementIDStr)
	if err != nil {
		return err
	}
	if err := s.requireRole(ctx, guildID, userID, managerRoles...); err != nil {
		return err
	}

	n, err := s.q.DeleteAnnouncementDraft(ctx, db.DeleteAnnouncementDraftParams{ID: announcementID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: delete announcement draft: %v", errs.ErrInternal, err)
	}
	if n > 0 {
		return nil
	}
	if _, err := s.load(ctx, guildID, announcementID); err != nil {
		return err
	}
	return fmt.Errorf("%w: only drafts can be deleted", errs.ErrFailedPrecondition)
}

func (s *Service) load(ctx context.Context, guildID, announcementID uuid.UUID) (*Announcement, error) {
	row, err := s.q.GetAnnouncement(ctx, db.GetAnnouncementParams{ID: announcementID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: announcement", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: load announcement: %v", errs.ErrInternal, err)
	}
	return toAnnouncement(row), nil
}

func (s *Service) requireRole(ctx context.Context, guildID, userID uuid.UUID, roles ...string) error {
	role, err := s.q.GetGuildMemberRole(ctx, db.GetGuildMemberRoleParams{GuildID: guildID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: not a member of this guild", errs.ErrPermissionDenied)
		}
		return fmt.Errorf("%w: load member role: %v", errs.ErrInternal, err)
	}
	return checkRole(role, roles)
}

func checkRole(role string, allowed []string) error {
	if len(allowed) == 0 || slices.Contains(allowed, role) {
		return nil
	}
	return fmt.Errorf("%w: requires role %v", errs.ErrPermissionDenied, allowed)
}

func publishRejection(a *Announcement) error {
	if a.Status != StatusDraft {
		return fmt.Errorf("%w: announcement is already published", errs.ErrFailedPrecondition)
	}
	if strings.TrimSpace(a.Title) == "" || strings.TrimSpace(a.Content) == "" {
		return fmt.Errorf("%w: title and content are required to publish", errs.ErrFailedPrecondition)
	}
	return fmt.Errorf("%w: announcement could not be published", errs.ErrFailedPrecondition)
}

func validateDraft(title, content string) error {
	if utf8.RuneCountInString(title) > maxTitleLength {
		return fmt.Errorf("%w: title must be at most %d characters", errs.ErrInvalidArgument, maxTitleLength)
	}
	if utf8.RuneCountInString(content) > maxContentLength {
		return fmt.Errorf("%w: content must be at most %d characters", errs.ErrInvalidArgument, maxContentLength)
	}
	return nil
}

func parseGuildAndUser(guildIDStr, userIDStr string) (uuid.UUID, uuid.UUID, error) {
	if userIDStr == "" {
		return uuid.Nil, uuid.Nil, errs.ErrUnauthenticated
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("%w: guild_id must be a UUID", errs.ErrInvalidArgument)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("%w: user id must be a UUID", errs.ErrInvalidArgument)
	}
	return guildID, userID, nil
}

func parseAnnouncementID(raw string) (uuid.UUID, error) {
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, fmt.Errorf("%w: announcement_id must be a UUID", errs.ErrInvalidArgument)
	}
	return id, nil
}

func clampPageSize(size int32) int32 {
	if size <= 0 {
		return defaultPageSize
	}
	if size > maxPageSize {
		return maxPageSize
	}
	return size
}

func toAnnouncement(r db.GetAnnouncementRow) *Announcement {
	a := &Announcement{
		ID:         r.ID.String(),
		GuildID:    r.GuildID.String(),
		AuthorID:   r.AuthorID.String(),
		AuthorName: r.AuthorName,
		Title:      r.Title,
		Content:    r.Content,
		Pinned:     r.Pinned,
		Status:     r.Status,
		CreatedAt:  r.CreatedAt,
		UpdatedAt:  r.UpdatedAt,
	}
	if r.PublishedAt.Valid {
		t := r.PublishedAt.Time
		a.PublishedAt = &t
	}
	return a
}
