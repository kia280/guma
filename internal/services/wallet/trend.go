package wallet

import (
	"context"
	"fmt"
	"time"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	defaultTrendDays = 30
	maxTrendDays     = 365
	trendDateLayout  = "2006-01-02"
)

type BalancePoint struct {
	Date    string
	Balance int64
}

type balanceChange struct {
	at     time.Time
	amount int64
}

func (s *Service) GetBalanceTrend(ctx context.Context, userIDStr, guildIDStr string, days int32) ([]*BalancePoint, error) {
	userID, guildID, err := parseIDs(userIDStr, guildIDStr)
	if err != nil {
		return nil, err
	}
	span := normalizeTrendDays(days)
	from := trendWindowStart(time.Now(), span)

	count, err := s.q.CountWalletTransactions(ctx, db.CountWalletTransactionsParams{UserID: userID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: count transactions: %v", errs.ErrInternal, err)
	}
	if count == 0 {
		return []*BalancePoint{}, nil
	}

	opening, err := s.q.SumWalletTransactionsBefore(ctx, db.SumWalletTransactionsBeforeParams{UserID: userID, GuildID: guildID, Before: from})
	if err != nil {
		return nil, fmt.Errorf("%w: sum opening balance: %v", errs.ErrInternal, err)
	}
	rows, err := s.q.ListWalletBalanceChangesSince(ctx, db.ListWalletBalanceChangesSinceParams{UserID: userID, GuildID: guildID, Since: from})
	if err != nil {
		return nil, fmt.Errorf("%w: list balance changes: %v", errs.ErrInternal, err)
	}

	changes := make([]balanceChange, len(rows))
	for i, r := range rows {
		changes[i] = balanceChange{at: r.CreatedAt, amount: r.Amount}
	}
	return dailyBalances(opening, changes, from, span), nil
}

func normalizeTrendDays(days int32) int {
	switch {
	case days <= 0:
		return defaultTrendDays
	case days > maxTrendDays:
		return maxTrendDays
	default:
		return int(days)
	}
}

func trendWindowStart(now time.Time, days int) time.Time {
	utc := now.UTC()
	today := time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
	return today.AddDate(0, 0, -(days - 1))
}

func dailyBalances(opening int64, changes []balanceChange, from time.Time, days int) []*BalancePoint {
	points := make([]*BalancePoint, 0, days)
	balance := opening
	next := 0
	for i := 0; i < days; i++ {
		day := from.AddDate(0, 0, i)
		dayEnd := day.AddDate(0, 0, 1)
		for next < len(changes) && changes[next].at.Before(dayEnd) {
			balance += changes[next].amount
			next++
		}
		points = append(points, &BalancePoint{Date: day.Format(trendDateLayout), Balance: balance})
	}
	return points
}
