package handlers

import (
	"context"

	"github.com/rs/zerolog"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

// GumaService implements the GumaService gRPC service
type GumaService struct {
	gumav1.UnimplementedGumaServiceServer
	logger zerolog.Logger
}

// NewGumaService creates a new Guma service
func NewGumaService(logger zerolog.Logger) *GumaService {
	return &GumaService{
		logger: logger.With().Str("service", "guma").Logger(),
	}
}

// GetNavigation retrieves navigation items for the user
func (s *GumaService) GetNavigation(ctx context.Context, req *gumav1.GetNavigationRequest) (*gumav1.GetNavigationResponse, error) {
	logger := s.logger.With().Str("operation", "get_navigation").Logger()

	// Get user ID from context
	userID := session.UserIDFromContext(ctx)

	logger.Info().Str("user_id", userID).Str("guild_id", req.GuildId).Msg("getting navigation")

	// TODO: Implement navigation logic based on user permissions
	// For now, return static navigation
	items := []*gumav1.NavigationItem{
		{
			Id:      "dashboard",
			Label:   "Dashboard",
			Icon:    "dashboard",
			Path:    "/dashboard",
			Order:   1,
			Visible: true,
		},
		{
			Id:      "guilds",
			Label:   "Guilds",
			Icon:    "groups",
			Path:    "/guilds",
			Order:   2,
			Visible: true,
		},
	}

	return &gumav1.GetNavigationResponse{
		Items: items,
	}, nil
}

// GetDashboardData retrieves dashboard data for the user
func (s *GumaService) GetDashboardData(ctx context.Context, req *gumav1.GetDashboardDataRequest) (*gumav1.GetDashboardDataResponse, error) {
	logger := s.logger.With().Str("operation", "get_dashboard_data").Logger()

	userID := session.UserIDFromContext(ctx)

	logger.Info().Str("user_id", userID).Str("guild_id", req.GuildId).Msg("getting dashboard data")

	// TODO: Implement dashboard data retrieval
	data := &gumav1.DashboardData{
		RecentActivities: []*gumav1.Activity{},
		Notifications:    []*gumav1.Notification{},
		Stats: &gumav1.QuickStats{
			GuildCount:          0,
			UnreadNotifications: 0,
			PendingInvitations:  0,
		},
	}

	return &gumav1.GetDashboardDataResponse{
		Data: data,
	}, nil
}

// GetUserPreferences retrieves user preferences
func (s *GumaService) GetUserPreferences(ctx context.Context, req *gumav1.GetUserPreferencesRequest) (*gumav1.GetUserPreferencesResponse, error) {
	userID := session.UserIDFromContext(ctx)

	s.logger.Info().Str("user_id", userID).Msg("getting user preferences")

	// TODO: Retrieve from database
	// Return default preferences for now
	preferences := &gumav1.UserPreferences{
		Theme:      "light",
		Language:   "en",
		Timezone:   "UTC",
		DateFormat: "YYYY-MM-DD",
		TimeFormat: "24h",
		UiSettings: map[string]string{},
	}

	return &gumav1.GetUserPreferencesResponse{
		Preferences: preferences,
	}, nil
}

// UpdateUserPreferences updates user preferences
func (s *GumaService) UpdateUserPreferences(ctx context.Context, req *gumav1.UpdateUserPreferencesRequest) (*gumav1.UpdateUserPreferencesResponse, error) {
	userID := session.UserIDFromContext(ctx)

	s.logger.Info().Str("user_id", userID).Msg("updating user preferences")

	// TODO: Validate and save to database

	return &gumav1.UpdateUserPreferencesResponse{
		Preferences: req.Preferences,
	}, nil
}

// GetAppConfig retrieves application configuration
func (s *GumaService) GetAppConfig(ctx context.Context, req *gumav1.GetAppConfigRequest) (*gumav1.GetAppConfigResponse, error) {
	s.logger.Info().Msg("getting app config")

	// Return application configuration
	config := &gumav1.AppConfig{
		Version: "1.0.0",
		Features: map[string]bool{
			"guilds":  true,
			"members": true,
			"events":  false,
		},
		Settings: map[string]string{
			"app_name": "Guma",
		},
		Limits: &gumav1.Limits{
			MaxGuildsPerUser:   10,
			MaxMembersPerGuild: 1000,
			MaxFileSizeBytes:   10485760, // 10MB
		},
	}

	return &gumav1.GetAppConfigResponse{
		Config: config,
	}, nil
}

// SearchGlobal performs global search
func (s *GumaService) SearchGlobal(ctx context.Context, req *gumav1.SearchGlobalRequest) (*gumav1.SearchGlobalResponse, error) {
	logger := s.logger.With().Str("operation", "search_global").Logger()

	userID := session.UserIDFromContext(ctx)

	logger.Info().Str("user_id", userID).Str("query", req.Query).Msg("performing global search")

	// TODO: Implement search logic

	results := &gumav1.SearchResults{
		Items:      []*gumav1.SearchResult{},
		TotalCount: 0,
	}

	return &gumav1.SearchGlobalResponse{
		Results: results,
	}, nil
}
