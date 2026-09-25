ALTER TABLE bank_items
    ADD COLUMN IF NOT EXISTS checkin_id UUID REFERENCES checkins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_items_checkin ON bank_items(checkin_id);
