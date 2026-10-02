package event

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

// GuildEvent is the domain model for a guild event.
type GuildEvent struct {
	ID               string
	GuildID          string
	CreatedBy        string
	CreatedByName    string
	Title            string
	Description      string
	Type             string
	StartDate        string
	EndDate          string
	IsAllDay         bool
	Location         string
	Priority         string
	IsRecurring      bool
	RecurringPattern *RecurringPattern
	ParticipantIDs   []string
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// RecurringPattern holds recurrence configuration.
type RecurringPattern struct {
	Type        string
	Interval    int32
	DaysOfWeek  []int32
	EndDate     string
	Occurrences int32
	CustomHours int32
	CustomMins  int32
}

// ListParams holds the inputs for List.
type ListParams struct {
	GuildID  string
	View     string
	Date     string
	PageSize int
	Offset   int
}

// ListResult is returned by List.
type ListResult struct {
	Events     []*GuildEvent
	TotalCount int32
	NextOffset int
}

// CreateParams holds the inputs for Create.
type CreateParams struct {
	GuildID          string
	CreatedBy        string
	Title            string
	Description      string
	Type             string
	StartDate        string
	EndDate          string
	IsAllDay         bool
	Location         string
	Priority         string
	IsRecurring      bool
	RecurringPattern *RecurringPattern
}

// UpdateParams holds the inputs for Update.
type UpdateParams struct {
	GuildID          string
	EventID          string
	UserID           string
	Title            string
	Description      string
	Type             string
	StartDate        string
	EndDate          string
	IsAllDay         bool
	Location         string
	Priority         string
	IsRecurring      bool
	RecurringPattern *RecurringPattern
}

// eventRow is the common subset of fields from event queries.
type eventRow struct {
	ID               uuid.UUID
	GuildID          uuid.UUID
	CreatedBy        uuid.UUID
	CreatedByName    string
	Title            string
	Description      string
	Type             string
	StartDate        string
	EndDate          string
	IsAllDay         bool
	Location         string
	Priority         string
	IsRecurring      bool
	RecurringPattern []byte
	ParticipantIds   []uuid.UUID
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// Service handles event business logic.
type Service struct {
	q      *db.Queries
	logger zerolog.Logger
}

// New creates a new event Service.
func New(pool *database.Pool, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{
		q:      q,
		logger: logger.With().Str("service", "event").Logger(),
	}
}

// List returns paginated events for a guild.
func (s *Service) List(ctx context.Context, p ListParams) (*ListResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}

	rows, err := s.q.ListEvents(ctx, db.ListEventsParams{
		GuildID: guildID, PageSize: int32(pageSize), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list events: %v", errs.ErrInternal, err)
	}

	events := make([]*GuildEvent, 0, len(rows))
	for _, r := range rows {
		events = append(events, toEvent(eventRow(r)))
	}

	total, _ := s.q.CountEvents(ctx, guildID)

	nextOffset := 0
	if len(events) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListResult{Events: events, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// Get fetches a single event by ID.
func (s *Service) Get(ctx context.Context, guildIDStr, eventIDStr string) (*GuildEvent, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: event", errs.ErrNotFound)
	}
	eventID, err := uuid.Parse(eventIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: event", errs.ErrNotFound)
	}
	r, err := s.q.GetEvent(ctx, db.GetEventParams{ID: eventID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: event", errs.ErrNotFound)
	}
	return toEvent(eventRow(r)), nil
}

// Create inserts a new guild event.
func (s *Service) Create(ctx context.Context, p CreateParams) (*GuildEvent, error) {
	f := normalizeFields(eventFields{Title: p.Title, Type: p.Type, Priority: p.Priority})
	p.Title, p.Type, p.Priority = f.Title, f.Type, f.Priority
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	createdBy, err := uuid.Parse(p.CreatedBy)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}

	rpJSON, err := marshalPattern(p.RecurringPattern)
	if err != nil {
		return nil, fmt.Errorf("%w: encode recurring pattern: %v", errs.ErrInternal, err)
	}

	r, err := s.q.CreateEvent(ctx, db.CreateEventParams{
		GuildID: guildID, CreatedBy: createdBy,
		Title: p.Title, Description: p.Description, Type: p.Type,
		StartDate: p.StartDate, EndDate: p.EndDate, IsAllDay: p.IsAllDay,
		Location: p.Location, Priority: p.Priority,
		IsRecurring: p.IsRecurring, RecurringPattern: rpJSON,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: create event: %v", errs.ErrInternal, err)
	}
	e := toEvent(eventRow(r))
	s.logger.Info().Str("event_id", e.ID).Str("guild_id", p.GuildID).Msg("event created")
	return e, nil
}

// Update modifies an existing event.
func (s *Service) Update(ctx context.Context, p UpdateParams) (*GuildEvent, error) {
	f := normalizeFields(eventFields{Title: p.Title, Type: p.Type, Priority: p.Priority})
	p.Title, p.Type, p.Priority = f.Title, f.Type, f.Priority
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: event", errs.ErrNotFound)
	}
	eventID, err := uuid.Parse(p.EventID)
	if err != nil {
		return nil, fmt.Errorf("%w: event", errs.ErrNotFound)
	}

	rpJSON, err := marshalPattern(p.RecurringPattern)
	if err != nil {
		return nil, fmt.Errorf("%w: encode recurring pattern: %v", errs.ErrInternal, err)
	}

	r, err := s.q.UpdateEvent(ctx, db.UpdateEventParams{
		Title: p.Title, Description: p.Description, Type: p.Type,
		StartDate: p.StartDate, EndDate: p.EndDate, IsAllDay: p.IsAllDay,
		Location: p.Location, Priority: p.Priority,
		IsRecurring: p.IsRecurring, RecurringPattern: rpJSON,
		ID: eventID, GuildID: guildID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: event", errs.ErrNotFound)
	}
	return toEvent(eventRow(r)), nil
}

// Delete removes a guild event.
func (s *Service) Delete(ctx context.Context, guildIDStr, eventIDStr, userIDStr string) error {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return fmt.Errorf("%w: event", errs.ErrNotFound)
	}
	eventID, err := uuid.Parse(eventIDStr)
	if err != nil {
		return fmt.Errorf("%w: event", errs.ErrNotFound)
	}
	n, err := s.q.DeleteEvent(ctx, db.DeleteEventParams{ID: eventID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: delete event: %v", errs.ErrInternal, err)
	}
	if n == 0 {
		return fmt.Errorf("%w: event", errs.ErrNotFound)
	}
	return nil
}

// ListByRange returns events within a date range.
func (s *Service) ListByRange(ctx context.Context, guildIDStr, startDate, endDate string) ([]*GuildEvent, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	rows, err := s.q.ListEventsByRange(ctx, db.ListEventsByRangeParams{
		GuildID: guildID, StartDate: startDate, EndDate: endDate,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list events by range: %v", errs.ErrInternal, err)
	}
	events := make([]*GuildEvent, 0, len(rows))
	for _, r := range rows {
		events = append(events, toEvent(eventRow(r)))
	}
	return events, nil
}

// ListUpcoming returns the next N upcoming events for a guild.
func (s *Service) ListUpcoming(ctx context.Context, guildIDStr string, limit int32) ([]*GuildEvent, error) {
	if limit <= 0 {
		limit = 10
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	rows, err := s.q.ListUpcomingEvents(ctx, db.ListUpcomingEventsParams{GuildID: guildID, Lim: limit})
	if err != nil {
		return nil, fmt.Errorf("%w: list upcoming events: %v", errs.ErrInternal, err)
	}
	events := make([]*GuildEvent, 0, len(rows))
	for _, r := range rows {
		events = append(events, toEvent(eventRow(r)))
	}
	return events, nil
}

// --- helpers ---

func toEvent(r eventRow) *GuildEvent {
	e := &GuildEvent{
		ID: r.ID.String(), GuildID: r.GuildID.String(), CreatedBy: r.CreatedBy.String(), CreatedByName: r.CreatedByName,
		Title: r.Title, Description: r.Description, Type: r.Type,
		StartDate: r.StartDate, EndDate: r.EndDate, IsAllDay: r.IsAllDay,
		Location: r.Location, Priority: r.Priority, IsRecurring: r.IsRecurring,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		ParticipantIDs: []string{},
	}
	if len(r.RecurringPattern) > 0 {
		var rp RecurringPattern
		if err := json.Unmarshal(r.RecurringPattern, &rp); err == nil {
			e.RecurringPattern = &rp
		}
	}
	for _, id := range r.ParticipantIds {
		e.ParticipantIDs = append(e.ParticipantIDs, id.String())
	}
	return e
}

func marshalPattern(p *RecurringPattern) ([]byte, error) {
	if p == nil {
		return nil, nil
	}
	return json.Marshal(p)
}

// NextPageToken encodes the offset as a page token string.
func NextPageToken(offset int) string {
	if offset == 0 {
		return ""
	}
	return strconv.Itoa(offset)
}

// ParsePageToken decodes a page token string to an offset.
func ParsePageToken(token string) (int, error) {
	if token == "" {
		return 0, nil
	}
	n, err := strconv.ParseInt(token, 10, 32)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("%w: invalid page_token", errs.ErrInvalidArgument)
	}
	return int(n), nil
}
