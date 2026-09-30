package events

import (
	"testing"
	"time"

	"github.com/rs/zerolog"

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

func TestParseLiveNotification(t *testing.T) {
	now := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)

	d, err := parseLiveNotification(`{"scope":"guild","target_id":"g1","guild_id":"g1","resource":"auction","resource_id":"a1"}`, now)
	require.NoError(t, err)
	assert.Equal(t, ScopeGuild, d.scope)
	assert.Equal(t, "g1", d.targetID)
	require.NotNil(t, d.event.ResourceChanged)
	assert.Equal(t, ResourceChanged{GuildID: "g1", Resource: "auction", ResourceID: "a1"}, *d.event.ResourceChanged)

	d, err = parseLiveNotification(`{"scope":"user","target_id":"u1","guild_id":null,"resource":"notification","resource_id":null}`, now)
	require.NoError(t, err)
	assert.Equal(t, ScopeUser, d.scope)
	assert.Equal(t, ResourceChanged{Resource: "notification"}, *d.event.ResourceChanged)

	for _, payload := range []string{
		`nope`,
		`{"scope":"world","target_id":"g1","resource":"x"}`,
		`{"scope":"guild","resource":"x"}`,
		`{"scope":"guild","target_id":"g1"}`,
	} {
		_, err := parseLiveNotification(payload, now)
		assert.Error(t, err, payload)
	}
}

func TestDispatchRoutesByChannelAndScope(t *testing.T) {
	b := NewBroker()
	alice, unsubAlice := b.Subscribe("alice", "g1")
	defer unsubAlice()
	bob, unsubBob := b.Subscribe("bob", "g1")
	defer unsubBob()
	now := time.Now()

	dispatch(b, zerolog.Nop(), liveEventsChannel, `{"scope":"guild","target_id":"g1","guild_id":"g1","resource":"raffle","resource_id":"l1"}`, now)
	assert.Len(t, alice, 1)
	assert.Len(t, bob, 1)

	dispatch(b, zerolog.Nop(), liveEventsChannel, `{"scope":"user","target_id":"bob","resource":"notification"}`, now)
	assert.Len(t, alice, 1)
	assert.Len(t, bob, 2)

	dispatch(b, zerolog.Nop(), walletChannel, `{"user_id":"alice","guild_id":"g1","balance":7}`, now)
	assert.Len(t, alice, 2)

	dispatch(b, zerolog.Nop(), "unknown", `{}`, now)
	dispatch(b, zerolog.Nop(), liveEventsChannel, `broken`, now)
	assert.Len(t, alice, 2)
	assert.Len(t, bob, 2)
}
