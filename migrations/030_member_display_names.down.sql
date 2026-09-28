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
            || ' with ' || gold_amount(NEW.current_bid) || ' gold.',
        'auctionOutbid',
        '/dashboard/auction/' || NEW.id,
        jsonb_build_object(
            'actor', bidder,
            'item', item_name,
            'amount', gold_amount(NEW.current_bid),
            'guildId', NEW.guild_id,
            'auctionId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_auction_ended() RETURNS trigger AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    winner    TEXT := COALESCE(notification_user_name(NEW.current_bidder_id), '');
    has_winner BOOLEAN := NEW.current_bidder_id IS NOT NULL AND NEW.current_bid > 0;
    base      JSONB := jsonb_build_object(
        'item', item_name,
        'amount', gold_amount(NEW.current_bid),
        'guildId', NEW.guild_id,
        'auctionId', NEW.id
    );
BEGIN
    IF has_winner AND notification_enabled(NEW.current_bidder_id, 'auction') THEN
        INSERT INTO notifications (user_id, title, message, type, action_url, params)
        VALUES (
            NEW.current_bidder_id,
            'You won an auction',
            'You won ' || CASE WHEN item_name = '' THEN 'an auction' ELSE item_name END
                || ' for ' || gold_amount(NEW.current_bid) || ' gold. It is now in your backpack.',
            'auctionWon',
            '/dashboard/auction/' || NEW.id,
            base
        );
    END IF;

    IF NEW.seller_id IS DISTINCT FROM NEW.current_bidder_id
       AND notification_enabled(NEW.seller_id, 'auction') THEN
        INSERT INTO notifications (user_id, title, message, type, action_url, params)
        VALUES (
            NEW.seller_id,
            CASE WHEN has_winner THEN 'Your auction sold' ELSE 'Your auction ended without bids' END,
            CASE WHEN has_winner
                THEN CASE WHEN winner = '' THEN 'Someone' ELSE winner END
                    || ' won ' || CASE WHEN item_name = '' THEN 'your auction' ELSE item_name END
                    || ' for ' || gold_amount(NEW.current_bid) || ' gold.'
                ELSE CASE WHEN item_name = '' THEN 'Your auction' ELSE item_name END
                    || ' ended without bids.'
            END,
            CASE WHEN has_winner THEN 'auctionSold' ELSE 'auctionUnsold' END,
            '/dashboard/auction/' || NEW.id,
            base || jsonb_build_object(
                'actor', winner,
                'destination', CASE WHEN NEW.source_type = 'backpack' THEN 'wallet' ELSE 'bank' END
            )
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_backpack_item_received() RETURNS trigger AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    sender    TEXT := COALESCE(notification_user_name(OLD.owner_id), '');
    note      TEXT := COALESCE(NEW.note, '');
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.owner_id,
        'You received an item',
        CASE WHEN sender = '' THEN 'A guild member' ELSE sender END
            || ' sent you ' || CASE WHEN item_name = '' THEN 'an item' ELSE item_name END || '.'
            || CASE WHEN note = '' THEN '' ELSE ' Note: ' || note END,
        'itemReceived',
        '/dashboard/wallet',
        jsonb_build_object(
            'actor', sender,
            'item', item_name,
            'note', note,
            'guildId', NEW.guild_id,
            'backpackItemId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

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
        subject := 'your guild bank request for ' || gold_amount(NEW.amount) || ' gold';
        params := jsonb_build_object('amount', gold_amount(NEW.amount));
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
        CASE WHEN kind = 'item' AND approved
            THEN '/dashboard/wallet?source=' || NEW.id
            ELSE '/dashboard/guild-bank?request=' || NEW.id
        END,
        params
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_item_delivered() RETURNS trigger AS $$
DECLARE
    item_name TEXT;
    officer   TEXT := COALESCE(notification_user_name(NEW.actor_id), '');
BEGIN
    SELECT COALESCE(bi.item->>'name', '') INTO item_name
    FROM backpack_items bi
    WHERE bi.id = NEW.item_id AND bi.guild_id = NEW.guild_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.subject_id,
        'Item delivered',
        CASE WHEN officer = '' THEN 'An officer' ELSE officer END
            || ' confirmed handing over ' || CASE WHEN COALESCE(item_name, '') = '' THEN 'your item' ELSE item_name END
            || ' in game.',
        'itemDelivered',
        '/dashboard/wallet',
        jsonb_build_object(
            'actor', officer,
            'item', COALESCE(item_name, ''),
            'guildId', NEW.guild_id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP INDEX IF EXISTS members_guild_display_name_key;
DROP TRIGGER IF EXISTS members_assign_display_name ON members;
DROP FUNCTION IF EXISTS assign_member_display_name();
DROP FUNCTION IF EXISTS member_display_name(UUID, UUID);
DROP FUNCTION IF EXISTS unique_member_name(UUID, TEXT, UUID);
ALTER TABLE members ALTER COLUMN display_name DROP NOT NULL;

UPDATE users
SET username = 'member-' || left(md5(random()::text || id::text), 8)
WHERE username IS NULL;
ALTER TABLE users ALTER COLUMN username SET NOT NULL;
ALTER TABLE users DROP COLUMN IF EXISTS discord_username;
