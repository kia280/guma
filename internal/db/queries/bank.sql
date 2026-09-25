-- name: EnsureGuildBank :exec
INSERT INTO guild_bank (guild_id) VALUES ($1)
ON CONFLICT (guild_id) DO NOTHING;

-- name: GetGuildBank :one
SELECT id, guild_id, balance, currency, goal, created_at, updated_at
FROM guild_bank WHERE guild_id = $1;

-- name: ListTopBankContributors :many
SELECT bc.user_id,
       bc.username,
       COALESCE(u.avatar_url, '') AS avatar_url,
       SUM(bc.amount)::bigint     AS total
FROM bank_contributions bc
LEFT JOIN users u ON u.id = bc.user_id
WHERE bc.guild_id = $1
GROUP BY bc.user_id, bc.username, u.avatar_url
ORDER BY total DESC
LIMIT 5;

-- name: DeductWalletIfSufficient :one
UPDATE wallets SET balance = balance - sqlc.arg(amount)::bigint, updated_at = NOW()
WHERE user_id = $1 AND guild_id = $2 AND balance >= sqlc.arg(amount)::bigint
RETURNING balance;

-- name: CreditWallet :one
UPDATE wallets SET balance = balance + sqlc.arg(amount)::bigint, updated_at = NOW()
WHERE user_id = $1 AND guild_id = $2
RETURNING balance;

-- name: CreditGuildBank :exec
UPDATE guild_bank SET balance = balance + sqlc.arg(amount)::bigint, updated_at = NOW() WHERE guild_id = $1;

-- name: DeductGuildBankIfSufficient :one
UPDATE guild_bank SET balance = balance - sqlc.arg(amount)::bigint, updated_at = NOW()
WHERE guild_id = $1 AND balance >= sqlc.arg(amount)::bigint
RETURNING balance;

-- name: InsertBankContribution :one
INSERT INTO bank_contributions (guild_id, user_id, username, amount, note)
VALUES ($1, $2, sqlc.arg(username)::text, $3, NULLIF(sqlc.arg(note)::text, ''))
RETURNING id, created_at;

-- name: GetUserDisplayName :one
SELECT COALESCE(display_name, username, '')::text AS display_name
FROM users WHERE id = $1;

-- name: InsertFundRequest :one
INSERT INTO fund_requests (guild_id, requester_id, requester_name, amount, reason)
VALUES ($1, $2, sqlc.arg(requester_name)::text, $3, NULLIF(sqlc.arg(reason)::text, ''))
RETURNING id, guild_id, requester_id, requester_name, amount,
          COALESCE(reason, '')      AS reason,
          status,
          reviewer_id,
          COALESCE(review_note, '') AS review_note,
          created_at, reviewed_at;

-- name: LockFundRequest :one
SELECT amount, requester_id, status FROM fund_requests
WHERE id = $1 AND guild_id = $2
FOR UPDATE;

-- name: UpdateFundRequestStatus :one
UPDATE fund_requests SET
    status = sqlc.arg(status)::text,
    reviewer_id = sqlc.arg(reviewer_id),
    review_note = NULLIF(sqlc.arg(review_note)::text, ''),
    reviewed_at = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id) AND status = 'pending'
RETURNING id, guild_id, requester_id, requester_name, amount,
          COALESCE(reason, '')      AS reason,
          status,
          reviewer_id,
          COALESCE(review_note, '') AS review_note,
          created_at, reviewed_at;

-- name: ListFundRequests :many
SELECT id, guild_id, requester_id, requester_name, amount,
       COALESCE(reason, '')      AS reason,
       status,
       reviewer_id,
       COALESCE(review_note, '') AS review_note,
       created_at, reviewed_at
FROM fund_requests
WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR status = sqlc.arg(status_filter)::text)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountFundRequests :one
SELECT COUNT(*) FROM fund_requests WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR status = sqlc.arg(status_filter)::text);

-- name: ListBankContributions :many
SELECT id, guild_id, user_id, username, amount,
       COALESCE(note, '') AS note,
       created_at
FROM bank_contributions WHERE guild_id = $1
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountBankContributions :one
SELECT COUNT(*) FROM bank_contributions WHERE guild_id = $1;

-- name: DeleteBackpackItemReturningItem :one
DELETE FROM backpack_items WHERE id = $1 AND owner_id = $2 AND guild_id = $3
RETURNING item;

-- name: InsertBankItem :one
INSERT INTO bank_items (guild_id, donor_id, donor_name, item, note)
VALUES ($1, $2, sqlc.arg(donor_name)::text, sqlc.arg(item)::jsonb, NULLIF(sqlc.arg(note)::text, ''))
RETURNING id, guild_id, donor_id, donor_name, item, quantity,
          COALESCE(note, '') AS note,
          donated_at;

-- name: ListBankItems :many
SELECT bi.id, bi.guild_id, bi.donor_id, bi.donor_name, bi.item, bi.quantity,
       COALESCE(bi.note, '') AS note,
       bi.donated_at,
       bi.checkin_id,
       COALESCE(c.title, '') AS checkin_title
FROM bank_items bi
LEFT JOIN checkins c ON c.id = bi.checkin_id
WHERE bi.guild_id = $1
  AND (sqlc.arg(category_filter)::text = '' OR bi.item->>'category' = sqlc.arg(category_filter)::text)
  AND (sqlc.arg(rarity_filter)::text   = '' OR bi.item->>'rarity'   = sqlc.arg(rarity_filter)::text)
ORDER BY bi.donated_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountBankItems :one
SELECT COUNT(*) FROM bank_items
WHERE guild_id = $1
  AND (sqlc.arg(category_filter)::text = '' OR item->>'category' = sqlc.arg(category_filter)::text)
  AND (sqlc.arg(rarity_filter)::text   = '' OR item->>'rarity'   = sqlc.arg(rarity_filter)::text);

-- name: InsertItemRequest :one
INSERT INTO item_requests (guild_id, bank_item_id, requester_id, requester_name, reason, item)
SELECT bi.guild_id, bi.id, sqlc.arg(requester_id), sqlc.arg(requester_name)::text,
       NULLIF(sqlc.arg(reason)::text, ''), bi.item
FROM bank_items bi
WHERE bi.id = sqlc.arg(bank_item_id) AND bi.guild_id = sqlc.arg(guild_id)
RETURNING id, guild_id, bank_item_id, requester_id, requester_name,
          COALESCE(reason, '')      AS reason,
          status,
          reviewer_id,
          COALESCE(review_note, '') AS review_note,
          created_at, reviewed_at, item;

-- name: LockItemRequest :one
SELECT bank_item_id, requester_id, status FROM item_requests
WHERE id = $1 AND guild_id = $2
FOR UPDATE;

-- name: RejectCompetingItemRequests :exec
UPDATE item_requests SET
    status = 'rejected',
    reviewer_id = sqlc.arg(reviewer_id),
    reviewed_at = NOW()
WHERE bank_item_id = sqlc.arg(bank_item_id) AND guild_id = sqlc.arg(guild_id)
  AND id <> sqlc.arg(id) AND status = 'pending';

-- name: ListItemRequests :many
SELECT id, guild_id, bank_item_id, requester_id, requester_name,
       COALESCE(reason, '')      AS reason,
       status,
       reviewer_id,
       COALESCE(review_note, '') AS review_note,
       created_at, reviewed_at, item
FROM item_requests
WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR status = sqlc.arg(status_filter)::text)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountItemRequests :one
SELECT COUNT(*) FROM item_requests WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR status = sqlc.arg(status_filter)::text);

-- name: DeleteBankItemReturningItem :one
DELETE FROM bank_items WHERE id = $1 AND guild_id = $2
RETURNING item;

-- name: InsertBackpackItemFromRequest :exec
INSERT INTO backpack_items (owner_id, guild_id, item, source, source_id)
VALUES ($1, $2, sqlc.arg(item)::jsonb, 'bank_item_request', sqlc.arg(source_id));

-- name: UpdateItemRequestStatus :one
UPDATE item_requests SET
    status = sqlc.arg(status)::text,
    reviewer_id = sqlc.arg(reviewer_id),
    review_note = NULLIF(sqlc.arg(review_note)::text, ''),
    reviewed_at = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id) AND status = 'pending'
RETURNING id, guild_id, bank_item_id, requester_id, requester_name,
          COALESCE(reason, '')      AS reason,
          status,
          reviewer_id,
          COALESCE(review_note, '') AS review_note,
          created_at, reviewed_at, item;
