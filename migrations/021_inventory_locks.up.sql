ALTER TABLE bank_items
    ADD COLUMN IF NOT EXISTS locked_by_type TEXT
        CONSTRAINT bank_items_locked_by_type_check CHECK (locked_by_type IN ('auction', 'lottery')),
    ADD COLUMN IF NOT EXISTS locked_by_id   UUID,
    ADD COLUMN IF NOT EXISTS locked_at      TIMESTAMPTZ,
    ADD CONSTRAINT bank_items_lock_complete_check
        CHECK ((locked_by_type IS NULL) = (locked_by_id IS NULL));

ALTER TABLE backpack_items
    ADD COLUMN IF NOT EXISTS locked_by_type TEXT
        CONSTRAINT backpack_items_locked_by_type_check CHECK (locked_by_type IN ('auction', 'lottery')),
    ADD COLUMN IF NOT EXISTS locked_by_id   UUID,
    ADD COLUMN IF NOT EXISTS locked_at      TIMESTAMPTZ,
    ADD CONSTRAINT backpack_items_lock_complete_check
        CHECK ((locked_by_type IS NULL) = (locked_by_id IS NULL));

CREATE INDEX IF NOT EXISTS idx_bank_items_lock ON bank_items(locked_by_type, locked_by_id)
    WHERE locked_by_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_backpack_items_lock ON backpack_items(locked_by_type, locked_by_id)
    WHERE locked_by_type IS NOT NULL;

ALTER TABLE auctions ADD COLUMN IF NOT EXISTS source_item_id UUID;

ALTER TABLE auctions DROP COLUMN IF EXISTS source_snapshot;
