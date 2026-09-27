CREATE OR REPLACE FUNCTION notify_backpack_changed() RETURNS trigger AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        PERFORM notify_live_event('user', OLD.owner_id, OLD.guild_id, 'backpack', OLD.id::text);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
        PERFORM notify_live_event('user', NEW.owner_id, NEW.guild_id, 'backpack', NEW.id::text);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER backpack_items_notify_live
    AFTER INSERT OR UPDATE OR DELETE ON backpack_items
    FOR EACH ROW
    EXECUTE FUNCTION notify_backpack_changed();

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

CREATE TRIGGER backpack_items_notify_received
    AFTER UPDATE OF owner_id ON backpack_items
    FOR EACH ROW
    WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id AND NEW.source = 'transfer')
    EXECUTE FUNCTION notify_backpack_item_received();
