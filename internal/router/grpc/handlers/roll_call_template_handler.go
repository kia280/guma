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

type RollCallTemplateHandler struct {
	gumav1.UnimplementedRollCallTemplateServiceServer
	svc    *rollcalltemplatesvc.Service
	logger zerolog.Logger
}

func NewRollCallTemplateService(db *database.Pool, az authz.Authorizer, logger zerolog.Logger) *RollCallTemplateHandler {
	return &RollCallTemplateHandler{
		svc:    rollcalltemplatesvc.New(db, az, logger),
		logger: logger.With().Str("handler", "roll_call_template").Logger(),
	}
}

func (h *RollCallTemplateHandler) ListRollCallTemplates(ctx context.Context, req *gumav1.ListRollCallTemplatesRequest) (*gumav1.ListRollCallTemplatesResponse, error) {
	var in struct{ GuildID uuid.UUID }
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	templates, err := h.svc.List(ctx, in.GuildID)
	if err != nil {
		return nil, toStatus(err)
	}
	protos := make([]*gumav1.RollCallTemplate, len(templates))
	for i, t := range templates {
		protos[i] = rollCallTemplateToProto(t)
	}
	return &gumav1.ListRollCallTemplatesResponse{Templates: protos}, nil
}

func (h *RollCallTemplateHandler) CreateRollCallTemplate(ctx context.Context, req *gumav1.CreateRollCallTemplateRequest) (*gumav1.CreateRollCallTemplateResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID         uuid.UUID
		ItemTemplateIDs []uuid.UUID
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	t, err := h.svc.Create(ctx, in.GuildID, userID, rollcalltemplatesvc.Fields{
		Name:            req.Name,
		Title:           req.Title,
		ItemTemplateIDs: in.ItemTemplateIDs,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateRollCallTemplateResponse{Template: rollCallTemplateToProto(t)}, nil
}

func (h *RollCallTemplateHandler) UpdateRollCallTemplate(ctx context.Context, req *gumav1.UpdateRollCallTemplateRequest) (*gumav1.UpdateRollCallTemplateResponse, error) {
	var in struct {
		GuildID         uuid.UUID
		TemplateID      uuid.UUID
		ItemTemplateIDs []uuid.UUID
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	t, err := h.svc.Update(ctx, in.GuildID, in.TemplateID, rollcalltemplatesvc.Fields{
		Name:            req.Name,
		Title:           req.Title,
		ItemTemplateIDs: in.ItemTemplateIDs,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateRollCallTemplateResponse{Template: rollCallTemplateToProto(t)}, nil
}

func (h *RollCallTemplateHandler) DeleteRollCallTemplate(ctx context.Context, req *gumav1.DeleteRollCallTemplateRequest) (*gumav1.DeleteRollCallTemplateResponse, error) {
	var in struct {
		GuildID    uuid.UUID
		TemplateID uuid.UUID
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	if err := h.svc.Delete(ctx, in.GuildID, in.TemplateID); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteRollCallTemplateResponse{Success: true}, nil
}

func rollCallTemplateToProto(t *rollcalltemplatesvc.Template) *gumav1.RollCallTemplate {
	items := make([]*gumav1.Item, len(t.Items))
	for i, item := range t.Items {
		items[i] = itemToProto(item)
	}
	return &gumav1.RollCallTemplate{
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
