package handlers

import (
	"context"
	"time"

	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/events"
	"github.com/kia280/guma/internal/session"
)

const defaultHeartbeatInterval = 25 * time.Second

type GuildLookup func(ctx context.Context, userID string) ([]string, error)

type StreamHandler struct {
	gumav1.UnimplementedStreamServiceServer
	broker            *events.Broker
	guildLookup       GuildLookup
	heartbeatInterval time.Duration
	logger            zerolog.Logger
}

func NewStreamService(broker *events.Broker, guildLookup GuildLookup, logger zerolog.Logger) *StreamHandler {
	return &StreamHandler{
		broker:            broker,
		guildLookup:       guildLookup,
		heartbeatInterval: defaultHeartbeatInterval,
		logger:            logger.With().Str("handler", "stream").Logger(),
	}
}

func (h *StreamHandler) WatchUserEvents(_ *gumav1.WatchUserEventsRequest, stream grpc.ServerStreamingServer[gumav1.WatchUserEventsResponse]) error {
	ctx := stream.Context()
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return status.Error(codes.Unauthenticated, "user not authenticated")
	}

	guildIDs, err := h.guildLookup(ctx, userID)
	if err != nil {
		h.logger.Error().Err(err).Str("user_id", userID).Msg("failed to load guild memberships for event stream")
		return status.Error(codes.Internal, "failed to load guild memberships")
	}

	updates, unsubscribe := h.broker.Subscribe(userID, guildIDs...)
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
