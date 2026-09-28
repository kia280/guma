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

type ItemTemplateHandler struct {
	gumav1.UnimplementedItemTemplateServiceServer
	svc    *rollcalltemplatesvc.ItemService
	logger zerolog.Logger
}

func NewItemTemplateService(db *database.Pool, logger zerolog.Logger) *ItemTemplateHandler {
	return &ItemTemplateHandler{
		svc:    rollcalltemplatesvc.NewItemService(db, logger),
		logger: logger.With().Str("handler", "item_template").Logger(),
	}
}

func (h *ItemTemplateHandler) ListItemTemplates(ctx context.Context, req *gumav1.ListItemTemplatesRequest) (*gumav1.ListItemTemplatesResponse, error) {
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
	protos := make([]*gumav1.ItemTemplate, len(templates))
	for i, t := range templates {
		protos[i] = itemTemplateToProto(t)
	}
	return &gumav1.ListItemTemplatesResponse{Templates: protos}, nil
}

func (h *ItemTemplateHandler) CreateItemTemplate(ctx context.Context, req *gumav1.CreateItemTemplateRequest) (*gumav1.CreateItemTemplateResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	t, err := h.svc.Create(ctx, req.GuildId, userID, rollcalltemplatesvc.ItemFields{
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Rarity:      req.Rarity,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateItemTemplateResponse{Template: itemTemplateToProto(t)}, nil
}

func (h *ItemTemplateHandler) UpdateItemTemplate(ctx context.Context, req *gumav1.UpdateItemTemplateRequest) (*gumav1.UpdateItemTemplateResponse, error) {
	if req.GuildId == "" || req.TemplateId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and template_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	t, err := h.svc.Update(ctx, req.GuildId, req.TemplateId, userID, rollcalltemplatesvc.ItemFields{
		Name:        req.Name,
		Description: req.Description,
		Category:    req.Category,
		Rarity:      req.Rarity,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateItemTemplateResponse{Template: itemTemplateToProto(t)}, nil
}

func (h *ItemTemplateHandler) DeleteItemTemplate(ctx context.Context, req *gumav1.DeleteItemTemplateRequest) (*gumav1.DeleteItemTemplateResponse, error) {
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
	return &gumav1.DeleteItemTemplateResponse{Success: true}, nil
}

func itemTemplateToProto(t *rollcalltemplatesvc.ItemTemplate) *gumav1.ItemTemplate {
	return &gumav1.ItemTemplate{
		Id:          t.ID,
		GuildId:     t.GuildID,
		Name:        t.Name,
		Description: t.Description,
		Category:    t.Category,
		Rarity:      t.Rarity,
		CreatedBy:   t.CreatedBy,
		CreatedAt:   timestamppb.New(t.CreatedAt),
		UpdatedAt:   timestamppb.New(t.UpdatedAt),
	}
}
