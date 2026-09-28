-- name: LockBackpackItem :one
UPDATE backpack_items SET
    locked_by_type = sqlc.arg(holder_type)::text,
    locked_by_id   = sqlc.arg(holder_id)::uuid,
    locked_at      = NOW()
WHERE backpack_items.id = sqlc.arg(id) AND backpack_items.owner_id = sqlc.arg(owner_id)
  AND backpack_items.guild_id = sqlc.arg(guild_id) AND backpack_items.locked_by_type IS NULL
  AND backpack_items.delivery_requested_at IS NULL
RETURNING backpack_items.item;

-- name: LockBankItem :one
UPDATE bank_items SET
    locked_by_type = sqlc.arg(holder_type)::text,
    locked_by_id   = sqlc.arg(holder_id)::uuid,
    locked_at      = NOW()
WHERE bank_items.id = sqlc.arg(id) AND bank_items.guild_id = sqlc.arg(guild_id)
  AND bank_items.locked_by_type IS NULL
RETURNING bank_items.item;

-- name: BackpackItemOwned :one
SELECT EXISTS (
    SELECT 1 FROM backpack_items
    WHERE backpack_items.id = $1 AND backpack_items.owner_id = $2 AND backpack_items.guild_id = $3
);

-- name: BankItemExists :one
SELECT EXISTS (SELECT 1 FROM bank_items WHERE bank_items.id = $1 AND bank_items.guild_id = $2);

-- name: ReleaseBackpackItem :many
UPDATE backpack_items SET locked_by_type = NULL, locked_by_id = NULL, locked_at = NULL
WHERE backpack_items.id = sqlc.arg(id)
  AND backpack_items.locked_by_type = sqlc.arg(holder_type)::text
  AND backpack_items.locked_by_id = sqlc.arg(holder_id)::uuid
RETURNING backpack_items.guild_id;

-- name: ReleaseBankItem :many
UPDATE bank_items SET locked_by_type = NULL, locked_by_id = NULL, locked_at = NULL
WHERE bank_items.id = sqlc.arg(id)
  AND bank_items.locked_by_type = sqlc.arg(holder_type)::text
  AND bank_items.locked_by_id = sqlc.arg(holder_id)::uuid
RETURNING bank_items.guild_id;

-- name: DeleteReleasedCancelledLoot :many
DELETE FROM bank_items
WHERE bank_items.id = sqlc.arg(id)
  AND bank_items.locked_by_type = sqlc.arg(holder_type)::text
  AND bank_items.locked_by_id = sqlc.arg(holder_id)::uuid
  AND bank_items.roll_call_id IN (SELECT c.id FROM roll_calls c WHERE c.cancelled_at IS NOT NULL)
RETURNING bank_items.guild_id, bank_items.roll_call_id;

-- name: ConsumeBackpackItem :one
DELETE FROM backpack_items
WHERE backpack_items.id = sqlc.arg(id)
  AND backpack_items.locked_by_type = sqlc.arg(holder_type)::text
  AND backpack_items.locked_by_id = sqlc.arg(holder_id)::uuid
RETURNING backpack_items.item;

-- name: ConsumeBankItem :one
DELETE FROM bank_items
WHERE bank_items.id = sqlc.arg(id)
  AND bank_items.locked_by_type = sqlc.arg(holder_type)::text
  AND bank_items.locked_by_id = sqlc.arg(holder_id)::uuid
RETURNING bank_items.item;

-- name: RejectPendingRequestsForBankItem :execrows
UPDATE item_requests SET
    status = 'rejected',
    reviewer_id = sqlc.arg(reviewer_id),
    review_note = NULLIF(sqlc.arg(review_note)::text, ''),
    reviewed_at = NOW()
WHERE bank_item_id = sqlc.arg(bank_item_id) AND guild_id = sqlc.arg(guild_id) AND status = 'pending';
