DROP TRIGGER IF EXISTS item_events_notify_delivered ON item_events;
DROP FUNCTION IF EXISTS notify_item_delivered();

DROP TRIGGER IF EXISTS backpack_items_notify_delivery_removed ON backpack_items;
DROP TRIGGER IF EXISTS backpack_items_notify_delivery_requested ON backpack_items;
DROP FUNCTION IF EXISTS notify_delivery_changed();

DELETE FROM item_events WHERE kind IN ('withdrawal_requested', 'withdrawal_cancelled', 'delivered');
ALTER TABLE item_events DROP CONSTRAINT IF EXISTS item_events_kind_check;
ALTER TABLE item_events
    ADD CONSTRAINT item_events_kind_check CHECK (kind IN (
        'looted', 'donated', 'requested', 'request_approved', 'request_rejected',
        'received', 'auction_listed', 'lottery_listed', 'returned', 'withdrawn', 'retracted'
    ));

DROP INDEX IF EXISTS idx_backpack_items_pending_delivery;
ALTER TABLE backpack_items DROP COLUMN IF EXISTS delivery_requested_at;
