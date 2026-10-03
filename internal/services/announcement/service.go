package announcement

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/services/pagination"
)

const (
	StatusDraft     = "draft"
	StatusPublished = "published"

	defaultPageSize = 50
	maxPageSize     = 200
)

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
	GuildID       uuid.UUID
	UserID        uuid.UUID
	IncludeDrafts bool
	PageSize      int32
}

type Update struct {
	GuildID        uuid.UUID
	AnnouncementID uuid.UUID
	Title          string
	Content        string
	Pinned         bool
}

type Service struct {
	q      *db.Queries
	az     authz.Checker
	logger zerolog.Logger
}

func New(pool *database.Pool, az authz.Checker, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{q: q, az: az, logger: logger.With().Str("service", "announcement").Logger()}
}

func (s *Service) List(ctx context.Context, p ListParams) ([]*Announcement, error) {
	if err := authz.Require(ctx, s.az, p.GuildID, p.UserID, listPermission(p.IncludeDrafts)); err != nil {
		return nil, err
	}

	rows, err := s.q.ListGuildAnnouncements(ctx, db.ListGuildAnnouncementsParams{
		GuildID:       p.GuildID,
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

func (s *Service) Get(ctx context.Context, guildID, announcementID, userID uuid.UUID) (*Announcement, error) {
	a, err := s.load(ctx, guildID, announcementID)
	if err != nil {
		return nil, err
	}
	if a.Status == StatusDraft {
		if err := authz.RequireOrNotFound(ctx, s.az, guildID, userID, authz.ManageAnnouncements, "announcement"); err != nil {
			return nil, err
		}
	}
	return a, nil
}

func listPermission(includeDrafts bool) authz.Permission {
	if includeDrafts {
		return authz.ManageAnnouncements
	}
	return authz.View
}

func (s *Service) CreateDraft(ctx context.Context, guildID, userID uuid.UUID) (*Announcement, error) {
	id, err := s.q.CreateAnnouncementDraft(ctx, db.CreateAnnouncementDraftParams{GuildID: guildID, AuthorID: userID})
	if err != nil {
		return nil, fmt.Errorf("%w: create announcement draft: %v", errs.ErrInternal, err)
	}
	return s.load(ctx, guildID, id)
}

func (s *Service) Update(ctx context.Context, p Update) (*Announcement, error) {
	guildID, announcementID := p.GuildID, p.AnnouncementID
	n, err := s.q.UpdateAnnouncement(ctx, db.UpdateAnnouncementParams{
		ID:      announcementID,
		GuildID: guildID,
		Title:   p.Title,
		Content: p.Content,
		Pinned:  p.Pinned,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: update announcement: %v", errs.ErrInternal, err)
	}
	a, err := s.load(ctx, guildID, announcementID)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, updateRejection(a)
	}
	return a, nil
}

func (s *Service) Unpublish(ctx context.Context, guildID, announcementID uuid.UUID) (*Announcement, error) {
	n, err := s.q.UnpublishAnnouncement(ctx, db.UnpublishAnnouncementParams{ID: announcementID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: unpublish announcement: %v", errs.ErrInternal, err)
	}
	a, err := s.load(ctx, guildID, announcementID)
	if err != nil {
		return nil, err
	}
	if n == 0 {
		return nil, fmt.Errorf("%w: announcement is not published", errs.ErrFailedPrecondition)
	}
	return a, nil
}

func (s *Service) Publish(ctx context.Context, guildID, announcementID uuid.UUID) (*Announcement, error) {
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

func (s *Service) DeleteDraft(ctx context.Context, guildID, announcementID uuid.UUID) error {
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

func updateRejection(a *Announcement) error {
	if a.Status == StatusPublished {
		return fmt.Errorf("%w: published announcements require a title and content", errs.ErrInvalidArgument)
	}
	return fmt.Errorf("%w: announcement could not be updated", errs.ErrFailedPrecondition)
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

func clampPageSize(size int32) int32 {
	return pagination.Size(size, defaultPageSize, maxPageSize)
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
