ALTER TABLE notifications ADD COLUMN params JSONB NOT NULL DEFAULT '{}';

DROP INDEX IF EXISTS idx_notifications_user;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
    ON notifications(user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id)
    WHERE NOT read;

CREATE OR REPLACE FUNCTION notify_notification_changed() RETURNS trigger AS $$
DECLARE
    changed RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        changed := OLD;
    ELSE
        changed := NEW;
    END IF;

    PERFORM notify_live_event('user', changed.user_id, NULL, 'notification', changed.id::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notifications_notify_changed
    AFTER INSERT OR DELETE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION notify_notification_changed();

CREATE TRIGGER notifications_notify_updated
    AFTER UPDATE ON notifications
    FOR EACH ROW
    WHEN (OLD IS DISTINCT FROM NEW)
    EXECUTE FUNCTION notify_notification_changed();

CREATE OR REPLACE FUNCTION notification_user_name(p_user_id UUID) RETURNS TEXT AS $$
    SELECT COALESCE(NULLIF(display_name, ''), username, '')
    FROM users
    WHERE id = p_user_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION notify_bank_request_reviewed() RETURNS trigger AS $$
DECLARE
    kind      TEXT := TG_ARGV[0];
    approved  BOOLEAN := NEW.status = 'approved';
    reviewer  TEXT := COALESCE(notification_user_name(NEW.reviewer_id), '');
    note      TEXT := COALESCE(NEW.review_note, '');
    subject   TEXT;
    params    JSONB;
BEGIN
    IF NEW.reviewer_id IS NOT DISTINCT FROM NEW.requester_id THEN
        RETURN NULL;
    END IF;

    IF kind = 'fund' THEN
        subject := 'your guild bank request for ' || NEW.amount || ' gold';
        params := jsonb_build_object('amount', NEW.amount);
    ELSE
        subject := 'your request for ' || COALESCE(to_jsonb(NEW)->'item'->>'name', 'an item');
        params := jsonb_build_object('item', COALESCE(to_jsonb(NEW)->'item'->>'name', ''));
    END IF;

    params := params || jsonb_build_object(
        'actor', reviewer,
        'note', note,
        'guildId', NEW.guild_id,
        'requestId', NEW.id
    );

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.requester_id,
        CASE kind
            WHEN 'fund' THEN CASE WHEN approved THEN 'Fund request approved' ELSE 'Fund request rejected' END
            ELSE CASE WHEN approved THEN 'Item request approved' ELSE 'Item request rejected' END
        END,
        CASE WHEN reviewer = '' THEN 'A reviewer' ELSE reviewer END
            || CASE WHEN approved THEN ' approved ' ELSE ' rejected ' END
            || subject || '.'
            || CASE WHEN note = '' THEN '' ELSE ' Note: ' || note END,
        kind || 'Request' || CASE WHEN approved THEN 'Approved' ELSE 'Rejected' END,
        '/dashboard/guild-bank',
        params
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fund_requests_notify_reviewed
    AFTER UPDATE OF status ON fund_requests
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected'))
    EXECUTE FUNCTION notify_bank_request_reviewed('fund');

CREATE TRIGGER item_requests_notify_reviewed
    AFTER UPDATE OF status ON item_requests
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected'))
    EXECUTE FUNCTION notify_bank_request_reviewed('item');

CREATE OR REPLACE FUNCTION notify_bank_request_submitted() RETURNS trigger AS $$
DECLARE
    kind    TEXT := TG_ARGV[0];
    reason  TEXT := COALESCE(NEW.reason, '');
    subject TEXT;
    params  JSONB;
BEGIN
    IF kind = 'fund' THEN
        subject := NEW.amount || ' gold from the guild bank';
        params := jsonb_build_object('amount', NEW.amount);
    ELSE
        subject := COALESCE(to_jsonb(NEW)->'item'->>'name', 'an item') || ' from the guild bank';
        params := jsonb_build_object('item', COALESCE(to_jsonb(NEW)->'item'->>'name', ''));
    END IF;

    params := params || jsonb_build_object(
        'actor', NEW.requester_name,
        'reason', reason,
        'guildId', NEW.guild_id,
        'requestId', NEW.id
    );

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    SELECT m.user_id,
           CASE kind WHEN 'fund' THEN 'New fund request' ELSE 'New item request' END,
           NEW.requester_name || ' requested ' || subject || '.'
               || CASE WHEN reason = '' THEN '' ELSE ' Reason: ' || reason END,
           kind || 'RequestSubmitted',
           '/dashboard/admin',
           params
    FROM members m
    WHERE m.guild_id = NEW.guild_id
      AND m.role IN ('owner', 'admin', 'moderator')
      AND m.user_id <> NEW.requester_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER fund_requests_notify_submitted
    AFTER INSERT ON fund_requests
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION notify_bank_request_submitted('fund');

CREATE TRIGGER item_requests_notify_submitted
    AFTER INSERT ON item_requests
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION notify_bank_request_submitted('item');

CREATE OR REPLACE FUNCTION notify_auction_outbid() RETURNS trigger AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    bidder    TEXT := COALESCE(notification_user_name(NEW.current_bidder_id), '');
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        OLD.current_bidder_id,
        'You have been outbid',
        CASE WHEN bidder = '' THEN 'Someone' ELSE bidder END
            || ' outbid you on ' || CASE WHEN item_name = '' THEN 'an auction' ELSE item_name END
            || ' with ' || NEW.current_bid || ' gold.',
        'auctionOutbid',
        '/dashboard/auction/' || NEW.id,
        jsonb_build_object(
            'actor', bidder,
            'item', item_name,
            'amount', NEW.current_bid,
            'guildId', NEW.guild_id,
            'auctionId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

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

CREATE OR REPLACE FUNCTION notify_lottery_won() RETURNS trigger AS $$
DECLARE
    lottery RECORD;
    prize   TEXT := COALESCE(NULLIF(NEW.prize_description, ''), '');
BEGIN
    SELECT id, guild_id, title INTO lottery FROM lotteries WHERE id = NEW.lottery_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'You won a lottery prize',
        'You placed #' || NEW.rank || ' in ' || lottery.title || ' and won '
            || CASE WHEN prize = '' THEN NEW.prize_amount || ' gold' ELSE prize END || '.',
        'lotteryWon',
        '/dashboard/lottery/' || NEW.lottery_id,
        jsonb_build_object(
            'lottery', lottery.title,
            'rank', NEW.rank,
            'prize', prize,
            'amount', NEW.prize_amount,
            'prizeType', CASE WHEN prize = '' THEN 'gold' ELSE 'item' END,
            'guildId', lottery.guild_id,
            'lotteryId', NEW.lottery_id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lottery_winners_notify_won
    AFTER INSERT ON lottery_winners
    FOR EACH ROW
    EXECUTE FUNCTION notify_lottery_won();
