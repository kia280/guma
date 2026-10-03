-- name: AcquireAuthzMemberLock :exec
SELECT pg_advisory_xact_lock(hashtextextended(sqlc.arg(guild_id)::uuid::text || ':' || sqlc.arg(user_id)::uuid::text, 0));

-- name: ClaimNextAuthzOutboxMember :one
SELECT guild_id, user_id FROM authz_member_outbox
WHERE available_at <= NOW()
ORDER BY id
LIMIT 1
FOR UPDATE SKIP LOCKED;

-- name: LockAuthzOutboxEntries :many
SELECT id FROM authz_member_outbox
WHERE guild_id = sqlc.arg(guild_id) AND user_id = sqlc.arg(user_id)
FOR UPDATE SKIP LOCKED;

-- name: DeleteAuthzOutboxEntries :exec
DELETE FROM authz_member_outbox WHERE id = ANY(sqlc.arg(ids)::bigint[]);

-- name: DeferAuthzOutboxMember :exec
UPDATE authz_member_outbox
SET attempts = attempts + 1,
    available_at = NOW() + make_interval(secs => power(2, LEAST(attempts, 8)))
WHERE guild_id = sqlc.arg(guild_id) AND user_id = sqlc.arg(user_id);

-- name: ListMemberRolesAfter :many
SELECT guild_id, user_id, role FROM members
WHERE (guild_id, user_id) > (sqlc.arg(after_guild_id)::uuid, sqlc.arg(after_user_id)::uuid)
ORDER BY guild_id, user_id
LIMIT sqlc.arg(page_size);
