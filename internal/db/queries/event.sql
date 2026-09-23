-- name: ListEvents :many
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       type,
       TO_CHAR(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
       TO_CHAR(end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
       is_all_day,
       COALESCE(location, '') AS location,
       priority,
       is_recurring, recurring_pattern,
       participant_ids,
       created_at, updated_at
FROM guild_events
WHERE guild_id = $1
ORDER BY start_date ASC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountEvents :one
SELECT COUNT(*) FROM guild_events WHERE guild_id = $1;

-- name: GetEvent :one
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       type,
       TO_CHAR(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
       TO_CHAR(end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
       is_all_day,
       COALESCE(location, '') AS location,
       priority,
       is_recurring, recurring_pattern,
       participant_ids,
       created_at, updated_at
FROM guild_events WHERE id = $1 AND guild_id = $2;

-- name: CreateEvent :one
INSERT INTO guild_events (
    guild_id, created_by, title, description, type,
    start_date, end_date, is_all_day, location, priority,
    is_recurring, recurring_pattern
) VALUES (
    $1, $2, sqlc.arg(title)::text,
    NULLIF(sqlc.arg(description)::text, ''),
    sqlc.arg(type)::text,
    sqlc.arg(start_date)::text::timestamptz,
    sqlc.arg(end_date)::text::timestamptz,
    sqlc.arg(is_all_day)::bool,
    NULLIF(sqlc.arg(location)::text, ''),
    sqlc.arg(priority)::text,
    sqlc.arg(is_recurring)::bool,
    sqlc.narg(recurring_pattern)::jsonb
)
RETURNING id, guild_id, created_by, title,
          COALESCE(description, '') AS description,
          type,
          TO_CHAR(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
          TO_CHAR(end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
          is_all_day,
          COALESCE(location, '') AS location,
          priority,
          is_recurring, recurring_pattern,
          participant_ids,
          created_at, updated_at;

-- name: UpdateEvent :one
UPDATE guild_events SET
    title             = CASE WHEN sqlc.arg(title)::text       != '' THEN sqlc.arg(title)::text       ELSE title END,
    description       = CASE WHEN sqlc.arg(description)::text != '' THEN sqlc.arg(description)::text ELSE description END,
    type              = CASE WHEN sqlc.arg(type)::text        != '' THEN sqlc.arg(type)::text        ELSE type END,
    start_date        = CASE WHEN sqlc.arg(start_date)::text  != '' THEN sqlc.arg(start_date)::text::timestamptz ELSE start_date END,
    end_date          = CASE WHEN sqlc.arg(end_date)::text    != '' THEN sqlc.arg(end_date)::text::timestamptz   ELSE end_date END,
    is_all_day        = sqlc.arg(is_all_day)::bool,
    location          = CASE WHEN sqlc.arg(location)::text    != '' THEN sqlc.arg(location)::text    ELSE location END,
    priority          = CASE WHEN sqlc.arg(priority)::text    != '' THEN sqlc.arg(priority)::text    ELSE priority END,
    is_recurring      = sqlc.arg(is_recurring)::bool,
    recurring_pattern = CASE WHEN sqlc.narg(recurring_pattern)::jsonb IS NOT NULL THEN sqlc.narg(recurring_pattern)::jsonb ELSE recurring_pattern END,
    updated_at        = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id)
RETURNING id, guild_id, created_by, title,
          COALESCE(description, '') AS description,
          type,
          TO_CHAR(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
          TO_CHAR(end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
          is_all_day,
          COALESCE(location, '') AS location,
          priority,
          is_recurring, recurring_pattern,
          participant_ids,
          created_at, updated_at;

-- name: DeleteEvent :execrows
DELETE FROM guild_events WHERE id = $1 AND guild_id = $2;

-- name: ListEventsByRange :many
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       type,
       TO_CHAR(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
       TO_CHAR(end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
       is_all_day,
       COALESCE(location, '') AS location,
       priority,
       is_recurring, recurring_pattern,
       participant_ids,
       created_at, updated_at
FROM guild_events
WHERE guild_id = $1
  AND start_date >= sqlc.arg(start_date)::text::timestamptz
  AND end_date   <= sqlc.arg(end_date)::text::timestamptz
ORDER BY start_date ASC;

-- name: ListUpcomingEvents :many
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       type,
       TO_CHAR(start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
       TO_CHAR(end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
       is_all_day,
       COALESCE(location, '') AS location,
       priority,
       is_recurring, recurring_pattern,
       participant_ids,
       created_at, updated_at
FROM guild_events
WHERE guild_id = $1 AND start_date > NOW()
ORDER BY start_date ASC
LIMIT sqlc.arg(lim)::int;
