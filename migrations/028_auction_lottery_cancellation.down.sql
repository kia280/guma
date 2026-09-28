DROP TRIGGER IF EXISTS lotteries_notify_cancelled ON lotteries;
DROP FUNCTION IF EXISTS notify_lottery_cancelled();
DROP TRIGGER IF EXISTS auctions_notify_cancelled ON auctions;
DROP FUNCTION IF EXISTS notify_auction_cancelled();

UPDATE lotteries SET status = 'ended' WHERE status = 'cancelled';

ALTER TABLE lotteries DROP COLUMN IF EXISTS cancelled_at;
ALTER TABLE auctions DROP COLUMN IF EXISTS cancelled_at;
