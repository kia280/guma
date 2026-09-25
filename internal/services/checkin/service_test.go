package checkin

import (
	"testing"

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
