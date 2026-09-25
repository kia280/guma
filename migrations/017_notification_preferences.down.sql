DROP TRIGGER IF EXISTS lottery_winners_notify_won ON lottery_winners;
CREATE TRIGGER lottery_winners_notify_won
    AFTER INSERT ON lottery_winners
    FOR EACH ROW
    EXECUTE FUNCTION notify_lottery_won();

DROP TRIGGER IF EXISTS auctions_notify_outbid ON auctions;
CREATE TRIGGER auctions_notify_outbid
    AFTER UPDATE OF current_bidder_id ON auctions
    FOR EACH ROW
    WHEN (
        OLD.current_bidder_id IS NOT NULL
        AND NEW.current_bidder_id IS NOT NULL
        AND OLD.current_bidder_id IS DISTINCT FROM NEW.current_bidder_id
        AND NOT NEW.is_blind
    )
    EXECUTE FUNCTION notify_auction_outbid();

DROP FUNCTION IF EXISTS notification_enabled(UUID, TEXT);

ALTER TABLE user_preferences
    DROP COLUMN IF EXISTS checkin_reminders,
    DROP COLUMN IF EXISTS event_reminders,
    DROP COLUMN IF EXISTS lottery_alerts,
    DROP COLUMN IF EXISTS auction_alerts,
    DROP COLUMN IF EXISTS email_notifications;
