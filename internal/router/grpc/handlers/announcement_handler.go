package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	announcementsvc "github.com/kia280/guma/internal/services/announcement"
	"github.com/kia280/guma/internal/session"
)

type AnnouncementHandler struct {
	gumav1.UnimplementedAnnouncementServiceServer
	svc    *announcementsvc.Service
	logger zerolog.Logger
}

func NewAnnouncementService(db *database.Pool, logger zerolog.Logger) *AnnouncementHandler {
	return &AnnouncementHandler{
		svc:    announcementsvc.New(db, logger),
		logger: logger.With().Str("handler", "announcement").Logger(),
	}
}

func (h *AnnouncementHandler) ListAnnouncements(ctx context.Context, req *gumav1.ListAnnouncementsRequest) (*gumav1.ListAnnouncementsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	list, err := h.svc.List(ctx, announcementsvc.ListParams{
		GuildID:       req.GuildId,
		UserID:        userID,
		IncludeDrafts: req.IncludeDrafts,
		PageSize:      req.PageSize,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	announcements := make([]*gumav1.Announcement, 0, len(list))
	for _, a := range list {
		announcements = append(announcements, announcementToProto(a))
	}
	return &gumav1.ListAnnouncementsResponse{Announcements: announcements}, nil
}

func (h *AnnouncementHandler) GetAnnouncement(ctx context.Context, req *gumav1.GetAnnouncementRequest) (*gumav1.GetAnnouncementResponse, error) {
	userID, err := requireAnnouncementTarget(ctx, req.GuildId, req.AnnouncementId)
	if err != nil {
		return nil, err
	}
	a, err := h.svc.Get(ctx, req.GuildId, req.AnnouncementId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetAnnouncementResponse{Announcement: announcementToProto(a)}, nil
}

func (h *AnnouncementHandler) CreateAnnouncementDraft(ctx context.Context, req *gumav1.CreateAnnouncementDraftRequest) (*gumav1.CreateAnnouncementDraftResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	a, err := h.svc.CreateDraft(ctx, req.GuildId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateAnnouncementDraftResponse{Announcement: announcementToProto(a)}, nil
}

func (h *AnnouncementHandler) UpdateAnnouncementDraft(ctx context.Context, req *gumav1.UpdateAnnouncementDraftRequest) (*gumav1.UpdateAnnouncementDraftResponse, error) {
	userID, err := requireAnnouncementTarget(ctx, req.GuildId, req.AnnouncementId)
	if err != nil {
		return nil, err
	}
	a, err := h.svc.UpdateDraft(ctx, announcementsvc.DraftUpdate{
		GuildID:        req.GuildId,
		AnnouncementID: req.AnnouncementId,
		UserID:         userID,
		Title:          req.Title,
		Content:        req.Content,
		Pinned:         req.Pinned,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateAnnouncementDraftResponse{Announcement: announcementToProto(a)}, nil
}

func (h *AnnouncementHandler) PublishAnnouncement(ctx context.Context, req *gumav1.PublishAnnouncementRequest) (*gumav1.PublishAnnouncementResponse, error) {
	userID, err := requireAnnouncementTarget(ctx, req.GuildId, req.AnnouncementId)
	if err != nil {
		return nil, err
	}
	a, err := h.svc.Publish(ctx, req.GuildId, req.AnnouncementId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.PublishAnnouncementResponse{Announcement: announcementToProto(a)}, nil
}

func (h *AnnouncementHandler) DeleteAnnouncementDraft(ctx context.Context, req *gumav1.DeleteAnnouncementDraftRequest) (*gumav1.DeleteAnnouncementDraftResponse, error) {
	userID, err := requireAnnouncementTarget(ctx, req.GuildId, req.AnnouncementId)
	if err != nil {
		return nil, err
	}
	if err := h.svc.DeleteDraft(ctx, req.GuildId, req.AnnouncementId, userID); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteAnnouncementDraftResponse{}, nil
}

func requireAnnouncementTarget(ctx context.Context, guildID, announcementID string) (string, error) {
	if guildID == "" {
		return "", status.Error(codes.InvalidArgument, "guild_id is required")
	}
	if announcementID == "" {
		return "", status.Error(codes.InvalidArgument, "announcement_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return "", status.Error(codes.Unauthenticated, "user not authenticated")
	}
	return userID, nil
}

func announcementToProto(a *announcementsvc.Announcement) *gumav1.Announcement {
	out := &gumav1.Announcement{
		Id:         a.ID,
		GuildId:    a.GuildID,
		AuthorId:   a.AuthorID,
		AuthorName: a.AuthorName,
		Title:      a.Title,
		Content:    a.Content,
		Pinned:     a.Pinned,
		Status:     a.Status,
		CreatedAt:  timestamppb.New(a.CreatedAt),
		UpdatedAt:  timestamppb.New(a.UpdatedAt),
	}
	if a.PublishedAt != nil {
		out.PublishedAt = timestamppb.New(*a.PublishedAt)
	}
	return out
}
