package notification

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	defaultPageSize = 20
	maxPageSize     = 100
)

type Notification struct {
	ID        string
	UserID    string
	Title     string
	Message   string
	Type      string
	Read      bool
	ActionURL string
	Params    map[string]any
	CreatedAt time.Time
}

type ListParams struct {
	UserID     string
	UnreadOnly bool
	PageSize   int32
	PageToken  string
}

type ListResult struct {
	Notifications []*Notification
	NextPageToken string
	TotalCount    int32
	UnreadCount   int32
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
	return &Service{q: q, logger: logger.With().Str("service", "notification").Logger()}
}

func (s *Service) List(ctx context.Context, p ListParams) (*ListResult, error) {
	userID, err := parseUserID(p.UserID)
	if err != nil {
		return nil, err
	}
	offset, err := parsePageToken(p.PageToken)
	if err != nil {
		return nil, err
	}
	pageSize := clampPageSize(p.PageSize)

	rows, err := s.q.ListUserNotifications(ctx, db.ListUserNotificationsParams{
		UserID:     userID,
		UnreadOnly: p.UnreadOnly,
		PageOffset: offset,
		PageSize:   pageSize,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list notifications: %v", errs.ErrInternal, err)
	}
	total, err := s.q.CountUserNotifications(ctx, db.CountUserNotificationsParams{UserID: userID, UnreadOnly: p.UnreadOnly})
	if err != nil {
		return nil, fmt.Errorf("%w: count notifications: %v", errs.ErrInternal, err)
	}
	unread, err := s.q.CountUnreadNotifications(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("%w: count unread notifications: %v", errs.ErrInternal, err)
	}

	notifications := make([]*Notification, 0, len(rows))
	for _, r := range rows {
		notifications = append(notifications, toNotification(r))
	}

	return &ListResult{
		Notifications: notifications,
		NextPageToken: nextPageToken(offset, int32(len(rows)), pageSize, total),
		TotalCount:    int32(total),
		UnreadCount:   int32(unread),
	}, nil
}

func (s *Service) UnreadCount(ctx context.Context, userIDStr string) (int32, error) {
	userID, err := parseUserID(userIDStr)
	if err != nil {
		return 0, err
	}
	n, err := s.q.CountUnreadNotifications(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("%w: count unread notifications: %v", errs.ErrInternal, err)
	}
	return int32(n), nil
}

func (s *Service) MarkRead(ctx context.Context, userIDStr, notificationIDStr string) (*Notification, error) {
	userID, err := parseUserID(userIDStr)
	if err != nil {
		return nil, err
	}
	notificationID, err := uuid.Parse(notificationIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: notification_id must be a UUID", errs.ErrInvalidArgument)
	}

	r, err := s.q.MarkNotificationRead(ctx, db.MarkNotificationReadParams{ID: notificationID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: notification", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: mark notification read: %v", errs.ErrInternal, err)
	}
	return toNotification(db.ListUserNotificationsRow(r)), nil
}

func (s *Service) MarkAllRead(ctx context.Context, userIDStr string) (int32, error) {
	userID, err := parseUserID(userIDStr)
	if err != nil {
		return 0, err
	}
	n, err := s.q.MarkAllNotificationsRead(ctx, userID)
	if err != nil {
		return 0, fmt.Errorf("%w: mark all notifications read: %v", errs.ErrInternal, err)
	}
	return int32(n), nil
}

func toNotification(r db.ListUserNotificationsRow) *Notification {
	return &Notification{
		ID:        r.ID.String(),
		UserID:    r.UserID.String(),
		Title:     r.Title,
		Message:   r.Message,
		Type:      r.Type,
		Read:      r.Read,
		ActionURL: r.ActionUrl,
		Params:    decodeParams(r.Params),
		CreatedAt: r.CreatedAt,
	}
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

func clampPageSize(size int32) int32 {
	if size <= 0 {
		return defaultPageSize
	}
	if size > maxPageSize {
		return maxPageSize
	}
	return size
}

func parsePageToken(token string) (int32, error) {
	if token == "" {
		return 0, nil
	}
	n, err := strconv.ParseInt(token, 10, 32)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("%w: invalid page_token", errs.ErrInvalidArgument)
	}
	return int32(n), nil
}

func nextPageToken(offset, returned, pageSize int32, total int64) string {
	next := int64(offset) + int64(returned)
	if returned < pageSize || next >= total {
		return ""
	}
	return strconv.FormatInt(next, 10)
}

func decodeParams(raw []byte) map[string]any {
	out := map[string]any{}
	if len(raw) == 0 {
		return out
	}
	if err := json.Unmarshal(raw, &out); err != nil {
		return map[string]any{}
	}
	return out
}
