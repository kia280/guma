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

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	notificationsvc "github.com/kia280/guma/internal/services/notification"
	"github.com/kia280/guma/internal/session"
)

func TestNotificationService_Validation(t *testing.T) {
	h := NewNotificationService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")

	tests := []struct {
		name     string
		call     func() error
		wantCode codes.Code
	}{
		{
			name: "list bad page token",
			call: func() error {
				_, err := h.ListNotifications(authed, &gumav1.ListNotificationsRequest{PageToken: "x"})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "mark read malformed id",
			call: func() error {
				_, err := h.MarkNotificationRead(authed, &gumav1.MarkNotificationReadRequest{NotificationId: "nope"})
				return err
			},
			wantCode: codes.InvalidArgument,
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

func TestNotificationToProto(t *testing.T) {
	h := NewNotificationService(nil, zerolog.Nop())
	createdAt := time.Date(2026, 9, 1, 12, 0, 0, 0, time.UTC)

	got := h.notificationToProto(&notificationsvc.Notification{
		ID:        "n1",
		Title:     "You have been outbid",
		Message:   "Erin outbid you",
		Type:      "auctionOutbid",
		ActionURL: "/dashboard/auction/a1",
		Params:    map[string]any{"item": "Dragon Slayer Sword", "amount": float64(200)},
		CreatedAt: createdAt,
	})

	assert.Equal(t, "n1", got.Id)
	assert.Equal(t, "auctionOutbid", got.Type)
	assert.Equal(t, "/dashboard/auction/a1", got.ActionUrl)
	assert.False(t, got.Read)
	assert.True(t, got.CreatedAt.AsTime().Equal(createdAt))
	assert.Equal(t, "Dragon Slayer Sword", got.Params.Fields["item"].GetStringValue())
	assert.Equal(t, float64(200), got.Params.Fields["amount"].GetNumberValue())
}

func TestNotificationToProto_DropsUnconvertibleParams(t *testing.T) {
	h := NewNotificationService(nil, zerolog.Nop())
	got := h.notificationToProto(&notificationsvc.Notification{ID: "n1", Params: map[string]any{"bad": make(chan int)}})
	require.NotNil(t, got.Params)
	assert.Empty(t, got.Params.Fields)
}
