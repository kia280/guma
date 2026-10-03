package handlers

import (
	"context"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	preferencesvc "github.com/kia280/guma/internal/services/preference"
)

func TestNotificationPreferencesToProto(t *testing.T) {
	got := notificationPreferencesToProto(preferencesvc.NotificationPreferences{
		EmailNotifications: true,
		AuctionAlerts:      false,
		RaffleAlerts:       true,
		EventReminders:     false,
		RollCallReminders:  true,
	})
	assert.True(t, got.EmailNotifications)
	assert.False(t, got.AuctionAlerts)
	assert.True(t, got.RaffleAlerts)
	assert.False(t, got.EventReminders)
	assert.True(t, got.RollCallReminders)
}

func TestPreferencesUpdatedAt(t *testing.T) {
	assert.Nil(t, preferencesUpdatedAt(&preferencesvc.Preferences{}))

	updated := time.Date(2026, 9, 25, 10, 0, 0, 0, time.UTC)
	got := preferencesUpdatedAt(&preferencesvc.Preferences{UpdatedAt: updated})
	require.NotNil(t, got)
	assert.True(t, got.AsTime().Equal(updated))
}

func TestPreferenceService_RequiresCaller(t *testing.T) {
	h := NewPreferenceService(nil, zerolog.Nop())
	_, err := h.GetMyPreferences(context.Background(), &gumav1.GetMyPreferencesRequest{})
	requireCode(t, err, codes.Unauthenticated)
	_, err = h.UpdateMyPreferences(context.Background(), &gumav1.UpdateMyPreferencesRequest{})
	requireCode(t, err, codes.Unauthenticated)
}
