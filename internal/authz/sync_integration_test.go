package authz

import (
	"context"
	"os"
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
)

type syncFixture struct {
	pool   *database.Pool
	keto   *Keto
	syncer *Syncer
}

func newSyncFixture(t *testing.T) *syncFixture {
	t.Helper()
	url := os.Getenv("GUMA_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set GUMA_TEST_DATABASE_URL to a migrated database to run syncer tests")
	}
	k := dialTestKeto(t)
	pool, err := database.NewPool(context.Background(), database.Config{URL: url, MaxOpenConns: 4, MaxIdleConns: 1, Logger: zerolog.Nop()})
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(pool.Close)
	f := &syncFixture{pool: pool, keto: k, syncer: NewSyncer(pool, k, zerolog.New(zerolog.NewTestWriter(t)).Level(zerolog.WarnLevel))}
	if _, err := f.syncer.Drain(context.Background()); err != nil {
		t.Fatalf("initial drain: %v", err)
	}
	return f
}

func (f *syncFixture) exec(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := f.pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("exec %q: %v", sql, err)
	}
}

func (f *syncFixture) newUser(t *testing.T) uuid.UUID {
	t.Helper()
	id := uuid.New()
	f.exec(t, `INSERT INTO users (id, email, username) VALUES ($1, $2, $3)`, id, id.String()+"@test.invalid", "u-"+id.String())
	return id
}

func (f *syncFixture) newGuild(t *testing.T, owner uuid.UUID) uuid.UUID {
	t.Helper()
	id := uuid.New()
	f.exec(t, `INSERT INTO guilds (id, name, owner_id) VALUES ($1, 'authz test', $2)`, id, owner)
	t.Cleanup(func() {
		f.exec(t, `DELETE FROM guilds WHERE id = $1`, id)
		f.drain(t)
	})
	return id
}

func (f *syncFixture) outboxCount(t *testing.T, guildID, userID uuid.UUID) int {
	t.Helper()
	var n int
	if err := f.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM authz_member_outbox WHERE guild_id = $1 AND user_id = $2`, guildID, userID).Scan(&n); err != nil {
		t.Fatalf("count outbox: %v", err)
	}
	return n
}

func (f *syncFixture) drain(t *testing.T) {
	t.Helper()
	if _, err := f.syncer.Drain(context.Background()); err != nil {
		t.Fatalf("drain: %v", err)
	}
}

func TestSyncerFollowsMembershipChanges(t *testing.T) {
	f := newSyncFixture(t)
	owner, user := f.newUser(t), f.newUser(t)
	guild := f.newGuild(t, owner)

	f.exec(t, `INSERT INTO members (user_id, guild_id, role) VALUES ($1, $3, 'owner'), ($2, $3, 'member')`, owner, user, guild)
	if n := f.outboxCount(t, guild, user); n != 1 {
		t.Fatalf("insert enqueued %d outbox entries, want 1", n)
	}
	f.drain(t)
	if n := f.outboxCount(t, guild, user); n != 0 {
		t.Fatalf("drain left %d outbox entries", n)
	}
	assertPermissions(t, f.keto, guild, owner, expectedRolePermissions[RoleOwner])
	assertPermissions(t, f.keto, guild, user, expectedRolePermissions[RoleMember])

	f.exec(t, `UPDATE members SET display_name = 'renamed' WHERE guild_id = $1 AND user_id = $2`, guild, user)
	if n := f.outboxCount(t, guild, user); n != 0 {
		t.Fatalf("non-role update enqueued %d outbox entries", n)
	}

	f.exec(t, `UPDATE members SET role = 'admin' WHERE guild_id = $1 AND user_id = $2`, guild, user)
	if err := f.syncer.SyncMember(context.Background(), guild, user); err != nil {
		t.Fatalf("SyncMember: %v", err)
	}
	if n := f.outboxCount(t, guild, user); n != 0 {
		t.Fatalf("SyncMember left %d outbox entries", n)
	}
	assertPermissions(t, f.keto, guild, user, expectedRolePermissions[RoleAdmin])

	f.exec(t, `DELETE FROM members WHERE guild_id = $1 AND user_id = $2`, guild, user)
	f.drain(t)
	assertPermissions(t, f.keto, guild, user, nil)

	f.exec(t, `DELETE FROM guilds WHERE id = $1`, guild)
	f.drain(t)
	assertPermissions(t, f.keto, guild, owner, nil)
	if got := memberTuples(t, f.keto, guild, owner); len(got) != 0 {
		t.Fatalf("guild deletion left tuples %v", got)
	}
}

func TestSyncerDefersFailedWrites(t *testing.T) {
	f := newSyncFixture(t)
	owner := f.newUser(t)
	guild := f.newGuild(t, owner)
	f.exec(t, `INSERT INTO members (user_id, guild_id, role) VALUES ($1, $2, 'superuser')`, owner, guild)

	f.drain(t)
	var attempts int
	var deferred bool
	if err := f.pool.QueryRow(context.Background(),
		`SELECT attempts, available_at > NOW() FROM authz_member_outbox WHERE guild_id = $1 AND user_id = $2`, guild, owner).
		Scan(&attempts, &deferred); err != nil {
		t.Fatalf("load deferred entry: %v", err)
	}
	if attempts != 1 || !deferred {
		t.Fatalf("attempts = %d, deferred = %v; want 1, true", attempts, deferred)
	}

	f.exec(t, `UPDATE members SET role = 'moderator' WHERE guild_id = $1 AND user_id = $2`, guild, owner)
	f.exec(t, `UPDATE authz_member_outbox SET available_at = NOW() WHERE guild_id = $1 AND user_id = $2`, guild, owner)
	f.drain(t)
	if n := f.outboxCount(t, guild, owner); n != 0 {
		t.Fatalf("retry left %d outbox entries", n)
	}
	assertPermissions(t, f.keto, guild, owner, expectedRolePermissions[RoleModerator])
}

func TestBackfillRepairsDrift(t *testing.T) {
	f := newSyncFixture(t)
	ctx := context.Background()
	owner, user := f.newUser(t), f.newUser(t)
	guild := f.newGuild(t, owner)
	f.exec(t, `INSERT INTO members (user_id, guild_id, role) VALUES ($1, $3, 'owner'), ($2, $3, 'moderator')`, owner, user, guild)
	f.exec(t, `DELETE FROM authz_member_outbox WHERE guild_id = $1`, guild)

	ghostGuild, ghostUser := uuid.New(), uuid.New()
	if err := f.keto.SetMemberRole(ctx, ghostGuild, ghostUser, RoleAdmin); err != nil {
		t.Fatalf("seed stale tuple: %v", err)
	}
	if err := f.keto.SetMemberRole(ctx, guild, user, RoleOwner); err != nil {
		t.Fatalf("seed wrong role: %v", err)
	}

	res, err := f.syncer.Backfill(ctx)
	if err != nil {
		t.Fatalf("Backfill: %v", err)
	}
	if res.Members < 2 || res.Stale < 1 {
		t.Fatalf("Backfill result %+v", res)
	}
	assertPermissions(t, f.keto, guild, owner, expectedRolePermissions[RoleOwner])
	assertPermissions(t, f.keto, guild, user, expectedRolePermissions[RoleModerator])
	assertPermissions(t, f.keto, ghostGuild, ghostUser, nil)
	if got := memberTuples(t, f.keto, guild, user); !slices.Equal(got, []Role{RoleModerator}) {
		t.Fatalf("tuples after backfill = %v", got)
	}

	again, err := f.syncer.Backfill(ctx)
	if err != nil {
		t.Fatalf("second Backfill: %v", err)
	}
	if again.Stale != 0 {
		t.Fatalf("second Backfill removed %d stale memberships, want 0", again.Stale)
	}
}

func TestBackfillContinuesPastBadMembers(t *testing.T) {
	f := newSyncFixture(t)
	bad, good := f.newUser(t), f.newUser(t)
	guild := f.newGuild(t, bad)
	f.exec(t, `INSERT INTO members (user_id, guild_id, role) VALUES ($1, $3, 'superuser'), ($2, $3, 'member')`, bad, good, guild)
	f.exec(t, `DELETE FROM authz_member_outbox WHERE guild_id = $1`, guild)

	res, err := f.syncer.Backfill(context.Background())
	if err == nil || res.Failed != 1 {
		t.Fatalf("Backfill = %+v, %v; want one failure", res, err)
	}
	assertPermissions(t, f.keto, guild, good, expectedRolePermissions[RoleMember])
	f.exec(t, `DELETE FROM members WHERE guild_id = $1 AND user_id = $2`, guild, bad)
}

func TestConcurrentRelaysConvergeToDatabase(t *testing.T) {
	f := newSyncFixture(t)
	ctx := context.Background()
	owner := f.newUser(t)
	guild := f.newGuild(t, owner)
	users := make([]uuid.UUID, 8)
	for i := range users {
		users[i] = f.newUser(t)
		f.exec(t, `INSERT INTO members (user_id, guild_id, role) VALUES ($1, $2, 'member')`, users[i], guild)
	}

	roles := []Role{RoleAdmin, RoleModerator, RoleMember}
	done := make(chan error)
	stop := make(chan struct{})
	for range 4 {
		go func() {
			for {
				select {
				case <-stop:
					done <- nil
					return
				default:
				}
				if _, err := f.syncer.Drain(ctx); err != nil {
					done <- err
					return
				}
			}
		}()
	}
	for round := range 30 {
		for i, u := range users {
			f.exec(t, `UPDATE members SET role = $1 WHERE guild_id = $2 AND user_id = $3`, string(roles[(round+i)%len(roles)]), guild, u)
		}
	}
	close(stop)
	for range 4 {
		if err := <-done; err != nil {
			t.Fatalf("relay: %v", err)
		}
	}
	f.drain(t)
	var deferred int
	if err := f.pool.QueryRow(ctx, `SELECT COUNT(*) FROM authz_member_outbox WHERE guild_id = $1`, guild).Scan(&deferred); err != nil {
		t.Fatalf("count outbox: %v", err)
	}
	if deferred > 0 {
		t.Logf("%d outbox entries were deferred after failed writes; retrying them now", deferred)
		f.exec(t, `UPDATE authz_member_outbox SET available_at = NOW() WHERE guild_id = $1`, guild)
		f.drain(t)
	}
	if err := f.pool.QueryRow(ctx, `SELECT COUNT(*) FROM authz_member_outbox WHERE guild_id = $1`, guild).Scan(&deferred); err != nil || deferred != 0 {
		t.Fatalf("outbox not drained: %d entries, %v", deferred, err)
	}

	for _, u := range users {
		var raw string
		if err := f.pool.QueryRow(ctx, `SELECT role FROM members WHERE guild_id = $1 AND user_id = $2`, guild, u).Scan(&raw); err != nil {
			t.Fatalf("load role: %v", err)
		}
		if got := memberTuples(t, f.keto, guild, u); !slices.Equal(got, []Role{Role(raw)}) {
			t.Errorf("user %s: tuples %v, database role %s", u, got, raw)
		}
	}
}
