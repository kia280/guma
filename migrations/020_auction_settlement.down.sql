DROP TRIGGER IF EXISTS auctions_notify_ended ON auctions;
DROP FUNCTION IF EXISTS notify_auction_ended();

DELETE FROM bank_contributions WHERE kind = 'auction_proceeds';
ALTER TABLE bank_contributions
    DROP COLUMN IF EXISTS reference_id,
    DROP COLUMN IF EXISTS reference_type;
ALTER TABLE bank_contributions DROP CONSTRAINT IF EXISTS bank_contributions_kind_check;
ALTER TABLE bank_contributions
    ADD CONSTRAINT bank_contributions_kind_check CHECK (kind IN ('gold', 'checkin_loot'));

DROP INDEX IF EXISTS idx_auctions_status_times;

ALTER TABLE auctions
    DROP COLUMN IF EXISTS settled_at,
    DROP COLUMN IF EXISTS source_snapshot,
    DROP COLUMN IF EXISTS source_type;
