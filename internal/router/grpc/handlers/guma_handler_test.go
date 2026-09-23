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

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
)

func TestNewGumaService(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGumaService(logger)

	assert.NotNil(t, service)
	assert.NotNil(t, service.logger)
}

func TestGumaService_GetNavigation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGumaService(logger)

	tests := []struct {
		name        string
		ctx         context.Context
		req         *gumav1.GetNavigationRequest
		wantErr     bool
		wantCode    codes.Code
		wantItems   int
		checkResult func(t *testing.T, resp *gumav1.GetNavigationResponse)
	}{
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &gumav1.GetNavigationRequest{},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name:      "successful navigation retrieval without guild_id",
			ctx:       session.WithUserID(context.Background(), "test-user"),
			req:       &gumav1.GetNavigationRequest{},
			wantErr:   false,
			wantItems: 2,
			checkResult: func(t *testing.T, resp *gumav1.GetNavigationResponse) {
				assert.Len(t, resp.Items, 2)
				assert.Equal(t, "dashboard", resp.Items[0].Id)
				assert.Equal(t, "Dashboard", resp.Items[0].Label)
				assert.True(t, resp.Items[0].Visible)
				assert.Equal(t, "guilds", resp.Items[1].Id)
			},
		},
		{
			name:      "successful navigation retrieval with guild_id",
			ctx:       session.WithUserID(context.Background(), "test-user"),
			req:       &gumav1.GetNavigationRequest{GuildId: "guild-123"},
			wantErr:   false,
			wantItems: 2,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.GetNavigation(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.Len(t, resp.Items, tt.wantItems)
				if tt.checkResult != nil {
					tt.checkResult(t, resp)
				}
			}
		})
	}
}

func TestGumaService_GetDashboardData(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGumaService(logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.GetDashboardDataRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &gumav1.GetDashboardDataRequest{},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name:    "successful dashboard data retrieval",
			ctx:     session.WithUserID(context.Background(), "test-user"),
			req:     &gumav1.GetDashboardDataRequest{GuildId: "guild-123"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.GetDashboardData(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Data)
				assert.NotNil(t, resp.Data.Stats)
				assert.NotNil(t, resp.Data.RecentActivities)
				assert.NotNil(t, resp.Data.Notifications)
			}
		})
	}
}

func TestGumaService_GetUserPreferences(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGumaService(logger)

	tests := []struct {
		name        string
		ctx         context.Context
		req         *gumav1.GetUserPreferencesRequest
		wantErr     bool
		wantCode    codes.Code
		checkResult func(t *testing.T, resp *gumav1.GetUserPreferencesResponse)
	}{
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &gumav1.GetUserPreferencesRequest{},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name:    "successful preferences retrieval",
			ctx:     session.WithUserID(context.Background(), "test-user"),
			req:     &gumav1.GetUserPreferencesRequest{},
			wantErr: false,
			checkResult: func(t *testing.T, resp *gumav1.GetUserPreferencesResponse) {
				assert.NotNil(t, resp.Preferences)
				assert.Equal(t, "light", resp.Preferences.Theme)
				assert.Equal(t, "en", resp.Preferences.Language)
				assert.Equal(t, "UTC", resp.Preferences.Timezone)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.GetUserPreferences(tt.ctx, tt.req)

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

func TestGumaService_UpdateUserPreferences(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGumaService(logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.UpdateUserPreferencesRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &gumav1.UpdateUserPreferencesRequest{},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name:     "missing preferences",
			ctx:      session.WithUserID(context.Background(), "test-user"),
			req:      &gumav1.UpdateUserPreferencesRequest{},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
		{
			name: "successful preferences update",
			ctx:  session.WithUserID(context.Background(), "test-user"),
			req: &gumav1.UpdateUserPreferencesRequest{
				Preferences: &gumav1.UserPreferences{
					Theme:      "dark",
					Language:   "ja",
					Timezone:   "Asia/Tokyo",
					DateFormat: "YYYY/MM/DD",
					TimeFormat: "24h",
				},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.UpdateUserPreferences(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.Equal(t, tt.req.Preferences, resp.Preferences)
			}
		})
	}
}

func TestGumaService_GetAppConfig(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGumaService(logger)

	tests := []struct {
		name        string
		ctx         context.Context
		req         *gumav1.GetAppConfigRequest
		wantErr     bool
		checkResult func(t *testing.T, resp *gumav1.GetAppConfigResponse)
	}{
		{
			name:    "successful app config retrieval",
			ctx:     context.Background(),
			req:     &gumav1.GetAppConfigRequest{},
			wantErr: false,
			checkResult: func(t *testing.T, resp *gumav1.GetAppConfigResponse) {
				assert.NotNil(t, resp.Config)
				assert.Equal(t, "1.0.0", resp.Config.Version)
				assert.NotNil(t, resp.Config.Features)
				assert.True(t, resp.Config.Features["guilds"])
				assert.True(t, resp.Config.Features["members"])
				assert.NotNil(t, resp.Config.Limits)
				assert.Equal(t, int32(10), resp.Config.Limits.MaxGuildsPerUser)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.GetAppConfig(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
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

func TestGumaService_SearchGlobal(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewGumaService(logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.SearchGlobalRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:     "empty query",
			ctx:      session.WithUserID(context.Background(), "test-user"),
			req:      &gumav1.SearchGlobalRequest{Query: ""},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing user_id in context",
			ctx:      context.Background(),
			req:      &gumav1.SearchGlobalRequest{Query: "test"},
			wantErr:  true,
			wantCode: codes.Unauthenticated,
		},
		{
			name:    "successful search without guild_id",
			ctx:     session.WithUserID(context.Background(), "test-user"),
			req:     &gumav1.SearchGlobalRequest{Query: "test query"},
			wantErr: false,
		},
		{
			name: "successful search with guild_id and limit",
			ctx:  session.WithUserID(context.Background(), "test-user"),
			req: &gumav1.SearchGlobalRequest{
				Query:   "test query",
				GuildId: "guild-123",
				Limit:   20,
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.SearchGlobal(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Results)
				assert.NotNil(t, resp.Results.Items)
				assert.Equal(t, int32(0), resp.Results.TotalCount)
			}
		})
	}
}
