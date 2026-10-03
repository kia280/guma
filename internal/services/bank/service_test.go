package bank

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/stretchr/testify/assert"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

func TestCheckReviewable(t *testing.T) {
	tests := []struct {
		name   string
		status string
		want   error
	}{
		{name: "pending", status: StatusPending},
		{name: "already approved", status: StatusApproved, want: errs.ErrFailedPrecondition},
		{name: "already rejected", status: StatusRejected, want: errs.ErrFailedPrecondition},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := checkReviewable(tt.status)
			if tt.want == nil {
				assert.NoError(t, err)
				return
			}
			assert.True(t, errors.Is(err, tt.want), "expected %v, got %v", tt.want, err)
		})
	}
}

func TestToItemRequest(t *testing.T) {
	id, guild, requester, reviewer := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	created := time.Date(2026, 9, 24, 10, 0, 0, 0, time.UTC)
	reviewed := created.Add(time.Hour)

	ir := toItemRequest(db.ListItemRequestsRow{
		ID: id, GuildID: guild, BankItemID: nil, RequesterID: requester,
		RequesterName: "Aria", Reason: "tank gear", Status: StatusApproved,
		ReviewerID: &reviewer, ReviewNote: "ok", CreatedAt: created,
		ReviewedAt: pgtype.Timestamptz{Time: reviewed, Valid: true},
		Item:       []byte(`{"id":"i1","name":"Iron Shield","category":"ARMOR","rarity":"RARE"}`),
	})

	assert.Equal(t, "", ir.BankItemID)
	assert.Equal(t, reviewer.String(), ir.ReviewerID)
	assert.Equal(t, "Iron Shield", ir.Item.Name)
	assert.Equal(t, "RARE", ir.Item.Rarity)
	if assert.NotNil(t, ir.ReviewedAt) {
		assert.Equal(t, reviewed, *ir.ReviewedAt)
	}
}
