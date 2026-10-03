package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/ids"
	announcementsvc "github.com/kia280/guma/internal/services/announcement"
)

type AnnouncementHandler struct {
	gumav1.UnimplementedAnnouncementServiceServer
	svc    *announcementsvc.Service
	logger zerolog.Logger
}

func NewAnnouncementService(db *database.Pool, az authz.Authorizer, logger zerolog.Logger) *AnnouncementHandler {
	return &AnnouncementHandler{
		svc:    announcementsvc.New(db, az, logger),
		logger: logger.With().Str("handler", "announcement").Logger(),
	}
}

func (h *AnnouncementHandler) ListAnnouncements(ctx context.Context, req *gumav1.ListAnnouncementsRequest) (*gumav1.ListAnnouncementsResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}

	list, err := h.svc.List(ctx, announcementsvc.ListParams{
		GuildID:       guildID,
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	announcementID := p.Parse("announcement_id", req.AnnouncementId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}
	a, err := h.svc.Get(ctx, guildID, announcementID, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetAnnouncementResponse{Announcement: announcementToProto(a)}, nil
}

func (h *AnnouncementHandler) CreateAnnouncementDraft(ctx context.Context, req *gumav1.CreateAnnouncementDraftRequest) (*gumav1.CreateAnnouncementDraftResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	a, err := h.svc.CreateDraft(ctx, guildID, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateAnnouncementDraftResponse{Announcement: announcementToProto(a)}, nil
}

func (h *AnnouncementHandler) UpdateAnnouncement(ctx context.Context, req *gumav1.UpdateAnnouncementRequest) (*gumav1.UpdateAnnouncementResponse, error) {
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	announcementID := p.Parse("announcement_id", req.AnnouncementId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}
	a, err := h.svc.Update(ctx, announcementsvc.Update{
		GuildID:        guildID,
		AnnouncementID: announcementID,
		Title:          req.Title,
		Content:        req.Content,
		Pinned:         req.Pinned,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateAnnouncementResponse{Announcement: announcementToProto(a)}, nil
}

func (h *AnnouncementHandler) PublishAnnouncement(ctx context.Context, req *gumav1.PublishAnnouncementRequest) (*gumav1.PublishAnnouncementResponse, error) {
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	announcementID := p.Parse("announcement_id", req.AnnouncementId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}
	a, err := h.svc.Publish(ctx, guildID, announcementID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.PublishAnnouncementResponse{Announcement: announcementToProto(a)}, nil
}

func (h *AnnouncementHandler) UnpublishAnnouncement(ctx context.Context, req *gumav1.UnpublishAnnouncementRequest) (*gumav1.UnpublishAnnouncementResponse, error) {
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	announcementID := p.Parse("announcement_id", req.AnnouncementId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}
	a, err := h.svc.Unpublish(ctx, guildID, announcementID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UnpublishAnnouncementResponse{Announcement: announcementToProto(a)}, nil
}

func (h *AnnouncementHandler) DeleteAnnouncementDraft(ctx context.Context, req *gumav1.DeleteAnnouncementDraftRequest) (*gumav1.DeleteAnnouncementDraftResponse, error) {
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	announcementID := p.Parse("announcement_id", req.AnnouncementId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}
	if err := h.svc.DeleteDraft(ctx, guildID, announcementID); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteAnnouncementDraftResponse{}, nil
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
