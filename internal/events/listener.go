package events

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
)

const (
	walletChannel      = "wallet_changed"
	minListenerBackoff = time.Second
	maxListenerBackoff = 30 * time.Second
)

type walletNotification struct {
	UserID  string `json:"user_id"`
	GuildID string `json:"guild_id"`
	Balance int64  `json:"balance"`
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

func ListenWalletChanges(ctx context.Context, pool *database.Pool, broker *Broker, logger zerolog.Logger) {
	logger = logger.With().Str("component", "wallet-listener").Logger()
	backoff := minListenerBackoff
	for {
		err := listenWalletChanges(ctx, pool, broker, logger, func() { backoff = minListenerBackoff })
		if ctx.Err() != nil {
			return
		}
		logger.Warn().Err(err).Dur("retry_in", backoff).Msg("wallet change listener disconnected")
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, maxListenerBackoff)
	}
}

func listenWalletChanges(ctx context.Context, pool *database.Pool, broker *Broker, logger zerolog.Logger, onListening func()) error {
	pooled, err := pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	conn := pooled.Hijack()
	defer conn.Close(context.Background()) //nolint:errcheck

	if _, err := conn.Exec(ctx, "LISTEN "+walletChannel); err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	onListening()
	logger.Info().Str("channel", walletChannel).Msg("listening for wallet changes")

	for {
		notification, err := conn.WaitForNotification(ctx)
		if err != nil {
			return fmt.Errorf("wait for notification: %w", err)
		}
		userID, event, err := parseWalletNotification(notification.Payload, time.Now())
		if err != nil {
			logger.Error().Err(err).Msg("skipping wallet notification")
			continue
		}
		if _, dropped := broker.Publish(userID, event); dropped > 0 {
			logger.Warn().Str("user_id", userID).Int("dropped", dropped).Msg("slow subscribers missed a wallet event")
		}
	}
}
