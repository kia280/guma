-- name: ListRollCalls :many
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       TO_CHAR(datetime    AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS datetime,
       TO_CHAR(expire_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expire_time,
       COALESCE(image_url, '') AS image_url,
       loot_list, attendance_count,
       (expire_time < NOW())::bool AS is_expired,
       (cancelled_at IS NOT NULL)::bool AS is_cancelled,
       (completed_at IS NOT NULL)::bool AS is_completed,
       completed_at,
       created_at, updated_at
FROM roll_calls
WHERE guild_id = $1
  AND CASE
    WHEN sqlc.arg(status_filter)::text = 'active'    THEN cancelled_at IS NULL AND expire_time >= NOW()
    WHEN sqlc.arg(status_filter)::text = 'expired'   THEN cancelled_at IS NULL AND completed_at IS NULL AND expire_time < NOW()
    WHEN sqlc.arg(status_filter)::text = 'cancelled' THEN cancelled_at IS NOT NULL
    WHEN sqlc.arg(status_filter)::text = 'completed' THEN completed_at IS NOT NULL
    ELSE true
  END
ORDER BY datetime DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountRollCalls :one
SELECT COUNT(*) FROM roll_calls WHERE guild_id = $1
  AND CASE
    WHEN sqlc.arg(status_filter)::text = 'active'    THEN cancelled_at IS NULL AND expire_time >= NOW()
    WHEN sqlc.arg(status_filter)::text = 'expired'   THEN cancelled_at IS NULL AND completed_at IS NULL AND expire_time < NOW()
    WHEN sqlc.arg(status_filter)::text = 'cancelled' THEN cancelled_at IS NOT NULL
    WHEN sqlc.arg(status_filter)::text = 'completed' THEN completed_at IS NOT NULL
    ELSE true
  END;

-- name: GetRollCall :one
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       TO_CHAR(datetime    AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS datetime,
       TO_CHAR(expire_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expire_time,
       COALESCE(image_url, '') AS image_url,
       loot_list, attendance_count,
       (expire_time < NOW())::bool AS is_expired,
       (cancelled_at IS NOT NULL)::bool AS is_cancelled,
       (completed_at IS NOT NULL)::bool AS is_completed,
       completed_at,
       created_at, updated_at
FROM roll_calls WHERE id = $1 AND guild_id = $2;

-- name: CreateRollCall :one
INSERT INTO roll_calls (guild_id, created_by, title, description, datetime, expire_time, image_url, loot_list)
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
          (completed_at IS NOT NULL)::bool AS is_completed,
          completed_at,
          created_at, updated_at;

-- name: UpdateRollCall :one
UPDATE roll_calls SET
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
          (completed_at IS NOT NULL)::bool AS is_completed,
          completed_at,
          created_at, updated_at;

-- name: DeleteRollCall :execrows
DELETE FROM roll_calls WHERE id = $1 AND guild_id = $2;

-- name: GetRollCallCheckInWindow :one
SELECT expire_time, (cancelled_at IS NOT NULL)::bool AS is_cancelled
FROM roll_calls WHERE id = $1 AND guild_id = $2;

-- name: CancelRollCall :one
UPDATE roll_calls SET cancelled_at = NOW(), updated_at = NOW()
WHERE id = $1 AND guild_id = $2 AND cancelled_at IS NULL AND expire_time >= NOW()
RETURNING id, guild_id, created_by, title,
          COALESCE(description, '') AS description,
          TO_CHAR(datetime    AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS datetime,
          TO_CHAR(expire_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expire_time,
          COALESCE(image_url, '') AS image_url,
          loot_list, attendance_count,
          (expire_time < NOW())::bool AS is_expired,
          (cancelled_at IS NOT NULL)::bool AS is_cancelled,
          (completed_at IS NOT NULL)::bool AS is_completed,
          completed_at,
          created_at, updated_at;

-- name: GetUserDisplayAndAvatar :one
SELECT COALESCE(member_display_name(sqlc.arg(guild_id)::uuid, id), '')::text AS display_name,
       COALESCE(avatar_url, '')                                                   AS avatar_url
FROM users WHERE id = sqlc.arg(user_id);

-- name: InsertRollCallAttendee :one
INSERT INTO roll_call_attendees (roll_call_id, user_id, display_name, avatar_url, notes)
VALUES ($1, $2, sqlc.arg(display_name)::text, sqlc.arg(avatar_url)::text, sqlc.arg(notes)::text)
ON CONFLICT (roll_call_id, user_id) DO NOTHING
RETURNING id;

-- name: IncrementRollCallAttendance :exec
UPDATE roll_calls SET attendance_count = attendance_count + 1, updated_at = NOW() WHERE id = $1;

-- name: RollCallExists :one
SELECT EXISTS(SELECT 1 FROM roll_calls WHERE id = $1 AND guild_id = $2);

-- name: ListRollCallAttendees :many
SELECT ca.id, ca.roll_call_id, ca.user_id,
       COALESCE(NULLIF(member_display_name(c.guild_id, ca.user_id), ''), ca.display_name, '')::text AS display_name,
       COALESCE(NULLIF(u.avatar_url, ''), ca.avatar_url, '')::text                        AS avatar_url,
       ca.notes,
       ca.checked_in_at
FROM roll_call_attendees ca
JOIN roll_calls c ON c.id = ca.roll_call_id
LEFT JOIN users u ON u.id = ca.user_id
WHERE ca.roll_call_id = $1
ORDER BY ca.checked_in_at ASC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountRollCallAttendees :one
SELECT COUNT(*) FROM roll_call_attendees WHERE roll_call_id = $1;

-- name: InsertRollCallBankItem :exec
INSERT INTO bank_items (id, guild_id, donor_id, donor_name, item, roll_call_id)
VALUES ($1, $2, $3, sqlc.arg(donor_name)::text, sqlc.arg(item)::jsonb, sqlc.arg(roll_call_id)::uuid);

-- name: InsertRollCallLootContribution :exec
INSERT INTO bank_contributions (guild_id, user_id, username, amount, note, kind, items, roll_call_id)
VALUES ($1, $2, sqlc.arg(username)::text, sqlc.arg(amount)::bigint, NULLIF(sqlc.arg(note)::text, ''), 'roll_call_loot',
        sqlc.arg(items)::jsonb, sqlc.arg(roll_call_id)::uuid);

-- name: RejectPendingRequestsForRollCallLoot :execrows
UPDATE item_requests SET
    status = 'rejected',
    reviewer_id = sqlc.arg(reviewer_id),
    review_note = NULLIF(sqlc.arg(review_note)::text, ''),
    reviewed_at = NOW()
WHERE item_requests.guild_id = sqlc.arg(guild_id)
  AND item_requests.status = 'pending'
  AND item_requests.bank_item_id IN (
      SELECT bi.id FROM bank_items bi
      WHERE bi.roll_call_id = sqlc.arg(roll_call_id) AND bi.guild_id = sqlc.arg(guild_id)
  );

-- name: LogRetractedRollCallLoot :exec
INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
SELECT bi.guild_id, bi.id, 'retracted', sqlc.arg(actor_id)::uuid, 'roll_call', bi.roll_call_id
FROM bank_items bi
WHERE bi.roll_call_id = sqlc.arg(roll_call_id) AND bi.guild_id = sqlc.arg(guild_id) AND bi.locked_by_type IS NULL;

-- name: RetractRollCallLoot :execrows
DELETE FROM bank_items
WHERE roll_call_id = sqlc.arg(roll_call_id) AND guild_id = sqlc.arg(guild_id) AND locked_by_type IS NULL;

-- name: IsRollCallAttendee :one
SELECT EXISTS(SELECT 1 FROM roll_call_attendees WHERE roll_call_id = $1 AND user_id = $2);

-- name: RejectPendingRequestsForLootItem :execrows
UPDATE item_requests SET
    status = 'rejected',
    reviewer_id = sqlc.arg(reviewer_id),
    review_note = NULLIF(sqlc.arg(review_note)::text, ''),
    reviewed_at = NOW()
WHERE item_requests.guild_id = sqlc.arg(guild_id)
  AND item_requests.bank_item_id = sqlc.arg(bank_item_id)
  AND item_requests.status = 'pending';

-- name: TakeRollCallLootItem :one
DELETE FROM bank_items
WHERE bank_items.id = sqlc.arg(id) AND bank_items.guild_id = sqlc.arg(guild_id) AND bank_items.roll_call_id = sqlc.arg(roll_call_id)
  AND bank_items.locked_by_type IS NULL
RETURNING bank_items.item;

-- name: InsertRollCallGoldPot :exec
INSERT INTO roll_call_gold_pots (roll_call_id, guild_id, total)
VALUES (sqlc.arg(roll_call_id), sqlc.arg(guild_id), sqlc.arg(total)::bigint);

-- name: GetRollCallGoldPot :one
SELECT p.roll_call_id, p.guild_id, p.total, p.distributed, p.retracted,
       (c.completed_at IS NOT NULL)::bool AS is_completed
FROM roll_call_gold_pots p
JOIN roll_calls c ON c.id = p.roll_call_id
WHERE p.roll_call_id = $1 AND p.guild_id = $2;

-- name: ListRollCallGoldPots :many
SELECT p.roll_call_id, p.total, p.distributed, p.retracted,
       (c.completed_at IS NOT NULL)::bool AS is_completed
FROM roll_call_gold_pots p
JOIN roll_calls c ON c.id = p.roll_call_id
WHERE p.guild_id = sqlc.arg(guild_id) AND p.roll_call_id = ANY(sqlc.arg(roll_call_ids)::uuid[]);

-- name: LockRollCallGoldPot :one
SELECT p.roll_call_id, p.guild_id, p.total, p.distributed, p.retracted,
       (c.completed_at IS NOT NULL)::bool AS is_completed
FROM roll_call_gold_pots p
JOIN roll_calls c ON c.id = p.roll_call_id
WHERE p.roll_call_id = $1 AND p.guild_id = $2
FOR UPDATE OF p;

-- name: AddRollCallGoldPotDistributed :one
UPDATE roll_call_gold_pots SET
    distributed = distributed + sqlc.arg(amount)::bigint,
    updated_at  = NOW()
WHERE roll_call_gold_pots.roll_call_id = sqlc.arg(roll_call_id) AND roll_call_gold_pots.guild_id = sqlc.arg(guild_id)
  AND roll_call_gold_pots.retracted = 0
  AND roll_call_gold_pots.distributed + sqlc.arg(amount)::bigint <= roll_call_gold_pots.total
  AND NOT EXISTS (
      SELECT 1 FROM roll_calls c WHERE c.id = roll_call_gold_pots.roll_call_id AND c.completed_at IS NOT NULL
  )
RETURNING roll_call_gold_pots.roll_call_id, roll_call_gold_pots.guild_id, roll_call_gold_pots.total,
          roll_call_gold_pots.distributed, roll_call_gold_pots.retracted;

-- name: RetractRollCallGoldPot :one
UPDATE roll_call_gold_pots SET
    retracted  = total - distributed,
    updated_at = NOW()
WHERE roll_call_id = $1 AND guild_id = $2 AND retracted = 0 AND distributed < total
RETURNING roll_call_id, guild_id, total, distributed, retracted;

-- name: GetRollCallGoldDistributionByRequest :one
SELECT id, total, created_at
FROM roll_call_gold_distributions
WHERE roll_call_id = $1 AND request_id = $2;

-- name: InsertRollCallGoldDistribution :one
INSERT INTO roll_call_gold_distributions (roll_call_id, guild_id, actor_id, request_id, total)
VALUES (sqlc.arg(roll_call_id), sqlc.arg(guild_id), sqlc.arg(actor_id), sqlc.arg(request_id), sqlc.arg(total)::bigint)
RETURNING id, created_at;

-- name: InsertRollCallGoldPayout :exec
INSERT INTO roll_call_gold_payouts (distribution_id, user_id, amount, transaction_id)
VALUES (sqlc.arg(distribution_id), sqlc.arg(user_id), sqlc.arg(amount)::bigint, sqlc.arg(transaction_id));

-- name: ListRollCallGoldDistributionPayouts :many
SELECT user_id, amount
FROM roll_call_gold_payouts
WHERE distribution_id = $1
ORDER BY user_id;

-- name: ListRollCallGoldRecipients :many
SELECT p.user_id, SUM(p.amount)::bigint AS amount
FROM roll_call_gold_payouts p
JOIN roll_call_gold_distributions d ON d.id = p.distribution_id
WHERE d.roll_call_id = $1 AND d.guild_id = $2
GROUP BY p.user_id
ORDER BY p.user_id;

-- name: CountRollCallAttendeesAmong :one
SELECT COUNT(*) FROM roll_call_attendees
WHERE roll_call_id = sqlc.arg(roll_call_id) AND user_id = ANY(sqlc.arg(user_ids)::uuid[]);

-- name: InsertRollCallGoldBankActivity :exec
INSERT INTO bank_contributions (guild_id, user_id, username, amount, note, kind, roll_call_id, reference_type, reference_id)
VALUES (sqlc.arg(guild_id), sqlc.arg(user_id), sqlc.arg(username)::text, sqlc.arg(amount)::bigint,
        NULLIF(sqlc.arg(note)::text, ''), sqlc.arg(kind)::text, sqlc.arg(roll_call_id)::uuid,
        NULLIF(sqlc.arg(reference_type)::text, ''), sqlc.narg(reference_id)::uuid);
-- name: LockRollCallState :one
SELECT title, (expire_time < NOW())::bool AS is_expired,
       (cancelled_at IS NOT NULL)::bool AS is_cancelled,
       (completed_at IS NOT NULL)::bool AS is_completed,
       loot_list
FROM roll_calls WHERE id = $1 AND guild_id = $2
FOR UPDATE;

-- name: LockRollCallBankItems :many
SELECT bank_items.id, bank_items.item, (bank_items.locked_by_type IS NOT NULL)::bool AS is_locked
FROM bank_items
WHERE bank_items.roll_call_id = sqlc.arg(roll_call_id)::uuid AND bank_items.guild_id = sqlc.arg(guild_id)
FOR UPDATE;

-- name: UpdateRollCallBankItem :execrows
UPDATE bank_items SET item = sqlc.arg(item)::jsonb
WHERE bank_items.id = sqlc.arg(id) AND bank_items.guild_id = sqlc.arg(guild_id)
  AND bank_items.roll_call_id = sqlc.arg(roll_call_id)::uuid AND bank_items.locked_by_type IS NULL;

-- name: RejectPendingRequestsForLootItems :execrows
UPDATE item_requests SET
    status = 'rejected',
    reviewer_id = sqlc.arg(reviewer_id),
    review_note = NULLIF(sqlc.arg(review_note)::text, ''),
    reviewed_at = NOW()
WHERE item_requests.guild_id = sqlc.arg(guild_id)
  AND item_requests.status = 'pending'
  AND item_requests.bank_item_id = ANY(sqlc.arg(bank_item_ids)::uuid[]);

-- name: LogRemovedRollCallLoot :exec
INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
SELECT bi.guild_id, bi.id, 'retracted', sqlc.arg(actor_id)::uuid, 'roll_call', bi.roll_call_id
FROM bank_items bi
WHERE bi.id = ANY(sqlc.arg(ids)::uuid[]) AND bi.guild_id = sqlc.arg(guild_id)
  AND bi.roll_call_id = sqlc.arg(roll_call_id)::uuid AND bi.locked_by_type IS NULL;

-- name: RemoveRollCallLoot :execrows
DELETE FROM bank_items
WHERE bank_items.id = ANY(sqlc.arg(ids)::uuid[]) AND bank_items.guild_id = sqlc.arg(guild_id)
  AND bank_items.roll_call_id = sqlc.arg(roll_call_id)::uuid AND bank_items.locked_by_type IS NULL;

-- name: SetRollCallLootList :one
UPDATE roll_calls SET loot_list = sqlc.arg(loot_list)::jsonb, updated_at = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id)
RETURNING id, guild_id, created_by, title,
          COALESCE(description, '') AS description,
          TO_CHAR(datetime    AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS datetime,
          TO_CHAR(expire_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expire_time,
          COALESCE(image_url, '') AS image_url,
          loot_list, attendance_count,
          (expire_time < NOW())::bool AS is_expired,
          (cancelled_at IS NOT NULL)::bool AS is_cancelled,
          (completed_at IS NOT NULL)::bool AS is_completed,
          completed_at,
          created_at, updated_at;

-- name: CountRollCallBankItems :one
SELECT COUNT(*) FROM bank_items
WHERE bank_items.roll_call_id = sqlc.arg(roll_call_id)::uuid AND bank_items.guild_id = sqlc.arg(guild_id);

-- name: CompleteRollCall :one
UPDATE roll_calls SET completed_at = NOW(), completed_by = sqlc.arg(completed_by), updated_at = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id)
  AND cancelled_at IS NULL AND completed_at IS NULL AND expire_time < NOW()
RETURNING id, guild_id, created_by, title,
          COALESCE(description, '') AS description,
          TO_CHAR(datetime    AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS datetime,
          TO_CHAR(expire_time AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS expire_time,
          COALESCE(image_url, '') AS image_url,
          loot_list, attendance_count,
          (expire_time < NOW())::bool AS is_expired,
          (cancelled_at IS NOT NULL)::bool AS is_cancelled,
          (completed_at IS NOT NULL)::bool AS is_completed,
          completed_at,
          created_at, updated_at;
