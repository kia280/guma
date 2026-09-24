DROP TRIGGER IF EXISTS lottery_winners_notify_won ON lottery_winners;
DROP TRIGGER IF EXISTS auctions_notify_outbid ON auctions;
DROP TRIGGER IF EXISTS item_requests_notify_submitted ON item_requests;
DROP TRIGGER IF EXISTS fund_requests_notify_submitted ON fund_requests;
DROP TRIGGER IF EXISTS item_requests_notify_reviewed ON item_requests;
DROP TRIGGER IF EXISTS fund_requests_notify_reviewed ON fund_requests;
DROP TRIGGER IF EXISTS notifications_notify_updated ON notifications;
DROP TRIGGER IF EXISTS notifications_notify_changed ON notifications;

DROP FUNCTION IF EXISTS notify_lottery_won();
DROP FUNCTION IF EXISTS notify_auction_outbid();
DROP FUNCTION IF EXISTS notify_bank_request_submitted();
DROP FUNCTION IF EXISTS notify_bank_request_reviewed();
DROP FUNCTION IF EXISTS notification_user_name(UUID);
DROP FUNCTION IF EXISTS notify_notification_changed();

DROP INDEX IF EXISTS idx_notifications_user_unread;
DROP INDEX IF EXISTS idx_notifications_user_created;
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);

ALTER TABLE notifications DROP COLUMN IF EXISTS params;
