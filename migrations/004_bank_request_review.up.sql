ALTER TABLE item_requests ADD COLUMN item JSONB;

UPDATE item_requests ir SET item = bi.item
FROM bank_items bi
WHERE bi.id = ir.bank_item_id;

UPDATE item_requests SET item = '{}'::jsonb WHERE item IS NULL;

ALTER TABLE item_requests ALTER COLUMN item SET NOT NULL;

ALTER TABLE item_requests ALTER COLUMN bank_item_id DROP NOT NULL;
ALTER TABLE item_requests DROP CONSTRAINT item_requests_bank_item_id_fkey;
ALTER TABLE item_requests ADD CONSTRAINT item_requests_bank_item_id_fkey
    FOREIGN KEY (bank_item_id) REFERENCES bank_items(id) ON DELETE SET NULL;

ALTER TABLE item_requests ADD CONSTRAINT item_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE fund_requests ADD CONSTRAINT fund_requests_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));
ALTER TABLE fund_requests ADD CONSTRAINT fund_requests_amount_check
    CHECK (amount > 0);

CREATE UNIQUE INDEX IF NOT EXISTS idx_item_requests_one_pending
    ON item_requests(bank_item_id, requester_id)
    WHERE status = 'pending';
