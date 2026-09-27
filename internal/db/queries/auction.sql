-- name: ListAuctions :many
SELECT id, guild_id, seller_id, item, starting_bid, current_bid,
       current_bidder_id, min_bid_increment, start_time, end_time,
       status, is_blind, created_at, updated_at,
       source_type, source_snapshot, settled_at
FROM auctions
WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text   = '' OR status             = sqlc.arg(status_filter)::text)
  AND (sqlc.arg(category_filter)::text = '' OR item->>'category'  = sqlc.arg(category_filter)::text)
  AND (sqlc.arg(rarity_filter)::text   = '' OR item->>'rarity'    = sqlc.arg(rarity_filter)::text)
  AND (sqlc.arg(search)::text          = '%%' OR item->>'name'   ILIKE sqlc.arg(search)::text)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountAuctions :one
SELECT COUNT(*) FROM auctions
WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text   = '' OR status             = sqlc.arg(status_filter)::text)
  AND (sqlc.arg(category_filter)::text = '' OR item->>'category'  = sqlc.arg(category_filter)::text)
  AND (sqlc.arg(rarity_filter)::text   = '' OR item->>'rarity'    = sqlc.arg(rarity_filter)::text)
  AND (sqlc.arg(search)::text          = '%%' OR item->>'name'   ILIKE sqlc.arg(search)::text);

-- name: GetAuction :one
SELECT id, guild_id, seller_id, item, starting_bid, current_bid,
       current_bidder_id, min_bid_increment, start_time, end_time,
       status, is_blind, created_at, updated_at,
       source_type, source_snapshot, settled_at
FROM auctions WHERE id = $1 AND guild_id = $2;

-- name: CreateAuction :one
INSERT INTO auctions (
    guild_id, seller_id, item, starting_bid, current_bid,
    min_bid_increment, start_time, end_time, status, is_blind
) VALUES ($1, $2, sqlc.arg(item)::jsonb, $3, 0, $4, $5, $6, sqlc.arg(status)::text, $7)
RETURNING id, guild_id, seller_id, item, starting_bid, current_bid,
          current_bidder_id, min_bid_increment, start_time, end_time,
          status, is_blind, created_at, updated_at,
          source_type, source_snapshot, settled_at;

-- name: GetAuctionForUpdate :one
SELECT current_bid, current_bidder_id, min_bid_increment, status, end_time
FROM auctions WHERE id = $1 AND guild_id = $2 FOR UPDATE;

-- name: UpdateAuctionBid :exec
UPDATE auctions SET current_bid = $1, current_bidder_id = $2, updated_at = NOW()
WHERE id = $3;

-- name: UpdateAuctionStatus :exec
UPDATE auctions SET status = sqlc.arg(status)::text, updated_at = NOW() WHERE id = sqlc.arg(id);

-- name: GetAuctionCancelInfo :one
SELECT current_bid, current_bidder_id, status FROM auctions WHERE id = $1 AND guild_id = $2;

-- name: MarkAllBidsNotWinning :exec
UPDATE bids SET is_winning = false WHERE auction_id = $1;

-- name: InsertBid :one
INSERT INTO bids (auction_id, bidder_id, amount, is_winning)
VALUES ($1, $2, $3, true)
RETURNING id, placed_at;

-- name: AuctionExists :one
SELECT EXISTS(SELECT 1 FROM auctions WHERE id = $1 AND guild_id = $2);

-- name: ListBids :many
SELECT id, auction_id, bidder_id, amount, is_winning, placed_at
FROM bids WHERE auction_id = $1
ORDER BY placed_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountBids :one
SELECT COUNT(*) FROM bids WHERE auction_id = $1;

-- name: ActivateDueAuctions :execrows
UPDATE auctions SET status = 'ACTIVE', updated_at = NOW()
WHERE status = 'UPCOMING' AND start_time <= NOW();

-- name: ListDueAuctions :many
SELECT id FROM auctions
WHERE status = 'ACTIVE' AND end_time <= NOW()
ORDER BY end_time ASC
LIMIT sqlc.arg(max_rows)::int;

-- name: LockAuctionForSettlement :one
SELECT id, guild_id, seller_id, item, current_bid, current_bidder_id,
       status, end_time, source_type, source_snapshot
FROM auctions WHERE id = $1
FOR UPDATE;

-- name: MarkAuctionEnded :exec
UPDATE auctions SET status = 'ENDED', settled_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: InsertBackpackItem :one
INSERT INTO backpack_items (owner_id, guild_id, item, source, source_id, note)
VALUES ($1, $2, sqlc.arg(item)::jsonb, sqlc.arg(source)::text, sqlc.arg(source_id), NULLIF(sqlc.arg(note)::text, ''))
RETURNING id;

-- name: RestoreBackpackItemSnapshot :execrows
INSERT INTO backpack_items (id, owner_id, guild_id, item, source, source_id, note, acquired_at)
SELECT r.id, r.owner_id, r.guild_id, r.item, r.source, r.source_id, r.note, r.acquired_at
FROM jsonb_populate_record(NULL::backpack_items, sqlc.arg(snapshot)::jsonb) AS r
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = r.owner_id)
ON CONFLICT (id) DO NOTHING;

-- name: RestoreBankItemSnapshot :execrows
INSERT INTO bank_items (id, guild_id, donor_id, donor_name, item, quantity, note, donated_at, checkin_id)
SELECT r.id, r.guild_id, r.donor_id, r.donor_name, r.item, r.quantity, r.note, r.donated_at,
       (SELECT c.id FROM checkins c WHERE c.id = r.checkin_id)
FROM jsonb_populate_record(NULL::bank_items, sqlc.arg(snapshot)::jsonb) AS r
WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = r.donor_id)
ON CONFLICT (id) DO NOTHING;

-- name: InsertBankProceeds :exec
INSERT INTO bank_contributions (guild_id, user_id, username, amount, note, kind, reference_type, reference_id)
VALUES ($1, $2, sqlc.arg(username)::text, $3, NULLIF(sqlc.arg(note)::text, ''),
        sqlc.arg(kind)::text, sqlc.arg(reference_type)::text, sqlc.arg(reference_id)::uuid);
