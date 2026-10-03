package rollcall

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

func TestPrepareBankLootAssignsIDsAndDefaults(t *testing.T) {
	loot := prepareBankLoot([]models.Item{
		{ID: "client-id", Name: " Dragon Scale ", Category: "MATERIAL", Rarity: "Epic", Description: "hot"},
		{Name: "Coin"},
		{Name: "Coin"},
	})
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

func TestPrepareBankLootEmpty(t *testing.T) {
	loot := prepareBankLoot(nil)
	assert.Empty(t, loot)
	assert.NotNil(t, loot)
}

func TestCheckCancellable(t *testing.T) {
	assert.NoError(t, checkCancellable(false, false))
	assert.ErrorIs(t, checkCancellable(true, false), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkCancellable(false, true), errs.ErrFailedPrecondition)
}

func TestCheckCheckInOpen(t *testing.T) {
	now := time.Date(2026, 9, 26, 12, 0, 0, 0, time.UTC)
	assert.NoError(t, checkCheckInOpen(now.Add(time.Hour), false, now))
	assert.ErrorIs(t, checkCheckInOpen(now.Add(time.Hour), true, now), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkCheckInOpen(now.Add(-time.Hour), false, now), errs.ErrFailedPrecondition)
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
	valid := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	future := time.Now().UTC().Add(time.Hour)
	datetime := future.Format(time.RFC3339)
	expireTime := future.Add(time.Hour).Format(time.RFC3339)
	base := UpdateParams{
		GuildID: valid, RollCallID: valid, UpdatedBy: valid,
		Title: "Raid", Datetime: datetime, ExpireTime: expireTime,
	}

	tests := []struct {
		name    string
		mutate  func(p *UpdateParams)
		wantErr error
	}{
		{name: "expire before datetime", mutate: func(p *UpdateParams) { p.ExpireTime = p.Datetime }, wantErr: errs.ErrInvalidArgument},
		{name: "expire in the past", mutate: func(p *UpdateParams) {
			p.Datetime = "2020-01-01T00:00:00Z"
			p.ExpireTime = "2020-01-02T00:00:00Z"
		}, wantErr: errs.ErrInvalidArgument},
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

func TestCheckLootEditable(t *testing.T) {
	assert.NoError(t, checkLootEditable(false, false))
	assert.ErrorIs(t, checkLootEditable(true, false), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkLootEditable(false, true), errs.ErrFailedPrecondition)
}

func TestCheckCompletable(t *testing.T) {
	assert.NoError(t, checkCompletable(false, false, true, 0, 0, false))
	assert.ErrorIs(t, checkCompletable(true, false, true, 0, 0, false), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkCompletable(false, true, true, 0, 0, false), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkCompletable(false, false, false, 0, 0, false), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkCompletable(false, false, true, 2, 0, false), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkCompletable(false, false, true, 0, 500, false), errs.ErrFailedPrecondition)
	assert.NoError(t, checkCompletable(false, false, true, 2, 500, true))
	assert.ErrorIs(t, checkCompletable(true, false, true, 2, 0, true), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkCompletable(false, true, true, 2, 0, true), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkCompletable(false, false, false, 0, 500, true), errs.ErrFailedPrecondition)
}

func TestPlanLootUpdate(t *testing.T) {
	inVault := models.Item{ID: uuid.NewString(), Name: "Sword", Category: "weapon", Rarity: "rare"}
	listed := models.Item{ID: uuid.NewString(), Name: "Shield", Category: "armor", Rarity: "common"}
	handedOut := models.Item{ID: uuid.NewString(), Name: "Ring", Category: "accessory", Rarity: "epic"}
	current := []models.Item{inVault, listed, handedOut}
	vault := map[string]bool{inVault.ID: false, listed.ID: true}

	t.Run("keeps unchanged items", func(t *testing.T) {
		plan, err := planLootUpdate(current, vault, current)
		require.NoError(t, err)
		assert.Equal(t, current, plan.final)
		assert.Empty(t, plan.added)
		assert.Empty(t, plan.changed)
		assert.Empty(t, plan.removed)
	})

	t.Run("adds, renames and removes items in the vault", func(t *testing.T) {
		renamed := inVault
		renamed.Name = " Great Sword "
		plan, err := planLootUpdate(current, vault, []models.Item{handedOut, listed, renamed, {Name: "Potion"}})
		require.NoError(t, err)
		require.Len(t, plan.added, 1)
		assert.Equal(t, "Potion", plan.added[0].Name)
		assert.Equal(t, defaultLootCategory, plan.added[0].Category)
		_, err = uuid.Parse(plan.added[0].ID)
		assert.NoError(t, err)
		require.Len(t, plan.changed, 1)
		assert.Equal(t, "Great Sword", plan.changed[0].Name)
		assert.Empty(t, plan.removed)
		assert.Equal(t, []string{handedOut.ID, listed.ID, inVault.ID, plan.added[0].ID},
			[]string{plan.final[0].ID, plan.final[1].ID, plan.final[2].ID, plan.final[3].ID})

		plan, err = planLootUpdate(current, vault, []models.Item{listed, handedOut})
		require.NoError(t, err)
		assert.Equal(t, []uuid.UUID{uuid.MustParse(inVault.ID)}, plan.removed)
	})

	t.Run("treats normalization-only differences as unchanged", func(t *testing.T) {
		legacy := models.Item{ID: handedOut.ID, Name: "Ring"}
		plan, err := planLootUpdate([]models.Item{legacy}, vault, []models.Item{{ID: handedOut.ID, Name: " Ring ", Category: "MISC"}})
		require.NoError(t, err)
		assert.Equal(t, []models.Item{legacy}, plan.final)
	})

	tests := []struct {
		name      string
		requested []models.Item
		wantErr   error
	}{
		{name: "remove handed-out item", requested: []models.Item{inVault, listed}, wantErr: errs.ErrFailedPrecondition},
		{name: "remove listed item", requested: []models.Item{inVault, handedOut}, wantErr: errs.ErrFailedPrecondition},
		{name: "rename handed-out item", requested: []models.Item{inVault, listed, {ID: handedOut.ID, Name: "Ring+1"}}, wantErr: errs.ErrFailedPrecondition},
		{name: "rename listed item", requested: []models.Item{inVault, {ID: listed.ID, Name: "Buckler"}, handedOut}, wantErr: errs.ErrFailedPrecondition},
		{name: "unknown item", requested: []models.Item{inVault, listed, handedOut, {ID: uuid.NewString(), Name: "Ghost"}}, wantErr: errs.ErrInvalidArgument},
		{name: "duplicate item", requested: []models.Item{inVault, inVault, listed, handedOut}, wantErr: errs.ErrInvalidArgument},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := planLootUpdate(current, vault, tt.requested)
			assert.ErrorIs(t, err, tt.wantErr)
		})
	}
}

func TestStoreLootKeepsGoldEntries(t *testing.T) {
	sword := models.Item{ID: uuid.NewString(), Name: "Sword"}
	shield := models.Item{ID: uuid.NewString(), Name: "Shield"}
	goldID := uuid.NewString()
	entries := []LootEntry{
		{Kind: LootKindItem, Item: sword},
		{Kind: LootKindGold, Item: models.Item{ID: goldID}, Amount: 1500},
		{Kind: LootKindItem, Item: shield},
	}

	stored := storeLoot(entries, []models.Item{shield})
	require.Len(t, stored, 2)
	assert.Equal(t, storedLootEntry{Kind: LootKindItem, Item: shield}, stored[0])
	assert.Equal(t, storedLootEntry{Kind: LootKindGold, Item: models.Item{ID: goldID}, Amount: 1500}, stored[1])

	stored = storeLoot(entries, []models.Item{sword, shield, {ID: uuid.NewString(), Name: "Potion"}})
	require.Len(t, stored, 4)
	assert.Equal(t, LootKindGold, stored[1].Kind)
	assert.Equal(t, int64(1500), stored[1].Amount)

	assert.Empty(t, storeLoot(nil, nil))
}
