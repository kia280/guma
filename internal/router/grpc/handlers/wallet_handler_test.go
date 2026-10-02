package handlers

import (
	"context"
	"os"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

func TestWalletHandler_GetBalanceTrend_Validation(t *testing.T) {
	handler := NewWalletService(nil, zerolog.New(os.Stdout))

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.GetBalanceTrendRequest
		wantCode codes.Code
	}{
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &gumav1.GetBalanceTrendRequest{GuildId: "3f1d0a52-9a2e-4c0e-8f4b-0c5a0f6f2a11"},
			wantCode: codes.Unauthenticated,
		},
		{
			name:     "malformed guild_id",
			ctx:      session.WithUserID(context.Background(), "3f1d0a52-9a2e-4c0e-8f4b-0c5a0f6f2a11"),
			req:      &gumav1.GetBalanceTrendRequest{GuildId: "not-a-uuid"},
			wantCode: codes.InvalidArgument,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := handler.GetBalanceTrend(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}
