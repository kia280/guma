package events

import (
	"sync"
	"time"
)

const subscriberBuffer = 16

type WalletUpdated struct {
	GuildID string
	Balance int64
}

type Event struct {
	OccurredAt    time.Time
	WalletUpdated *WalletUpdated
}

type subscription struct {
	ch   chan Event
	once sync.Once
}

func (s *subscription) close() {
	s.once.Do(func() { close(s.ch) })
}

type Broker struct {
	mu     sync.Mutex
	subs   map[string]map[*subscription]struct{}
	closed bool
}

func NewBroker() *Broker {
	return &Broker{subs: make(map[string]map[*subscription]struct{})}
}

func (b *Broker) Subscribe(userID string) (<-chan Event, func()) {
	sub := &subscription{ch: make(chan Event, subscriberBuffer)}

	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		sub.close()
		return sub.ch, func() {}
	}
	if b.subs[userID] == nil {
		b.subs[userID] = make(map[*subscription]struct{})
	}
	b.subs[userID][sub] = struct{}{}

	return sub.ch, func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		if userSubs, ok := b.subs[userID]; ok {
			delete(userSubs, sub)
			if len(userSubs) == 0 {
				delete(b.subs, userID)
			}
		}
		sub.close()
	}
}

func (b *Broker) Publish(userID string, e Event) (delivered, dropped int) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for sub := range b.subs[userID] {
		select {
		case sub.ch <- e:
			delivered++
		default:
			dropped++
		}
	}
	return delivered, dropped
}

func (b *Broker) Close() {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.closed {
		return
	}
	b.closed = true
	for _, userSubs := range b.subs {
		for sub := range userSubs {
			sub.close()
		}
	}
	b.subs = nil
}
