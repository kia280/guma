package preference

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const foreignKeyViolation = "23503"

type NotificationPreferences struct {
	EmailNotifications bool
	AuctionAlerts      bool
	LotteryAlerts      bool
	EventReminders     bool
	CheckinReminders   bool
}

type Preferences struct {
	Notifications NotificationPreferences
	UpdatedAt     time.Time
}

type NotificationPatch struct {
	EmailNotifications *bool
	AuctionAlerts      *bool
	LotteryAlerts      *bool
	EventReminders     *bool
	CheckinReminders   *bool
}

func (p NotificationPatch) IsEmpty() bool {
	return p.EmailNotifications == nil &&
		p.AuctionAlerts == nil &&
		p.LotteryAlerts == nil &&
		p.EventReminders == nil &&
		p.CheckinReminders == nil
}

var DefaultNotifications = NotificationPreferences{
	EmailNotifications: true,
	AuctionAlerts:      true,
	LotteryAlerts:      true,
	EventReminders:     false,
	CheckinReminders:   true,
}

type store interface {
	GetNotificationPreferences(ctx context.Context, userID uuid.UUID) (db.GetNotificationPreferencesRow, error)
	UpsertNotificationPreferences(ctx context.Context, arg db.UpsertNotificationPreferencesParams) (db.UpsertNotificationPreferencesRow, error)
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
	return &Service{q: q, logger: logger.With().Str("service", "preference").Logger()}
}

func (s *Service) Get(ctx context.Context, userIDStr string) (*Preferences, error) {
	userID, err := parseUserID(userIDStr)
	if err != nil {
		return nil, err
	}

	row, err := s.q.GetNotificationPreferences(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return &Preferences{Notifications: DefaultNotifications}, nil
		}
		return nil, fmt.Errorf("%w: get preferences: %v", errs.ErrInternal, err)
	}
	return &Preferences{
		Notifications: NotificationPreferences{
			EmailNotifications: row.EmailNotifications,
			AuctionAlerts:      row.AuctionAlerts,
			LotteryAlerts:      row.LotteryAlerts,
			EventReminders:     row.EventReminders,
			CheckinReminders:   row.CheckinReminders,
		},
		UpdatedAt: row.UpdatedAt,
	}, nil
}

func (s *Service) UpdateNotifications(ctx context.Context, userIDStr string, patch NotificationPatch) (*Preferences, error) {
	userID, err := parseUserID(userIDStr)
	if err != nil {
		return nil, err
	}
	if patch.IsEmpty() {
		return nil, fmt.Errorf("%w: no notification preferences to update", errs.ErrInvalidArgument)
	}

	row, err := s.q.UpsertNotificationPreferences(ctx, db.UpsertNotificationPreferencesParams{
		UserID:             userID,
		EmailNotifications: optionalBool(patch.EmailNotifications),
		AuctionAlerts:      optionalBool(patch.AuctionAlerts),
		LotteryAlerts:      optionalBool(patch.LotteryAlerts),
		EventReminders:     optionalBool(patch.EventReminders),
		CheckinReminders:   optionalBool(patch.CheckinReminders),
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == foreignKeyViolation {
			return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: update preferences: %v", errs.ErrInternal, err)
	}
	return &Preferences{
		Notifications: NotificationPreferences{
			EmailNotifications: row.EmailNotifications,
			AuctionAlerts:      row.AuctionAlerts,
			LotteryAlerts:      row.LotteryAlerts,
			EventReminders:     row.EventReminders,
			CheckinReminders:   row.CheckinReminders,
		},
		UpdatedAt: row.UpdatedAt,
	}, nil
}

func parseUserID(raw string) (uuid.UUID, error) {
	if raw == "" {
		return uuid.Nil, errs.ErrUnauthenticated
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, fmt.Errorf("%w: user id must be a UUID", errs.ErrInvalidArgument)
	}
	return id, nil
}

func optionalBool(v *bool) pgtype.Bool {
	if v == nil {
		return pgtype.Bool{}
	}
	return pgtype.Bool{Bool: *v, Valid: true}
}
