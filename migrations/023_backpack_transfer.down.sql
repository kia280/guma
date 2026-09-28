DROP TRIGGER IF EXISTS backpack_items_notify_received ON backpack_items;
DROP FUNCTION IF EXISTS notify_backpack_item_received();
DROP TRIGGER IF EXISTS backpack_items_notify_live ON backpack_items;
DROP FUNCTION IF EXISTS notify_backpack_changed();
