ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_username TEXT;
ALTER TABLE users ALTER COLUMN username DROP NOT NULL;

UPDATE users
SET display_name = username
WHERE (display_name IS NULL OR btrim(display_name) = '') AND username IS NOT NULL;

CREATE OR REPLACE FUNCTION unique_member_name(p_guild_id UUID, p_base TEXT, p_member_id UUID) RETURNS TEXT AS $$
DECLARE
    base      TEXT := left(COALESCE(NULLIF(btrim(p_base), ''), 'member'), 29);
    candidate TEXT := base;
    suffix    INT  := 1;
BEGIN
    WHILE EXISTS (
        SELECT 1 FROM members
        WHERE guild_id = p_guild_id
          AND lower(display_name) = lower(candidate)
          AND id IS DISTINCT FROM p_member_id
    ) LOOP
        suffix := suffix + 1;
        candidate := base || '-' || suffix;
    END LOOP;
    RETURN candidate;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    rec RECORD;
BEGIN
    CREATE TEMP TABLE member_name_backfill ON COMMIT DROP AS
    SELECT m.id, m.guild_id, m.joined_at,
           COALESCE(NULLIF(btrim(m.display_name), ''), NULLIF(btrim(u.display_name), ''), u.username) AS base
    FROM members m
    JOIN users u ON u.id = m.user_id;

    UPDATE members SET display_name = NULL;

    FOR rec IN SELECT * FROM member_name_backfill ORDER BY guild_id, joined_at, id LOOP
        UPDATE members
        SET display_name = unique_member_name(rec.guild_id, rec.base, rec.id)
        WHERE id = rec.id;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION assign_member_display_name() RETURNS trigger AS $$
BEGIN
    IF NEW.display_name IS NULL OR btrim(NEW.display_name) = '' THEN
        NEW.display_name := unique_member_name(
            NEW.guild_id,
            (SELECT COALESCE(NULLIF(btrim(display_name), ''), username) FROM users WHERE id = NEW.user_id),
            NEW.id
        );
    ELSE
        NEW.display_name := btrim(NEW.display_name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS members_assign_display_name ON members;
CREATE TRIGGER members_assign_display_name
    BEFORE INSERT OR UPDATE OF display_name ON members
    FOR EACH ROW
    EXECUTE FUNCTION assign_member_display_name();

ALTER TABLE members ALTER COLUMN display_name SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS members_guild_display_name_key ON members (guild_id, lower(display_name));

CREATE OR REPLACE FUNCTION member_display_name(p_guild_id UUID, p_user_id UUID) RETURNS TEXT AS $$
    SELECT COALESCE(
        (SELECT NULLIF(display_name, '') FROM members WHERE guild_id = p_guild_id AND user_id = p_user_id),
        (SELECT COALESCE(NULLIF(display_name, ''), username) FROM users WHERE id = p_user_id),
        ''
    );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION notify_auction_outbid() RETURNS trigger AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    bidder    TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.current_bidder_id), '');
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
    winner    TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.current_bidder_id), '');
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
    sender    TEXT := COALESCE(member_display_name(NEW.guild_id, OLD.owner_id), '');
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
    reviewer  TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.reviewer_id), '');
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
    officer   TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.actor_id), '');
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
