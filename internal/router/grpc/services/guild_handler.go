package services

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	guildv1 "github.com/kia280/guma/gen/proto/guma/v1"
)

// GuildService implements the GuildService gRPC service
type GuildService struct {
	guildv1.UnimplementedGuildServiceServer
	logger zerolog.Logger
}

// NewGuildService creates a new Guild handler
func NewGuildService(logger zerolog.Logger) *GuildService {
	return &GuildService{
		logger: logger.With().Str("service", "guild").Logger(),
	}
}

// CreateGuild creates a new guild
func (s *GuildService) CreateGuild(ctx context.Context, req *guildv1.CreateGuildRequest) (*guildv1.CreateGuildResponse, error) {
	logger := s.logger.With().Str("operation", "create_guild").Logger()

	// Validate request
	if req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "guild name is required")
	}

	userID, ok := ctx.Value("user_id").(string)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	logger.Info().
		Str("user_id", userID).
		Str("guild_name", req.Name).
		Msg("creating guild")

	// TODO: Implement guild creation logic with database

	// Return mock guild for now
	guild := &guildv1.Guild{
		Id:          "mock-guild-id",
		Name:        req.Name,
		Description: req.Description,
		OwnerId:     userID,
		Tags:        req.Tags,
		Settings: &guildv1.GuildSettings{
			Timezone:       "UTC",
			Language:       "en",
			Public:         false,
			AllowInvites:   true,
			CustomSettings: req.Settings,
		},
		CreatedAt:   timestamppb.Now(),
		UpdatedAt:   timestamppb.Now(),
		MemberCount: 1,
	}

	logger.Info().Str("guild_id", guild.Id).Msg("guild created successfully")

	return &guildv1.CreateGuildResponse{
		Guild: guild,
	}, nil
}

// GetGuild retrieves a guild by ID
func (s *GuildService) GetGuild(ctx context.Context, req *guildv1.GetGuildRequest) (*guildv1.GetGuildResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	userID, ok := ctx.Value("user_id").(string)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Msg("getting guild")

	// TODO: Implement guild retrieval from database

	// Return mock guild
	guild := &guildv1.Guild{
		Id:          req.GuildId,
		Name:        "Mock Guild",
		Description: "A mock guild",
		OwnerId:     userID,
		Tags:        []string{"gaming"},
		Settings: &guildv1.GuildSettings{
			Timezone:       "UTC",
			Language:       "en",
			Public:         false,
			AllowInvites:   true,
			CustomSettings: map[string]string{},
		},
		CreatedAt:   timestamppb.Now(),
		UpdatedAt:   timestamppb.Now(),
		MemberCount: 10,
	}

	return &guildv1.GetGuildResponse{
		Guild: guild,
	}, nil
}

// UpdateGuild updates a guild
func (s *GuildService) UpdateGuild(ctx context.Context, req *guildv1.UpdateGuildRequest) (*guildv1.UpdateGuildResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	userID, ok := ctx.Value("user_id").(string)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Msg("updating guild")

	// TODO: Implement guild update logic with database
	// TODO: Check user permissions

	guild := &guildv1.Guild{
		Id:          req.GuildId,
		Name:        req.Name,
		Description: req.Description,
		OwnerId:     userID,
		Tags:        req.Tags,
		Settings: &guildv1.GuildSettings{
			Timezone:       "UTC",
			Language:       "en",
			Public:         false,
			AllowInvites:   true,
			CustomSettings: map[string]string{},
		},
		CreatedAt:   timestamppb.Now(),
		UpdatedAt:   timestamppb.Now(),
		MemberCount: 10,
	}

	return &guildv1.UpdateGuildResponse{
		Guild: guild,
	}, nil
}

// DeleteGuild deletes a guild
func (s *GuildService) DeleteGuild(ctx context.Context, req *guildv1.DeleteGuildRequest) (*guildv1.DeleteGuildResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	userID, ok := ctx.Value("user_id").(string)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Msg("deleting guild")

	// TODO: Implement guild deletion logic with database
	// TODO: Check user permissions (only owner can delete)

	return &guildv1.DeleteGuildResponse{
		Success: true,
	}, nil
}

// ListGuilds lists guilds for the user
func (s *GuildService) ListGuilds(ctx context.Context, req *guildv1.ListGuildsRequest) (*guildv1.ListGuildsResponse, error) {
	userID, ok := ctx.Value("user_id").(string)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Int32("page_size", req.PageSize).
		Str("page_token", req.PageToken).
		Msg("listing guilds")

	// TODO: Implement guild listing from database with pagination

	guilds := []*guildv1.Guild{}

	return &guildv1.ListGuildsResponse{
		Guilds:        guilds,
		NextPageToken: "",
		TotalCount:    0,
	}, nil
}

// GetGuildSettings retrieves guild settings
func (s *GuildService) GetGuildSettings(ctx context.Context, req *guildv1.GetGuildSettingsRequest) (*guildv1.GetGuildSettingsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	userID, ok := ctx.Value("user_id").(string)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Msg("getting guild settings")

	// TODO: Implement settings retrieval from database

	settings := &guildv1.GuildSettings{
		Timezone:       "UTC",
		Language:       "en",
		Public:         false,
		AllowInvites:   true,
		CustomSettings: map[string]string{},
	}

	return &guildv1.GetGuildSettingsResponse{
		Settings: settings,
	}, nil
}

// UpdateGuildSettings updates guild settings
func (s *GuildService) UpdateGuildSettings(ctx context.Context, req *guildv1.UpdateGuildSettingsRequest) (*guildv1.UpdateGuildSettingsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	if req.Settings == nil {
		return nil, status.Error(codes.InvalidArgument, "settings are required")
	}

	userID, ok := ctx.Value("user_id").(string)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Msg("updating guild settings")

	// TODO: Implement settings update in database
	// TODO: Check user permissions

	return &guildv1.UpdateGuildSettingsResponse{
		Settings: req.Settings,
	}, nil
}
