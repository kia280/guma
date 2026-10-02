package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	eventsvc "github.com/kia280/guma/internal/services/event"
	"github.com/kia280/guma/internal/session"
)

// EventHandler is a thin gRPC adapter over the event service.
type EventHandler struct {
	gumav1.UnimplementedEventServiceServer
	svc    *eventsvc.Service
	logger zerolog.Logger
}

// NewEventService creates a new Event gRPC handler.
func NewEventService(db *database.Pool, logger zerolog.Logger) *EventHandler {
	return &EventHandler{
		svc:    eventsvc.New(db, logger),
		logger: logger.With().Str("handler", "event").Logger(),
	}
}

func (h *EventHandler) ListEvents(ctx context.Context, req *gumav1.ListEventsRequest) (*gumav1.ListEventsResponse, error) {
	offset, err := eventsvc.ParsePageToken(req.PageToken)
	if err != nil {
		return nil, toStatus(err)
	}
	result, err := h.svc.List(ctx, eventsvc.ListParams{
		GuildID:  req.GuildId,
		View:     req.View,
		Date:     req.Date,
		PageSize: int(req.PageSize),
		Offset:   offset,
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.GuildEvent, len(result.Events))
	for i, e := range result.Events {
		protos[i] = eventToProto(e)
	}
	return &gumav1.ListEventsResponse{
		Events:        protos,
		NextPageToken: eventsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *EventHandler) GetEvent(ctx context.Context, req *gumav1.GetEventRequest) (*gumav1.GetEventResponse, error) {
	e, err := h.svc.Get(ctx, req.GuildId, req.EventId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetEventResponse{Event: eventToProto(e)}, nil
}

func (h *EventHandler) CreateEvent(ctx context.Context, req *gumav1.CreateEventRequest) (*gumav1.CreateEventResponse, error) {
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	e, err := h.svc.Create(ctx, eventsvc.CreateParams{
		GuildID:          req.GuildId,
		CreatedBy:        userID,
		Title:            req.Title,
		Description:      req.Description,
		Type:             req.Type,
		StartDate:        req.StartDate,
		EndDate:          req.EndDate,
		IsAllDay:         req.IsAllDay,
		Location:         req.Location,
		Priority:         req.Priority,
		IsRecurring:      req.IsRecurring,
		RecurringPattern: recurringPatternFromProto(req.RecurringPattern),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateEventResponse{Event: eventToProto(e)}, nil
}

func (h *EventHandler) UpdateEvent(ctx context.Context, req *gumav1.UpdateEventRequest) (*gumav1.UpdateEventResponse, error) {
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	e, err := h.svc.Update(ctx, eventsvc.UpdateParams{
		GuildID:          req.GuildId,
		EventID:          req.EventId,
		UserID:           userID,
		Title:            req.Title,
		Description:      req.Description,
		Type:             req.Type,
		StartDate:        req.StartDate,
		EndDate:          req.EndDate,
		IsAllDay:         req.IsAllDay,
		Location:         req.Location,
		Priority:         req.Priority,
		IsRecurring:      req.IsRecurring,
		RecurringPattern: recurringPatternFromProto(req.RecurringPattern),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateEventResponse{Event: eventToProto(e)}, nil
}

func (h *EventHandler) DeleteEvent(ctx context.Context, req *gumav1.DeleteEventRequest) (*gumav1.DeleteEventResponse, error) {
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	if err := h.svc.Delete(ctx, req.GuildId, req.EventId, userID); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteEventResponse{Success: true}, nil
}

func (h *EventHandler) ListEventsByRange(ctx context.Context, req *gumav1.ListEventsByRangeRequest) (*gumav1.ListEventsByRangeResponse, error) {
	events, err := h.svc.ListByRange(ctx, req.GuildId, req.StartDate, req.EndDate)
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.GuildEvent, len(events))
	for i, e := range events {
		protos[i] = eventToProto(e)
	}
	return &gumav1.ListEventsByRangeResponse{Events: protos}, nil
}

func (h *EventHandler) ListUpcomingEvents(ctx context.Context, req *gumav1.ListUpcomingEventsRequest) (*gumav1.ListUpcomingEventsResponse, error) {
	events, err := h.svc.ListUpcoming(ctx, req.GuildId, req.Limit)
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.GuildEvent, len(events))
	for i, e := range events {
		protos[i] = eventToProto(e)
	}
	return &gumav1.ListUpcomingEventsResponse{Events: protos}, nil
}

// --- proto conversion helpers ---

func eventToProto(e *eventsvc.GuildEvent) *gumav1.GuildEvent {
	return &gumav1.GuildEvent{
		Id:               e.ID,
		GuildId:          e.GuildID,
		CreatedBy:        e.CreatedBy,
		CreatedByName:    e.CreatedByName,
		Title:            e.Title,
		Description:      e.Description,
		Type:             e.Type,
		StartDate:        e.StartDate,
		EndDate:          e.EndDate,
		IsAllDay:         e.IsAllDay,
		Location:         e.Location,
		Priority:         e.Priority,
		IsRecurring:      e.IsRecurring,
		RecurringPattern: recurringPatternToProto(e.RecurringPattern),
		ParticipantIds:   e.ParticipantIDs,
		CreatedAt:        timestamppb.New(e.CreatedAt),
		UpdatedAt:        timestamppb.New(e.UpdatedAt),
	}
}

func recurringPatternToProto(p *eventsvc.RecurringPattern) *gumav1.RecurringPattern {
	if p == nil {
		return nil
	}
	return &gumav1.RecurringPattern{
		Type:          p.Type,
		Interval:      p.Interval,
		DaysOfWeek:    p.DaysOfWeek,
		EndDate:       p.EndDate,
		Occurrences:   p.Occurrences,
		CustomHours:   p.CustomHours,
		CustomMinutes: p.CustomMins,
	}
}

func recurringPatternFromProto(p *gumav1.RecurringPattern) *eventsvc.RecurringPattern {
	if p == nil {
		return nil
	}
	return &eventsvc.RecurringPattern{
		Type:        p.Type,
		Interval:    p.Interval,
		DaysOfWeek:  p.DaysOfWeek,
		EndDate:     p.EndDate,
		Occurrences: p.Occurrences,
		CustomHours: p.CustomHours,
		CustomMins:  p.CustomMinutes,
	}
}
