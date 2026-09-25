DELETE FROM bank_contributions WHERE kind <> 'gold';

ALTER TABLE bank_contributions
    DROP COLUMN IF EXISTS checkin_id,
    DROP COLUMN IF EXISTS items,
    DROP COLUMN IF EXISTS kind;

DROP INDEX IF EXISTS idx_bank_items_checkin;

ALTER TABLE bank_items DROP COLUMN IF EXISTS checkin_id;
