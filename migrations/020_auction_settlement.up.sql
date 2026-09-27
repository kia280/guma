ALTER TABLE auctions
    ADD COLUMN IF NOT EXISTS source_type     TEXT
        CONSTRAINT auctions_source_type_check CHECK (source_type IN ('backpack', 'bank')),
    ADD COLUMN IF NOT EXISTS source_snapshot JSONB,
    ADD COLUMN IF NOT EXISTS settled_at      TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_auctions_status_times ON auctions(status, start_time, end_time);

ALTER TABLE bank_contributions DROP CONSTRAINT IF EXISTS bank_contributions_kind_check;
ALTER TABLE bank_contributions
    ADD CONSTRAINT bank_contributions_kind_check CHECK (kind IN ('gold', 'checkin_loot', 'auction_proceeds')),
    ADD COLUMN IF NOT EXISTS reference_type TEXT,
    ADD COLUMN IF NOT EXISTS reference_id   UUID;

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

CREATE TRIGGER auctions_notify_ended
    AFTER UPDATE OF status ON auctions
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ENDED')
    EXECUTE FUNCTION notify_auction_ended();
