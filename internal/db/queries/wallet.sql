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

-- name: ListBackpackItems :many
SELECT id, owner_id, guild_id, item,
       source, source_id,
       COALESCE(note, '') AS note,
       acquired_at
FROM backpack_items
WHERE owner_id = $1 AND guild_id = $2
ORDER BY acquired_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountBackpackItems :one
SELECT COUNT(*) FROM backpack_items WHERE owner_id = $1 AND guild_id = $2;

-- name: DeleteBackpackItem :one
DELETE FROM backpack_items
WHERE id = $1 AND owner_id = $2 AND guild_id = $3
RETURNING id, owner_id, guild_id, item, source, source_id,
          COALESCE(note, '') AS note, acquired_at;
