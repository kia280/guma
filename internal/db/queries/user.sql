-- name: CreateUser :one
INSERT INTO users (id, email, username, display_name, avatar_url)
VALUES (
    sqlc.arg(id),
    sqlc.arg(email),
    NULLIF(sqlc.arg(username)::text, ''),
    NULLIF(sqlc.arg(display_name)::text, ''),
    NULLIF(sqlc.arg(avatar_url)::text, '')
)
RETURNING id, email, COALESCE(username, '')::text AS username,
          COALESCE(display_name, '') AS display_name,
          COALESCE(bio, '')          AS bio,
          COALESCE(avatar_url, '')   AS avatar_url,
          created_at, updated_at;

-- name: UpsertUserFromKratos :one
-- Inserts the users row on first touch, or refreshes Kratos-owned fields
-- (email, avatar_url) if it already exists. Username/display_name/bio are
-- app-editable and are preserved across updates so UpdateMe writes don't
-- get clobbered by every GetMe call.
INSERT INTO users (id, email, display_name, avatar_url, discord_username)
VALUES (
    sqlc.arg(id),
    sqlc.arg(email),
    NULLIF(sqlc.arg(display_name)::text, ''),
    NULLIF(sqlc.arg(avatar_url)::text, ''),
    NULLIF(sqlc.arg(discord_username)::text, '')
)
ON CONFLICT (id) DO UPDATE SET
    email            = EXCLUDED.email,
    avatar_url       = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
    display_name     = COALESCE(NULLIF(users.display_name, ''), EXCLUDED.display_name),
    discord_username = COALESCE(EXCLUDED.discord_username, users.discord_username),
    updated_at       = NOW()
RETURNING id, email, COALESCE(username, '')::text AS username,
          COALESCE(display_name, '') AS display_name,
          COALESCE(bio, '')          AS bio,
          COALESCE(avatar_url, '')   AS avatar_url,
          created_at, updated_at;

-- name: GetUserByID :one
SELECT id, email, COALESCE(username, '')::text AS username,
       COALESCE(display_name, '') AS display_name,
       COALESCE(bio, '')          AS bio,
       COALESCE(avatar_url, '')   AS avatar_url,
       created_at, updated_at
FROM users
WHERE id = $1;

-- name: GetUserPublicByID :one
SELECT id, COALESCE(username, '')::text AS username,
       COALESCE(display_name, '') AS display_name,
       COALESCE(avatar_url, '')   AS avatar_url,
       created_at, updated_at
FROM users
WHERE id = $1;

-- name: UpdateUser :one
UPDATE users SET
    display_name = CASE WHEN sqlc.arg(display_name)::text != '' THEN sqlc.arg(display_name)::text ELSE display_name END,
    bio          = CASE WHEN sqlc.arg(bio)::text          != '' THEN sqlc.arg(bio)::text          ELSE bio          END,
    avatar_url   = CASE WHEN sqlc.arg(avatar_url)::text   != '' THEN sqlc.arg(avatar_url)::text   ELSE avatar_url   END,
    updated_at   = NOW()
WHERE id = sqlc.arg(id)
RETURNING id, email, COALESCE(username, '')::text AS username,
          COALESCE(display_name, '') AS display_name,
          COALESCE(bio, '')          AS bio,
          COALESCE(avatar_url, '')   AS avatar_url,
          created_at, updated_at;

-- name: UpdateMemberDisplayName :execrows
UPDATE members SET display_name = sqlc.arg(display_name)::text
WHERE user_id = sqlc.arg(user_id) AND guild_id = sqlc.arg(guild_id);

-- name: ListUserGuildIDs :many
SELECT guild_id FROM members WHERE user_id = $1;

-- name: GetUserCurrentGuildBalance :one
SELECT m.guild_id,
       m.role,
       m.display_name,
       COALESCE(w.balance, 0)::bigint AS balance
FROM members m
LEFT JOIN wallets w ON w.user_id = m.user_id AND w.guild_id = m.guild_id
WHERE m.user_id = $1
ORDER BY m.last_active DESC
LIMIT 1;

-- name: CountUserGuilds :one
SELECT COUNT(*) FROM members WHERE user_id = $1;

-- name: CountUserCheckins :one
SELECT COUNT(*) FROM checkin_attendees WHERE user_id = $1;

-- name: CountUserEventsAttended :one
SELECT COUNT(*) FROM guild_events WHERE sqlc.arg(user_id)::uuid = ANY(participant_ids);

-- name: CountUserAuctionsWon :one
SELECT COUNT(*) FROM auctions WHERE current_bidder_id = $1 AND status = 'ENDED';

-- name: CountUserLotteriesWon :one
SELECT COUNT(*) FROM lottery_winners WHERE user_id = $1;

-- name: SumUserEarnedSpent :one
SELECT
    COALESCE(SUM(CASE WHEN amount > 0 THEN amount       ELSE 0 END), 0)::bigint AS total_earned,
    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount)  ELSE 0 END), 0)::bigint AS total_spent
FROM transactions
WHERE user_id = $1;

-- name: ListUsers :many
SELECT id, email, COALESCE(username, '')::text AS username,
       COALESCE(display_name, '') AS display_name,
       COALESCE(avatar_url, '')   AS avatar_url,
       created_at
FROM users
ORDER BY created_at DESC
LIMIT $1;
