-- name: ListCheckins :many
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       TO_CHAR(datetime    AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS datetime,
       TO_CHAR(expire_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expire_time,
       COALESCE(image_url, '') AS image_url,
       loot_list, attendance_count,
       (expire_time < NOW())::bool AS is_expired,
       (cancelled_at IS NOT NULL)::bool AS is_cancelled,
       created_at, updated_at
FROM checkins
WHERE guild_id = $1
  AND CASE
    WHEN sqlc.arg(status_filter)::text = 'active'    THEN cancelled_at IS NULL AND expire_time >= NOW()
    WHEN sqlc.arg(status_filter)::text = 'expired'   THEN cancelled_at IS NULL AND expire_time < NOW()
    WHEN sqlc.arg(status_filter)::text = 'cancelled' THEN cancelled_at IS NOT NULL
    ELSE true
  END
ORDER BY datetime DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountCheckins :one
SELECT COUNT(*) FROM checkins WHERE guild_id = $1
  AND CASE
    WHEN sqlc.arg(status_filter)::text = 'active'    THEN cancelled_at IS NULL AND expire_time >= NOW()
    WHEN sqlc.arg(status_filter)::text = 'expired'   THEN cancelled_at IS NULL AND expire_time < NOW()
    WHEN sqlc.arg(status_filter)::text = 'cancelled' THEN cancelled_at IS NOT NULL
    ELSE true
  END;

-- name: GetCheckin :one
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       TO_CHAR(datetime    AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS datetime,
       TO_CHAR(expire_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expire_time,
       COALESCE(image_url, '') AS image_url,
       loot_list, attendance_count,
       (expire_time < NOW())::bool AS is_expired,
       (cancelled_at IS NOT NULL)::bool AS is_cancelled,
       created_at, updated_at
FROM checkins WHERE id = $1 AND guild_id = $2;

-- name: CreateCheckin :one
INSERT INTO checkins (guild_id, created_by, title, description, datetime, expire_time, image_url, loot_list)
VALUES (
    $1, $2, sqlc.arg(title)::text,
    NULLIF(sqlc.arg(description)::text, ''),
    sqlc.arg(datetime)::text::timestamptz,
    sqlc.arg(expire_time)::text::timestamptz,
    NULLIF(sqlc.arg(image_url)::text, ''),
    sqlc.arg(loot_list)::jsonb
)
RETURNING id, guild_id, created_by, title,
          COALESCE(description, '') AS description,
          TO_CHAR(datetime    AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS datetime,
          TO_CHAR(expire_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expire_time,
          COALESCE(image_url, '') AS image_url,
          loot_list, attendance_count,
          (expire_time < NOW())::bool AS is_expired,
          (cancelled_at IS NOT NULL)::bool AS is_cancelled,
          created_at, updated_at;

-- name: UpdateCheckin :one
UPDATE checkins SET
    title       = CASE WHEN sqlc.arg(title)::text       != '' THEN sqlc.arg(title)::text       ELSE title END,
    description = CASE WHEN sqlc.arg(description)::text != '' THEN sqlc.arg(description)::text ELSE description END,
    datetime    = CASE WHEN sqlc.arg(datetime)::text    != '' THEN sqlc.arg(datetime)::text::timestamptz    ELSE datetime END,
    expire_time = CASE WHEN sqlc.arg(expire_time)::text != '' THEN sqlc.arg(expire_time)::text::timestamptz ELSE expire_time END,
    image_url   = CASE WHEN sqlc.arg(image_url)::text   != '' THEN sqlc.arg(image_url)::text   ELSE image_url END,
    loot_list   = sqlc.arg(loot_list)::jsonb,
    updated_at  = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id)
RETURNING id, guild_id, created_by, title,
          COALESCE(description, '') AS description,
          TO_CHAR(datetime    AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS datetime,
          TO_CHAR(expire_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expire_time,
          COALESCE(image_url, '') AS image_url,
          loot_list, attendance_count,
          (expire_time < NOW())::bool AS is_expired,
          (cancelled_at IS NOT NULL)::bool AS is_cancelled,
          created_at, updated_at;

-- name: DeleteCheckin :execrows
DELETE FROM checkins WHERE id = $1 AND guild_id = $2;

-- name: GetCheckinAttendanceWindow :one
SELECT expire_time, (cancelled_at IS NOT NULL)::bool AS is_cancelled
FROM checkins WHERE id = $1 AND guild_id = $2;

-- name: CancelCheckin :one
UPDATE checkins SET cancelled_at = NOW(), updated_at = NOW()
WHERE id = $1 AND guild_id = $2 AND cancelled_at IS NULL AND expire_time >= NOW()
RETURNING id, guild_id, created_by, title,
          COALESCE(description, '') AS description,
          TO_CHAR(datetime    AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS datetime,
          TO_CHAR(expire_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expire_time,
          COALESCE(image_url, '') AS image_url,
          loot_list, attendance_count,
          (expire_time < NOW())::bool AS is_expired,
          (cancelled_at IS NOT NULL)::bool AS is_cancelled,
          created_at, updated_at;

-- name: GetUserDisplayAndAvatar :one
SELECT COALESCE(display_name, '') AS display_name,
       COALESCE(avatar_url, '')   AS avatar_url
FROM users WHERE id = $1;

-- name: InsertCheckinAttendee :one
INSERT INTO checkin_attendees (checkin_id, user_id, display_name, avatar_url, notes)
VALUES ($1, $2, sqlc.arg(display_name)::text, sqlc.arg(avatar_url)::text, sqlc.arg(notes)::text)
ON CONFLICT (checkin_id, user_id) DO NOTHING
RETURNING id;

-- name: IncrementCheckinAttendance :exec
UPDATE checkins SET attendance_count = attendance_count + 1, updated_at = NOW() WHERE id = $1;

-- name: CheckinExists :one
SELECT EXISTS(SELECT 1 FROM checkins WHERE id = $1 AND guild_id = $2);

-- name: ListCheckinAttendees :many
SELECT id, checkin_id, user_id,
       COALESCE(display_name, '') AS display_name,
       COALESCE(avatar_url, '')   AS avatar_url,
       notes,
       attended_at
FROM checkin_attendees WHERE checkin_id = $1
ORDER BY attended_at ASC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountCheckinAttendees :one
SELECT COUNT(*) FROM checkin_attendees WHERE checkin_id = $1;

-- name: InsertCheckinBankItem :exec
INSERT INTO bank_items (id, guild_id, donor_id, donor_name, item, checkin_id)
VALUES ($1, $2, $3, sqlc.arg(donor_name)::text, sqlc.arg(item)::jsonb, sqlc.arg(checkin_id)::uuid);

-- name: InsertCheckinLootContribution :exec
INSERT INTO bank_contributions (guild_id, user_id, username, amount, note, kind, items, checkin_id)
VALUES ($1, $2, sqlc.arg(username)::text, 0, NULLIF(sqlc.arg(note)::text, ''), 'checkin_loot',
        sqlc.arg(items)::jsonb, sqlc.arg(checkin_id)::uuid);

-- name: RejectPendingRequestsForCheckinLoot :execrows
UPDATE item_requests SET
    status = 'rejected',
    reviewer_id = sqlc.arg(reviewer_id),
    review_note = NULLIF(sqlc.arg(review_note)::text, ''),
    reviewed_at = NOW()
WHERE item_requests.guild_id = sqlc.arg(guild_id)
  AND item_requests.status = 'pending'
  AND item_requests.bank_item_id IN (
      SELECT bi.id FROM bank_items bi
      WHERE bi.checkin_id = sqlc.arg(checkin_id) AND bi.guild_id = sqlc.arg(guild_id)
  );

-- name: RetractCheckinLoot :execrows
DELETE FROM bank_items
WHERE checkin_id = sqlc.arg(checkin_id) AND guild_id = sqlc.arg(guild_id) AND locked_by_type IS NULL;

-- name: IsCheckinAttendee :one
SELECT EXISTS(SELECT 1 FROM checkin_attendees WHERE checkin_id = $1 AND user_id = $2);

-- name: RejectPendingRequestsForLootItem :execrows
UPDATE item_requests SET
    status = 'rejected',
    reviewer_id = sqlc.arg(reviewer_id),
    review_note = NULLIF(sqlc.arg(review_note)::text, ''),
    reviewed_at = NOW()
WHERE item_requests.guild_id = sqlc.arg(guild_id)
  AND item_requests.bank_item_id = sqlc.arg(bank_item_id)
  AND item_requests.status = 'pending';

-- name: TakeCheckinLootItem :one
DELETE FROM bank_items
WHERE bank_items.id = sqlc.arg(id) AND bank_items.guild_id = sqlc.arg(guild_id) AND bank_items.checkin_id = sqlc.arg(checkin_id)
  AND bank_items.locked_by_type IS NULL
RETURNING bank_items.item;
