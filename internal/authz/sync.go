package authz

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
)

const (
	outboxChannel     = "authz_member_changed"
	tupleWriteTimeout = 5 * time.Second
	backfillPageSize  = 500
	minRelayBackoff   = time.Second
	maxRelayBackoff   = 30 * time.Second
)

type Syncer struct {
	pool   *database.Pool
	q      *db.Queries
	tuples TupleStore
	logger zerolog.Logger
}

func NewSyncer(pool *database.Pool, tuples TupleStore, logger zerolog.Logger) *Syncer {
	return &Syncer{
		pool:   pool,
		q:      db.New(pool.Pool),
		tuples: tuples,
		logger: logger.With().Str("component", "authz-sync").Logger(),
	}
}

func (s *Syncer) SyncMember(ctx context.Context, guildID, userID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	if err := s.reconcile(ctx, s.q.WithTx(tx), guildID, userID); err != nil {
		return err
	}
	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}

func (s *Syncer) reconcile(ctx context.Context, qtx *db.Queries, guildID, userID uuid.UUID) error {
	if err := qtx.AcquireAuthzMemberLock(ctx, db.AcquireAuthzMemberLockParams{GuildID: guildID, UserID: userID}); err != nil {
		return fmt.Errorf("lock member: %w", err)
	}
	ids, err := qtx.LockAuthzOutboxEntries(ctx, db.LockAuthzOutboxEntriesParams{GuildID: guildID, UserID: userID})
	if err != nil {
		return fmt.Errorf("lock outbox entries: %w", err)
	}
	role, err := memberRole(ctx, qtx, guildID, userID)
	if err != nil {
		return err
	}

	writeCtx, cancel := context.WithTimeout(ctx, tupleWriteTimeout)
	defer cancel()
	if err := s.tuples.SetMemberRole(writeCtx, guildID, userID, role); err != nil {
		return fmt.Errorf("write member tuples: %w", err)
	}

	if len(ids) > 0 {
		if err := qtx.DeleteAuthzOutboxEntries(ctx, ids); err != nil {
			return fmt.Errorf("delete outbox entries: %w", err)
		}
	}
	return nil
}

func memberRole(ctx context.Context, q *db.Queries, guildID, userID uuid.UUID) (Role, error) {
	raw, err := q.GetGuildMemberRole(ctx, db.GetGuildMemberRoleParams{GuildID: guildID, UserID: userID})
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("load member role: %w", err)
	}
	role, ok := ParseRole(raw)
	if !ok {
		return "", fmt.Errorf("member has unknown role %q", raw)
	}
	return role, nil
}

func (s *Syncer) ProcessNext(ctx context.Context) (bool, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return false, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(tx)

	m, err := qtx.ClaimNextAuthzOutboxMember(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("claim outbox entry: %w", err)
	}

	if err := s.reconcile(ctx, qtx, m.GuildID, m.UserID); err != nil {
		tx.Rollback(ctx) //nolint:errcheck
		s.logger.Warn().Err(err).Str("guild_id", m.GuildID.String()).Str("user_id", m.UserID.String()).
			Msg("member authorization sync failed; will retry")
		if deferErr := s.q.DeferAuthzOutboxMember(ctx, db.DeferAuthzOutboxMemberParams{GuildID: m.GuildID, UserID: m.UserID}); deferErr != nil {
			return false, fmt.Errorf("defer outbox entry: %w", deferErr)
		}
		return true, nil
	}
	if err := tx.Commit(ctx); err != nil {
		return false, fmt.Errorf("commit: %w", err)
	}
	return true, nil
}

func (s *Syncer) Drain(ctx context.Context) (int, error) {
	n := 0
	for {
		more, err := s.ProcessNext(ctx)
		if err != nil || !more {
			return n, err
		}
		n++
	}
}

func (s *Syncer) Run(ctx context.Context, sweepInterval time.Duration) {
	wake := make(chan struct{}, 1)
	go s.listen(ctx, wake)

	ticker := time.NewTicker(sweepInterval)
	defer ticker.Stop()
	for {
		if _, err := s.Drain(ctx); err != nil && ctx.Err() == nil {
			s.logger.Error().Err(err).Msg("authorization outbox drain failed")
		}
		select {
		case <-ctx.Done():
			return
		case <-wake:
		case <-ticker.C:
		}
	}
}

func (s *Syncer) listen(ctx context.Context, wake chan<- struct{}) {
	backoff := minRelayBackoff
	for {
		err := s.waitForChanges(ctx, wake, func() { backoff = minRelayBackoff })
		if ctx.Err() != nil {
			return
		}
		s.logger.Warn().Err(err).Dur("retry_in", backoff).Msg("authorization outbox listener disconnected")
		select {
		case <-ctx.Done():
			return
		case <-time.After(backoff):
		}
		backoff = min(backoff*2, maxRelayBackoff)
	}
}

func (s *Syncer) waitForChanges(ctx context.Context, wake chan<- struct{}, onListening func()) error {
	pooled, err := s.pool.Acquire(ctx)
	if err != nil {
		return fmt.Errorf("acquire connection: %w", err)
	}
	conn := pooled.Hijack()
	defer conn.Close(context.Background()) //nolint:errcheck

	if _, err := conn.Exec(ctx, "LISTEN "+outboxChannel); err != nil {
		return fmt.Errorf("listen %s: %w", outboxChannel, err)
	}
	onListening()
	for {
		if _, err := conn.WaitForNotification(ctx); err != nil {
			return fmt.Errorf("wait for notification: %w", err)
		}
		select {
		case wake <- struct{}{}:
		default:
		}
	}
}

type BackfillResult struct {
	Members int
	Stale   int
	Failed  int
}

func (s *Syncer) Backfill(ctx context.Context) (BackfillResult, error) {
	var res BackfillResult
	var failures []error
	sync := func(guildID, userID uuid.UUID) bool {
		if err := s.SyncMember(ctx, guildID, userID); err != nil {
			res.Failed++
			failures = append(failures, fmt.Errorf("member %s in guild %s: %w", userID, guildID, err))
			return false
		}
		return true
	}

	seen := make(map[[2]uuid.UUID]struct{})
	after := db.ListMemberRolesAfterParams{AfterGuildID: uuid.Nil, AfterUserID: uuid.Nil, PageSize: backfillPageSize}
	for {
		rows, err := s.q.ListMemberRolesAfter(ctx, after)
		if err != nil {
			return res, fmt.Errorf("list members: %w", err)
		}
		for _, r := range rows {
			seen[[2]uuid.UUID{r.GuildID, r.UserID}] = struct{}{}
			if sync(r.GuildID, r.UserID) {
				res.Members++
			}
		}
		if len(rows) < backfillPageSize {
			break
		}
		last := rows[len(rows)-1]
		after.AfterGuildID, after.AfterUserID = last.GuildID, last.UserID
	}

	stale := make(map[[2]uuid.UUID]struct{})
	if err := s.tuples.ListMemberRoles(ctx, func(m MemberRole) error {
		key := [2]uuid.UUID{m.GuildID, m.UserID}
		if _, ok := seen[key]; !ok {
			stale[key] = struct{}{}
		}
		return nil
	}); err != nil {
		return res, fmt.Errorf("list keto tuples: %w", err)
	}
	for key := range stale {
		if sync(key[0], key[1]) {
			res.Stale++
		}
	}

	if len(failures) > 0 {
		return res, fmt.Errorf("%d memberships failed to sync: %w", len(failures), errors.Join(failures...))
	}
	return res, nil
}
