ALTER TABLE bank_items
    ADD COLUMN IF NOT EXISTS checkin_id UUID REFERENCES checkins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bank_items_checkin ON bank_items(checkin_id);

ALTER TABLE bank_contributions
    ADD COLUMN IF NOT EXISTS kind       TEXT  NOT NULL DEFAULT 'gold'
        CONSTRAINT bank_contributions_kind_check CHECK (kind IN ('gold', 'checkin_loot')),
    ADD COLUMN IF NOT EXISTS items      JSONB NOT NULL DEFAULT '[]',
    ADD COLUMN IF NOT EXISTS checkin_id UUID  REFERENCES checkins(id) ON DELETE SET NULL;
