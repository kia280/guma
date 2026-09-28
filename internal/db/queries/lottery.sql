-- name: ListLotteries :many
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       ticket_price, tickets_sold,
       max_tickets, max_tickets_per_user, status,
       TO_CHAR(draw_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS draw_date,
       prizes, created_at, updated_at, cancelled_at
FROM lotteries
WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR status = sqlc.arg(status_filter)::text)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountLotteries :one
SELECT COUNT(*) FROM lotteries WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR status = sqlc.arg(status_filter)::text);

-- name: GetLottery :one
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       ticket_price, tickets_sold,
       max_tickets, max_tickets_per_user, status,
       TO_CHAR(draw_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS draw_date,
       prizes, created_at, updated_at, cancelled_at
FROM lotteries WHERE id = $1 AND guild_id = $2;

-- name: CreateLottery :one
INSERT INTO lotteries (
    id, guild_id, created_by, title, description, ticket_price,
    max_tickets, max_tickets_per_user, status, draw_date, prizes
) VALUES (
    sqlc.arg(id)::uuid, $1, $2, sqlc.arg(title)::text,
    NULLIF(sqlc.arg(description)::text, ''),
    $3, $4, $5, 'active',
    sqlc.arg(draw_date)::text::timestamptz,
    sqlc.arg(prizes)::jsonb
)
RETURNING id, guild_id, created_by, title,
          COALESCE(description, '') AS description,
          ticket_price, tickets_sold,
          max_tickets, max_tickets_per_user, status,
          TO_CHAR(draw_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS draw_date,
          prizes, created_at, updated_at, cancelled_at;

-- name: LockLotteryForPurchase :one
SELECT ticket_price, status, max_tickets, max_tickets_per_user, tickets_sold, draw_date
FROM lotteries WHERE id = $1 AND guild_id = $2
FOR UPDATE;

-- name: CountUserTicketsForLottery :one
SELECT COUNT(*) FROM lottery_tickets WHERE lottery_id = $1 AND user_id = $2;

-- name: EnsureWalletDefault :exec
INSERT INTO wallets (user_id, guild_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: InsertLotteryTicket :one
INSERT INTO lottery_tickets (lottery_id, user_id, ticket_number)
VALUES ($1, $2, sqlc.arg(ticket_number)::text)
RETURNING id, purchased_at;

-- name: IncrementTicketsSold :exec
UPDATE lotteries SET tickets_sold = tickets_sold + sqlc.arg(n)::int, updated_at = NOW() WHERE id = sqlc.arg(id);

-- name: LotteryExists :one
SELECT EXISTS(SELECT 1 FROM lotteries WHERE id = $1 AND guild_id = $2);

-- name: GetLotteryForDraw :one
SELECT prizes, status, created_by, title, ticket_price
FROM lotteries WHERE id = $1 AND guild_id = $2 FOR UPDATE;

-- name: ListAllLotteryTickets :many
SELECT id, user_id, ticket_number FROM lottery_tickets WHERE lottery_id = $1;

-- name: GetUserUsernameAndAvatar :one
SELECT COALESCE(member_display_name(sqlc.arg(guild_id)::uuid, id), '')::text AS username,
       COALESCE(avatar_url, '')                                               AS avatar_url
FROM users WHERE id = sqlc.arg(user_id);

-- name: InsertLotteryWinner :one
INSERT INTO lottery_winners (lottery_id, user_id, rank, prize_amount, prize_description, ticket_number)
VALUES ($1, $2, sqlc.arg(rank)::int, $3, NULLIF(sqlc.arg(prize_description)::text, ''), sqlc.arg(ticket_number)::text)
RETURNING id;

-- name: EndLottery :exec
UPDATE lotteries SET status = 'ended', updated_at = NOW() WHERE id = $1;

-- name: ListLotteryWinners :many
SELECT lw.id, lw.lottery_id, lw.user_id,
       COALESCE(member_display_name(l.guild_id, lw.user_id), '')::text AS username,
       COALESCE(u.avatar_url, '') AS avatar_url,
       lw.rank, lw.prize_amount,
       COALESCE(lw.prize_description, '') AS prize_description,
       lw.ticket_number
FROM lottery_winners lw
JOIN lotteries l ON l.id = lw.lottery_id
LEFT JOIN users u ON u.id = lw.user_id
WHERE lw.lottery_id = $1
ORDER BY lw.rank ASC;

-- name: ListUserTickets :many
SELECT lt.id, lt.lottery_id, lt.user_id, lt.ticket_number, lt.purchased_at
FROM lottery_tickets lt
JOIN lotteries l ON l.id = lt.lottery_id
WHERE lt.user_id = $1
  AND (sqlc.arg(guild_filter)::text = '' OR l.guild_id::text = sqlc.arg(guild_filter)::text)
ORDER BY lt.purchased_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountUserTickets :one
SELECT COUNT(*) FROM lottery_tickets lt
JOIN lotteries l ON l.id = lt.lottery_id
WHERE lt.user_id = $1
  AND (sqlc.arg(guild_filter)::text = '' OR l.guild_id::text = sqlc.arg(guild_filter)::text);

-- name: LockLottery :one
SELECT id, created_by, title, ticket_price, tickets_sold, max_tickets,
       max_tickets_per_user, status, draw_date, prizes
FROM lotteries WHERE id = $1 AND guild_id = $2
FOR UPDATE;

-- name: UpdateLottery :one
UPDATE lotteries SET
    title                = sqlc.arg(title)::text,
    description          = CASE WHEN sqlc.arg(set_description)::bool
                                THEN NULLIF(sqlc.arg(description)::text, '')
                                ELSE description END,
    ticket_price         = sqlc.arg(ticket_price),
    max_tickets          = sqlc.arg(max_tickets),
    max_tickets_per_user = sqlc.arg(max_tickets_per_user),
    draw_date            = sqlc.arg(draw_date),
    updated_at           = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id)
  AND status IN ('active', 'upcoming')
RETURNING id, guild_id, created_by, title,
          COALESCE(description, '') AS description,
          ticket_price, tickets_sold,
          max_tickets, max_tickets_per_user, status,
          TO_CHAR(draw_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS draw_date,
          prizes, created_at, updated_at, cancelled_at;

-- name: ListLotteryTicketHolders :many
SELECT user_id, COUNT(*)::int AS tickets
FROM lottery_tickets WHERE lottery_id = $1
GROUP BY user_id
ORDER BY user_id;

-- name: MarkLotteryCancelled :exec
UPDATE lotteries SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: DeleteCancelledLottery :execrows
DELETE FROM lotteries WHERE id = $1 AND guild_id = $2 AND status = 'cancelled';

-- name: ListDueLotteries :many
SELECT id, guild_id FROM lotteries
WHERE status IN ('active', 'upcoming') AND draw_date <= NOW()
ORDER BY draw_date ASC
LIMIT sqlc.arg(max_rows)::int;
