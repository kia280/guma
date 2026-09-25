DROP INDEX IF EXISTS idx_bank_items_checkin;

ALTER TABLE bank_items DROP COLUMN IF EXISTS checkin_id;
