package rollcall

import (
	"encoding/json"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

func TestPrepareLootSplitsItemsAndGold(t *testing.T) {
	prepared := prepareLoot([]LootEntry{
		{Item: models.Item{Name: " Sword "}},
		{Kind: " GOLD ", Amount: 12_345},
		{Kind: LootKindItem, Item: models.Item{Name: "Shield", Rarity: "Rare"}},
	})
	assert.Equal(t, int64(12_345), prepared.gold)
	require.Len(t, prepared.items, 2)
	assert.Equal(t, "Sword", prepared.items[0].Name)
	assert.Equal(t, "rare", prepared.items[1].Rarity)
	require.Len(t, prepared.stored, 3)
	assert.Equal(t, LootKindItem, prepared.stored[0].Kind)
	assert.Equal(t, LootKindGold, prepared.stored[1].Kind)
	assert.Equal(t, int64(12_345), prepared.stored[1].Amount)
	_, err := uuid.Parse(prepared.stored[1].ID)
	assert.NoError(t, err)
}

func TestDecodeLootReadsLegacyRowsAsItems(t *testing.T) {
	raw := []byte(`[{"id":"a","name":"Old Sword","category":"weapon"},{"kind":"gold","id":"g","name":"","amount":500},{"kind":"item","id":"b","name":"Ring"},{"kind":"gems","id":"x"}]`)
	loot := decodeLoot(raw)
	require.Len(t, loot, 3)
	assert.Equal(t, LootEntry{Kind: LootKindItem, Item: models.Item{ID: "a", Name: "Old Sword", Category: "weapon"}}, loot[0])
	assert.Equal(t, LootEntry{Kind: LootKindGold, Item: models.Item{ID: "g"}, Amount: 500}, loot[1])
	assert.Equal(t, LootEntry{Kind: LootKindItem, Item: models.Item{ID: "b", Name: "Ring"}}, loot[2])
	assert.Equal(t, []models.Item{loot[0].Item, loot[2].Item}, lootItems(loot))
	assert.Empty(t, decodeLoot(nil))
	assert.Empty(t, decodeLoot([]byte(`[]`)))
}

func TestStoredLootRoundTrip(t *testing.T) {
	prepared := prepareLoot([]LootEntry{{Kind: LootKindGold, Amount: 900}, {Item: models.Item{Name: "Gem"}}})
	raw, err := json.Marshal(prepared.stored)
	require.NoError(t, err)
	loot := decodeLoot(raw)
	require.Len(t, loot, 2)
	assert.Equal(t, LootKindGold, loot[0].Kind)
	assert.Equal(t, int64(900), loot[0].Amount)
	assert.Equal(t, "Gem", loot[1].Item.Name)
}

func TestNormalizeGoldPayouts(t *testing.T) {
	a := uuid.MustParse("00000000-0000-0000-0000-00000000000a")
	b := uuid.MustParse("00000000-0000-0000-0000-00000000000b")
	c := uuid.MustParse("00000000-0000-0000-0000-00000000000c")

	lines, total, err := normalizeGoldPayouts([]GoldPayout{
		{UserID: c.String(), Amount: 333},
		{UserID: a.String(), Amount: 334},
		{UserID: b.String(), Amount: 0},
	})
	require.NoError(t, err)
	assert.Equal(t, int64(667), total)
	assert.Equal(t, []goldPayoutLine{{userID: a, amount: 334}, {userID: c, amount: 333}}, lines)

	tests := []struct {
		name    string
		payouts []GoldPayout
	}{
		{name: "duplicate", payouts: []GoldPayout{{UserID: a.String(), Amount: 5}, {UserID: a.String(), Amount: 5}}},
		{name: "duplicate with zero", payouts: []GoldPayout{{UserID: a.String(), Amount: 5}, {UserID: a.String()}}},
		{name: "bad user", payouts: []GoldPayout{{UserID: "nope", Amount: 5}}},
		{name: "overflowing sum", payouts: []GoldPayout{{UserID: a.String(), Amount: maxGoldAmount}, {UserID: b.String(), Amount: 1}}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, err := normalizeGoldPayouts(tt.payouts)
			assert.ErrorIs(t, err, errs.ErrInvalidArgument)
		})
	}
}

func TestCheckGoldPotCapacity(t *testing.T) {
	pot := GoldPot{Total: 1000, Distributed: 400}
	assert.Equal(t, int64(600), pot.Remaining())
	assert.NoError(t, checkGoldPotCapacity(pot, false, 600))
	assert.NoError(t, checkGoldPotCapacity(pot, false, 1))
	assert.ErrorIs(t, checkGoldPotCapacity(pot, false, 601), errs.ErrFailedPrecondition)
	assert.ErrorIs(t, checkGoldPotCapacity(pot, true, 1), errs.ErrFailedPrecondition)

	retracted := GoldPot{Total: 1000, Distributed: 400, Retracted: 600}
	assert.Equal(t, int64(0), retracted.Remaining())
	assert.ErrorIs(t, checkGoldPotCapacity(retracted, false, 1), errs.ErrFailedPrecondition)

	kept := GoldPot{Total: 1000, Distributed: 400, Completed: true}
	assert.Equal(t, int64(0), kept.Remaining())
	assert.Equal(t, int64(600), kept.Kept())
	assert.Equal(t, int64(0), pot.Kept())
	assert.ErrorIs(t, checkGoldPotCapacity(kept, false, 1), errs.ErrFailedPrecondition)
}
