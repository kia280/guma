package handlers

import (
	"context"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	preferencesvc "github.com/kia280/guma/internal/services/preference"
)

func TestPreferenceService_Validation(t *testing.T) {
	h := NewPreferenceService(nil, zerolog.Nop())
	anon := context.Background()

	tests := []struct {
		name     string
		call     func() error
		wantCode codes.Code
	}{
		{
			name:     "get unauthenticated",
			call:     func() error { _, err := h.GetMyPreferences(anon, &gumav1.GetMyPreferencesRequest{}); return err },
			wantCode: codes.Unauthenticated,
		},
		{
			name: "update unauthenticated",
			call: func() error {
				_, err := h.UpdateMyPreferences(anon, &gumav1.UpdateMyPreferencesRequest{
					Notifications: &gumav1.NotificationPreferencesPatch{AuctionAlerts: proto.Bool(false)},
				})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.call()
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

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
