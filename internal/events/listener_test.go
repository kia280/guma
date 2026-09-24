package events

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseWalletNotification(t *testing.T) {
	now := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)

	userID, e, err := parseWalletNotification(`{"user_id":"u1","guild_id":"g1","balance":9007199254740993}`, now)
	require.NoError(t, err)
	assert.Equal(t, "u1", userID)
	assert.Equal(t, now, e.OccurredAt)
	require.NotNil(t, e.WalletUpdated)
	assert.Equal(t, "g1", e.WalletUpdated.GuildID)
	assert.Equal(t, int64(9007199254740993), e.WalletUpdated.Balance)

	for _, payload := range []string{`not json`, `{"guild_id":"g1","balance":1}`, `{"user_id":"u1","balance":1}`} {
		_, _, err := parseWalletNotification(payload, now)
		assert.Error(t, err, payload)
	}
}
