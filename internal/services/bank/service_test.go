package bank

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/authz/authztest"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	testGuild = "00000000-0000-0000-0000-000000000001"
	testUser  = "00000000-0000-0000-0000-000000000002"
)

func TestRequestFundsValidatesInput(t *testing.T) {
	s := New(nil, nil, zerolog.Nop())
	tests := []struct {
		name   string
		guild  string
		user   string
		amount int64
		reason string
	}{
		{name: "bad guild id", guild: "nope", user: testUser, amount: 10, reason: "raid"},
		{name: "bad user id", guild: testGuild, user: "nope", amount: 10, reason: "raid"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := s.RequestFunds(context.Background(), tt.guild, tt.user, tt.amount, tt.reason)
			assert.ErrorIs(t, err, errs.ErrInvalidArgument)
		})
	}
}

func TestDeleteBankItemValidatesIDs(t *testing.T) {
	s := New(nil, nil, zerolog.Nop())
	tests := []struct {
		name  string
		guild string
		user  string
		item  string
		want  error
	}{
		{name: "bad guild id", guild: "nope", user: testUser, item: uuid.NewString(), want: errs.ErrNotFound},
		{name: "bad user id", guild: testGuild, user: "nope", item: uuid.NewString(), want: errs.ErrInvalidArgument},
		{name: "bad item id", guild: testGuild, user: testUser, item: "nope", want: errs.ErrNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.ErrorIs(t, s.DeleteBankItem(context.Background(), tt.guild, tt.user, tt.item), tt.want)
		})
	}
}

func TestDeleteBankItemRequiresDeletePermission(t *testing.T) {
	guild, user := uuid.MustParse(testGuild), uuid.MustParse(testUser)
	checker := authztest.New().Grant(guild, user, authz.View, authz.ReviewBankRequests)
	s := New(nil, checker, zerolog.Nop())
	err := s.DeleteBankItem(context.Background(), testGuild, testUser, uuid.NewString())
	assert.ErrorIs(t, err, errs.ErrPermissionDenied)
}

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
