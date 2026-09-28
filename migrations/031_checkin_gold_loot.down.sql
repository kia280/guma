DROP TRIGGER IF EXISTS transactions_notify_checkin_gold_received ON transactions;
DROP FUNCTION IF EXISTS notify_checkin_gold_received();

DELETE FROM bank_contributions WHERE kind IN ('checkin_gold_payout', 'checkin_gold_retracted');
ALTER TABLE bank_contributions DROP CONSTRAINT IF EXISTS bank_contributions_kind_check;
ALTER TABLE bank_contributions
    ADD CONSTRAINT bank_contributions_kind_check
        CHECK (kind IN ('gold', 'checkin_loot', 'auction_proceeds', 'lottery_revenue'));

DROP TABLE IF EXISTS checkin_gold_payouts;
DROP TABLE IF EXISTS checkin_gold_distributions;
DROP TABLE IF EXISTS checkin_gold_pots;
