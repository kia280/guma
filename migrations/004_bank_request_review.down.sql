DROP INDEX IF EXISTS idx_item_requests_one_pending;

ALTER TABLE fund_requests DROP CONSTRAINT IF EXISTS fund_requests_amount_check;
ALTER TABLE fund_requests DROP CONSTRAINT IF EXISTS fund_requests_status_check;
ALTER TABLE item_requests DROP CONSTRAINT IF EXISTS item_requests_status_check;

DELETE FROM item_requests WHERE bank_item_id IS NULL;

ALTER TABLE item_requests DROP CONSTRAINT item_requests_bank_item_id_fkey;
ALTER TABLE item_requests ADD CONSTRAINT item_requests_bank_item_id_fkey
    FOREIGN KEY (bank_item_id) REFERENCES bank_items(id) ON DELETE CASCADE;
ALTER TABLE item_requests ALTER COLUMN bank_item_id SET NOT NULL;

ALTER TABLE item_requests DROP COLUMN item;
