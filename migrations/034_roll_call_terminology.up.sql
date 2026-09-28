ALTER TABLE checkins RENAME TO roll_calls;
ALTER TABLE checkin_attendees RENAME TO roll_call_attendees;
ALTER TABLE checkin_templates RENAME TO roll_call_templates;
ALTER TABLE checkin_gold_pots RENAME TO roll_call_gold_pots;
ALTER TABLE checkin_gold_distributions RENAME TO roll_call_gold_distributions;
ALTER TABLE checkin_gold_payouts RENAME TO roll_call_gold_payouts;

ALTER TABLE roll_call_attendees RENAME COLUMN checkin_id TO roll_call_id;
ALTER TABLE roll_call_attendees RENAME COLUMN attended_at TO checked_in_at;
ALTER TABLE roll_call_gold_pots RENAME COLUMN checkin_id TO roll_call_id;
ALTER TABLE roll_call_gold_distributions RENAME COLUMN checkin_id TO roll_call_id;
ALTER TABLE bank_items RENAME COLUMN checkin_id TO roll_call_id;
ALTER TABLE bank_contributions RENAME COLUMN checkin_id TO roll_call_id;
ALTER TABLE user_preferences RENAME COLUMN checkin_reminders TO roll_call_reminders;

ALTER TABLE roll_calls RENAME CONSTRAINT checkins_pkey TO roll_calls_pkey;
ALTER TABLE roll_calls RENAME CONSTRAINT checkins_guild_id_fkey TO roll_calls_guild_id_fkey;
ALTER TABLE roll_calls RENAME CONSTRAINT checkins_created_by_fkey TO roll_calls_created_by_fkey;
ALTER TABLE roll_calls RENAME CONSTRAINT checkins_completed_by_fkey TO roll_calls_completed_by_fkey;

ALTER TABLE roll_call_attendees RENAME CONSTRAINT checkin_attendees_pkey TO roll_call_attendees_pkey;
ALTER TABLE roll_call_attendees RENAME CONSTRAINT checkin_attendees_checkin_id_user_id_key TO roll_call_attendees_roll_call_id_user_id_key;
ALTER TABLE roll_call_attendees RENAME CONSTRAINT checkin_attendees_checkin_id_fkey TO roll_call_attendees_roll_call_id_fkey;
ALTER TABLE roll_call_attendees RENAME CONSTRAINT checkin_attendees_user_id_fkey TO roll_call_attendees_user_id_fkey;
ALTER TABLE roll_call_attendees RENAME CONSTRAINT checkin_attendees_notes_check TO roll_call_attendees_notes_check;

ALTER TABLE roll_call_templates RENAME CONSTRAINT checkin_templates_pkey TO roll_call_templates_pkey;
ALTER TABLE roll_call_templates RENAME CONSTRAINT checkin_templates_guild_name_key TO roll_call_templates_guild_name_key;
ALTER TABLE roll_call_templates RENAME CONSTRAINT checkin_templates_guild_id_fkey TO roll_call_templates_guild_id_fkey;
ALTER TABLE roll_call_templates RENAME CONSTRAINT checkin_templates_created_by_fkey TO roll_call_templates_created_by_fkey;

ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT checkin_gold_pots_pkey TO roll_call_gold_pots_pkey;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT checkin_gold_pots_checkin_id_fkey TO roll_call_gold_pots_roll_call_id_fkey;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT checkin_gold_pots_guild_id_fkey TO roll_call_gold_pots_guild_id_fkey;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT checkin_gold_pots_total_check TO roll_call_gold_pots_total_check;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT checkin_gold_pots_distributed_check TO roll_call_gold_pots_distributed_check;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT checkin_gold_pots_retracted_check TO roll_call_gold_pots_retracted_check;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT checkin_gold_pots_balance_check TO roll_call_gold_pots_balance_check;

ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT checkin_gold_distributions_pkey TO roll_call_gold_distributions_pkey;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT checkin_gold_distributions_request_key TO roll_call_gold_distributions_request_key;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT checkin_gold_distributions_checkin_id_fkey TO roll_call_gold_distributions_roll_call_id_fkey;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT checkin_gold_distributions_guild_id_fkey TO roll_call_gold_distributions_guild_id_fkey;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT checkin_gold_distributions_actor_id_fkey TO roll_call_gold_distributions_actor_id_fkey;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT checkin_gold_distributions_total_check TO roll_call_gold_distributions_total_check;

ALTER TABLE roll_call_gold_payouts RENAME CONSTRAINT checkin_gold_payouts_pkey TO roll_call_gold_payouts_pkey;
ALTER TABLE roll_call_gold_payouts RENAME CONSTRAINT checkin_gold_payouts_distribution_id_fkey TO roll_call_gold_payouts_distribution_id_fkey;
ALTER TABLE roll_call_gold_payouts RENAME CONSTRAINT checkin_gold_payouts_user_id_fkey TO roll_call_gold_payouts_user_id_fkey;
ALTER TABLE roll_call_gold_payouts RENAME CONSTRAINT checkin_gold_payouts_transaction_id_fkey TO roll_call_gold_payouts_transaction_id_fkey;
ALTER TABLE roll_call_gold_payouts RENAME CONSTRAINT checkin_gold_payouts_amount_check TO roll_call_gold_payouts_amount_check;

ALTER TABLE bank_items RENAME CONSTRAINT bank_items_checkin_id_fkey TO bank_items_roll_call_id_fkey;
ALTER TABLE bank_contributions RENAME CONSTRAINT bank_contributions_checkin_id_fkey TO bank_contributions_roll_call_id_fkey;

ALTER INDEX idx_checkins_guild RENAME TO idx_roll_calls_guild;
ALTER INDEX idx_checkin_attendees RENAME TO idx_roll_call_attendees;
ALTER INDEX idx_bank_items_checkin RENAME TO idx_bank_items_roll_call;
ALTER INDEX idx_checkin_gold_payouts_user RENAME TO idx_roll_call_gold_payouts_user;

ALTER TABLE bank_contributions DROP CONSTRAINT IF EXISTS bank_contributions_kind_check;
UPDATE bank_contributions SET kind = 'roll_call_loot' WHERE kind = 'checkin_loot';
UPDATE bank_contributions SET kind = 'roll_call_gold_payout' WHERE kind = 'checkin_gold_payout';
UPDATE bank_contributions SET kind = 'roll_call_gold_retracted' WHERE kind = 'checkin_gold_retracted';
UPDATE bank_contributions SET reference_type = 'roll_call_gold_distribution' WHERE reference_type = 'checkin_gold_distribution';
ALTER TABLE bank_contributions
    ADD CONSTRAINT bank_contributions_kind_check
        CHECK (kind IN ('gold', 'roll_call_loot', 'auction_proceeds', 'lottery_revenue',
                        'roll_call_gold_payout', 'roll_call_gold_retracted', 'admin_transfer'));

UPDATE transactions SET type = 'ROLL_CALL_GOLD' WHERE type = 'CHECKIN_GOLD';
UPDATE transactions SET reference_type = 'roll_call' WHERE reference_type = 'checkin';
UPDATE backpack_items SET source = 'roll_call' WHERE source = 'checkin';
UPDATE item_events SET source = 'roll_call' WHERE source = 'checkin';

UPDATE notifications SET type = 'rollCallGoldReceived' WHERE type = 'checkinGoldReceived';
UPDATE notifications SET params = (params - 'checkin') || jsonb_build_object('rollCall', params->'checkin')
WHERE params ? 'checkin';
UPDATE notifications SET params = (params - 'checkinId') || jsonb_build_object('rollCallId', params->'checkinId')
WHERE params ? 'checkinId';
UPDATE notifications SET action_url = '/dashboard/roll-calls' || substr(action_url, length('/dashboard/attendance') + 1)
WHERE action_url = '/dashboard/attendance' OR action_url LIKE '/dashboard/attendance/%' OR action_url LIKE '/dashboard/attendance?%';

CREATE OR REPLACE FUNCTION notification_enabled(p_user_id UUID, p_kind TEXT) RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (SELECT CASE p_kind
                    WHEN 'auction'   THEN auction_alerts
                    WHEN 'lottery'   THEN lottery_alerts
                    WHEN 'event'     THEN event_reminders
                    WHEN 'roll_call' THEN roll_call_reminders
                    ELSE TRUE
                END
         FROM user_preferences
         WHERE user_id = p_user_id),
        TRUE
    );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION log_bank_item_event() RETURNS trigger AS $$
DECLARE
    admin_id UUID := acting_admin_id();
BEGIN
    IF NEW.roll_call_id IS NOT NULL THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'looted', NEW.donor_id, 'roll_call', NEW.roll_call_id);
    ELSIF admin_id IS NOT NULL THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'donated', NEW.donor_id, 'admin', admin_id);
    ELSE
        INSERT INTO item_events (guild_id, item_id, kind, actor_id)
        VALUES (NEW.guild_id, NEW.id, 'donated', NEW.donor_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_loot_assigned() RETURNS trigger AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    roll_call RECORD;
BEGIN
    SELECT id, title INTO roll_call FROM roll_calls WHERE id = NEW.source_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.owner_id,
        'You received roll call loot',
        'You received ' || CASE WHEN item_name = '' THEN 'an item' ELSE item_name END
            || ' from ' || COALESCE(roll_call.title, 'a roll call') || '.',
        'lootAssigned',
        '/dashboard/wallet?source=' || NEW.source_id,
        jsonb_build_object(
            'item', item_name,
            'rollCall', COALESCE(roll_call.title, ''),
            'guildId', NEW.guild_id,
            'rollCallId', NEW.source_id,
            'backpackItemId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS backpack_items_notify_loot_assigned ON backpack_items;
CREATE TRIGGER backpack_items_notify_loot_assigned
    AFTER INSERT ON backpack_items
    FOR EACH ROW
    WHEN (NEW.source = 'roll_call' AND NEW.source_id IS NOT NULL)
    EXECUTE FUNCTION notify_loot_assigned();

DROP TRIGGER IF EXISTS transactions_notify_checkin_gold_received ON transactions;
DROP FUNCTION IF EXISTS notify_checkin_gold_received();

CREATE OR REPLACE FUNCTION notify_roll_call_gold_received() RETURNS trigger AS $$
DECLARE
    roll_call RECORD;
BEGIN
    SELECT id, title INTO roll_call FROM roll_calls WHERE id = NEW.reference_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'You received roll call gold',
        'You received ' || gold_amount(NEW.amount) || ' gold from '
            || COALESCE(roll_call.title, 'a roll call') || '.',
        'rollCallGoldReceived',
        '/dashboard/wallet',
        jsonb_build_object(
            'amount', gold_amount(NEW.amount),
            'rollCall', COALESCE(roll_call.title, ''),
            'guildId', NEW.guild_id,
            'rollCallId', NEW.reference_id,
            'transactionId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_notify_roll_call_gold_received
    AFTER INSERT ON transactions
    FOR EACH ROW
    WHEN (NEW.type = 'ROLL_CALL_GOLD' AND NEW.amount > 0)
    EXECUTE FUNCTION notify_roll_call_gold_received();
