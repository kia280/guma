DROP TRIGGER IF EXISTS item_requests_log_review_event ON item_requests;
DROP TRIGGER IF EXISTS item_requests_log_insert_event ON item_requests;
DROP TRIGGER IF EXISTS backpack_items_log_transfer_event ON backpack_items;
DROP TRIGGER IF EXISTS backpack_items_log_insert_event ON backpack_items;
DROP TRIGGER IF EXISTS bank_items_log_event ON bank_items;

DROP FUNCTION IF EXISTS log_item_request_event();
DROP FUNCTION IF EXISTS log_backpack_item_event();
DROP FUNCTION IF EXISTS log_bank_item_event();

DROP TABLE IF EXISTS item_events;
