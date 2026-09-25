ALTER TABLE user_preferences
    ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS auction_alerts      BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS lottery_alerts      BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS event_reminders     BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS checkin_reminders   BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION notification_enabled(p_user_id UUID, p_kind TEXT) RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (SELECT CASE p_kind
                    WHEN 'auction' THEN auction_alerts
                    WHEN 'lottery' THEN lottery_alerts
                    WHEN 'event'   THEN event_reminders
                    WHEN 'checkin' THEN checkin_reminders
                    ELSE TRUE
                END
         FROM user_preferences
         WHERE user_id = p_user_id),
        TRUE
    );
$$ LANGUAGE sql STABLE;

DROP TRIGGER IF EXISTS auctions_notify_outbid ON auctions;
CREATE TRIGGER auctions_notify_outbid
    AFTER UPDATE OF current_bidder_id ON auctions
    FOR EACH ROW
    WHEN (
        OLD.current_bidder_id IS NOT NULL
        AND NEW.current_bidder_id IS NOT NULL
        AND OLD.current_bidder_id IS DISTINCT FROM NEW.current_bidder_id
        AND NOT NEW.is_blind
        AND notification_enabled(OLD.current_bidder_id, 'auction')
    )
    EXECUTE FUNCTION notify_auction_outbid();

DROP TRIGGER IF EXISTS lottery_winners_notify_won ON lottery_winners;
CREATE TRIGGER lottery_winners_notify_won
    AFTER INSERT ON lottery_winners
    FOR EACH ROW
    WHEN (notification_enabled(NEW.user_id, 'lottery'))
    EXECUTE FUNCTION notify_lottery_won();
