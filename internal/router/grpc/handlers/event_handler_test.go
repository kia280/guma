package handlers

import (
	"context"
	"testing"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

func TestEventHandler_RejectsMalformedIDs(t *testing.T) {
	h := NewEventService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), testUserID)
	const guildID = "00000000-0000-0000-0000-000000000002"
	const eventID = "00000000-0000-0000-0000-000000000003"

	tests := []struct {
		name string
		call func() error
	}{
		{name: "list events guild", call: func() error {
			_, err := h.ListEvents(authed, &gumav1.ListEventsRequest{GuildId: "bad"})
			return err
		}},
		{name: "get event guild", call: func() error {
			_, err := h.GetEvent(authed, &gumav1.GetEventRequest{GuildId: "bad", EventId: eventID})
			return err
		}},
		{name: "get event id", call: func() error {
			_, err := h.GetEvent(authed, &gumav1.GetEventRequest{GuildId: guildID, EventId: "bad"})
			return err
		}},
		{name: "create event guild", call: func() error {
			_, err := h.CreateEvent(authed, &gumav1.CreateEventRequest{GuildId: "bad"})
			return err
		}},
		{name: "update event id", call: func() error {
			_, err := h.UpdateEvent(authed, &gumav1.UpdateEventRequest{GuildId: guildID, EventId: "bad"})
			return err
		}},
		{name: "delete event id", call: func() error {
			_, err := h.DeleteEvent(authed, &gumav1.DeleteEventRequest{GuildId: guildID, EventId: "bad"})
			return err
		}},
		{name: "list events by range guild", call: func() error {
			_, err := h.ListEventsByRange(authed, &gumav1.ListEventsByRangeRequest{GuildId: "bad"})
			return err
		}},
		{name: "list upcoming events guild", call: func() error {
			_, err := h.ListUpcomingEvents(authed, &gumav1.ListUpcomingEventsRequest{GuildId: "bad"})
			return err
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requireCode(t, tt.call(), codes.InvalidArgument)
		})
	}
}

func TestEventHandler_RequiresAuthenticatedUser(t *testing.T) {
	h := NewEventService(nil, zerolog.Nop())
	_, err := h.DeleteEvent(context.Background(), &gumav1.DeleteEventRequest{})
	requireCode(t, err, codes.Unauthenticated)
}
