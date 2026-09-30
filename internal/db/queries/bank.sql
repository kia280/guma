-- name: EnsureGuildBank :exec
INSERT INTO guild_bank (guild_id) VALUES ($1)
ON CONFLICT (guild_id) DO NOTHING;

-- name: GetGuildBank :one
SELECT id, guild_id, balance, currency, created_at, updated_at
FROM guild_bank WHERE guild_id = $1;

-- name: ListTopBankContributors :many
SELECT bc.user_id,
       COALESCE(NULLIF(member_display_name(bc.guild_id, bc.user_id), ''), MAX(bc.username))::text AS username,
       COALESCE(u.avatar_url, '') AS avatar_url,
       SUM(bc.amount)::bigint     AS total
FROM bank_contributions bc
LEFT JOIN users u ON u.id = bc.user_id
WHERE bc.guild_id = $1 AND bc.kind = 'gold'
GROUP BY bc.guild_id, bc.user_id, u.avatar_url
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
SELECT COALESCE(member_display_name(sqlc.arg(guild_id)::uuid, sqlc.arg(user_id)::uuid), '')::text AS display_name;

-- name: InsertFundRequest :one
INSERT INTO fund_requests (guild_id, requester_id, requester_name, amount, reason)
VALUES ($1, $2, sqlc.arg(requester_name)::text, $3, NULLIF(sqlc.arg(reason)::text, ''))
RETURNING fund_requests.id, fund_requests.guild_id, fund_requests.requester_id, fund_requests.requester_name,
          (SELECT COALESCE(u.avatar_url, '') FROM users u WHERE u.id = fund_requests.requester_id)::text AS requester_avatar_url,
          fund_requests.amount,
          COALESCE(fund_requests.reason, '')      AS reason,
          fund_requests.status,
          fund_requests.reviewer_id,
          COALESCE(fund_requests.review_note, '') AS review_note,
          fund_requests.created_at, fund_requests.reviewed_at;

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
WHERE fund_requests.id = sqlc.arg(id) AND fund_requests.guild_id = sqlc.arg(guild_id) AND fund_requests.status = 'pending'
RETURNING fund_requests.id, fund_requests.guild_id, fund_requests.requester_id, fund_requests.requester_name,
          (SELECT COALESCE(u.avatar_url, '') FROM users u WHERE u.id = fund_requests.requester_id)::text AS requester_avatar_url,
          fund_requests.amount,
          COALESCE(fund_requests.reason, '')      AS reason,
          fund_requests.status,
          fund_requests.reviewer_id,
          COALESCE(fund_requests.review_note, '') AS review_note,
          fund_requests.created_at, fund_requests.reviewed_at;

-- name: ListFundRequests :many
SELECT fr.id, fr.guild_id, fr.requester_id,
       COALESCE(NULLIF(member_display_name(fr.guild_id, fr.requester_id), ''), fr.requester_name)::text AS requester_name,
       COALESCE(u.avatar_url, '')   AS requester_avatar_url,
       fr.amount,
       COALESCE(fr.reason, '')      AS reason,
       fr.status,
       fr.reviewer_id,
       COALESCE(fr.review_note, '') AS review_note,
       fr.created_at, fr.reviewed_at
FROM fund_requests fr
LEFT JOIN users u ON u.id = fr.requester_id
WHERE fr.guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR fr.status = sqlc.arg(status_filter)::text)
ORDER BY fr.created_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountFundRequests :one
SELECT COUNT(*) FROM fund_requests WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR status = sqlc.arg(status_filter)::text);

-- name: ListBankContributions :many
SELECT bc.id, bc.guild_id, bc.user_id,
       COALESCE(NULLIF(member_display_name(bc.guild_id, bc.user_id), ''), bc.username)::text AS username,
       COALESCE(u.avatar_url, '') AS avatar_url,
       bc.amount,
       COALESCE(bc.note, '')      AS note,
       bc.created_at, bc.kind, bc.items, bc.roll_call_id,
       COALESCE(bc.reference_type, '') AS reference_type,
       bc.reference_id
FROM bank_contributions bc
LEFT JOIN users u ON u.id = bc.user_id
WHERE bc.guild_id = $1
ORDER BY bc.created_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountBankContributions :one
SELECT COUNT(*) FROM bank_contributions WHERE guild_id = $1;

-- name: DeleteBackpackItemReturningItem :one
DELETE FROM backpack_items
WHERE id = $1 AND owner_id = $2 AND guild_id = $3 AND locked_by_type IS NULL AND delivery_requested_at IS NULL
RETURNING item;

-- name: InsertBankItem :one
INSERT INTO bank_items (id, guild_id, donor_id, donor_name, item, note)
VALUES (sqlc.arg(id), sqlc.arg(guild_id), sqlc.arg(donor_id), sqlc.arg(donor_name)::text, sqlc.arg(item)::jsonb,
        NULLIF(sqlc.arg(note)::text, ''))
RETURNING id, guild_id, donor_id, donor_name, item, quantity,
          COALESCE(note, '') AS note,
          donated_at;

-- name: ListBankItems :many
SELECT bi.id, bi.guild_id, bi.donor_id,
       COALESCE(NULLIF(member_display_name(bi.guild_id, bi.donor_id), ''), bi.donor_name)::text AS donor_name,
       bi.item, bi.quantity,
       COALESCE(bi.note, '') AS note,
       bi.donated_at,
       bi.roll_call_id,
       COALESCE(c.title, '') AS roll_call_title,
       (SELECT COUNT(*) FROM item_requests ir WHERE ir.bank_item_id = bi.id AND ir.status = 'pending')::int AS pending_request_count,
       EXISTS (
           SELECT 1 FROM item_requests ir
           WHERE ir.bank_item_id = bi.id AND ir.status = 'pending' AND ir.requester_id = sqlc.arg(viewer_id)
       ) AS requested_by_me,
       COALESCE(bi.locked_by_type, '') AS locked_by_type,
       bi.locked_by_id
FROM bank_items bi
LEFT JOIN roll_calls c ON c.id = bi.roll_call_id
WHERE bi.guild_id = $1
  AND (sqlc.arg(category_filter)::text = '' OR bi.item->>'category' = sqlc.arg(category_filter)::text)
  AND (sqlc.arg(rarity_filter)::text   = '' OR bi.item->>'rarity'   = sqlc.arg(rarity_filter)::text)
  AND (sqlc.arg(roll_call_filter)::text  = '' OR bi.roll_call_id::text  = sqlc.arg(roll_call_filter)::text)
ORDER BY bi.donated_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountBankItems :one
SELECT COUNT(*) FROM bank_items
WHERE guild_id = $1
  AND (sqlc.arg(category_filter)::text = '' OR item->>'category' = sqlc.arg(category_filter)::text)
  AND (sqlc.arg(rarity_filter)::text   = '' OR item->>'rarity'   = sqlc.arg(rarity_filter)::text)
  AND (sqlc.arg(roll_call_filter)::text  = '' OR roll_call_id::text  = sqlc.arg(roll_call_filter)::text);

-- name: InsertItemRequest :one
INSERT INTO item_requests (guild_id, bank_item_id, requester_id, requester_name, reason, item)
SELECT bi.guild_id, bi.id, sqlc.arg(requester_id), sqlc.arg(requester_name)::text,
       NULLIF(sqlc.arg(reason)::text, ''), bi.item
FROM bank_items bi
WHERE bi.id = sqlc.arg(bank_item_id) AND bi.guild_id = sqlc.arg(guild_id) AND bi.locked_by_type IS NULL
RETURNING item_requests.id, item_requests.guild_id, item_requests.bank_item_id, item_requests.requester_id, item_requests.requester_name,
          (SELECT COALESCE(u.avatar_url, '') FROM users u WHERE u.id = item_requests.requester_id)::text AS requester_avatar_url,
          COALESCE(item_requests.reason, '')      AS reason,
          item_requests.status,
          item_requests.reviewer_id,
          COALESCE(item_requests.review_note, '') AS review_note,
          item_requests.created_at, item_requests.reviewed_at, item_requests.item;

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
SELECT ir.id, ir.guild_id, ir.bank_item_id, ir.requester_id,
       COALESCE(NULLIF(member_display_name(ir.guild_id, ir.requester_id), ''), ir.requester_name)::text AS requester_name,
       COALESCE(u.avatar_url, '')   AS requester_avatar_url,
       COALESCE(ir.reason, '')      AS reason,
       ir.status,
       ir.reviewer_id,
       COALESCE(ir.review_note, '') AS review_note,
       ir.created_at, ir.reviewed_at, ir.item
FROM item_requests ir
LEFT JOIN users u ON u.id = ir.requester_id
WHERE ir.guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR ir.status = sqlc.arg(status_filter)::text)
ORDER BY ir.created_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountItemRequests :one
SELECT COUNT(*) FROM item_requests WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR status = sqlc.arg(status_filter)::text);

-- name: GetBankItemForUpdate :one
SELECT item, COALESCE(locked_by_type, '') AS locked_by_type FROM bank_items
WHERE id = $1 AND guild_id = $2
FOR UPDATE;

-- name: DeleteBankItemReturningItem :one
DELETE FROM bank_items WHERE id = $1 AND guild_id = $2 AND locked_by_type IS NULL
RETURNING item;

-- name: InsertBackpackItemFromRequest :exec
INSERT INTO backpack_items (id, owner_id, guild_id, item, source, source_id)
VALUES (sqlc.arg(id), sqlc.arg(owner_id), sqlc.arg(guild_id), sqlc.arg(item)::jsonb, 'bank_item_request', sqlc.arg(source_id));

-- name: UpdateItemRequestStatus :one
UPDATE item_requests SET
    status = sqlc.arg(status)::text,
    reviewer_id = sqlc.arg(reviewer_id),
    review_note = NULLIF(sqlc.arg(review_note)::text, ''),
    reviewed_at = NOW()
WHERE item_requests.id = sqlc.arg(id) AND item_requests.guild_id = sqlc.arg(guild_id) AND item_requests.status = 'pending'
RETURNING item_requests.id, item_requests.guild_id, item_requests.bank_item_id, item_requests.requester_id, item_requests.requester_name,
          (SELECT COALESCE(u.avatar_url, '') FROM users u WHERE u.id = item_requests.requester_id)::text AS requester_avatar_url,
          COALESCE(item_requests.reason, '')      AS reason,
          item_requests.status,
          item_requests.reviewer_id,
          COALESCE(item_requests.review_note, '') AS review_note,
          item_requests.created_at, item_requests.reviewed_at, item_requests.item;
