CREATE OR REPLACE FUNCTION notify_loot_assigned() RETURNS trigger AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    checkin   RECORD;
BEGIN
    SELECT id, title INTO checkin FROM checkins WHERE id = NEW.source_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.owner_id,
        'You received roll call loot',
        'You received ' || CASE WHEN item_name = '' THEN 'an item' ELSE item_name END
            || ' from ' || COALESCE(checkin.title, 'a roll call') || '.',
        'lootAssigned',
        '/dashboard/wallet?source=' || NEW.source_id,
        jsonb_build_object(
            'item', item_name,
            'checkin', COALESCE(checkin.title, ''),
            'guildId', NEW.guild_id,
            'checkinId', NEW.source_id,
            'backpackItemId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER backpack_items_notify_loot_assigned
    AFTER INSERT ON backpack_items
    FOR EACH ROW
    WHEN (NEW.source = 'checkin' AND NEW.source_id IS NOT NULL)
    EXECUTE FUNCTION notify_loot_assigned();
