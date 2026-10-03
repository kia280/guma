package raffle

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

func ptr[T any](v T) *T { return &v }

func TestRaffleStateChecks(t *testing.T) {
	now := time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)
	future, past := now.Add(time.Hour), now.Add(-time.Minute)

	tests := []struct {
		name      string
		status    string
		drawDate  time.Time
		open      bool
		editable  bool
		cancelOK  bool
		deletable bool
	}{
		{name: "active", status: statusActive, drawDate: future, open: true, editable: true, cancelOK: true},
		{name: "upcoming", status: statusUpcoming, drawDate: future, open: true, editable: true, cancelOK: true},
		{name: "due but not drawn", status: statusActive, drawDate: past},
		{name: "ended", status: statusEnded, drawDate: past},
		{name: "cancelled", status: statusCancelled, drawDate: future, deletable: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			check := func(ok bool, err error) {
				if ok {
					assert.NoError(t, err)
				} else {
					assert.ErrorIs(t, err, errs.ErrFailedPrecondition)
				}
			}
			check(tt.open, checkOpen(tt.status, tt.drawDate, now))
			check(tt.editable, checkEditable(tt.status, tt.drawDate, now))
			check(tt.cancelOK, checkCancellable(tt.status, tt.drawDate, now))
			check(tt.deletable, checkDeletable(tt.status))
		})
	}
	assert.False(t, isOpenStatus(statusCancelled))
}

func TestValidateRaffleUpdate(t *testing.T) {
	now := time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)
	tests := []struct {
		name string
		p    UpdateParams
		ok   bool
	}{
		{name: "clear description", p: UpdateParams{Description: ptr("")}, ok: true},
		{name: "past draw date", p: UpdateParams{DrawDate: "2026-09-28T11:00:00Z"}},
		{name: "malformed draw date", p: UpdateParams{DrawDate: "tomorrow"}},
		{name: "future draw date", p: UpdateParams{DrawDate: "2026-09-29T12:00:00Z"}, ok: true},
		{name: "free tickets", p: UpdateParams{TicketPrice: ptr(int64(0))}, ok: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateUpdate(tt.p, now)
			if tt.ok {
				assert.NoError(t, err)
			} else {
				assert.ErrorIs(t, err, errs.ErrInvalidArgument)
			}
		})
	}
}

func TestApplyRaffleUpdate(t *testing.T) {
	drawDate := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	current := db.LockRaffleRow{
		Title: "Raffle", TicketPrice: 1000, MaxTickets: 100, MaxTicketsPerUser: 5, DrawDate: drawDate,
	}

	next, err := applyUpdate(current, UpdateParams{
		Title: ptr(" New "), Description: ptr(""), DrawDate: "2026-10-02T08:00:00+08:00",
		TicketPrice: ptr(int64(2000)), MaxTickets: ptr(int32(0)), MaxTicketsPerUser: ptr(int32(1)),
	})
	require.NoError(t, err)
	assert.Equal(t, db.UpdateRaffleParams{
		Title: "New", SetDescription: true, Description: "",
		TicketPrice: 2000, MaxTickets: 0, MaxTicketsPerUser: 1,
		DrawDate: time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC),
	}, next)

	kept, err := applyUpdate(current, UpdateParams{Title: ptr("Raffle")})
	require.NoError(t, err)
	assert.False(t, kept.SetDescription)
	assert.Equal(t, drawDate, kept.DrawDate)
	assert.Equal(t, int64(1000), kept.TicketPrice)
}

func TestApplyRaffleUpdateFreezesTicketsAfterSale(t *testing.T) {
	current := db.LockRaffleRow{Title: "Raffle", TicketPrice: 1000, MaxTickets: 100, MaxTicketsPerUser: 5, TicketsSold: 1}

	for name, p := range map[string]UpdateParams{
		"price":    {TicketPrice: ptr(int64(500))},
		"max":      {MaxTickets: ptr(int32(200))},
		"per user": {MaxTicketsPerUser: ptr(int32(10))},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := applyUpdate(current, p)
			assert.ErrorIs(t, err, errs.ErrFailedPrecondition)
		})
	}

	next, err := applyUpdate(current, UpdateParams{
		Title: ptr("Renamed"), TicketPrice: ptr(int64(1000)), MaxTickets: ptr(int32(100)), MaxTicketsPerUser: ptr(int32(5)),
	})
	require.NoError(t, err)
	assert.Equal(t, "Renamed", next.Title)
}
