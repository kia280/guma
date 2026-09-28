-- name: ListEvents :many
SELECT e.id, e.guild_id, e.created_by,
       COALESCE(member_display_name(e.guild_id, e.created_by), '')::text AS created_by_name,
       e.title,
       COALESCE(e.description, '') AS description,
       e.type,
       TO_CHAR(e.start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
       TO_CHAR(e.end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
       e.is_all_day,
       COALESCE(e.location, '') AS location,
       e.priority,
       e.is_recurring, e.recurring_pattern,
       e.participant_ids,
       e.created_at, e.updated_at
FROM guild_events e
LEFT JOIN users u ON u.id = e.created_by
WHERE e.guild_id = $1
ORDER BY e.start_date ASC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountEvents :one
SELECT COUNT(*) FROM guild_events WHERE guild_id = $1;

-- name: GetEvent :one
SELECT e.id, e.guild_id, e.created_by,
       COALESCE(member_display_name(e.guild_id, e.created_by), '')::text AS created_by_name,
       e.title,
       COALESCE(e.description, '') AS description,
       e.type,
       TO_CHAR(e.start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
       TO_CHAR(e.end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
       e.is_all_day,
       COALESCE(e.location, '') AS location,
       e.priority,
       e.is_recurring, e.recurring_pattern,
       e.participant_ids,
       e.created_at, e.updated_at
FROM guild_events e
LEFT JOIN users u ON u.id = e.created_by
WHERE e.id = $1 AND e.guild_id = $2;

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
RETURNING guild_events.id, guild_events.guild_id, guild_events.created_by,
          COALESCE(member_display_name(guild_events.guild_id, guild_events.created_by), '')::text AS created_by_name,
          guild_events.title,
          COALESCE(guild_events.description, '') AS description,
          guild_events.type,
          TO_CHAR(guild_events.start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
          TO_CHAR(guild_events.end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
          guild_events.is_all_day,
          COALESCE(guild_events.location, '') AS location,
          guild_events.priority,
          guild_events.is_recurring, guild_events.recurring_pattern,
          guild_events.participant_ids,
          guild_events.created_at, guild_events.updated_at;

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
WHERE guild_events.id = sqlc.arg(id) AND guild_events.guild_id = sqlc.arg(guild_id)
RETURNING guild_events.id, guild_events.guild_id, guild_events.created_by,
          COALESCE(member_display_name(guild_events.guild_id, guild_events.created_by), '')::text AS created_by_name,
          guild_events.title,
          COALESCE(guild_events.description, '') AS description,
          guild_events.type,
          TO_CHAR(guild_events.start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
          TO_CHAR(guild_events.end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
          guild_events.is_all_day,
          COALESCE(guild_events.location, '') AS location,
          guild_events.priority,
          guild_events.is_recurring, guild_events.recurring_pattern,
          guild_events.participant_ids,
          guild_events.created_at, guild_events.updated_at;

-- name: DeleteEvent :execrows
DELETE FROM guild_events WHERE id = $1 AND guild_id = $2;

-- name: ListEventsByRange :many
SELECT e.id, e.guild_id, e.created_by,
       COALESCE(member_display_name(e.guild_id, e.created_by), '')::text AS created_by_name,
       e.title,
       COALESCE(e.description, '') AS description,
       e.type,
       TO_CHAR(e.start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
       TO_CHAR(e.end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
       e.is_all_day,
       COALESCE(e.location, '') AS location,
       e.priority,
       e.is_recurring, e.recurring_pattern,
       e.participant_ids,
       e.created_at, e.updated_at
FROM guild_events e
LEFT JOIN users u ON u.id = e.created_by
WHERE e.guild_id = $1
  AND e.start_date >= sqlc.arg(start_date)::text::timestamptz
  AND e.end_date   <= sqlc.arg(end_date)::text::timestamptz
ORDER BY e.start_date ASC;

-- name: ListUpcomingEvents :many
SELECT e.id, e.guild_id, e.created_by,
       COALESCE(member_display_name(e.guild_id, e.created_by), '')::text AS created_by_name,
       e.title,
       COALESCE(e.description, '') AS description,
       e.type,
       TO_CHAR(e.start_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS start_date,
       TO_CHAR(e.end_date   AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS end_date,
       e.is_all_day,
       COALESCE(e.location, '') AS location,
       e.priority,
       e.is_recurring, e.recurring_pattern,
       e.participant_ids,
       e.created_at, e.updated_at
FROM guild_events e
LEFT JOIN users u ON u.id = e.created_by
WHERE e.guild_id = $1 AND e.start_date > NOW()
ORDER BY e.start_date ASC
LIMIT sqlc.arg(lim)::int;
