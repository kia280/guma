package checkin

import (
	"context"
	"strings"
	"testing"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

func TestPrepareBankLootAssignsIDsAndDefaults(t *testing.T) {
	loot, err := prepareBankLoot([]models.Item{
		{ID: "client-id", Name: " Dragon Scale ", Category: "MATERIAL", Rarity: "Epic", Description: "hot"},
		{Name: "Coin"},
		{Name: "Coin"},
	})
	require.NoError(t, err)
	require.Len(t, loot, 3)

	seen := map[string]bool{}
	for _, item := range loot {
		_, err := uuid.Parse(item.ID)
		assert.NoError(t, err)
		assert.False(t, seen[item.ID])
		seen[item.ID] = true
	}
	assert.NotEqual(t, "client-id", loot[0].ID)
	assert.Equal(t, models.Item{ID: loot[0].ID, Name: "Dragon Scale", Category: "material", Rarity: "epic", Description: "hot"}, loot[0])
	assert.Equal(t, models.Item{ID: loot[1].ID, Name: "Coin", Category: "misc", Rarity: "common"}, loot[1])
}

func TestPrepareBankLootRejectsBlankNames(t *testing.T) {
	_, err := prepareBankLoot([]models.Item{{Name: "Sword"}, {Name: "  "}})
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
}

func TestPrepareBankLootEmpty(t *testing.T) {
	loot, err := prepareBankLoot(nil)
	require.NoError(t, err)
	assert.Empty(t, loot)
	assert.NotNil(t, loot)
}

func TestNormalizeAttendanceNotes(t *testing.T) {
	notes, err := normalizeAttendanceNotes("  Late arrival \n")
	require.NoError(t, err)
	assert.Equal(t, "Late arrival", notes)

	notes, err = normalizeAttendanceNotes(strings.Repeat("遲", maxAttendanceNotes))
	require.NoError(t, err)
	assert.Equal(t, maxAttendanceNotes, utf8.RuneCountInString(notes))

	_, err = normalizeAttendanceNotes(strings.Repeat("a", maxAttendanceNotes+1))
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
}

func TestSubmitAttendanceRejectsLongNotesBeforeQuerying(t *testing.T) {
	s := &Service{}
	_, err := s.SubmitAttendance(context.Background(),
		"00000000-0000-0000-0000-000000000001",
		"00000000-0000-0000-0000-000000000002",
		"00000000-0000-0000-0000-000000000003",
		strings.Repeat("a", maxAttendanceNotes+1))
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
}

func TestCheckCancellable(t *testing.T) {
	assert.NoError(t, checkCancellable(false, false))
	assert.ErrorIs(t, checkCancellable(true, false), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkCancellable(false, true), errs.ErrFailedPrecondition)
}

func TestCheckAttendanceOpen(t *testing.T) {
	now := time.Date(2026, 9, 26, 12, 0, 0, 0, time.UTC)
	assert.NoError(t, checkAttendanceOpen(now.Add(time.Hour), false, now))
	assert.ErrorIs(t, checkAttendanceOpen(now.Add(time.Hour), true, now), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkAttendanceOpen(now.Add(-time.Hour), false, now), errs.ErrFailedPrecondition)
}

func TestCancelRejectsMalformedIDsBeforeQuerying(t *testing.T) {
	s := &Service{}
	const valid = "00000000-0000-0000-0000-000000000001"

	_, err := s.Cancel(context.Background(), "bad", valid, valid)
	assert.ErrorIs(t, err, errs.ErrNotFound)

	_, err = s.Cancel(context.Background(), valid, "bad", valid)
	assert.ErrorIs(t, err, errs.ErrNotFound)

	_, err = s.Cancel(context.Background(), valid, valid, "bad")
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
}

func TestCheckEditable(t *testing.T) {
	assert.NoError(t, checkEditable(false, false))
	assert.ErrorIs(t, checkEditable(true, false), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkEditable(false, true), errs.ErrFailedPrecondition)
}

func TestCheckExpireTimeInFuture(t *testing.T) {
	now := time.Date(2026, 9, 26, 12, 0, 0, 0, time.UTC)
	assert.NoError(t, checkExpireTimeInFuture("2026-09-26T13:00:00Z", now))
	assert.ErrorIs(t, checkExpireTimeInFuture("2026-09-26T12:00:00Z", now), errs.ErrInvalidArgument)
	assert.ErrorIs(t, checkExpireTimeInFuture("2026-09-26T11:00:00Z", now), errs.ErrInvalidArgument)
	assert.ErrorIs(t, checkExpireTimeInFuture("not-a-time", now), errs.ErrInvalidArgument)
}

func TestUpdateValidatesBeforeQuerying(t *testing.T) {
	s := &Service{}
	const valid = "00000000-0000-0000-0000-000000000001"
	future := time.Now().UTC().Add(time.Hour)
	datetime := future.Format(time.RFC3339)
	expireTime := future.Add(time.Hour).Format(time.RFC3339)
	base := UpdateParams{
		GuildID: valid, CheckInID: valid, UpdatedBy: valid,
		Title: "Raid", Datetime: datetime, ExpireTime: expireTime,
	}

	tests := []struct {
		name    string
		mutate  func(p *UpdateParams)
		wantErr error
	}{
		{name: "blank title", mutate: func(p *UpdateParams) { p.Title = "  " }, wantErr: errs.ErrInvalidArgument},
		{name: "expire before datetime", mutate: func(p *UpdateParams) { p.ExpireTime = p.Datetime }, wantErr: errs.ErrInvalidArgument},
		{name: "expire in the past", mutate: func(p *UpdateParams) {
			p.Datetime = "2020-01-01T00:00:00Z"
			p.ExpireTime = "2020-01-02T00:00:00Z"
		}, wantErr: errs.ErrInvalidArgument},
		{name: "loot change", mutate: func(p *UpdateParams) { p.Loot = []LootEntry{{Kind: LootKindItem, Item: models.Item{Name: "Sword"}}} }, wantErr: errs.ErrInvalidArgument},
		{name: "malformed guild", mutate: func(p *UpdateParams) { p.GuildID = "bad" }, wantErr: errs.ErrNotFound},
		{name: "malformed checkin", mutate: func(p *UpdateParams) { p.CheckInID = "bad" }, wantErr: errs.ErrNotFound},
		{name: "malformed user", mutate: func(p *UpdateParams) { p.UpdatedBy = "bad" }, wantErr: errs.ErrInvalidArgument},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := base
			tt.mutate(&p)
			_, err := s.Update(context.Background(), p)
			assert.ErrorIs(t, err, tt.wantErr)
		})
	}
}
