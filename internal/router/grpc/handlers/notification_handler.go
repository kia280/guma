package handlers

import (
	"context"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"google.golang.org/protobuf/types/known/structpb"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/ids"
	notificationsvc "github.com/kia280/guma/internal/services/notification"
)

type NotificationHandler struct {
	gumav1.UnimplementedNotificationServiceServer
	svc    *notificationsvc.Service
	logger zerolog.Logger
}

func NewNotificationService(db *database.Pool, logger zerolog.Logger) *NotificationHandler {
	return &NotificationHandler{
		svc:    notificationsvc.New(db, logger),
		logger: logger.With().Str("handler", "notification").Logger(),
	}
}

func (h *NotificationHandler) ListNotifications(ctx context.Context, req *gumav1.ListNotificationsRequest) (*gumav1.ListNotificationsResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}

	result, err := h.svc.List(ctx, notificationsvc.ListParams{
		UserID:     userID,
		UnreadOnly: req.UnreadOnly,
		PageSize:   req.PageSize,
		PageToken:  req.PageToken,
	})
	if err != nil {
		return nil, toStatus(err)
	}

	notifications := make([]*gumav1.Notification, 0, len(result.Notifications))
	for _, n := range result.Notifications {
		notifications = append(notifications, h.notificationToProto(n))
	}
	return &gumav1.ListNotificationsResponse{
		Notifications: notifications,
		NextPageToken: result.NextPageToken,
		TotalCount:    result.TotalCount,
		UnreadCount:   result.UnreadCount,
	}, nil
}

func (h *NotificationHandler) GetUnreadNotificationCount(ctx context.Context, _ *gumav1.GetUnreadNotificationCountRequest) (*gumav1.GetUnreadNotificationCountResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}

	count, err := h.svc.UnreadCount(ctx, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetUnreadNotificationCountResponse{UnreadCount: count}, nil
}

func (h *NotificationHandler) MarkNotificationRead(ctx context.Context, req *gumav1.MarkNotificationReadRequest) (*gumav1.MarkNotificationReadResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct{ NotificationID uuid.UUID }
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	n, err := h.svc.MarkRead(ctx, userID, in.NotificationID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.MarkNotificationReadResponse{Notification: h.notificationToProto(n)}, nil
}

func (h *NotificationHandler) MarkAllNotificationsRead(ctx context.Context, _ *gumav1.MarkAllNotificationsReadRequest) (*gumav1.MarkAllNotificationsReadResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}

	updated, err := h.svc.MarkAllRead(ctx, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.MarkAllNotificationsReadResponse{UpdatedCount: updated}, nil
}

func (h *NotificationHandler) notificationToProto(n *notificationsvc.Notification) *gumav1.Notification {
	params, err := structpb.NewStruct(n.Params)
	if err != nil {
		h.logger.Warn().Err(err).Str("notification_id", n.ID).Msg("dropping unconvertible notification params")
		params = &structpb.Struct{Fields: map[string]*structpb.Value{}}
	}
	return &gumav1.Notification{
		Id:        n.ID,
		Title:     n.Title,
		Message:   n.Message,
		Type:      n.Type,
		Read:      n.Read,
		CreatedAt: timestamppb.New(n.CreatedAt),
		ActionUrl: n.ActionURL,
		Params:    params,
	}
}
