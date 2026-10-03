package events

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
)

const (
	walletChannel      = "wallet_changed"
	liveEventsChannel  = "live_events"
	minListenerBackoff = time.Second
	maxListenerBackoff = 30 * time.Second

	ScopeUser  = "user"
	ScopeGuild = "guild"
)

type walletNotification struct {
	UserID  string `json:"user_id"`
	GuildID string `json:"guild_id"`
	Balance int64  `json:"balance"`
}

type liveNotification struct {
	Scope      string  `json:"scope"`
	TargetID   string  `json:"target_id"`
	GuildID    *string `json:"guild_id"`
	Resource   string  `json:"resource"`
	ResourceID *string `json:"resource_id"`
}

type delivery struct {
	scope    string
	targetID string
	event    Event
}

func parseWalletNotification(payload string, now time.Time) (string, Event, error) {
	var n walletNotification
	if err := json.Unmarshal([]byte(payload), &n); err != nil {
		return "", Event{}, fmt.Errorf("decode wallet notification: %w", err)
	}
	if n.UserID == "" || n.GuildID == "" {
		return "", Event{}, fmt.Errorf("wallet notification missing user or guild: %q", payload)
	}
	return n.UserID, Event{
		OccurredAt:    now,
		WalletUpdated: &WalletUpdated{GuildID: n.GuildID, Balance: n.Balance},
	}, nil
}

func parseLiveNotification(payload string, now time.Time) (delivery, error) {
	var n liveNotification
	if err := json.Unmarshal([]byte(payload), &n); err != nil {
		return delivery{}, fmt.Errorf("decode live notification: %w", err)
	}
	if n.Scope != ScopeUser && n.Scope != ScopeGuild {
		return delivery{}, fmt.Errorf("live notification has unknown scope: %q", payload)
	}
	if n.TargetID == "" || n.Resource == "" {
		return delivery{}, fmt.Errorf("live notification missing target or resource: %q", payload)
	}
	changed := &ResourceChanged{Resource: n.Resource}
	if n.GuildID != nil {
		changed.GuildID = *n.GuildID
	}
	if n.ResourceID != nil {
		changed.ResourceID = *n.ResourceID
	}
	return delivery{
		scope:    n.Scope,
		targetID: n.TargetID,
		event:    Event{OccurredAt: now, ResourceChanged: changed},
	}, nil
}

func Listen(ctx context.Context, pool *database.Pool, broker *Broker, logger zerolog.Logger) {
	logger = logger.With().Str("component", "event-listener").Logger()
	backoff := minListenerBackoff
	for {
		err := listen(ctx, pool, broker, logger, func() { backoff = minListenerBackoff })
		if ctx.Err() != nil {
			return
		}
		logger.Warn().Err(err).Dur("retry_in", backoff).Msg("event listener disconnected")
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, maxListenerBackoff)
	}
}

func listen(ctx context.Context, pool *database.Pool, broker *Broker, logger zerolog.Logger, onListening func()) error {
	pooled, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	conn := pooled.Hijack()
	defer conn.Close(context.Background()) //nolint:errcheck

	for _, channel := range []string{walletChannel, liveEventsChannel} {
		if _, err := conn.Exec(ctx, "LISTEN "+channel); err != nil {
			return fmt.Errorf("listen %s: %w", channel, err)
		}
	}
	onListening()
	logger.Info().Strs("channels", []string{walletChannel, liveEventsChannel}).Msg("listening for live events")

	for {
		notification, err := conn.WaitForNotification(ctx)
		if err != nil {
			return fmt.Errorf("wait for notification: %w", err)
		}
		dispatch(broker, logger, notification.Channel, notification.Payload, time.Now())
	}
}

func dispatch(broker *Broker, logger zerolog.Logger, channel, payload string, now time.Time) {
	var target string
	var dropped int
	switch channel {
	case walletChannel:
		userID, event, err := parseWalletNotification(payload, now)
		if err != nil {
			logger.Error().Err(err).Msg("skipping wallet notification")
			return
		}
		target = userID
		_, dropped = broker.Publish(userID, event)
	case liveEventsChannel:
		d, err := parseLiveNotification(payload, now)
		if err != nil {
			logger.Error().Err(err).Msg("skipping live notification")
			return
		}
		target = d.targetID
		if d.scope == ScopeUser {
			_, dropped = broker.Publish(d.targetID, d.event)
		} else {
			_, dropped = broker.PublishGuild(d.targetID, d.event)
		}
	default:
		return
	}
	if dropped > 0 {
		logger.Warn().Str("channel", channel).Str("target", target).Int("dropped", dropped).Msg("slow subscribers missed a live event")
	}
}

func MemberGuildIDs(pool *database.Pool) func(ctx context.Context, userID uuid.UUID) ([]string, error) {
	q := db.New(pool.Pool)
	return func(ctx context.Context, userID uuid.UUID) ([]string, error) {
		rows, err := q.ListUserGuildIDs(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("list user guilds: %w", err)
		}
		guildIDs := make([]string, len(rows))
		for i, row := range rows {
			guildIDs[i] = row.String()
		}
		return guildIDs, nil
	}
}
