-- name: ListRaffles :many
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       ticket_price, tickets_sold,
       max_tickets, max_tickets_per_user, status,
       TO_CHAR(draw_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS draw_date,
       prizes, created_at, updated_at, cancelled_at
FROM raffles
WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR status = sqlc.arg(status_filter)::text)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountRaffles :one
SELECT COUNT(*) FROM raffles WHERE guild_id = $1
  AND (sqlc.arg(status_filter)::text = '' OR status = sqlc.arg(status_filter)::text);

-- name: GetRaffle :one
SELECT id, guild_id, created_by, title,
       COALESCE(description, '') AS description,
       ticket_price, tickets_sold,
       max_tickets, max_tickets_per_user, status,
       TO_CHAR(draw_date AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS draw_date,
       prizes, created_at, updated_at, cancelled_at
FROM raffles WHERE id = $1 AND guild_id = $2;

-- name: CreateRaffle :one
INSERT INTO raffles (
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

-- name: LockRaffleForPurchase :one
SELECT ticket_price, status, max_tickets, max_tickets_per_user, tickets_sold, draw_date
FROM raffles WHERE id = $1 AND guild_id = $2
FOR UPDATE;

-- name: CountUserTicketsForRaffle :one
SELECT COUNT(*) FROM raffle_tickets WHERE raffle_id = $1 AND user_id = $2;

-- name: EnsureWalletDefault :exec
INSERT INTO wallets (user_id, guild_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;

-- name: InsertRaffleTicket :one
INSERT INTO raffle_tickets (raffle_id, user_id, ticket_number)
VALUES ($1, $2, sqlc.arg(ticket_number)::text)
RETURNING id, purchased_at;

-- name: IncrementTicketsSold :exec
UPDATE raffles SET tickets_sold = tickets_sold + sqlc.arg(n)::int, updated_at = NOW() WHERE id = sqlc.arg(id);

-- name: RaffleExists :one
SELECT EXISTS(SELECT 1 FROM raffles WHERE id = $1 AND guild_id = $2);

-- name: GetRaffleForDraw :one
SELECT prizes, status, created_by, title, ticket_price
FROM raffles WHERE id = $1 AND guild_id = $2 FOR UPDATE;

-- name: ListAllRaffleTickets :many
SELECT id, user_id, ticket_number FROM raffle_tickets WHERE raffle_id = $1;

-- name: GetUserUsernameAndAvatar :one
SELECT COALESCE(member_display_name(sqlc.arg(guild_id)::uuid, id), '')::text AS username,
       COALESCE(avatar_url, '')                                               AS avatar_url
FROM users WHERE id = sqlc.arg(user_id);

-- name: InsertRaffleWinner :one
INSERT INTO raffle_winners (raffle_id, user_id, rank, prize_amount, prize_description, ticket_number)
VALUES ($1, $2, sqlc.arg(rank)::int, $3, NULLIF(sqlc.arg(prize_description)::text, ''), sqlc.arg(ticket_number)::text)
RETURNING id;

-- name: EndRaffle :exec
UPDATE raffles SET status = 'ended', updated_at = NOW() WHERE id = $1;

-- name: ListRaffleWinners :many
SELECT lw.id, lw.raffle_id, lw.user_id,
       COALESCE(member_display_name(l.guild_id, lw.user_id), '')::text AS username,
       COALESCE(u.avatar_url, '') AS avatar_url,
       lw.rank, lw.prize_amount,
       COALESCE(lw.prize_description, '') AS prize_description,
       lw.ticket_number
FROM raffle_winners lw
JOIN raffles l ON l.id = lw.raffle_id
LEFT JOIN users u ON u.id = lw.user_id
WHERE lw.raffle_id = $1
ORDER BY lw.rank ASC;

-- name: ListUserTickets :many
SELECT lt.id, lt.raffle_id, lt.user_id, lt.ticket_number, lt.purchased_at
FROM raffle_tickets lt
JOIN raffles l ON l.id = lt.raffle_id
WHERE lt.user_id = $1
  AND (sqlc.arg(guild_filter)::text = '' OR l.guild_id::text = sqlc.arg(guild_filter)::text)
ORDER BY lt.purchased_at DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountUserTickets :one
SELECT COUNT(*) FROM raffle_tickets lt
JOIN raffles l ON l.id = lt.raffle_id
WHERE lt.user_id = $1
  AND (sqlc.arg(guild_filter)::text = '' OR l.guild_id::text = sqlc.arg(guild_filter)::text);

-- name: LockRaffle :one
SELECT id, created_by, title, ticket_price, tickets_sold, max_tickets,
       max_tickets_per_user, status, draw_date, prizes
FROM raffles WHERE id = $1 AND guild_id = $2
FOR UPDATE;

-- name: UpdateRaffle :one
UPDATE raffles SET
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

-- name: ListRaffleTicketHolders :many
SELECT user_id, COUNT(*)::int AS tickets
FROM raffle_tickets WHERE raffle_id = $1
GROUP BY user_id
ORDER BY user_id;

-- name: MarkRaffleCancelled :exec
UPDATE raffles SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
WHERE id = $1;

-- name: DeleteCancelledRaffle :execrows
DELETE FROM raffles WHERE id = $1 AND guild_id = $2 AND status = 'cancelled';

-- name: ListDueRaffles :many
SELECT id, guild_id FROM raffles
WHERE status IN ('active', 'upcoming') AND draw_date <= NOW()
ORDER BY draw_date ASC
LIMIT sqlc.arg(max_rows)::int;
