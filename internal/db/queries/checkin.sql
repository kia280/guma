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
    title       = sqlc.arg(title)::text,
    description = CASE WHEN sqlc.arg(set_description)::bool THEN NULLIF(sqlc.arg(description)::text, '') ELSE description END,
    datetime    = sqlc.arg(datetime)::text::timestamptz,
    expire_time = sqlc.arg(expire_time)::text::timestamptz,
    image_url   = CASE WHEN sqlc.arg(set_image_url)::bool THEN NULLIF(sqlc.arg(image_url)::text, '') ELSE image_url END,
    updated_at  = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id)
  AND cancelled_at IS NULL AND expire_time >= NOW()
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
VALUES ($1, $2, sqlc.arg(username)::text, sqlc.arg(amount)::bigint, NULLIF(sqlc.arg(note)::text, ''), 'checkin_loot',
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

-- name: LogRetractedCheckinLoot :exec
INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
SELECT bi.guild_id, bi.id, 'retracted', sqlc.arg(actor_id)::uuid, 'checkin', bi.checkin_id
FROM bank_items bi
WHERE bi.checkin_id = sqlc.arg(checkin_id) AND bi.guild_id = sqlc.arg(guild_id) AND bi.locked_by_type IS NULL;

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

-- name: InsertCheckinGoldPot :exec
INSERT INTO checkin_gold_pots (checkin_id, guild_id, total)
VALUES (sqlc.arg(checkin_id), sqlc.arg(guild_id), sqlc.arg(total)::bigint);

-- name: GetCheckinGoldPot :one
SELECT checkin_id, guild_id, total, distributed, retracted
FROM checkin_gold_pots
WHERE checkin_id = $1 AND guild_id = $2;

-- name: ListCheckinGoldPots :many
SELECT checkin_id, total, distributed, retracted
FROM checkin_gold_pots
WHERE guild_id = sqlc.arg(guild_id) AND checkin_id = ANY(sqlc.arg(checkin_ids)::uuid[]);

-- name: LockCheckinGoldPot :one
SELECT checkin_id, guild_id, total, distributed, retracted
FROM checkin_gold_pots
WHERE checkin_id = $1 AND guild_id = $2
FOR UPDATE;

-- name: AddCheckinGoldPotDistributed :one
UPDATE checkin_gold_pots SET
    distributed = distributed + sqlc.arg(amount)::bigint,
    updated_at  = NOW()
WHERE checkin_id = sqlc.arg(checkin_id) AND guild_id = sqlc.arg(guild_id)
  AND retracted = 0
  AND distributed + sqlc.arg(amount)::bigint <= total
RETURNING checkin_id, guild_id, total, distributed, retracted;

-- name: RetractCheckinGoldPot :one
UPDATE checkin_gold_pots SET
    retracted  = total - distributed,
    updated_at = NOW()
WHERE checkin_id = $1 AND guild_id = $2 AND retracted = 0 AND distributed < total
RETURNING checkin_id, guild_id, total, distributed, retracted;

-- name: GetCheckinGoldDistributionByRequest :one
SELECT id, total, created_at
FROM checkin_gold_distributions
WHERE checkin_id = $1 AND request_id = $2;

-- name: InsertCheckinGoldDistribution :one
INSERT INTO checkin_gold_distributions (checkin_id, guild_id, actor_id, request_id, total)
VALUES (sqlc.arg(checkin_id), sqlc.arg(guild_id), sqlc.arg(actor_id), sqlc.arg(request_id), sqlc.arg(total)::bigint)
RETURNING id, created_at;

-- name: InsertCheckinGoldPayout :exec
INSERT INTO checkin_gold_payouts (distribution_id, user_id, amount, transaction_id)
VALUES (sqlc.arg(distribution_id), sqlc.arg(user_id), sqlc.arg(amount)::bigint, sqlc.arg(transaction_id));

-- name: ListCheckinGoldDistributionPayouts :many
SELECT user_id, amount
FROM checkin_gold_payouts
WHERE distribution_id = $1
ORDER BY user_id;

-- name: ListCheckinGoldRecipients :many
SELECT p.user_id, SUM(p.amount)::bigint AS amount
FROM checkin_gold_payouts p
JOIN checkin_gold_distributions d ON d.id = p.distribution_id
WHERE d.checkin_id = $1 AND d.guild_id = $2
GROUP BY p.user_id
ORDER BY p.user_id;

-- name: CountCheckinAttendeesAmong :one
SELECT COUNT(*) FROM checkin_attendees
WHERE checkin_id = sqlc.arg(checkin_id) AND user_id = ANY(sqlc.arg(user_ids)::uuid[]);

-- name: InsertCheckinGoldBankActivity :exec
INSERT INTO bank_contributions (guild_id, user_id, username, amount, note, kind, checkin_id, reference_type, reference_id)
VALUES (sqlc.arg(guild_id), sqlc.arg(user_id), sqlc.arg(username)::text, sqlc.arg(amount)::bigint,
        NULLIF(sqlc.arg(note)::text, ''), sqlc.arg(kind)::text, sqlc.arg(checkin_id)::uuid,
        NULLIF(sqlc.arg(reference_type)::text, ''), sqlc.narg(reference_id)::uuid);
