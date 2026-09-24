package events

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func walletEvent(guild string, balance int64) Event {
	return Event{OccurredAt: time.Now(), WalletUpdated: &WalletUpdated{GuildID: guild, Balance: balance}}
}

func TestBrokerDeliversOnlyToSubscribedUser(t *testing.T) {
	b := NewBroker()
	alice, unsubAlice := b.Subscribe("alice")
	defer unsubAlice()
	bob, unsubBob := b.Subscribe("bob")
	defer unsubBob()

	delivered, dropped := b.Publish("alice", walletEvent("g1", 42))
	assert.Equal(t, 1, delivered)
	assert.Equal(t, 0, dropped)

	select {
	case e := <-alice:
		require.NotNil(t, e.WalletUpdated)
		assert.Equal(t, int64(42), e.WalletUpdated.Balance)
	default:
		t.Fatal("alice did not receive the event")
	}
	select {
	case e := <-bob:
		t.Fatalf("bob received an unexpected event: %+v", e)
	default:
	}
}

func TestBrokerFansOutToEverySubscriptionOfAUser(t *testing.T) {
	b := NewBroker()
	first, unsubFirst := b.Subscribe("alice")
	defer unsubFirst()
	second, unsubSecond := b.Subscribe("alice")
	defer unsubSecond()

	delivered, _ := b.Publish("alice", walletEvent("g1", 1))
	assert.Equal(t, 2, delivered)
	assert.Len(t, first, 1)
	assert.Len(t, second, 1)
}

func TestBrokerUnsubscribeClosesChannel(t *testing.T) {
	b := NewBroker()
	ch, unsubscribe := b.Subscribe("alice")
	unsubscribe()
	unsubscribe()

	_, ok := <-ch
	assert.False(t, ok)
	delivered, dropped := b.Publish("alice", walletEvent("g1", 1))
	assert.Zero(t, delivered)
	assert.Zero(t, dropped)
}

func TestBrokerDropsWhenSubscriberIsFull(t *testing.T) {
	b := NewBroker()
	_, unsubscribe := b.Subscribe("alice")
	defer unsubscribe()

	for i := 0; i < subscriberBuffer; i++ {
		b.Publish("alice", walletEvent("g1", int64(i)))
	}
	delivered, dropped := b.Publish("alice", walletEvent("g1", 99))
	assert.Zero(t, delivered)
	assert.Equal(t, 1, dropped)
}

func TestBrokerCloseEndsSubscriptions(t *testing.T) {
	b := NewBroker()
	ch, unsubscribe := b.Subscribe("alice")
	b.Close()
	b.Close()
	unsubscribe()

	_, ok := <-ch
	assert.False(t, ok)

	late, _ := b.Subscribe("alice")
	_, ok = <-late
	assert.False(t, ok)
}

func TestBrokerPublishGuildReachesMembersOnly(t *testing.T) {
	b := NewBroker()
	member, unsubMember := b.Subscribe("alice", "g1", "g2")
	other, unsubOther := b.Subscribe("bob", "g3")
	defer unsubOther()

	changed := Event{OccurredAt: time.Now(), ResourceChanged: &ResourceChanged{GuildID: "g2", Resource: "bank"}}
	delivered, _ := b.PublishGuild("g2", changed)
	assert.Equal(t, 1, delivered)
	assert.Len(t, member, 1)
	assert.Len(t, other, 0)

	unsubMember()
	delivered, _ = b.PublishGuild("g1", changed)
	assert.Zero(t, delivered)
	delivered, _ = b.Publish("alice", changed)
	assert.Zero(t, delivered)
}
