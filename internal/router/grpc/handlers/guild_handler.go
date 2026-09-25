package handlers

import (
	"context"
	"errors"

	"github.com/rs/zerolog"
	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	guildv1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/services/errs"
	guildsvc "github.com/kia280/guma/internal/services/guild"
	"github.com/kia280/guma/internal/session"
)

// GuildHandler is a thin gRPC adapter over the guild service.
type GuildHandler struct {
	guildv1.UnimplementedGuildServiceServer
	svc    *guildsvc.Service
	logger zerolog.Logger
}

// NewGuildService creates a new Guild gRPC handler.
func NewGuildService(db *database.Pool, logger zerolog.Logger) *GuildHandler {
	return &GuildHandler{
		svc:    guildsvc.New(db, logger),
		logger: logger.With().Str("handler", "guild").Logger(),
	}
}

func (h *GuildHandler) CreateGuild(ctx context.Context, req *guildv1.CreateGuildRequest) (*guildv1.CreateGuildResponse, error) {
	if req.Name == "" {
		return nil, status.Error(codes.InvalidArgument, "guild name is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	g, err := h.svc.Create(ctx, guildsvc.CreateParams{
		Name:           req.Name,
		Description:    req.Description,
		CustomSettings: req.Settings,
		OwnerID:        userID,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.CreateGuildResponse{Guild: guildToProto(g)}, nil
}

func (h *GuildHandler) GetGuild(ctx context.Context, req *guildv1.GetGuildRequest) (*guildv1.GetGuildResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	if session.UserIDFromContext(ctx) == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	g, err := h.svc.Get(ctx, req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.GetGuildResponse{Guild: guildToProto(g)}, nil
}

func (h *GuildHandler) UpdateGuild(ctx context.Context, req *guildv1.UpdateGuildRequest) (*guildv1.UpdateGuildResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	g, err := h.svc.Update(ctx, guildsvc.UpdateParams{
		GuildID:     req.GuildId,
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		IconURL:     req.IconUrl,
		BannerURL:   req.BannerUrl,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.UpdateGuildResponse{Guild: guildToProto(g)}, nil
}

func (h *GuildHandler) UploadGuildLogo(ctx context.Context, req *guildv1.UploadGuildLogoRequest) (*guildv1.UploadGuildLogoResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	g, err := h.svc.UploadLogo(ctx, guildsvc.UploadLogoParams{
		GuildID:     req.GuildId,
		UserID:      userID,
		ContentType: req.ContentType,
		Data:        req.Data,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.UploadGuildLogoResponse{Guild: guildToProto(g)}, nil
}

func (h *GuildHandler) DeleteGuildLogo(ctx context.Context, req *guildv1.DeleteGuildLogoRequest) (*guildv1.DeleteGuildLogoResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	g, err := h.svc.DeleteLogo(ctx, req.GuildId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.DeleteGuildLogoResponse{Guild: guildToProto(g)}, nil
}

func (h *GuildHandler) GetGuildLogo(ctx context.Context, req *guildv1.GetGuildLogoRequest) (*httpbody.HttpBody, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	if session.UserIDFromContext(ctx) == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	logo, err := h.svc.GetLogo(ctx, req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}

	cacheControl := "private, no-cache"
	if req.V != "" {
		cacheControl = "private, max-age=31536000, immutable"
	}
	if err := grpc.SetHeader(ctx, metadata.Pairs("cache-control", cacheControl)); err != nil {
		h.logger.Warn().Err(err).Msg("failed to set guild logo cache header")
	}
	return &httpbody.HttpBody{ContentType: logo.ContentType, Data: logo.Data}, nil
}

func (h *GuildHandler) DeleteGuild(ctx context.Context, req *guildv1.DeleteGuildRequest) (*guildv1.DeleteGuildResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	if err := h.svc.Delete(ctx, req.GuildId, userID); err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.DeleteGuildResponse{Success: true}, nil
}

func (h *GuildHandler) ListGuilds(ctx context.Context, req *guildv1.ListGuildsRequest) (*guildv1.ListGuildsResponse, error) {
	if session.UserIDFromContext(ctx) == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	result, err := h.svc.List(ctx, guildsvc.ListParams{
		Search:   req.Search,
		PageSize: int(req.PageSize),
		Offset:   guildsvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*guildv1.Guild, len(result.Guilds))
	for i, g := range result.Guilds {
		protos[i] = guildToProto(g)
	}
	return &guildv1.ListGuildsResponse{
		Guilds:        protos,
		NextPageToken: guildsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *GuildHandler) GetCurrentGuild(ctx context.Context, _ *guildv1.GetCurrentGuildRequest) (*guildv1.GetCurrentGuildResponse, error) {
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	g, err := h.svc.GetCurrent(ctx, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	if g == nil {
		return &guildv1.GetCurrentGuildResponse{}, nil
	}
	return &guildv1.GetCurrentGuildResponse{Guild: guildToProto(g)}, nil
}

func (h *GuildHandler) JoinGuildById(ctx context.Context, req *guildv1.JoinGuildByIdRequest) (*guildv1.JoinGuildByIdResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	g, err := h.svc.Join(ctx, req.GuildId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.JoinGuildByIdResponse{Guild: guildToProto(g)}, nil
}

func (h *GuildHandler) LeaveGuild(ctx context.Context, req *guildv1.LeaveGuildRequest) (*guildv1.LeaveGuildResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	if err := h.svc.Leave(ctx, req.GuildId, userID); err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.LeaveGuildResponse{Success: true}, nil
}

func (h *GuildHandler) GetGuildSettings(ctx context.Context, req *guildv1.GetGuildSettingsRequest) (*guildv1.GetGuildSettingsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	if session.UserIDFromContext(ctx) == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	settings, err := h.svc.GetSettings(ctx, req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.GetGuildSettingsResponse{Settings: settingsToProto(settings)}, nil
}

func (h *GuildHandler) UpdateGuildSettings(ctx context.Context, req *guildv1.UpdateGuildSettingsRequest) (*guildv1.UpdateGuildSettingsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	if req.Settings == nil {
		return nil, status.Error(codes.InvalidArgument, "settings are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	updated, err := h.svc.UpdateSettings(ctx, req.GuildId, userID, settingsFromProto(req.Settings))
	if err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.UpdateGuildSettingsResponse{Settings: settingsToProto(updated)}, nil
}

func (h *GuildHandler) GetGuildStats(ctx context.Context, req *guildv1.GetGuildStatsRequest) (*guildv1.GetGuildStatsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	stats, err := h.svc.Stats(ctx, req.GuildId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &guildv1.GetGuildStatsResponse{Stats: &guildv1.GuildStats{
		MemberCount:      stats.MemberCount,
		BankBalance:      stats.BankBalance,
		BankCurrency:     stats.BankCurrency,
		ActiveEventCount: stats.ActiveEventCount,
		BankItemCount:    stats.BankItemCount,
	}}, nil
}

// --- proto conversion helpers ---

func guildToProto(g *guildsvc.Guild) *guildv1.Guild {
	return &guildv1.Guild{
		Id:          g.ID,
		Name:        g.Name,
		Description: g.Description,
		OwnerId:     g.OwnerID,
		Settings:    settingsToProto(&g.Settings),
		IconUrl:     g.IconURL,
		BannerUrl:   g.BannerURL,
		MemberCount: g.MemberCount,
		CreatedAt:   timestamppb.New(g.CreatedAt),
		UpdatedAt:   timestamppb.New(g.UpdatedAt),
	}
}

func settingsToProto(s *guildsvc.GuildSettings) *guildv1.GuildSettings {
	cs := s.CustomSettings
	if cs == nil {
		cs = map[string]string{}
	}
	return &guildv1.GuildSettings{
		Timezone:       s.Timezone,
		Language:       s.Language,
		Public:         s.Public,
		AllowInvites:   s.AllowInvites,
		CustomSettings: cs,
	}
}

func settingsFromProto(p *guildv1.GuildSettings) guildsvc.GuildSettings {
	return guildsvc.GuildSettings{
		Timezone:       p.Timezone,
		Language:       p.Language,
		Public:         p.Public,
		AllowInvites:   p.AllowInvites,
		CustomSettings: p.CustomSettings,
	}
}

// toStatus maps service layer errors to gRPC status errors.
func toStatus(err error) error {
	switch {
	case errors.Is(err, errs.ErrNotFound):
		return status.Error(codes.NotFound, err.Error())
	case errors.Is(err, errs.ErrPermissionDenied):
		return status.Error(codes.PermissionDenied, err.Error())
	case errors.Is(err, errs.ErrUnauthenticated):
		return status.Error(codes.Unauthenticated, err.Error())
	case errors.Is(err, errs.ErrFailedPrecondition):
		return status.Error(codes.FailedPrecondition, err.Error())
	case errors.Is(err, errs.ErrAlreadyExists):
		return status.Error(codes.AlreadyExists, err.Error())
	case errors.Is(err, errs.ErrInvalidArgument):
		return status.Error(codes.InvalidArgument, err.Error())
	default:
		return status.Errorf(codes.Internal, "%v", err)
	}
}
