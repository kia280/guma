ALTER TABLE backpack_items ADD COLUMN IF NOT EXISTS delivery_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_backpack_items_pending_delivery
    ON backpack_items(guild_id, delivery_requested_at)
    WHERE delivery_requested_at IS NOT NULL;

ALTER TABLE item_events DROP CONSTRAINT IF EXISTS item_events_kind_check;
ALTER TABLE item_events
    ADD CONSTRAINT item_events_kind_check CHECK (kind IN (
        'looted', 'donated', 'requested', 'request_approved', 'request_rejected',
        'received', 'auction_listed', 'lottery_listed', 'returned', 'withdrawn', 'retracted',
        'withdrawal_requested', 'withdrawal_cancelled', 'delivered'
    ));

CREATE OR REPLACE FUNCTION notify_delivery_changed() RETURNS trigger AS $$
DECLARE
    changed RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        changed := OLD;
    ELSE
        changed := NEW;
    END IF;
    PERFORM notify_live_event('guild', changed.guild_id, changed.guild_id, 'delivery', changed.id::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER backpack_items_notify_delivery_requested
    AFTER UPDATE OF delivery_requested_at ON backpack_items
    FOR EACH ROW
    WHEN (OLD.delivery_requested_at IS DISTINCT FROM NEW.delivery_requested_at)
    EXECUTE FUNCTION notify_delivery_changed();

CREATE TRIGGER backpack_items_notify_delivery_removed
    AFTER DELETE ON backpack_items
    FOR EACH ROW
    WHEN (OLD.delivery_requested_at IS NOT NULL)
    EXECUTE FUNCTION notify_delivery_changed();

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

CREATE TRIGGER item_events_notify_delivered
    AFTER INSERT ON item_events
    FOR EACH ROW
    WHEN (NEW.kind = 'delivered' AND NEW.subject_id IS NOT NULL)
    EXECUTE FUNCTION notify_item_delivered();
