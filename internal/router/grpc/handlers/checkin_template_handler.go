package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	checkintemplatesvc "github.com/kia280/guma/internal/services/checkintemplate"
	"github.com/kia280/guma/internal/session"
)

type CheckInTemplateHandler struct {
	gumav1.UnimplementedCheckInTemplateServiceServer
	svc    *checkintemplatesvc.Service
	logger zerolog.Logger
}

func NewCheckInTemplateService(db *database.Pool, logger zerolog.Logger) *CheckInTemplateHandler {
	return &CheckInTemplateHandler{
		svc:    checkintemplatesvc.New(db, logger),
		logger: logger.With().Str("handler", "checkin_template").Logger(),
	}
}

func (h *CheckInTemplateHandler) ListCheckInTemplates(ctx context.Context, req *gumav1.ListCheckInTemplatesRequest) (*gumav1.ListCheckInTemplatesResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	templates, err := h.svc.List(ctx, req.GuildId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	protos := make([]*gumav1.CheckInTemplate, len(templates))
	for i, t := range templates {
		protos[i] = checkinTemplateToProto(t)
	}
	return &gumav1.ListCheckInTemplatesResponse{Templates: protos}, nil
}

func (h *CheckInTemplateHandler) CreateCheckInTemplate(ctx context.Context, req *gumav1.CreateCheckInTemplateRequest) (*gumav1.CreateCheckInTemplateResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	t, err := h.svc.Create(ctx, req.GuildId, userID, checkintemplatesvc.Fields{
		Name:            req.Name,
		Title:           req.Title,
		ItemTemplateIDs: req.ItemTemplateIds,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateCheckInTemplateResponse{Template: checkinTemplateToProto(t)}, nil
}

func (h *CheckInTemplateHandler) UpdateCheckInTemplate(ctx context.Context, req *gumav1.UpdateCheckInTemplateRequest) (*gumav1.UpdateCheckInTemplateResponse, error) {
	if req.GuildId == "" || req.TemplateId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and template_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	t, err := h.svc.Update(ctx, req.GuildId, req.TemplateId, userID, checkintemplatesvc.Fields{
		Name:            req.Name,
		Title:           req.Title,
		ItemTemplateIDs: req.ItemTemplateIds,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateCheckInTemplateResponse{Template: checkinTemplateToProto(t)}, nil
}

func (h *CheckInTemplateHandler) DeleteCheckInTemplate(ctx context.Context, req *gumav1.DeleteCheckInTemplateRequest) (*gumav1.DeleteCheckInTemplateResponse, error) {
	if req.GuildId == "" || req.TemplateId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and template_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	if err := h.svc.Delete(ctx, req.GuildId, req.TemplateId, userID); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteCheckInTemplateResponse{Success: true}, nil
}

func checkinTemplateToProto(t *checkintemplatesvc.Template) *gumav1.CheckInTemplate {
	items := make([]*gumav1.Item, len(t.Items))
	for i, item := range t.Items {
		items[i] = itemToProto(item)
	}
	return &gumav1.CheckInTemplate{
		Id:        t.ID,
		GuildId:   t.GuildID,
		Name:      t.Name,
		Title:     t.Title,
		Items:     items,
		CreatedBy: t.CreatedBy,
		CreatedAt: timestamppb.New(t.CreatedAt),
		UpdatedAt: timestamppb.New(t.UpdatedAt),
	}
}
