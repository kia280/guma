package handlers

import (
	"context"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/ids"
	rollcalltemplatesvc "github.com/kia280/guma/internal/services/rollcalltemplate"
)

type ItemTemplateHandler struct {
	gumav1.UnimplementedItemTemplateServiceServer
	svc    *rollcalltemplatesvc.ItemService
	logger zerolog.Logger
}

func NewItemTemplateService(db *database.Pool, az authz.Authorizer, logger zerolog.Logger) *ItemTemplateHandler {
	return &ItemTemplateHandler{
		svc:    rollcalltemplatesvc.NewItemService(db, az, logger),
		logger: logger.With().Str("handler", "item_template").Logger(),
	}
}

func (h *ItemTemplateHandler) ListItemTemplates(ctx context.Context, req *gumav1.ListItemTemplatesRequest) (*gumav1.ListItemTemplatesResponse, error) {
	var in struct {
		GuildID uuid.UUID `proto:"guild_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	templates, err := h.svc.List(ctx, in.GuildID)
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID uuid.UUID `proto:"guild_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	t, err := h.svc.Create(ctx, in.GuildID, userID, rollcalltemplatesvc.ItemFields{
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
	var in struct {
		GuildID    uuid.UUID `proto:"guild_id"`
		TemplateID uuid.UUID `proto:"template_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	t, err := h.svc.Update(ctx, in.GuildID, in.TemplateID, rollcalltemplatesvc.ItemFields{
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
	var in struct {
		GuildID    uuid.UUID `proto:"guild_id"`
		TemplateID uuid.UUID `proto:"template_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	if err := h.svc.Delete(ctx, in.GuildID, in.TemplateID); err != nil {
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
