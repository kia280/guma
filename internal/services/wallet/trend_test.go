package wallet

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeTrendDays(t *testing.T) {
	assert.Equal(t, defaultTrendDays, normalizeTrendDays(0))
	assert.Equal(t, defaultTrendDays, normalizeTrendDays(-7))
	assert.Equal(t, 7, normalizeTrendDays(7))
	assert.Equal(t, maxTrendDays, normalizeTrendDays(maxTrendDays+1))
}

func TestTrendWindowStart(t *testing.T) {
	taipei := time.FixedZone("Asia/Taipei", 8*60*60)
	now := time.Date(2026, time.September, 26, 3, 30, 0, 0, taipei)

	got := trendWindowStart(now, 30)

	assert.Equal(t, time.Date(2026, time.August, 27, 0, 0, 0, 0, time.UTC), got)
	assert.Equal(t, time.Date(2026, time.September, 25, 0, 0, 0, 0, time.UTC), trendWindowStart(now, 1))
}

func TestDailyBalancesCarriesOpeningBalanceForward(t *testing.T) {
	from := time.Date(2026, time.September, 23, 0, 0, 0, 0, time.UTC)

	points := dailyBalances(500, nil, from, 3)

	require.Len(t, points, 3)
	assert.Equal(t, "2026-09-23", points[0].Date)
	assert.Equal(t, "2026-09-25", points[2].Date)
	for _, p := range points {
		assert.Equal(t, int64(500), p.Balance)
	}
}

func TestDailyBalancesAccumulatesChangesPerDay(t *testing.T) {
	from := time.Date(2026, time.September, 23, 0, 0, 0, 0, time.UTC)
	changes := []balanceChange{
		{at: from.Add(9 * time.Hour), amount: 100},
		{at: from.Add(23*time.Hour + 59*time.Minute), amount: -30},
		{at: from.AddDate(0, 0, 2).Add(time.Second), amount: 50},
	}

	points := dailyBalances(500, changes, from, 4)

	require.Len(t, points, 4)
	assert.Equal(t, []int64{570, 570, 620, 620}, balances(points))
}

func TestDailyBalancesBucketsByUTCDay(t *testing.T) {
	from := time.Date(2026, time.September, 23, 0, 0, 0, 0, time.UTC)
	taipei := time.FixedZone("Asia/Taipei", 8*60*60)
	changes := []balanceChange{
		{at: time.Date(2026, time.September, 24, 7, 0, 0, 0, taipei), amount: 40},
	}

	points := dailyBalances(0, changes, from, 2)

	assert.Equal(t, []int64{40, 40}, balances(points))
}

func TestDailyBalancesIgnoresChangesAfterWindow(t *testing.T) {
	from := time.Date(2026, time.September, 23, 0, 0, 0, 0, time.UTC)
	changes := []balanceChange{
		{at: from.AddDate(0, 0, 2), amount: 999},
	}

	points := dailyBalances(10, changes, from, 2)

	assert.Equal(t, []int64{10, 10}, balances(points))
}

func balances(points []*BalancePoint) []int64 {
	out := make([]int64, len(points))
	for i, p := range points {
		out[i] = p.Balance
	}
	return out
}
