package guild

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/kia280/guma/internal/services/errs"
)

type Stats struct {
	MemberCount      int32
	BankBalance      int64
	BankCurrency     string
	ActiveEventCount int32
	BankItemCount    int32
}

func (s *Service) Stats(ctx context.Context, guildIDStr, userIDStr string) (*Stats, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, userID, "owner", "admin"); err != nil {
		return nil, err
	}

	row, err := s.q.GetGuildStats(ctx, guildID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: get guild stats: %v", errs.ErrInternal, err)
	}

	return &Stats{
		MemberCount:      row.MemberCount,
		BankBalance:      row.BankBalance,
		BankCurrency:     row.BankCurrency,
		ActiveEventCount: row.ActiveEventCount,
		BankItemCount:    row.BankItemCount,
	}, nil
}
