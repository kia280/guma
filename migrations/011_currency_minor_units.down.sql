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

DROP FUNCTION IF EXISTS gold_amount(BIGINT);

ALTER TABLE auctions ALTER COLUMN min_bid_increment SET DEFAULT 1;

UPDATE lotteries
SET prizes = (
    SELECT jsonb_agg(
        CASE WHEN prize ? 'Amount'
            THEN jsonb_set(prize, '{Amount}', to_jsonb(ROUND((prize->>'Amount')::BIGINT / 100.0)::BIGINT))
            ELSE prize
        END
        ORDER BY ordinality
    )
    FROM jsonb_array_elements(prizes) WITH ORDINALITY AS p(prize, ordinality)
)
WHERE jsonb_typeof(prizes) = 'array' AND jsonb_array_length(prizes) > 0;

UPDATE wallets SET balance = ROUND(balance / 100.0);
UPDATE transactions SET amount = ROUND(amount / 100.0), balance_after = ROUND(balance_after / 100.0);
UPDATE auctions SET starting_bid = ROUND(starting_bid / 100.0), current_bid = ROUND(current_bid / 100.0), min_bid_increment = ROUND(min_bid_increment / 100.0);
UPDATE bids SET amount = ROUND(amount / 100.0);
UPDATE lotteries SET ticket_price = ROUND(ticket_price / 100.0);
UPDATE lottery_winners SET prize_amount = ROUND(prize_amount / 100.0);
UPDATE guild_bank SET balance = ROUND(balance / 100.0), goal = ROUND(goal / 100.0);
UPDATE bank_contributions SET amount = ROUND(amount / 100.0);
UPDATE fund_requests SET amount = ROUND(amount / 100.0);
