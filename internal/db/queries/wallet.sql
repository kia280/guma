-- name: EnsureWallet :exec
INSERT INTO wallets (user_id, guild_id, balance, currency)
VALUES ($1, $2, 0, 'gold')
ON CONFLICT (user_id, guild_id) DO NOTHING;

-- name: GetWallet :one
SELECT user_id, guild_id, balance, currency, created_at, updated_at
FROM wallets WHERE user_id = $1 AND guild_id = $2;

-- name: GetWalletBalanceForUpdate :one
SELECT balance FROM wallets WHERE user_id = $1 AND guild_id = $2 FOR UPDATE;

-- name: UpdateWalletBalance :exec
UPDATE wallets SET balance = $1, updated_at = NOW() WHERE user_id = $2 AND guild_id = $3;

-- name: InsertTransaction :one
INSERT INTO transactions (user_id, guild_id, type, amount, balance_after, description, reference_id, reference_type, actor_id, counterparty_id)
VALUES (
    $1, $2, sqlc.arg(type)::text, $3, $4,
    NULLIF(sqlc.arg(description)::text, ''),
    NULLIF(sqlc.arg(reference_id)::text, '')::uuid,
    NULLIF(sqlc.arg(reference_type)::text, ''),
    sqlc.narg(actor_id)::uuid,
    sqlc.narg(counterparty_id)::uuid
)
RETURNING id;

-- name: InsertTransactionSimple :exec
INSERT INTO transactions (user_id, guild_id, type, amount, balance_after, description)
VALUES ($1, $2, sqlc.arg(type)::text, $3, $4, NULLIF(sqlc.arg(description)::text, ''));

-- name: ListWalletTransactions :many
SELECT id, user_id, guild_id, type, amount, balance_after,
       COALESCE(description, '')       AS description,
       reference_id,
       COALESCE(reference_type, '')    AS reference_type,
       created_at,
       actor_id,
       COALESCE(member_display_name(guild_id, actor_id), '')::text        AS actor_name,
       counterparty_id,
       COALESCE(member_display_name(guild_id, counterparty_id), '')::text AS counterparty_name
FROM transactions
WHERE user_id = $1 AND guild_id = $2
  AND (sqlc.arg(type_filter)::text = '' OR type = sqlc.arg(type_filter)::text)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountWalletTransactions :one
SELECT COUNT(*) FROM transactions
WHERE user_id = $1 AND guild_id = $2
  AND (sqlc.arg(type_filter)::text = '' OR type = sqlc.arg(type_filter)::text);

-- name: SumWalletTransactionsBefore :one
SELECT COALESCE(SUM(amount), 0)::bigint AS balance
FROM transactions
WHERE user_id = $1 AND guild_id = $2
  AND created_at < sqlc.arg(before)::timestamptz;

-- name: ListWalletBalanceChangesSince :many
SELECT created_at, amount
FROM transactions
WHERE user_id = $1 AND guild_id = $2
  AND created_at >= sqlc.arg(since)::timestamptz
ORDER BY created_at ASC;

-- name: ListBackpackItems :many
SELECT bi.id, bi.owner_id, bi.guild_id, bi.item,
       bi.source, bi.source_id,
       COALESCE(bi.note, '') AS note,
       bi.acquired_at,
       bi.delivery_requested_at,
       COALESCE(
           CASE bi.source
               WHEN 'transfer' THEN member_display_name(bi.guild_id, bi.source_id)
               WHEN 'admin'    THEN member_display_name(bi.guild_id, bi.source_id)
               WHEN 'raffle'  THEN (SELECT l.title FROM raffles l WHERE l.id = bi.source_id)
               WHEN 'roll_call'  THEN (SELECT c.title FROM roll_calls c WHERE c.id = bi.source_id)
           END,
           ''
       )::text AS source_label,
       COALESCE(bi.locked_by_type, '') AS locked_by_type,
       bi.locked_by_id
FROM backpack_items bi
WHERE bi.owner_id = $1 AND bi.guild_id = $2
ORDER BY bi.acquired_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountBackpackItems :one
SELECT COUNT(*) FROM backpack_items WHERE owner_id = $1 AND guild_id = $2;

-- name: RequestBackpackWithdrawal :one
UPDATE backpack_items SET delivery_requested_at = NOW()
WHERE id = $1 AND owner_id = $2 AND guild_id = $3 AND delivery_requested_at IS NULL AND locked_by_type IS NULL
RETURNING id, owner_id, guild_id, item, source, source_id,
          COALESCE(note, '') AS note, acquired_at, delivery_requested_at;

-- name: CancelBackpackWithdrawal :one
UPDATE backpack_items SET delivery_requested_at = NULL
WHERE id = $1 AND owner_id = $2 AND guild_id = $3 AND delivery_requested_at IS NOT NULL
RETURNING id, owner_id, guild_id, item, source, source_id,
          COALESCE(note, '') AS note, acquired_at, delivery_requested_at;

-- name: ListPendingDeliveries :many
SELECT bi.id, bi.owner_id, bi.guild_id, bi.item, bi.source, bi.source_id,
       COALESCE(bi.note, '') AS note, bi.acquired_at, bi.delivery_requested_at,
       COALESCE(member_display_name(bi.guild_id, bi.owner_id), '')::text AS owner_name
FROM backpack_items bi
WHERE bi.guild_id = $1 AND bi.delivery_requested_at IS NOT NULL
ORDER BY bi.delivery_requested_at, bi.id
LIMIT 200;

-- name: LockPendingDelivery :one
SELECT id, owner_id, guild_id, item, source, source_id,
       COALESCE(note, '') AS note, acquired_at, delivery_requested_at
FROM backpack_items
WHERE id = $1 AND guild_id = $2 AND delivery_requested_at IS NOT NULL
FOR UPDATE;

-- name: DeleteDeliveredItem :exec
DELETE FROM backpack_items WHERE id = $1 AND guild_id = $2 AND delivery_requested_at IS NOT NULL;

-- name: TransferBackpackItem :one
UPDATE backpack_items SET
    owner_id    = sqlc.arg(to_user_id),
    source      = 'transfer',
    source_id   = sqlc.arg(from_user_id),
    note        = NULLIF(sqlc.arg(note)::text, ''),
    acquired_at = NOW()
WHERE backpack_items.id = sqlc.arg(id)
  AND backpack_items.owner_id = sqlc.arg(from_user_id)
  AND backpack_items.guild_id = sqlc.arg(guild_id)
  AND backpack_items.locked_by_type IS NULL
  AND backpack_items.delivery_requested_at IS NULL
RETURNING backpack_items.id, backpack_items.owner_id, backpack_items.guild_id, backpack_items.item,
          backpack_items.source, backpack_items.source_id,
          COALESCE(backpack_items.note, '') AS note, backpack_items.acquired_at;

-- name: ListActiveLeadingBids :many
SELECT id, COALESCE(item->>'name', '')::text AS item_name, current_bid, end_time
FROM auctions
WHERE guild_id = $1 AND current_bidder_id = $2 AND status IN ('UPCOMING', 'ACTIVE')
ORDER BY end_time ASC;

-- name: ListMemberAssets :many
SELECT m.user_id,
       COALESCE(w.balance, 0)::bigint AS balance,
       (SELECT COUNT(*) FROM backpack_items bi WHERE bi.owner_id = m.user_id AND bi.guild_id = m.guild_id)::int AS item_count
FROM members m
LEFT JOIN wallets w ON w.user_id = m.user_id AND w.guild_id = m.guild_id
WHERE m.guild_id = $1;

-- name: ListAllBackpackItems :many
SELECT bi.id, bi.owner_id, bi.guild_id, bi.item,
       bi.source, bi.source_id,
       COALESCE(bi.note, '') AS note,
       bi.acquired_at,
       bi.delivery_requested_at,
       COALESCE(
           CASE bi.source
               WHEN 'transfer' THEN member_display_name(bi.guild_id, bi.source_id)
               WHEN 'admin'    THEN member_display_name(bi.guild_id, bi.source_id)
               WHEN 'raffle'  THEN (SELECT l.title FROM raffles l WHERE l.id = bi.source_id)
               WHEN 'roll_call'  THEN (SELECT c.title FROM roll_calls c WHERE c.id = bi.source_id)
           END,
           ''
       )::text AS source_label,
       COALESCE(bi.locked_by_type, '') AS locked_by_type,
       bi.locked_by_id
FROM backpack_items bi
WHERE bi.owner_id = $1 AND bi.guild_id = $2
ORDER BY bi.acquired_at DESC, bi.id;

-- name: SetActingAdmin :exec
SELECT set_config('guma.acting_admin_id', sqlc.arg(admin_id)::text, true);

-- name: AdminMoveBackpackItem :one
UPDATE backpack_items SET
    owner_id    = sqlc.arg(to_user_id),
    source      = 'admin',
    source_id   = sqlc.arg(from_user_id),
    note        = NULLIF(sqlc.arg(note)::text, ''),
    acquired_at = NOW()
WHERE backpack_items.id = sqlc.arg(id)
  AND backpack_items.owner_id = sqlc.arg(from_user_id)
  AND backpack_items.guild_id = sqlc.arg(guild_id)
  AND backpack_items.locked_by_type IS NULL
  AND backpack_items.delivery_requested_at IS NULL
RETURNING backpack_items.id;

-- name: InsertWithdrawalRequest :one
INSERT INTO withdrawal_requests (guild_id, requester_id, requester_name, amount, note)
VALUES ($1, $2, sqlc.arg(requester_name)::text, $3, NULLIF(sqlc.arg(note)::text, ''))
RETURNING id;

-- name: LockWithdrawalRequest :one
SELECT amount, requester_id, status FROM withdrawal_requests
WHERE id = $1 AND guild_id = $2
FOR UPDATE;

-- name: UpdateWithdrawalRequestStatus :execrows
UPDATE withdrawal_requests SET
    status = sqlc.arg(status)::text,
    reviewer_id = sqlc.narg(reviewer_id)::uuid,
    review_note = NULLIF(sqlc.arg(review_note)::text, ''),
    reviewed_at = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id) AND status = 'pending';

-- name: ListWithdrawalRequests :many
SELECT wr.id, wr.guild_id, wr.requester_id,
       COALESCE(NULLIF(member_display_name(wr.guild_id, wr.requester_id), ''), wr.requester_name)::text AS requester_name,
       COALESCE(u.avatar_url, '')    AS requester_avatar_url,
       wr.amount,
       COALESCE(wr.note, '')         AS note,
       wr.status,
       wr.reviewer_id,
       COALESCE(member_display_name(wr.guild_id, wr.reviewer_id), '')::text AS reviewer_name,
       COALESCE(wr.review_note, '')  AS review_note,
       wr.created_at, wr.reviewed_at
FROM withdrawal_requests wr
LEFT JOIN users u ON u.id = wr.requester_id
WHERE wr.guild_id = sqlc.arg(guild_id)
  AND (sqlc.narg(requester_id)::uuid IS NULL OR wr.requester_id = sqlc.narg(requester_id)::uuid)
  AND (sqlc.narg(request_id)::uuid IS NULL OR wr.id = sqlc.narg(request_id)::uuid)
  AND (sqlc.arg(status_filter)::text = '' OR wr.status = sqlc.arg(status_filter)::text)
ORDER BY wr.created_at DESC, wr.id
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountWithdrawalRequests :one
SELECT COUNT(*) FROM withdrawal_requests wr
WHERE wr.guild_id = sqlc.arg(guild_id)
  AND (sqlc.narg(requester_id)::uuid IS NULL OR wr.requester_id = sqlc.narg(requester_id)::uuid)
  AND (sqlc.arg(status_filter)::text = '' OR wr.status = sqlc.arg(status_filter)::text);

-- name: SumPendingWithdrawals :one
SELECT COALESCE(SUM(amount), 0)::bigint AS amount
FROM withdrawal_requests
WHERE requester_id = $1 AND guild_id = $2 AND status = 'pending';
