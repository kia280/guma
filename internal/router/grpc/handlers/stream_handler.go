package handlers

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/events"
)

const (
	defaultHeartbeatInterval  = 25 * time.Second
	defaultMembershipCacheTTL = 5 * time.Second
)

type GuildLookup func(ctx context.Context, userID uuid.UUID) ([]string, error)

type StreamHandler struct {
	gumav1.UnimplementedStreamServiceServer
	broker            *events.Broker
	guildLookup       GuildLookup
	heartbeatInterval time.Duration
	membershipTTL     time.Duration
	logger            zerolog.Logger
}

func NewStreamService(broker *events.Broker, guildLookup GuildLookup, logger zerolog.Logger) *StreamHandler {
	return &StreamHandler{
		broker:            broker,
		guildLookup:       guildLookup,
		heartbeatInterval: defaultHeartbeatInterval,
		membershipTTL:     defaultMembershipCacheTTL,
		logger:            logger.With().Str("handler", "stream").Logger(),
	}
}

func (h *StreamHandler) WatchUserEvents(_ *gumav1.WatchUserEventsRequest, stream grpc.ServerStreamingServer[gumav1.WatchUserEventsResponse]) error {
	ctx := stream.Context()
	userID, err := callerID(ctx)
	if err != nil {
		return err
	}

	guildIDs, err := h.guildLookup(ctx, userID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID.String()).Msg("failed to load guild memberships for event stream")
		return status.Error(codes.Internal, "failed to load guild memberships")
	}

	membership := newGuildMembership(userID, guildIDs, h.guildLookup, h.membershipTTL, time.Now())

	updates, unsubscribe := h.broker.Subscribe(userID.String(), guildIDs...)
	defer unsubscribe()

	if err := stream.Send(heartbeatEvent(time.Now())); err != nil {
		return err
	}

	ticker := time.NewTicker(h.heartbeatInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return nil
		case e, ok := <-updates:
			if !ok {
				return nil
			}
			allowed, err := membership.allows(ctx, e, time.Now())
			if err != nil {
				h.logger.Error().Err(err).Str("user_id", userID.String()).Msg("failed to refresh guild memberships for event stream")
				continue
			}
			if !allowed {
				continue
			}
			if err := stream.Send(userEventToProto(e)); err != nil {
				return err
			}
		case now := <-ticker.C:
			if err := stream.Send(heartbeatEvent(now)); err != nil {
				return err
			}
		}
	}
}

type guildMembership struct {
	userID     uuid.UUID
	lookup     GuildLookup
	ttl        time.Duration
	subscribed map[string]struct{}
	current    map[string]struct{}
	checkedAt  time.Time
}

func newGuildMembership(userID uuid.UUID, guildIDs []string, lookup GuildLookup, ttl time.Duration, now time.Time) *guildMembership {
	return &guildMembership{
		userID:     userID,
		lookup:     lookup,
		ttl:        ttl,
		subscribed: guildIDSet(guildIDs),
		current:    guildIDSet(guildIDs),
		checkedAt:  now,
	}
}

func (m *guildMembership) allows(ctx context.Context, e events.Event, now time.Time) (bool, error) {
	if e.ResourceChanged == nil {
		return true, nil
	}
	guildID := e.ResourceChanged.GuildID
	if _, ok := m.subscribed[guildID]; !ok {
		return true, nil
	}
	if now.Sub(m.checkedAt) >= m.ttl {
		guildIDs, err := m.lookup(ctx, m.userID)
		m.current = guildIDSet(guildIDs)
		m.checkedAt = now
		if err != nil {
			return false, err
		}
	}
	_, ok := m.current[guildID]
	return ok, nil
}

func guildIDSet(guildIDs []string) map[string]struct{} {
	set := make(map[string]struct{}, len(guildIDs))
	for _, guildID := range guildIDs {
		set[guildID] = struct{}{}
	}
	return set
}

func heartbeatEvent(now time.Time) *gumav1.WatchUserEventsResponse {
	return &gumav1.WatchUserEventsResponse{
		OccurredAt: timestamppb.New(now),
		Event:      &gumav1.WatchUserEventsResponse_Heartbeat{Heartbeat: &gumav1.Heartbeat{}},
	}
}

func userEventToProto(e events.Event) *gumav1.WatchUserEventsResponse {
	resp := &gumav1.WatchUserEventsResponse{OccurredAt: timestamppb.New(e.OccurredAt)}
	switch {
	case e.WalletUpdated != nil:
		resp.Event = &gumav1.WatchUserEventsResponse_WalletUpdated{
			WalletUpdated: &gumav1.WalletUpdated{GuildId: e.WalletUpdated.GuildID, Balance: e.WalletUpdated.Balance},
		}
	case e.ResourceChanged != nil:
		resp.Event = &gumav1.WatchUserEventsResponse_ResourceChanged{
			ResourceChanged: &gumav1.ResourceChanged{
				GuildId:    e.ResourceChanged.GuildID,
				Resource:   e.ResourceChanged.Resource,
				ResourceId: e.ResourceChanged.ResourceID,
			},
		}
	}
	return resp
}
