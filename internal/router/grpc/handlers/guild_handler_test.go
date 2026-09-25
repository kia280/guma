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

	"github.com/kia280/guma/internal/session"

	guildv1 "github.com/kia280/guma/gen/proto/guma/v1"
)

func TestNewGuildService(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(nil, logger)

	assert.NotNil(t, service)
	assert.NotNil(t, service.logger)
}

func TestGuildService_CreateGuild_Validation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.CreateGuildRequest
		wantCode codes.Code
	}{
		{
			name:     "missing guild name",
			ctx:      session.WithUserID(context.Background(), "test-user"),
			req:      &guildv1.CreateGuildRequest{},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &guildv1.CreateGuildRequest{Name: "Test Guild"},
			wantCode: codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.CreateGuild(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestGuildService_GetGuild_Validation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.GetGuildRequest
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      session.WithUserID(context.Background(), "test-user"),
			req:      &guildv1.GetGuildRequest{},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &guildv1.GetGuildRequest{GuildId: "guild-123"},
			wantCode: codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.GetGuild(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestGuildService_UpdateGuild_Validation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.UpdateGuildRequest
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      session.WithUserID(context.Background(), "test-user"),
			req:      &guildv1.UpdateGuildRequest{},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &guildv1.UpdateGuildRequest{GuildId: "guild-123", Name: "Updated Guild"},
			wantCode: codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.UpdateGuild(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestGuildService_DeleteGuild_Validation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.DeleteGuildRequest
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      session.WithUserID(context.Background(), "test-user"),
			req:      &guildv1.DeleteGuildRequest{},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &guildv1.DeleteGuildRequest{GuildId: "guild-123"},
			wantCode: codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.DeleteGuild(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestGuildService_ListGuilds_Validation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.ListGuildsRequest
		wantCode codes.Code
	}{
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &guildv1.ListGuildsRequest{},
			wantCode: codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.ListGuilds(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestGuildService_GetGuildSettings_Validation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.GetGuildSettingsRequest
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      session.WithUserID(context.Background(), "test-user"),
			req:      &guildv1.GetGuildSettingsRequest{},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &guildv1.GetGuildSettingsRequest{GuildId: "guild-123"},
			wantCode: codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.GetGuildSettings(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestGuildService_UpdateGuildSettings_Validation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.UpdateGuildSettingsRequest
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      session.WithUserID(context.Background(), "test-user"),
			req:      &guildv1.UpdateGuildSettingsRequest{},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing settings",
			ctx:      session.WithUserID(context.Background(), "test-user"),
			req:      &guildv1.UpdateGuildSettingsRequest{GuildId: "guild-123"},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "missing user_id in context",
			ctx:  context.Background(),
			req: &guildv1.UpdateGuildSettingsRequest{
				GuildId:  "guild-123",
				Settings: &guildv1.GuildSettings{Timezone: "UTC"},
			},
			wantCode: codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.UpdateGuildSettings(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestGuildService_GuildLogo_Validation(t *testing.T) {
	service := NewGuildService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "test-user")

	tests := []struct {
		name     string
		call     func() error
		wantCode codes.Code
	}{
		{
			name: "upload missing guild_id",
			call: func() error {
				_, err := service.UploadGuildLogo(authed, &guildv1.UploadGuildLogoRequest{})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "upload unauthenticated",
			call: func() error {
				_, err := service.UploadGuildLogo(context.Background(), &guildv1.UploadGuildLogoRequest{GuildId: "g"})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "upload rejects unsupported type",
			call: func() error {
				_, err := service.UploadGuildLogo(session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001"), &guildv1.UploadGuildLogoRequest{
					GuildId:     "00000000-0000-0000-0000-000000000002",
					ContentType: "image/svg+xml",
					Data:        []byte("<svg></svg>"),
				})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "delete missing guild_id",
			call: func() error {
				_, err := service.DeleteGuildLogo(authed, &guildv1.DeleteGuildLogoRequest{})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "delete unauthenticated",
			call: func() error {
				_, err := service.DeleteGuildLogo(context.Background(), &guildv1.DeleteGuildLogoRequest{GuildId: "g"})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "get missing guild_id",
			call: func() error {
				_, err := service.GetGuildLogo(authed, &guildv1.GetGuildLogoRequest{})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "get unauthenticated",
			call: func() error {
				_, err := service.GetGuildLogo(context.Background(), &guildv1.GetGuildLogoRequest{GuildId: "g"})
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

func TestGuildService_GetGuildStats_Validation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.GetGuildStatsRequest
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      session.WithUserID(context.Background(), "test-user"),
			req:      &guildv1.GetGuildStatsRequest{},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &guildv1.GetGuildStatsRequest{GuildId: "g"},
			wantCode: codes.Unauthenticated,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.GetGuildStats(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}
