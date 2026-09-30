DROP TRIGGER IF EXISTS raffles_live_event ON raffles;
DROP TRIGGER IF EXISTS raffle_tickets_live_event_insert ON raffle_tickets;
DROP TRIGGER IF EXISTS raffle_tickets_live_event_update ON raffle_tickets;
DROP TRIGGER IF EXISTS raffle_tickets_live_event_delete ON raffle_tickets;
DROP TRIGGER IF EXISTS raffle_winners_live_event_insert ON raffle_winners;
DROP TRIGGER IF EXISTS raffle_winners_live_event_update ON raffle_winners;
DROP TRIGGER IF EXISTS raffle_winners_live_event_delete ON raffle_winners;
DROP TRIGGER IF EXISTS raffle_winners_notify_won ON raffle_winners;
DROP TRIGGER IF EXISTS raffles_notify_cancelled ON raffles;

DROP FUNCTION IF EXISTS notify_raffle_rows_changed();
DROP FUNCTION IF EXISTS notify_raffle_won();
DROP FUNCTION IF EXISTS notify_raffle_cancelled();

UPDATE notifications SET action_url = '/dashboard/lottery' || substr(action_url, length('/dashboard/raffle') + 1)
WHERE action_url = '/dashboard/raffle' OR action_url LIKE '/dashboard/raffle/%' OR action_url LIKE '/dashboard/raffle?%';
UPDATE notifications SET params = (params - 'raffleId') || jsonb_build_object('lotteryId', params->'raffleId')
WHERE params ? 'raffleId';
UPDATE notifications SET params = (params - 'raffle') || jsonb_build_object('lottery', params->'raffle')
WHERE params ? 'raffle';
UPDATE notifications SET title = 'A lottery was cancelled' WHERE title = 'A raffle was cancelled';
UPDATE notifications SET title = 'You won a lottery prize' WHERE title = 'You won a raffle prize';
UPDATE notifications SET type = 'lotteryCancelled' WHERE type = 'raffleCancelled';
UPDATE notifications SET type = 'lotteryWon' WHERE type = 'raffleWon';

UPDATE transactions SET description = 'Lottery cancelled refund' WHERE description = 'Raffle cancelled refund';
UPDATE transactions SET description = 'Lottery prize' WHERE description = 'Raffle prize';
UPDATE transactions SET description = 'Lottery ticket purchase' WHERE description = 'Raffle ticket purchase';
UPDATE transactions SET reference_type = 'lottery' WHERE reference_type = 'raffle';
UPDATE transactions SET type = 'LOTTERY_WIN' WHERE type = 'RAFFLE_WIN';
UPDATE transactions SET type = 'LOTTERY_TICKET' WHERE type = 'RAFFLE_TICKET';

UPDATE backpack_items SET source = 'lottery' WHERE source = 'raffle';

ALTER TABLE item_events DROP CONSTRAINT IF EXISTS item_events_kind_check;
UPDATE item_events SET source = 'lottery' WHERE source = 'raffle';
UPDATE item_events SET kind = 'lottery_listed' WHERE kind = 'raffle_listed';
ALTER TABLE item_events
    ADD CONSTRAINT item_events_kind_check CHECK (kind IN (
        'looted', 'donated', 'requested', 'request_approved', 'request_rejected',
        'received', 'auction_listed', 'lottery_listed', 'returned', 'withdrawn', 'retracted',
        'withdrawal_requested', 'withdrawal_cancelled', 'delivered', 'deleted'
    ));

ALTER TABLE bank_contributions DROP CONSTRAINT IF EXISTS bank_contributions_kind_check;
UPDATE bank_contributions SET reference_type = 'lottery' WHERE reference_type = 'raffle';
UPDATE bank_contributions SET kind = 'lottery_revenue' WHERE kind = 'raffle_revenue';
ALTER TABLE bank_contributions
    ADD CONSTRAINT bank_contributions_kind_check
        CHECK (kind IN ('gold', 'roll_call_loot', 'auction_proceeds', 'lottery_revenue',
                        'roll_call_gold_payout', 'roll_call_gold_retracted', 'admin_transfer'));

ALTER TABLE backpack_items DROP CONSTRAINT IF EXISTS backpack_items_locked_by_type_check;
UPDATE backpack_items SET locked_by_type = 'lottery' WHERE locked_by_type = 'raffle';
ALTER TABLE backpack_items
    ADD CONSTRAINT backpack_items_locked_by_type_check CHECK (locked_by_type IN ('auction', 'lottery'));

ALTER TABLE bank_items DROP CONSTRAINT IF EXISTS bank_items_locked_by_type_check;
UPDATE bank_items SET locked_by_type = 'lottery' WHERE locked_by_type = 'raffle';
ALTER TABLE bank_items
    ADD CONSTRAINT bank_items_locked_by_type_check CHECK (locked_by_type IN ('auction', 'lottery'));

ALTER INDEX idx_raffle_tickets_user RENAME TO idx_lottery_tickets_user;
ALTER INDEX idx_raffles_guild RENAME TO idx_lotteries_guild;

ALTER TABLE raffle_winners RENAME CONSTRAINT raffle_winners_user_id_fkey TO lottery_winners_user_id_fkey;
ALTER TABLE raffle_winners RENAME CONSTRAINT raffle_winners_raffle_id_fkey TO lottery_winners_lottery_id_fkey;
ALTER TABLE raffle_winners RENAME CONSTRAINT raffle_winners_pkey TO lottery_winners_pkey;

ALTER TABLE raffle_tickets RENAME CONSTRAINT raffle_tickets_user_id_fkey TO lottery_tickets_user_id_fkey;
ALTER TABLE raffle_tickets RENAME CONSTRAINT raffle_tickets_raffle_id_fkey TO lottery_tickets_lottery_id_fkey;
ALTER TABLE raffle_tickets RENAME CONSTRAINT raffle_tickets_pkey TO lottery_tickets_pkey;

ALTER TABLE raffles RENAME CONSTRAINT raffles_created_by_fkey TO lotteries_created_by_fkey;
ALTER TABLE raffles RENAME CONSTRAINT raffles_guild_id_fkey TO lotteries_guild_id_fkey;
ALTER TABLE raffles RENAME CONSTRAINT raffles_pkey TO lotteries_pkey;

ALTER TABLE user_preferences RENAME COLUMN raffle_alerts TO lottery_alerts;
ALTER TABLE raffle_winners RENAME COLUMN raffle_id TO lottery_id;
ALTER TABLE raffle_tickets RENAME COLUMN raffle_id TO lottery_id;

ALTER TABLE raffle_winners RENAME TO lottery_winners;
ALTER TABLE raffle_tickets RENAME TO lottery_tickets;
ALTER TABLE raffles RENAME TO lotteries;

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

CREATE OR REPLACE FUNCTION notify_lottery_rows_changed() RETURNS trigger AS $$
DECLARE
    changed RECORD;
BEGIN
    FOR changed IN
        SELECT DISTINCT l.guild_id, l.id
        FROM changed_rows c
        JOIN lotteries l ON l.id = c.lottery_id
    LOOP
        PERFORM notify_live_event('guild', changed.guild_id, changed.guild_id, 'lottery', changed.id::text);
    END LOOP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_lottery_won() RETURNS trigger AS $$
DECLARE
    lottery RECORD;
    prize   TEXT := COALESCE(NULLIF(NEW.prize_description, ''), '');
BEGIN
    SELECT id, guild_id, title INTO lottery FROM lotteries WHERE id = NEW.lottery_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'You won a lottery prize',
        'You placed #' || NEW.rank || ' in ' || lottery.title || ' and won '
            || CASE WHEN prize = '' THEN gold_amount(NEW.prize_amount) || ' gold' ELSE prize END || '.',
        'lotteryWon',
        '/dashboard/lottery/' || NEW.lottery_id,
        jsonb_build_object(
            'lottery', lottery.title,
            'rank', NEW.rank,
            'prize', prize,
            'amount', gold_amount(NEW.prize_amount),
            'prizeType', CASE WHEN prize = '' THEN 'gold' ELSE 'item' END,
            'guildId', lottery.guild_id,
            'lotteryId', NEW.lottery_id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_lottery_cancelled() RETURNS trigger AS $$
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    SELECT t.user_id,
           'A lottery was cancelled',
           NEW.title || ' was cancelled. Your ' || t.tickets
               || CASE WHEN t.tickets = 1 THEN ' ticket was' ELSE ' tickets were' END
               || ' refunded (' || gold_amount(t.tickets * NEW.ticket_price) || ' gold).',
           'lotteryCancelled',
           '/dashboard/lottery/' || NEW.id,
           jsonb_build_object(
               'lottery', NEW.title,
               'tickets', t.tickets,
               'amount', gold_amount(t.tickets * NEW.ticket_price),
               'guildId', NEW.guild_id,
               'lotteryId', NEW.id
           )
    FROM (
        SELECT user_id, COUNT(*)::int AS tickets
        FROM lottery_tickets WHERE lottery_id = NEW.id
        GROUP BY user_id
    ) t
    WHERE notification_enabled(t.user_id, 'lottery');
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER lotteries_live_event
    AFTER INSERT OR UPDATE OR DELETE ON lotteries
    FOR EACH ROW EXECUTE FUNCTION notify_guild_row_changed('lottery');

CREATE TRIGGER lottery_tickets_live_event_insert
    AFTER INSERT ON lottery_tickets
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_lottery_rows_changed();

CREATE TRIGGER lottery_tickets_live_event_update
    AFTER UPDATE ON lottery_tickets
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_lottery_rows_changed();

CREATE TRIGGER lottery_tickets_live_event_delete
    AFTER DELETE ON lottery_tickets
    REFERENCING OLD TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_lottery_rows_changed();

CREATE TRIGGER lottery_winners_live_event_insert
    AFTER INSERT ON lottery_winners
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_lottery_rows_changed();

CREATE TRIGGER lottery_winners_live_event_update
    AFTER UPDATE ON lottery_winners
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_lottery_rows_changed();

CREATE TRIGGER lottery_winners_live_event_delete
    AFTER DELETE ON lottery_winners
    REFERENCING OLD TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_lottery_rows_changed();

CREATE TRIGGER lottery_winners_notify_won
    AFTER INSERT ON lottery_winners
    FOR EACH ROW
    WHEN (notification_enabled(NEW.user_id, 'lottery'))
    EXECUTE FUNCTION notify_lottery_won();

CREATE TRIGGER lotteries_notify_cancelled
    AFTER UPDATE OF status ON lotteries
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled')
    EXECUTE FUNCTION notify_lottery_cancelled();
