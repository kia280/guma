-- name: ListAuctions :many
SELECT id, guild_id, seller_id, item, starting_bid, current_bid,
       current_bidder_id, min_bid_increment, start_time, end_time,
       status, is_blind, created_at, updated_at,
       source_type, settled_at, source_item_id, cancelled_at
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
       source_type, settled_at, source_item_id, cancelled_at
FROM auctions WHERE id = $1 AND guild_id = $2;

-- name: CreateAuction :one
INSERT INTO auctions (
    id, guild_id, seller_id, item, starting_bid, current_bid,
    min_bid_increment, start_time, end_time, status, is_blind,
    source_type, source_item_id
) VALUES (sqlc.arg(id)::uuid, $1, $2, sqlc.arg(item)::jsonb, $3, 0, $4, $5, $6, sqlc.arg(status)::text, $7,
          NULLIF(sqlc.arg(source_type)::text, ''), sqlc.narg(source_item_id)::uuid)
RETURNING id, guild_id, seller_id, item, starting_bid, current_bid,
          current_bidder_id, min_bid_increment, start_time, end_time,
          status, is_blind, created_at, updated_at,
          source_type, settled_at, source_item_id, cancelled_at;

-- name: GetAuctionForUpdate :one
SELECT starting_bid, current_bid, current_bidder_id, min_bid_increment, status, end_time
FROM auctions WHERE id = $1 AND guild_id = $2 FOR UPDATE;

-- name: UpdateAuctionBid :exec
UPDATE auctions SET current_bid = $1, current_bidder_id = $2, updated_at = NOW()
WHERE id = $3;

-- name: LockAuction :one
SELECT id, guild_id, seller_id, item, starting_bid, current_bid,
       current_bidder_id, min_bid_increment, start_time, end_time,
       status, is_blind, created_at, updated_at,
       source_type, settled_at, source_item_id, cancelled_at
FROM auctions WHERE id = $1 AND guild_id = $2
FOR UPDATE;

-- name: UpdateAuctionDetails :one
UPDATE auctions SET
    item              = sqlc.arg(item)::jsonb,
    starting_bid      = sqlc.arg(starting_bid),
    min_bid_increment = sqlc.arg(min_bid_increment),
    is_blind          = sqlc.arg(is_blind),
    start_time        = sqlc.arg(start_time),
    end_time          = sqlc.arg(end_time),
    updated_at        = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id)
  AND status IN ('UPCOMING', 'ACTIVE')
RETURNING id, guild_id, seller_id, item, starting_bid, current_bid,
          current_bidder_id, min_bid_increment, start_time, end_time,
          status, is_blind, created_at, updated_at,
          source_type, settled_at, source_item_id, cancelled_at;

-- name: MarkAuctionCancelled :exec
UPDATE auctions SET status = 'CANCELLED', cancelled_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: DeleteCancelledAuction :execrows
DELETE FROM auctions WHERE id = $1 AND guild_id = $2 AND status = 'CANCELLED';

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
       status, end_time, source_type, source_item_id
FROM auctions WHERE id = $1
FOR UPDATE;

-- name: MarkAuctionEnded :exec
UPDATE auctions SET status = 'ENDED', settled_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: InsertBackpackItem :one
INSERT INTO backpack_items (id, owner_id, guild_id, item, source, source_id, note)
VALUES (COALESCE(sqlc.narg(id)::uuid, uuid_generate_v4()), sqlc.arg(owner_id), sqlc.arg(guild_id), sqlc.arg(item)::jsonb,
        sqlc.arg(source)::text, sqlc.arg(source_id), NULLIF(sqlc.arg(note)::text, ''))
RETURNING id;

-- name: InsertBankProceeds :exec
INSERT INTO bank_contributions (guild_id, user_id, username, amount, note, kind, reference_type, reference_id)
VALUES ($1, $2, sqlc.arg(username)::text, $3, NULLIF(sqlc.arg(note)::text, ''),
        sqlc.arg(kind)::text, sqlc.arg(reference_type)::text, sqlc.arg(reference_id)::uuid);
