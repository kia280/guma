package handlers

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/events"
	"github.com/kia280/guma/internal/session"
)

type fakeUserEventStream struct {
	grpc.ServerStream
	ctx  context.Context
	mu   sync.Mutex
	sent []*gumav1.WatchUserEventsResponse
}

func (s *fakeUserEventStream) Context() context.Context { return s.ctx }

func (s *fakeUserEventStream) Send(m *gumav1.WatchUserEventsResponse) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sent = append(s.sent, m)
	return nil
}

func (s *fakeUserEventStream) messages() []*gumav1.WatchUserEventsResponse {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]*gumav1.WatchUserEventsResponse(nil), s.sent...)
}

func TestWatchUserEventsRequiresAuthentication(t *testing.T) {
	h := NewStreamService(events.NewBroker(), zerolog.Nop())
	err := h.WatchUserEvents(&gumav1.WatchUserEventsRequest{}, &fakeUserEventStream{ctx: context.Background()})
	assert.Equal(t, codes.Unauthenticated, status.Code(err))
}

func TestWatchUserEventsStreamsWalletUpdates(t *testing.T) {
	broker := events.NewBroker()
	h := NewStreamService(broker, zerolog.Nop())
	h.heartbeatInterval = time.Hour

	ctx, cancel := context.WithCancel(session.WithUserID(context.Background(), "alice"))
	stream := &fakeUserEventStream{ctx: ctx}
	done := make(chan error, 1)
	go func() { done <- h.WatchUserEvents(&gumav1.WatchUserEventsRequest{}, stream) }()

	require.Eventually(t, func() bool { return len(stream.messages()) == 1 }, time.Second, 5*time.Millisecond)
	assert.NotNil(t, stream.messages()[0].GetHeartbeat())

	broker.Publish("bob", events.Event{OccurredAt: time.Now(), WalletUpdated: &events.WalletUpdated{GuildID: "g1", Balance: 5}})
	broker.Publish("alice", events.Event{OccurredAt: time.Now(), WalletUpdated: &events.WalletUpdated{GuildID: "g1", Balance: 250}})

	require.Eventually(t, func() bool { return len(stream.messages()) == 2 }, time.Second, 5*time.Millisecond)
	update := stream.messages()[1].GetWalletUpdated()
	require.NotNil(t, update)
	assert.Equal(t, "g1", update.GuildId)
	assert.Equal(t, int64(250), update.Balance)

	cancel()
	select {
	case err := <-done:
		assert.NoError(t, err)
	case <-time.After(time.Second):
		t.Fatal("stream did not stop after context cancellation")
	}
}

func TestWatchUserEventsEndsWhenBrokerCloses(t *testing.T) {
	broker := events.NewBroker()
	h := NewStreamService(broker, zerolog.Nop())
	stream := &fakeUserEventStream{ctx: session.WithUserID(context.Background(), "alice")}
	done := make(chan error, 1)
	go func() { done <- h.WatchUserEvents(&gumav1.WatchUserEventsRequest{}, stream) }()

	require.Eventually(t, func() bool { return len(stream.messages()) == 1 }, time.Second, 5*time.Millisecond)
	broker.Close()
	select {
	case err := <-done:
		assert.NoError(t, err)
	case <-time.After(time.Second):
		t.Fatal("stream did not stop after broker close")
	}
}

func TestWatchUserEventsSendsHeartbeats(t *testing.T) {
	h := NewStreamService(events.NewBroker(), zerolog.Nop())
	h.heartbeatInterval = 10 * time.Millisecond
	ctx, cancel := context.WithCancel(session.WithUserID(context.Background(), "alice"))
	defer cancel()
	stream := &fakeUserEventStream{ctx: ctx}
	go func() { _ = h.WatchUserEvents(&gumav1.WatchUserEventsRequest{}, stream) }()

	require.Eventually(t, func() bool { return len(stream.messages()) >= 3 }, time.Second, 5*time.Millisecond)
	for _, m := range stream.messages() {
		assert.NotNil(t, m.GetHeartbeat())
	}
}
