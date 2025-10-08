package services

import (
	"context"
	"os"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	guildv1 "github.com/kia280/guma/gen/proto/guma/v1"
)

func TestNewGuildService(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(logger)

	assert.NotNil(t, service)
	assert.NotNil(t, service.logger)
}

func TestGuildService_CreateGuild(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(logger)

	tests := []struct {
		name        string
		ctx         context.Context
		req         *guildv1.CreateGuildRequest
		wantErr     bool
		wantCode    codes.Code
		checkResult func(t *testing.T, resp *guildv1.CreateGuildResponse)
	}{
		{
			name:     "missing guild name",
			ctx:      context.WithValue(context.Background(), "user_id", "test-user"),
			req:      &guildv1.CreateGuildRequest{},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
		{
			name: "missing user_id in context",
			ctx:  context.Background(),
			req: &guildv1.CreateGuildRequest{
				Name: "Test Guild",
			},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name: "successful guild creation",
			ctx:  context.WithValue(context.Background(), "user_id", "test-user"),
			req: &guildv1.CreateGuildRequest{
				Name:        "Test Guild",
				Description: "A test guild",
				Tags:        []string{"gaming", "test"},
				Settings:    map[string]string{"key": "value"},
			},
			wantErr: false,
			checkResult: func(t *testing.T, resp *guildv1.CreateGuildResponse) {
				assert.NotNil(t, resp.Guild)
				assert.Equal(t, "Test Guild", resp.Guild.Name)
				assert.Equal(t, "A test guild", resp.Guild.Description)
				assert.Equal(t, "test-user", resp.Guild.OwnerId)
				assert.NotEmpty(t, resp.Guild.Id)
				assert.NotNil(t, resp.Guild.Settings)
				assert.Equal(t, int32(1), resp.Guild.MemberCount)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.CreateGuild(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				if tt.checkResult != nil {
					tt.checkResult(t, resp)
				}
			}
		})
	}
}

func TestGuildService_GetGuild(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.GetGuildRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      context.WithValue(context.Background(), "user_id", "test-user"),
			req:      &guildv1.GetGuildRequest{},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
		{
			name: "missing user_id in context",
			ctx:  context.Background(),
			req:  &guildv1.GetGuildRequest{GuildId: "guild-123"},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name:    "successful guild retrieval",
			ctx:     context.WithValue(context.Background(), "user_id", "test-user"),
			req:     &guildv1.GetGuildRequest{GuildId: "guild-123"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.GetGuild(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Guild)
				assert.Equal(t, tt.req.GuildId, resp.Guild.Id)
			}
		})
	}
}

func TestGuildService_UpdateGuild(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.UpdateGuildRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      context.WithValue(context.Background(), "user_id", "test-user"),
			req:      &guildv1.UpdateGuildRequest{},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
		{
			name: "missing user_id in context",
			ctx:  context.Background(),
			req: &guildv1.UpdateGuildRequest{
				GuildId: "guild-123",
				Name:    "Updated Guild",
			},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name: "successful guild update",
			ctx:  context.WithValue(context.Background(), "user_id", "test-user"),
			req: &guildv1.UpdateGuildRequest{
				GuildId:     "guild-123",
				Name:        "Updated Guild",
				Description: "Updated description",
				Tags:        []string{"updated"},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.UpdateGuild(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Guild)
				assert.Equal(t, tt.req.Name, resp.Guild.Name)
			}
		})
	}
}

func TestGuildService_DeleteGuild(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.DeleteGuildRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      context.WithValue(context.Background(), "user_id", "test-user"),
			req:      &guildv1.DeleteGuildRequest{},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &guildv1.DeleteGuildRequest{GuildId: "guild-123"},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name:    "successful guild deletion",
			ctx:     context.WithValue(context.Background(), "user_id", "test-user"),
			req:     &guildv1.DeleteGuildRequest{GuildId: "guild-123"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.DeleteGuild(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.True(t, resp.Success)
			}
		})
	}
}

func TestGuildService_ListGuilds(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.ListGuildsRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &guildv1.ListGuildsRequest{},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name:    "successful guild listing without pagination",
			ctx:     context.WithValue(context.Background(), "user_id", "test-user"),
			req:     &guildv1.ListGuildsRequest{},
			wantErr: false,
		},
		{
			name: "successful guild listing with pagination",
			ctx:  context.WithValue(context.Background(), "user_id", "test-user"),
			req: &guildv1.ListGuildsRequest{
				PageSize:  10,
				PageToken: "next-page",
				Filter:    "active",
				OrderBy:   "created_at",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.ListGuilds(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Guilds)
			}
		})
	}
}

func TestGuildService_GetGuildSettings(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.GetGuildSettingsRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      context.WithValue(context.Background(), "user_id", "test-user"),
			req:      &guildv1.GetGuildSettingsRequest{},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &guildv1.GetGuildSettingsRequest{GuildId: "guild-123"},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name:    "successful settings retrieval",
			ctx:     context.WithValue(context.Background(), "user_id", "test-user"),
			req:     &guildv1.GetGuildSettingsRequest{GuildId: "guild-123"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.GetGuildSettings(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Settings)
			}
		})
	}
}

func TestGuildService_UpdateGuildSettings(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGuildService(logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *guildv1.UpdateGuildSettingsRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:     "missing guild_id",
			ctx:      context.WithValue(context.Background(), "user_id", "test-user"),
			req:      &guildv1.UpdateGuildSettingsRequest{},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
		{
			name: "missing settings",
			ctx:  context.WithValue(context.Background(), "user_id", "test-user"),
			req:  &guildv1.UpdateGuildSettingsRequest{GuildId: "guild-123"},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
		{
			name: "missing user_id in context",
			ctx:  context.Background(),
			req: &guildv1.UpdateGuildSettingsRequest{
				GuildId: "guild-123",
				Settings: &guildv1.GuildSettings{
					Timezone: "UTC",
				},
			},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name: "successful settings update",
			ctx:  context.WithValue(context.Background(), "user_id", "test-user"),
			req: &guildv1.UpdateGuildSettingsRequest{
				GuildId: "guild-123",
				Settings: &guildv1.GuildSettings{
					Timezone:       "Asia/Tokyo",
					Language:       "ja",
					Public:         true,
					AllowInvites:   false,
					CustomSettings: map[string]string{"theme": "dark"},
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.UpdateGuildSettings(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.Equal(t, tt.req.Settings, resp.Settings)
			}
		})
	}
}
