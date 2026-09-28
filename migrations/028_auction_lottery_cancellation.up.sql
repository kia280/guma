ALTER TABLE auctions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE lotteries ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

UPDATE auctions SET cancelled_at = updated_at
WHERE status = 'CANCELLED' AND cancelled_at IS NULL;

CREATE OR REPLACE FUNCTION notify_auction_cancelled() RETURNS trigger AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    SELECT b.bidder_id,
           'An auction was cancelled',
           CASE WHEN item_name = '' THEN 'An auction' ELSE item_name END || ' was cancelled.'
               || CASE WHEN r.refunded
                       THEN ' Your bid of ' || gold_amount(NEW.current_bid) || ' gold was refunded.'
                       ELSE '' END,
           'auctionCancelled',
           '/dashboard/auction/' || NEW.id,
           jsonb_build_object(
               'item', item_name,
               'amount', gold_amount(CASE WHEN r.refunded THEN NEW.current_bid ELSE 0 END),
               'refunded', CASE WHEN r.refunded THEN 'yes' ELSE 'no' END,
               'guildId', NEW.guild_id,
               'auctionId', NEW.id
           )
    FROM (SELECT DISTINCT bidder_id FROM bids WHERE auction_id = NEW.id) b
    CROSS JOIN LATERAL (
        SELECT b.bidder_id = NEW.current_bidder_id AND NEW.current_bid > 0 AS refunded
    ) r
    WHERE b.bidder_id IS DISTINCT FROM NEW.seller_id
      AND notification_enabled(b.bidder_id, 'auction');
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auctions_notify_cancelled
    AFTER UPDATE OF status ON auctions
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'CANCELLED')
    EXECUTE FUNCTION notify_auction_cancelled();

CREATE OR REPLACE FUNCTION notify_lottery_cancelled() RETURNS trigger AS $$
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    SELECT t.user_id,
           'A lottery was cancelled',
           NEW.title || ' was cancelled. Your ' || t.tickets
               || CASE WHEN t.tickets = 1 THEN ' ticket was' ELSE ' tickets were' END
               || ' refunded (' || gold_amount(t.tickets * NEW.ticket_price) || ' gold).',
           'lotteryCancelled',
           '/dashboard/lottery/' || NEW.id,
           jsonb_build_object(
               'lottery', NEW.title,
               'tickets', t.tickets,
               'amount', gold_amount(t.tickets * NEW.ticket_price),
               'guildId', NEW.guild_id,
               'lotteryId', NEW.id
           )
    FROM (
        SELECT user_id, COUNT(*)::int AS tickets
        FROM lottery_tickets WHERE lottery_id = NEW.id
        GROUP BY user_id
    ) t
    WHERE notification_enabled(t.user_id, 'lottery');
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lotteries_notify_cancelled
    AFTER UPDATE OF status ON lotteries
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled')
    EXECUTE FUNCTION notify_lottery_cancelled();
