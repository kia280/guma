ALTER TABLE auctions ADD COLUMN IF NOT EXISTS source_snapshot JSONB;

UPDATE backpack_items SET locked_by_type = NULL, locked_by_id = NULL, locked_at = NULL
WHERE locked_by_type IS NOT NULL;
UPDATE bank_items SET locked_by_type = NULL, locked_by_id = NULL, locked_at = NULL
WHERE locked_by_type IS NOT NULL;

ALTER TABLE auctions DROP COLUMN IF EXISTS source_item_id;

DROP INDEX IF EXISTS idx_backpack_items_lock;
DROP INDEX IF EXISTS idx_bank_items_lock;

ALTER TABLE backpack_items
    DROP CONSTRAINT IF EXISTS backpack_items_lock_complete_check,
    DROP COLUMN IF EXISTS locked_at,
    DROP COLUMN IF EXISTS locked_by_id,
    DROP COLUMN IF EXISTS locked_by_type;

ALTER TABLE bank_items
    DROP CONSTRAINT IF EXISTS bank_items_lock_complete_check,
    DROP COLUMN IF EXISTS locked_at,
    DROP COLUMN IF EXISTS locked_by_id,
    DROP COLUMN IF EXISTS locked_by_type;
