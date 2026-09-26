package handlers

import (
	"context"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

func TestCancelCheckIn_Validation(t *testing.T) {
	h := NewCheckInService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const checkinID = "00000000-0000-0000-0000-000000000003"

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.CancelCheckInRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: &gumav1.CancelCheckInRequest{CheckinId: checkinID}, wantCode: codes.InvalidArgument},
		{name: "missing checkin", ctx: authed, req: &gumav1.CancelCheckInRequest{GuildId: guildID}, wantCode: codes.InvalidArgument},
		{name: "unauthenticated", ctx: context.Background(), req: &gumav1.CancelCheckInRequest{GuildId: guildID, CheckinId: checkinID}, wantCode: codes.Unauthenticated},
		{name: "malformed checkin id", ctx: authed, req: &gumav1.CancelCheckInRequest{GuildId: guildID, CheckinId: "bad"}, wantCode: codes.NotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.CancelCheckIn(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}
