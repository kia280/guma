package events

import (
	"sync"
	"time"
)

const subscriberBuffer = 64

type WalletUpdated struct {
	GuildID string
	Balance int64
}

type ResourceChanged struct {
	GuildID    string
	Resource   string
	ResourceID string
}

type Event struct {
	OccurredAt      time.Time
	WalletUpdated   *WalletUpdated
	ResourceChanged *ResourceChanged
}

type subscription struct {
	userID   string
	guildIDs []string
	ch       chan Event
	once     sync.Once
}

func (s *subscription) close() {
	s.once.Do(func() { close(s.ch) })
}

type Broker struct {
	mu      sync.Mutex
	byUser  map[string]map[*subscription]struct{}
	byGuild map[string]map[*subscription]struct{}
	closed  bool
}

func NewBroker() *Broker {
	return &Broker{
		byUser:  make(map[string]map[*subscription]struct{}),
		byGuild: make(map[string]map[*subscription]struct{}),
	}
}

func addSub(index map[string]map[*subscription]struct{}, key string, sub *subscription) {
	if index[key] == nil {
		index[key] = make(map[*subscription]struct{})
	}
	index[key][sub] = struct{}{}
}

func removeSub(index map[string]map[*subscription]struct{}, key string, sub *subscription) {
	if subs, ok := index[key]; ok {
		delete(subs, sub)
		if len(subs) == 0 {
			delete(index, key)
		}
	}
}

func (b *Broker) Subscribe(userID string, guildIDs ...string) (<-chan Event, func()) {
	sub := &subscription{userID: userID, guildIDs: guildIDs, ch: make(chan Event, subscriberBuffer)}

	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		sub.close()
		return sub.ch, func() {}
	}
	addSub(b.byUser, userID, sub)
	for _, guildID := range guildIDs {
		addSub(b.byGuild, guildID, sub)
	}

	return sub.ch, func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		if !b.closed {
			removeSub(b.byUser, sub.userID, sub)
			for _, guildID := range sub.guildIDs {
				removeSub(b.byGuild, guildID, sub)
			}
		}
		sub.close()
	}
}

func deliver(subs map[*subscription]struct{}, e Event) (delivered, dropped int) {
	for sub := range subs {
		select {
		case sub.ch <- e:
			delivered++
		default:
			dropped++
		}
	}
	return delivered, dropped
}

func (b *Broker) Publish(userID string, e Event) (delivered, dropped int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return deliver(b.byUser[userID], e)
}

func (b *Broker) PublishGuild(guildID string, e Event) (delivered, dropped int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return deliver(b.byGuild[guildID], e)
}

func (b *Broker) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return
	}
	b.closed = true
	for _, subs := range b.byUser {
		for sub := range subs {
			sub.close()
		}
	}
	b.byUser = nil
	b.byGuild = nil
}
