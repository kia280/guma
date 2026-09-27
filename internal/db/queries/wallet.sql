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
INSERT INTO transactions (user_id, guild_id, type, amount, balance_after, description, reference_id, reference_type)
VALUES (
    $1, $2, sqlc.arg(type)::text, $3, $4,
    NULLIF(sqlc.arg(description)::text, ''),
    NULLIF(sqlc.arg(reference_id)::text, '')::uuid,
    NULLIF(sqlc.arg(reference_type)::text, '')
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
       created_at
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
       COALESCE(
           CASE bi.source
               WHEN 'transfer' THEN (SELECT COALESCE(NULLIF(u.display_name, ''), u.username) FROM users u WHERE u.id = bi.source_id)
               WHEN 'lottery'  THEN (SELECT l.title FROM lotteries l WHERE l.id = bi.source_id)
               WHEN 'checkin'  THEN (SELECT c.title FROM checkins c WHERE c.id = bi.source_id)
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

-- name: DeleteBackpackItem :one
DELETE FROM backpack_items
WHERE id = $1 AND owner_id = $2 AND guild_id = $3 AND locked_by_type IS NULL
RETURNING id, owner_id, guild_id, item, source, source_id,
          COALESCE(note, '') AS note, acquired_at;

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
RETURNING backpack_items.id, backpack_items.owner_id, backpack_items.guild_id, backpack_items.item,
          backpack_items.source, backpack_items.source_id,
          COALESCE(backpack_items.note, '') AS note, backpack_items.acquired_at;

-- name: ListActiveLeadingBids :many
SELECT id, COALESCE(item->>'name', '')::text AS item_name, current_bid, end_time
FROM auctions
WHERE guild_id = $1 AND current_bidder_id = $2 AND status IN ('UPCOMING', 'ACTIVE')
ORDER BY end_time ASC;
