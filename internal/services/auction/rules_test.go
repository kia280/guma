package auction

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

func ptr[T any](v T) *T { return &v }

func openAuction(now time.Time) *AuctionItem {
	return &AuctionItem{
		Item:            models.Item{ID: "item", Name: "Sword", Category: "weapon", Rarity: "rare"},
		StartingBid:     10000,
		MinBidIncrement: 1000,
		StartTime:       now.Add(-time.Hour),
		EndTime:         now.Add(time.Hour),
		Status:          statusActive,
	}
}

func TestMinimumBid(t *testing.T) {
	assert.Equal(t, int64(10000), minimumBid(10000, 0, 1000, false))
	assert.Equal(t, int64(1000), minimumBid(0, 0, 1000, false))
	assert.Equal(t, int64(13000), minimumBid(10000, 12000, 1000, true))
}

func TestAuctionStateChecks(t *testing.T) {
	now := time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)
	future, past := now.Add(time.Hour), now.Add(-time.Minute)

	tests := []struct {
		name      string
		status    string
		endTime   time.Time
		editable  bool
		cancelOK  bool
		deletable bool
	}{
		{name: "upcoming", status: statusUpcoming, endTime: future, editable: true, cancelOK: true},
		{name: "active", status: statusActive, endTime: future, editable: true, cancelOK: true},
		{name: "active past end awaiting settlement", status: statusActive, endTime: past},
		{name: "ended", status: statusEnded, endTime: past},
		{name: "cancelled", status: statusCancelled, endTime: future, deletable: true},
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
			check(tt.editable, checkEditable(tt.status, tt.endTime, now))
			check(tt.cancelOK, checkCancellable(tt.status, tt.endTime, now))
			check(tt.deletable, checkDeletable(tt.status))
		})
	}
}

func TestApplyUpdateWithoutBids(t *testing.T) {
	now := time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)
	current := openAuction(now)
	newEnd := now.Add(3 * time.Hour)

	next, err := applyUpdate(current, "", UpdateParams{
		Item:            &models.Item{Name: " Axe ", Category: "weapon", Rarity: "epic", Description: " sharp "},
		StartingBid:     ptr(int64(5000)),
		MinBidIncrement: ptr(int64(500)),
		IsBlind:         ptr(true),
		EndTime:         &newEnd,
	}, now)
	require.NoError(t, err)
	assert.Equal(t, models.Item{ID: "item", Name: "Axe", Category: "weapon", Rarity: "epic", Description: "sharp"}, next.Item)
	assert.Equal(t, int64(5000), next.StartingBid)
	assert.Equal(t, int64(500), next.MinBidIncrement)
	assert.True(t, next.IsBlind)
	assert.Equal(t, newEnd, next.EndTime)
	assert.Equal(t, "Sword", current.Item.Name)
}

func TestApplyUpdateFreezesPricingAfterFirstBid(t *testing.T) {
	now := time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)
	current := openAuction(now)
	current.CurrentBidderID = "bidder"
	current.CurrentBid = 12000

	for name, p := range map[string]UpdateParams{
		"item":          {Item: &models.Item{Name: "Axe", Category: "weapon", Rarity: "rare"}},
		"starting bid":  {StartingBid: ptr(int64(1))},
		"increment":     {MinBidIncrement: ptr(int64(1))},
		"blind":         {IsBlind: ptr(true)},
		"shorter end":   {EndTime: ptr(now.Add(30 * time.Minute))},
		"started start": {StartTime: ptr(now.Add(time.Minute))},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := applyUpdate(current, "", p, now)
			assert.ErrorIs(t, err, errs.ErrFailedPrecondition)
		})
	}

	unchanged, err := applyUpdate(current, "", UpdateParams{
		Item:            &models.Item{Name: "Sword", Category: "weapon", Rarity: "rare"},
		StartingBid:     ptr(current.StartingBid),
		MinBidIncrement: ptr(current.MinBidIncrement),
		IsBlind:         ptr(false),
		EndTime:         ptr(current.EndTime.Add(400 * time.Millisecond)),
	}, now)
	require.NoError(t, err)
	assert.Equal(t, current.EndTime, unchanged.EndTime)

	extended, err := applyUpdate(current, "", UpdateParams{EndTime: ptr(now.Add(5 * time.Hour))}, now)
	require.NoError(t, err)
	assert.Equal(t, now.Add(5*time.Hour), extended.EndTime)
}

func TestApplyUpdateRejectsInventoryItemChanges(t *testing.T) {
	now := time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)
	_, err := applyUpdate(openAuction(now), "bank", UpdateParams{Item: &models.Item{Name: "Axe"}}, now)
	assert.ErrorIs(t, err, errs.ErrFailedPrecondition)
}

func TestApplyUpdateTimes(t *testing.T) {
	now := time.Date(2026, 9, 28, 12, 0, 0, 0, time.UTC)

	_, err := applyUpdate(openAuction(now), "", UpdateParams{EndTime: ptr(now.Add(-time.Minute))}, now)
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)

	upcoming := openAuction(now)
	upcoming.Status = statusUpcoming
	upcoming.StartTime = now.Add(time.Hour)
	upcoming.EndTime = now.Add(2 * time.Hour)

	_, err = applyUpdate(upcoming, "", UpdateParams{StartTime: ptr(now.Add(-time.Minute))}, now)
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)

	_, err = applyUpdate(upcoming, "", UpdateParams{StartTime: ptr(now.Add(3 * time.Hour))}, now)
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)

	next, err := applyUpdate(upcoming, "", UpdateParams{
		StartTime: ptr(now.Add(3 * time.Hour)),
		EndTime:   ptr(now.Add(5 * time.Hour)),
	}, now)
	require.NoError(t, err)
	assert.Equal(t, now.Add(3*time.Hour), next.StartTime)
	assert.Equal(t, now.Add(5*time.Hour), next.EndTime)
}
