package raffle

import (
	"fmt"
	"strings"
	"time"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	statusActive    = "active"
	statusUpcoming  = "upcoming"
	statusEnded     = "ended"
	statusCancelled = "cancelled"
)

func isOpenStatus(status string) bool {
	return status == statusActive || status == statusUpcoming
}

func checkOpen(status string, drawDate, now time.Time) error {
	if !isOpenStatus(status) {
		return fmt.Errorf("%w: raffle is not open for ticket purchase", errs.ErrFailedPrecondition)
	}
	if !drawDate.After(now) {
		return fmt.Errorf("%w: ticket sales have closed", errs.ErrFailedPrecondition)
	}
	return nil
}

func checkEditable(status string, drawDate, now time.Time) error {
	switch {
	case status == statusCancelled:
		return fmt.Errorf("%w: raffle is cancelled", errs.ErrFailedPrecondition)
	case status == statusEnded:
		return fmt.Errorf("%w: raffle already drawn", errs.ErrFailedPrecondition)
	case !drawDate.After(now):
		return fmt.Errorf("%w: raffle is due to be drawn", errs.ErrFailedPrecondition)
	}
	return nil
}

func checkCancellable(status string, drawDate, now time.Time) error {
	switch {
	case status == statusCancelled:
		return fmt.Errorf("%w: raffle is already cancelled", errs.ErrFailedPrecondition)
	case status == statusEnded:
		return fmt.Errorf("%w: raffle already drawn", errs.ErrFailedPrecondition)
	case !drawDate.After(now):
		return fmt.Errorf("%w: raffle is due to be drawn", errs.ErrFailedPrecondition)
	}
	return nil
}

func checkDeletable(status string) error {
	if status != statusCancelled {
		return fmt.Errorf("%w: only cancelled raffles can be deleted", errs.ErrFailedPrecondition)
	}
	return nil
}

func validateUpdate(p UpdateParams, now time.Time) error {
	if p.Title != nil && strings.TrimSpace(*p.Title) == "" {
		return fmt.Errorf("%w: title is required", errs.ErrInvalidArgument)
	}
	if p.DrawDate != "" {
		at, err := time.Parse(time.RFC3339, p.DrawDate)
		if err != nil {
			return fmt.Errorf("%w: draw_date must be an ISO 8601 datetime", errs.ErrInvalidArgument)
		}
		if !at.After(now) {
			return fmt.Errorf("%w: draw_date must be in the future", errs.ErrInvalidArgument)
		}
	}
	if p.TicketPrice != nil && *p.TicketPrice < 0 {
		return fmt.Errorf("%w: ticket price cannot be negative", errs.ErrInvalidArgument)
	}
	if p.MaxTickets != nil && *p.MaxTickets < 0 {
		return fmt.Errorf("%w: max tickets cannot be negative", errs.ErrInvalidArgument)
	}
	if p.MaxTicketsPerUser != nil && *p.MaxTicketsPerUser < 0 {
		return fmt.Errorf("%w: max tickets per user cannot be negative", errs.ErrInvalidArgument)
	}
	if p.Title == nil && p.Description == nil && p.DrawDate == "" &&
		p.TicketPrice == nil && p.MaxTickets == nil && p.MaxTicketsPerUser == nil {
		return fmt.Errorf("%w: nothing to update", errs.ErrInvalidArgument)
	}
	return nil
}

func applyUpdate(current db.LockRaffleRow, p UpdateParams) (db.UpdateRaffleParams, error) {
	next := db.UpdateRaffleParams{
		Title:             current.Title,
		TicketPrice:       current.TicketPrice,
		MaxTickets:        current.MaxTickets,
		MaxTicketsPerUser: current.MaxTicketsPerUser,
		DrawDate:          current.DrawDate,
	}
	if p.Title != nil {
		next.Title = strings.TrimSpace(*p.Title)
	}
	if p.Description != nil {
		next.SetDescription = true
		next.Description = strings.TrimSpace(*p.Description)
	}
	if p.DrawDate != "" {
		at, err := time.Parse(time.RFC3339, p.DrawDate)
		if err != nil {
			return db.UpdateRaffleParams{}, fmt.Errorf("%w: draw_date must be an ISO 8601 datetime", errs.ErrInvalidArgument)
		}
		next.DrawDate = at.UTC()
	}

	sold := current.TicketsSold > 0
	locked := func(field string) error {
		return fmt.Errorf("%w: %s cannot change after tickets are sold", errs.ErrFailedPrecondition, field)
	}
	if p.TicketPrice != nil && *p.TicketPrice != current.TicketPrice {
		if sold {
			return db.UpdateRaffleParams{}, locked("ticket price")
		}
		next.TicketPrice = *p.TicketPrice
	}
	if p.MaxTickets != nil && *p.MaxTickets != current.MaxTickets {
		if sold {
			return db.UpdateRaffleParams{}, locked("ticket limit")
		}
		next.MaxTickets = *p.MaxTickets
	}
	if p.MaxTicketsPerUser != nil && *p.MaxTicketsPerUser != current.MaxTicketsPerUser {
		if sold {
			return db.UpdateRaffleParams{}, locked("per-member ticket limit")
		}
		next.MaxTicketsPerUser = *p.MaxTicketsPerUser
	}
	return next, nil
}
