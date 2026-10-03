package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	preferencesvc "github.com/kia280/guma/internal/services/preference"
	"github.com/kia280/guma/internal/session"
)

type PreferenceHandler struct {
	gumav1.UnimplementedPreferenceServiceServer
	svc    *preferencesvc.Service
	logger zerolog.Logger
}

func NewPreferenceService(db *database.Pool, logger zerolog.Logger) *PreferenceHandler {
	return &PreferenceHandler{
		svc:    preferencesvc.New(db, logger),
		logger: logger.With().Str("handler", "preference").Logger(),
	}
}

func (h *PreferenceHandler) GetMyPreferences(ctx context.Context, _ *gumav1.GetMyPreferencesRequest) (*gumav1.GetMyPreferencesResponse, error) {
	userID := session.UserIDFromContext(ctx)

	p, err := h.svc.Get(ctx, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetMyPreferencesResponse{
		Notifications: notificationPreferencesToProto(p.Notifications),
		UpdatedAt:     preferencesUpdatedAt(p),
	}, nil
}

func (h *PreferenceHandler) UpdateMyPreferences(ctx context.Context, req *gumav1.UpdateMyPreferencesRequest) (*gumav1.UpdateMyPreferencesResponse, error) {
	userID := session.UserIDFromContext(ctx)
	p, err := h.svc.UpdateNotifications(ctx, userID, preferencesvc.NotificationPatch{
		EmailNotifications: req.Notifications.EmailNotifications,
		AuctionAlerts:      req.Notifications.AuctionAlerts,
		RaffleAlerts:       req.Notifications.RaffleAlerts,
		EventReminders:     req.Notifications.EventReminders,
		RollCallReminders:  req.Notifications.RollCallReminders,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateMyPreferencesResponse{
		Notifications: notificationPreferencesToProto(p.Notifications),
		UpdatedAt:     preferencesUpdatedAt(p),
	}, nil
}

func notificationPreferencesToProto(n preferencesvc.NotificationPreferences) *gumav1.NotificationPreferences {
	return &gumav1.NotificationPreferences{
		EmailNotifications: n.EmailNotifications,
		AuctionAlerts:      n.AuctionAlerts,
		RaffleAlerts:       n.RaffleAlerts,
		EventReminders:     n.EventReminders,
		RollCallReminders:  n.RollCallReminders,
	}
}

func preferencesUpdatedAt(p *preferencesvc.Preferences) *timestamppb.Timestamp {
	if p.UpdatedAt.IsZero() {
		return nil
	}
	return timestamppb.New(p.UpdatedAt)
}
