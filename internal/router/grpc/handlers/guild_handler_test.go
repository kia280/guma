package handlers

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/kia280/guma/internal/session"

	guildv1 "github.com/kia280/guma/gen/proto/guma/v1"
)

func TestNewGuildService(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(nil, nil, logger)

	assert.NotNil(t, service)
	assert.NotNil(t, service.logger)
}

func TestGuildService_GuildLogo_Validation(t *testing.T) {
	service := NewGuildService(nil, nil, zerolog.Nop())

	tests := []struct {
		name     string
		call     func() error
		wantCode codes.Code
	}{
		{
			name: "upload rejects unsupported type",
			call: func() error {
				_, err := service.UploadGuildLogo(session.WithUserID(context.Background(), uuid.MustParse("00000000-0000-0000-0000-000000000001")), &guildv1.UploadGuildLogoRequest{
					GuildId:     "00000000-0000-0000-0000-000000000002",
					ContentType: "image/svg+xml",
					Data:        []byte("<svg></svg>"),
				})
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

func TestGuildHandler_RejectsMalformedIDs(t *testing.T) {
	h := NewGuildService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), testUserID)

	tests := []struct {
		name string
		call func() error
	}{
		{name: "get guild", call: func() error {
			_, err := h.GetGuild(authed, &guildv1.GetGuildRequest{GuildId: "bad"})
			return err
		}},
		{name: "get guild logo", call: func() error {
			_, err := h.GetGuildLogo(authed, &guildv1.GetGuildLogoRequest{GuildId: "bad"})
			return err
		}},
		{name: "join guild", call: func() error {
			_, err := h.JoinGuildById(authed, &guildv1.JoinGuildByIdRequest{GuildId: "bad"})
			return err
		}},
		{name: "leave guild", call: func() error {
			_, err := h.LeaveGuild(authed, &guildv1.LeaveGuildRequest{GuildId: "bad"})
			return err
		}},
		{name: "get guild stats", call: func() error {
			_, err := h.GetGuildStats(authed, &guildv1.GetGuildStatsRequest{GuildId: "bad"})
			return err
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requireCode(t, tt.call(), codes.InvalidArgument)
		})
	}
}

func TestGuildHandler_RequiresAuthenticatedUser(t *testing.T) {
	h := NewGuildService(nil, nil, zerolog.Nop())

	_, err := h.CreateGuild(context.Background(), &guildv1.CreateGuildRequest{Name: "guild"})
	requireCode(t, err, codes.Unauthenticated)

	_, err = h.GetCurrentGuild(context.Background(), &guildv1.GetCurrentGuildRequest{})
	requireCode(t, err, codes.Unauthenticated)
}
