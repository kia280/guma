package event

import (
	"fmt"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/kia280/guma/internal/services/errs"
)

const (
	maxTitleLength       = 200
	maxDescriptionLength = 2000
	maxLocationLength    = 200
	maxDaysOfWeek        = 7
)

var (
	eventTypes      = []string{"boss_respawn", "guild_war", "guild_meeting", "raid", "training", "tournament", "social", "other"}
	eventPriorities = []string{"low", "medium", "high", "critical"}
	recurringTypes  = []string{"daily", "weekly", "monthly", "custom"}
)

type eventFields struct {
	Title            string
	Description      string
	Type             string
	Location         string
	Priority         string
	RecurringPattern *RecurringPattern
}

func normalizeFields(f eventFields) (eventFields, error) {
	if f.Priority == "" {
		f.Priority = "medium"
	}
	if f.Type == "" {
		f.Type = "other"
	}
	f.Title = strings.TrimSpace(f.Title)
	if f.Title == "" {
		return f, fmt.Errorf("%w: title is required", errs.ErrInvalidArgument)
	}
	for _, c := range []struct {
		field, value string
		max          int
	}{
		{"title", f.Title, maxTitleLength},
		{"description", f.Description, maxDescriptionLength},
		{"location", f.Location, maxLocationLength},
	} {
		if utf8.RuneCountInString(c.value) > c.max {
			return f, fmt.Errorf("%w: %s must be at most %d characters", errs.ErrInvalidArgument, c.field, c.max)
		}
	}
	if !slices.Contains(eventTypes, f.Type) {
		return f, fmt.Errorf("%w: unknown event type", errs.ErrInvalidArgument)
	}
	if !slices.Contains(eventPriorities, f.Priority) {
		return f, fmt.Errorf("%w: unknown event priority", errs.ErrInvalidArgument)
	}
	if rp := f.RecurringPattern; rp != nil {
		if !slices.Contains(recurringTypes, rp.Type) {
			return f, fmt.Errorf("%w: unknown recurring pattern type", errs.ErrInvalidArgument)
		}
		if len(rp.DaysOfWeek) > maxDaysOfWeek {
			return f, fmt.Errorf("%w: days_of_week must have at most %d entries", errs.ErrInvalidArgument, maxDaysOfWeek)
		}
	}
	return f, nil
}
