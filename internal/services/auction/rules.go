package auction

import (
	"fmt"
	"strings"
	"time"

	"github.com/kia280/guma/internal/services/errs"
)

const (
	statusUpcoming  = "UPCOMING"
	statusEnded     = "ENDED"
	statusCancelled = "CANCELLED"
)

func minimumBid(startingBid, currentBid, increment int64, hasBids bool) int64 {
	if hasBids {
		return currentBid + increment
	}
	return max(startingBid, increment)
}

func isClosed(status string, endTime, now time.Time) bool {
	return status == statusActive && !endTime.After(now)
}

func checkEditable(status string, endTime, now time.Time) error {
	switch {
	case status == statusCancelled:
		return fmt.Errorf("%w: auction is cancelled", errs.ErrFailedPrecondition)
	case status == statusEnded, isClosed(status, endTime, now):
		return fmt.Errorf("%w: auction has ended", errs.ErrFailedPrecondition)
	}
	return nil
}

func checkCancellable(status string, endTime, now time.Time) error {
	switch {
	case status == statusCancelled:
		return fmt.Errorf("%w: auction is already cancelled", errs.ErrFailedPrecondition)
	case status == statusEnded, isClosed(status, endTime, now):
		return fmt.Errorf("%w: auction has ended", errs.ErrFailedPrecondition)
	}
	return nil
}

func checkDeletable(status string) error {
	if status != statusCancelled {
		return fmt.Errorf("%w: only cancelled auctions can be deleted", errs.ErrFailedPrecondition)
	}
	return nil
}

func sameInstant(a, b time.Time) bool {
	return a.Truncate(time.Second).Equal(b.Truncate(time.Second))
}

func applyUpdate(current *AuctionItem, sourceType string, p UpdateParams, now time.Time) (*AuctionItem, error) {
	next := *current
	hasBids := current.CurrentBidderID != ""
	locked := func(field string) error {
		return fmt.Errorf("%w: %s cannot change after the first bid", errs.ErrFailedPrecondition, field)
	}

	if p.Item != nil {
		item := *p.Item
		item.ID = current.Item.ID
		item.Name = strings.TrimSpace(item.Name)
		item.Description = strings.TrimSpace(item.Description)
		if item != current.Item {
			if sourceType != "" {
				return nil, fmt.Errorf("%w: an item listed from inventory cannot be changed", errs.ErrFailedPrecondition)
			}
			if hasBids {
				return nil, locked("item")
			}
			next.Item = item
		}
	}
	if p.StartingBid != nil && *p.StartingBid != current.StartingBid {
		if hasBids {
			return nil, locked("starting bid")
		}
		next.StartingBid = *p.StartingBid
	}
	if p.MinBidIncrement != nil && *p.MinBidIncrement != current.MinBidIncrement {
		if hasBids {
			return nil, locked("bid increment")
		}
		next.MinBidIncrement = *p.MinBidIncrement
	}
	if p.IsBlind != nil && *p.IsBlind != current.IsBlind {
		if hasBids {
			return nil, locked("blind bidding")
		}
		next.IsBlind = *p.IsBlind
	}
	if p.StartTime != nil && !sameInstant(*p.StartTime, current.StartTime) {
		if current.Status != statusUpcoming {
			return nil, fmt.Errorf("%w: start time cannot change after the auction starts", errs.ErrFailedPrecondition)
		}
		if !p.StartTime.After(now) {
			return nil, fmt.Errorf("%w: start time must be in the future", errs.ErrInvalidArgument)
		}
		next.StartTime = p.StartTime.UTC()
	}
	if p.EndTime != nil && !sameInstant(*p.EndTime, current.EndTime) {
		if !p.EndTime.After(now) {
			return nil, fmt.Errorf("%w: end time must be in the future", errs.ErrInvalidArgument)
		}
		if hasBids && p.EndTime.Before(current.EndTime) {
			return nil, fmt.Errorf("%w: end time can only be extended once bids are placed", errs.ErrFailedPrecondition)
		}
		next.EndTime = p.EndTime.UTC()
	}
	if !next.EndTime.After(next.StartTime) {
		return nil, fmt.Errorf("%w: end time must be after start time", errs.ErrInvalidArgument)
	}
	return &next, nil
}
