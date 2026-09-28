package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	rollcalltemplatesvc "github.com/kia280/guma/internal/services/rollcalltemplate"
	"github.com/kia280/guma/internal/session"
)

type RollCallTemplateHandler struct {
	gumav1.UnimplementedCheckInTemplateServiceServer
	svc    *rollcalltemplatesvc.Service
	logger zerolog.Logger
}

func NewRollCallTemplateService(db *database.Pool, logger zerolog.Logger) *RollCallTemplateHandler {
	return &RollCallTemplateHandler{
		svc:    rollcalltemplatesvc.New(db, logger),
		logger: logger.With().Str("handler", "roll_call_template").Logger(),
	}
}

func (h *RollCallTemplateHandler) ListCheckInTemplates(ctx context.Context, req *gumav1.ListCheckInTemplatesRequest) (*gumav1.ListCheckInTemplatesResponse, error) {
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
		protos[i] = rollCallTemplateToProto(t)
	}
	return &gumav1.ListCheckInTemplatesResponse{Templates: protos}, nil
}

func (h *RollCallTemplateHandler) CreateCheckInTemplate(ctx context.Context, req *gumav1.CreateCheckInTemplateRequest) (*gumav1.CreateCheckInTemplateResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	t, err := h.svc.Create(ctx, req.GuildId, userID, rollcalltemplatesvc.Fields{
		Name:            req.Name,
		Title:           req.Title,
		ItemTemplateIDs: req.ItemTemplateIds,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateCheckInTemplateResponse{Template: rollCallTemplateToProto(t)}, nil
}

func (h *RollCallTemplateHandler) UpdateCheckInTemplate(ctx context.Context, req *gumav1.UpdateCheckInTemplateRequest) (*gumav1.UpdateCheckInTemplateResponse, error) {
	if req.GuildId == "" || req.TemplateId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and template_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	t, err := h.svc.Update(ctx, req.GuildId, req.TemplateId, userID, rollcalltemplatesvc.Fields{
		Name:            req.Name,
		Title:           req.Title,
		ItemTemplateIDs: req.ItemTemplateIds,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateCheckInTemplateResponse{Template: rollCallTemplateToProto(t)}, nil
}

func (h *RollCallTemplateHandler) DeleteCheckInTemplate(ctx context.Context, req *gumav1.DeleteCheckInTemplateRequest) (*gumav1.DeleteCheckInTemplateResponse, error) {
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

func rollCallTemplateToProto(t *rollcalltemplatesvc.Template) *gumav1.CheckInTemplate {
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
