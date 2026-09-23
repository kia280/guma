-- name: ListAuctions :many
SELECT id, guild_id, seller_id, item, starting_bid, current_bid,
       current_bidder_id, min_bid_increment, start_time, end_time,
       status, is_blind, created_at, updated_at
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
       status, is_blind, created_at, updated_at
FROM auctions WHERE id = $1 AND guild_id = $2;

-- name: CreateAuction :one
INSERT INTO auctions (
    guild_id, seller_id, item, starting_bid, current_bid,
    min_bid_increment, start_time, end_time, status, is_blind
) VALUES ($1, $2, sqlc.arg(item)::jsonb, $3, 0, $4, $5, $6, sqlc.arg(status)::text, $7)
RETURNING id, guild_id, seller_id, item, starting_bid, current_bid,
          current_bidder_id, min_bid_increment, start_time, end_time,
          status, is_blind, created_at, updated_at;

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
