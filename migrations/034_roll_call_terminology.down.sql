DROP TRIGGER IF EXISTS transactions_notify_roll_call_gold_received ON transactions;
DROP FUNCTION IF EXISTS notify_roll_call_gold_received();

UPDATE transactions SET type = 'CHECKIN_GOLD' WHERE type = 'ROLL_CALL_GOLD';
UPDATE transactions SET reference_type = 'checkin' WHERE reference_type = 'roll_call';
UPDATE backpack_items SET source = 'checkin' WHERE source = 'roll_call';
UPDATE item_events SET source = 'checkin' WHERE source = 'roll_call';

UPDATE notifications SET type = 'checkinGoldReceived' WHERE type = 'rollCallGoldReceived';
UPDATE notifications SET params = (params - 'rollCall') || jsonb_build_object('checkin', params->'rollCall')
WHERE params ? 'rollCall';
UPDATE notifications SET params = (params - 'rollCallId') || jsonb_build_object('checkinId', params->'rollCallId')
WHERE params ? 'rollCallId';
UPDATE notifications SET action_url = '/dashboard/attendance' || substr(action_url, length('/dashboard/roll-calls') + 1)
WHERE action_url = '/dashboard/roll-calls' OR action_url LIKE '/dashboard/roll-calls/%' OR action_url LIKE '/dashboard/roll-calls?%';

ALTER TABLE bank_contributions DROP CONSTRAINT IF EXISTS bank_contributions_kind_check;
UPDATE bank_contributions SET kind = 'checkin_loot' WHERE kind = 'roll_call_loot';
UPDATE bank_contributions SET kind = 'checkin_gold_payout' WHERE kind = 'roll_call_gold_payout';
UPDATE bank_contributions SET kind = 'checkin_gold_retracted' WHERE kind = 'roll_call_gold_retracted';
UPDATE bank_contributions SET reference_type = 'checkin_gold_distribution' WHERE reference_type = 'roll_call_gold_distribution';
ALTER TABLE bank_contributions
    ADD CONSTRAINT bank_contributions_kind_check
        CHECK (kind IN ('gold', 'checkin_loot', 'auction_proceeds', 'lottery_revenue',
                        'checkin_gold_payout', 'checkin_gold_retracted', 'admin_transfer'));

ALTER INDEX idx_roll_call_gold_payouts_user RENAME TO idx_checkin_gold_payouts_user;
ALTER INDEX idx_bank_items_roll_call RENAME TO idx_bank_items_checkin;
ALTER INDEX idx_roll_call_attendees RENAME TO idx_checkin_attendees;
ALTER INDEX idx_roll_calls_guild RENAME TO idx_checkins_guild;

ALTER TABLE bank_contributions RENAME CONSTRAINT bank_contributions_roll_call_id_fkey TO bank_contributions_checkin_id_fkey;
ALTER TABLE bank_items RENAME CONSTRAINT bank_items_roll_call_id_fkey TO bank_items_checkin_id_fkey;
ALTER TABLE roll_call_gold_payouts RENAME CONSTRAINT roll_call_gold_payouts_amount_check TO checkin_gold_payouts_amount_check;
ALTER TABLE roll_call_gold_payouts RENAME CONSTRAINT roll_call_gold_payouts_transaction_id_fkey TO checkin_gold_payouts_transaction_id_fkey;
ALTER TABLE roll_call_gold_payouts RENAME CONSTRAINT roll_call_gold_payouts_user_id_fkey TO checkin_gold_payouts_user_id_fkey;
ALTER TABLE roll_call_gold_payouts RENAME CONSTRAINT roll_call_gold_payouts_distribution_id_fkey TO checkin_gold_payouts_distribution_id_fkey;
ALTER TABLE roll_call_gold_payouts RENAME CONSTRAINT roll_call_gold_payouts_pkey TO checkin_gold_payouts_pkey;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT roll_call_gold_distributions_total_check TO checkin_gold_distributions_total_check;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT roll_call_gold_distributions_actor_id_fkey TO checkin_gold_distributions_actor_id_fkey;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT roll_call_gold_distributions_guild_id_fkey TO checkin_gold_distributions_guild_id_fkey;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT roll_call_gold_distributions_roll_call_id_fkey TO checkin_gold_distributions_checkin_id_fkey;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT roll_call_gold_distributions_request_key TO checkin_gold_distributions_request_key;
ALTER TABLE roll_call_gold_distributions RENAME CONSTRAINT roll_call_gold_distributions_pkey TO checkin_gold_distributions_pkey;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT roll_call_gold_pots_balance_check TO checkin_gold_pots_balance_check;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT roll_call_gold_pots_retracted_check TO checkin_gold_pots_retracted_check;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT roll_call_gold_pots_distributed_check TO checkin_gold_pots_distributed_check;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT roll_call_gold_pots_total_check TO checkin_gold_pots_total_check;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT roll_call_gold_pots_guild_id_fkey TO checkin_gold_pots_guild_id_fkey;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT roll_call_gold_pots_roll_call_id_fkey TO checkin_gold_pots_checkin_id_fkey;
ALTER TABLE roll_call_gold_pots RENAME CONSTRAINT roll_call_gold_pots_pkey TO checkin_gold_pots_pkey;
ALTER TABLE roll_call_templates RENAME CONSTRAINT roll_call_templates_created_by_fkey TO checkin_templates_created_by_fkey;
ALTER TABLE roll_call_templates RENAME CONSTRAINT roll_call_templates_guild_id_fkey TO checkin_templates_guild_id_fkey;
ALTER TABLE roll_call_templates RENAME CONSTRAINT roll_call_templates_guild_name_key TO checkin_templates_guild_name_key;
ALTER TABLE roll_call_templates RENAME CONSTRAINT roll_call_templates_pkey TO checkin_templates_pkey;
ALTER TABLE roll_call_attendees RENAME CONSTRAINT roll_call_attendees_notes_check TO checkin_attendees_notes_check;
ALTER TABLE roll_call_attendees RENAME CONSTRAINT roll_call_attendees_user_id_fkey TO checkin_attendees_user_id_fkey;
ALTER TABLE roll_call_attendees RENAME CONSTRAINT roll_call_attendees_roll_call_id_fkey TO checkin_attendees_checkin_id_fkey;
ALTER TABLE roll_call_attendees RENAME CONSTRAINT roll_call_attendees_roll_call_id_user_id_key TO checkin_attendees_checkin_id_user_id_key;
ALTER TABLE roll_call_attendees RENAME CONSTRAINT roll_call_attendees_pkey TO checkin_attendees_pkey;
ALTER TABLE roll_calls RENAME CONSTRAINT roll_calls_completed_by_fkey TO checkins_completed_by_fkey;
ALTER TABLE roll_calls RENAME CONSTRAINT roll_calls_created_by_fkey TO checkins_created_by_fkey;
ALTER TABLE roll_calls RENAME CONSTRAINT roll_calls_guild_id_fkey TO checkins_guild_id_fkey;
ALTER TABLE roll_calls RENAME CONSTRAINT roll_calls_pkey TO checkins_pkey;

ALTER TABLE user_preferences RENAME COLUMN roll_call_reminders TO checkin_reminders;
ALTER TABLE bank_contributions RENAME COLUMN roll_call_id TO checkin_id;
ALTER TABLE bank_items RENAME COLUMN roll_call_id TO checkin_id;
ALTER TABLE roll_call_gold_distributions RENAME COLUMN roll_call_id TO checkin_id;
ALTER TABLE roll_call_gold_pots RENAME COLUMN roll_call_id TO checkin_id;
ALTER TABLE roll_call_attendees RENAME COLUMN checked_in_at TO attended_at;
ALTER TABLE roll_call_attendees RENAME COLUMN roll_call_id TO checkin_id;

ALTER TABLE roll_call_gold_payouts RENAME TO checkin_gold_payouts;
ALTER TABLE roll_call_gold_distributions RENAME TO checkin_gold_distributions;
ALTER TABLE roll_call_gold_pots RENAME TO checkin_gold_pots;
ALTER TABLE roll_call_templates RENAME TO checkin_templates;
ALTER TABLE roll_call_attendees RENAME TO checkin_attendees;
ALTER TABLE roll_calls RENAME TO checkins;

CREATE OR REPLACE FUNCTION notification_enabled(p_user_id UUID, p_kind TEXT) RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (SELECT CASE p_kind
                    WHEN 'auction' THEN auction_alerts
                    WHEN 'lottery' THEN lottery_alerts
                    WHEN 'event'   THEN event_reminders
                    WHEN 'checkin' THEN checkin_reminders
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
    IF NEW.checkin_id IS NOT NULL THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'looted', NEW.donor_id, 'checkin', NEW.checkin_id);
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
    checkin   RECORD;
BEGIN
    SELECT id, title INTO checkin FROM checkins WHERE id = NEW.source_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.owner_id,
        'You received roll call loot',
        'You received ' || CASE WHEN item_name = '' THEN 'an item' ELSE item_name END
            || ' from ' || COALESCE(checkin.title, 'a roll call') || '.',
        'lootAssigned',
        '/dashboard/wallet?source=' || NEW.source_id,
        jsonb_build_object(
            'item', item_name,
            'checkin', COALESCE(checkin.title, ''),
            'guildId', NEW.guild_id,
            'checkinId', NEW.source_id,
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
    WHEN (NEW.source = 'checkin' AND NEW.source_id IS NOT NULL)
    EXECUTE FUNCTION notify_loot_assigned();

CREATE OR REPLACE FUNCTION notify_checkin_gold_received() RETURNS trigger AS $$
DECLARE
    checkin RECORD;
BEGIN
    SELECT id, title INTO checkin FROM checkins WHERE id = NEW.reference_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'You received roll call gold',
        'You received ' || gold_amount(NEW.amount) || ' gold from '
            || COALESCE(checkin.title, 'a roll call') || '.',
        'checkinGoldReceived',
        '/dashboard/wallet',
        jsonb_build_object(
            'amount', gold_amount(NEW.amount),
            'checkin', COALESCE(checkin.title, ''),
            'guildId', NEW.guild_id,
            'checkinId', NEW.reference_id,
            'transactionId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_notify_checkin_gold_received
    AFTER INSERT ON transactions
    FOR EACH ROW
    WHEN (NEW.type = 'CHECKIN_GOLD' AND NEW.amount > 0)
    EXECUTE FUNCTION notify_checkin_gold_received();
