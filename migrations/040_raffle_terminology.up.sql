ALTER TABLE lotteries RENAME TO raffles;
ALTER TABLE lottery_tickets RENAME TO raffle_tickets;
ALTER TABLE lottery_winners RENAME TO raffle_winners;

ALTER TABLE raffle_tickets RENAME COLUMN lottery_id TO raffle_id;
ALTER TABLE raffle_winners RENAME COLUMN lottery_id TO raffle_id;
ALTER TABLE user_preferences RENAME COLUMN lottery_alerts TO raffle_alerts;

ALTER TABLE raffles RENAME CONSTRAINT lotteries_pkey TO raffles_pkey;
ALTER TABLE raffles RENAME CONSTRAINT lotteries_guild_id_fkey TO raffles_guild_id_fkey;
ALTER TABLE raffles RENAME CONSTRAINT lotteries_created_by_fkey TO raffles_created_by_fkey;

ALTER TABLE raffle_tickets RENAME CONSTRAINT lottery_tickets_pkey TO raffle_tickets_pkey;
ALTER TABLE raffle_tickets RENAME CONSTRAINT lottery_tickets_lottery_id_fkey TO raffle_tickets_raffle_id_fkey;
ALTER TABLE raffle_tickets RENAME CONSTRAINT lottery_tickets_user_id_fkey TO raffle_tickets_user_id_fkey;

ALTER TABLE raffle_winners RENAME CONSTRAINT lottery_winners_pkey TO raffle_winners_pkey;
ALTER TABLE raffle_winners RENAME CONSTRAINT lottery_winners_lottery_id_fkey TO raffle_winners_raffle_id_fkey;
ALTER TABLE raffle_winners RENAME CONSTRAINT lottery_winners_user_id_fkey TO raffle_winners_user_id_fkey;

ALTER INDEX idx_lotteries_guild RENAME TO idx_raffles_guild;
ALTER INDEX idx_lottery_tickets_user RENAME TO idx_raffle_tickets_user;

ALTER TABLE bank_items DROP CONSTRAINT IF EXISTS bank_items_locked_by_type_check;
UPDATE bank_items SET locked_by_type = 'raffle' WHERE locked_by_type = 'lottery';
ALTER TABLE bank_items
    ADD CONSTRAINT bank_items_locked_by_type_check CHECK (locked_by_type IN ('auction', 'raffle'));

ALTER TABLE backpack_items DROP CONSTRAINT IF EXISTS backpack_items_locked_by_type_check;
UPDATE backpack_items SET locked_by_type = 'raffle' WHERE locked_by_type = 'lottery';
ALTER TABLE backpack_items
    ADD CONSTRAINT backpack_items_locked_by_type_check CHECK (locked_by_type IN ('auction', 'raffle'));

ALTER TABLE bank_contributions DROP CONSTRAINT IF EXISTS bank_contributions_kind_check;
UPDATE bank_contributions SET kind = 'raffle_revenue' WHERE kind = 'lottery_revenue';
UPDATE bank_contributions SET reference_type = 'raffle' WHERE reference_type = 'lottery';
ALTER TABLE bank_contributions
    ADD CONSTRAINT bank_contributions_kind_check
        CHECK (kind IN ('gold', 'roll_call_loot', 'auction_proceeds', 'raffle_revenue',
                        'roll_call_gold_payout', 'roll_call_gold_retracted', 'admin_transfer'));

ALTER TABLE item_events DROP CONSTRAINT IF EXISTS item_events_kind_check;
UPDATE item_events SET kind = 'raffle_listed' WHERE kind = 'lottery_listed';
UPDATE item_events SET source = 'raffle' WHERE source = 'lottery';
ALTER TABLE item_events
    ADD CONSTRAINT item_events_kind_check CHECK (kind IN (
        'looted', 'donated', 'requested', 'request_approved', 'request_rejected',
        'received', 'auction_listed', 'raffle_listed', 'returned', 'withdrawn', 'retracted',
        'withdrawal_requested', 'withdrawal_cancelled', 'delivered', 'deleted'
    ));

UPDATE backpack_items SET source = 'raffle' WHERE source = 'lottery';

UPDATE transactions SET type = 'RAFFLE_TICKET' WHERE type = 'LOTTERY_TICKET';
UPDATE transactions SET type = 'RAFFLE_WIN' WHERE type = 'LOTTERY_WIN';
UPDATE transactions SET reference_type = 'raffle' WHERE reference_type = 'lottery';
UPDATE transactions SET description = 'Raffle ticket purchase' WHERE description = 'Lottery ticket purchase';
UPDATE transactions SET description = 'Raffle prize' WHERE description = 'Lottery prize';
UPDATE transactions SET description = 'Raffle cancelled refund' WHERE description = 'Lottery cancelled refund';

UPDATE notifications SET type = 'raffleWon' WHERE type = 'lotteryWon';
UPDATE notifications SET type = 'raffleCancelled' WHERE type = 'lotteryCancelled';
UPDATE notifications SET title = 'You won a raffle prize' WHERE title = 'You won a lottery prize';
UPDATE notifications SET title = 'A raffle was cancelled' WHERE title = 'A lottery was cancelled';
UPDATE notifications SET params = (params - 'lottery') || jsonb_build_object('raffle', params->'lottery')
WHERE params ? 'lottery';
UPDATE notifications SET params = (params - 'lotteryId') || jsonb_build_object('raffleId', params->'lotteryId')
WHERE params ? 'lotteryId';
UPDATE notifications SET action_url = '/dashboard/raffle' || substr(action_url, length('/dashboard/lottery') + 1)
WHERE action_url = '/dashboard/lottery' OR action_url LIKE '/dashboard/lottery/%' OR action_url LIKE '/dashboard/lottery?%';

CREATE OR REPLACE FUNCTION notification_enabled(p_user_id UUID, p_kind TEXT) RETURNS BOOLEAN AS $$
    SELECT COALESCE(
        (SELECT CASE p_kind
                    WHEN 'auction'   THEN auction_alerts
                    WHEN 'raffle'    THEN raffle_alerts
                    WHEN 'event'     THEN event_reminders
                    WHEN 'roll_call' THEN roll_call_reminders
                    ELSE TRUE
                END
         FROM user_preferences
         WHERE user_id = p_user_id),
        TRUE
    );
$$ LANGUAGE sql STABLE;

DROP TRIGGER IF EXISTS lotteries_live_event ON raffles;
DROP TRIGGER IF EXISTS lottery_tickets_live_event_insert ON raffle_tickets;
DROP TRIGGER IF EXISTS lottery_tickets_live_event_update ON raffle_tickets;
DROP TRIGGER IF EXISTS lottery_tickets_live_event_delete ON raffle_tickets;
DROP TRIGGER IF EXISTS lottery_winners_live_event_insert ON raffle_winners;
DROP TRIGGER IF EXISTS lottery_winners_live_event_update ON raffle_winners;
DROP TRIGGER IF EXISTS lottery_winners_live_event_delete ON raffle_winners;
DROP TRIGGER IF EXISTS lottery_winners_notify_won ON raffle_winners;
DROP TRIGGER IF EXISTS lotteries_notify_cancelled ON raffles;

DROP FUNCTION IF EXISTS notify_lottery_rows_changed();
DROP FUNCTION IF EXISTS notify_lottery_won();
DROP FUNCTION IF EXISTS notify_lottery_cancelled();

CREATE OR REPLACE FUNCTION notify_raffle_rows_changed() RETURNS trigger AS $$
DECLARE
    changed RECORD;
BEGIN
    FOR changed IN
        SELECT DISTINCT r.guild_id, r.id
        FROM changed_rows c
        JOIN raffles r ON r.id = c.raffle_id
    LOOP
        PERFORM notify_live_event('guild', changed.guild_id, changed.guild_id, 'raffle', changed.id::text);
    END LOOP;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_raffle_won() RETURNS trigger AS $$
DECLARE
    raffle RECORD;
    prize  TEXT := COALESCE(NULLIF(NEW.prize_description, ''), '');
BEGIN
    SELECT id, guild_id, title INTO raffle FROM raffles WHERE id = NEW.raffle_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'You won a raffle prize',
        'You placed #' || NEW.rank || ' in ' || raffle.title || ' and won '
            || CASE WHEN prize = '' THEN gold_amount(NEW.prize_amount) || ' gold' ELSE prize END || '.',
        'raffleWon',
        '/dashboard/raffle/' || NEW.raffle_id,
        jsonb_build_object(
            'raffle', raffle.title,
            'rank', NEW.rank,
            'prize', prize,
            'amount', gold_amount(NEW.prize_amount),
            'prizeType', CASE WHEN prize = '' THEN 'gold' ELSE 'item' END,
            'guildId', raffle.guild_id,
            'raffleId', NEW.raffle_id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_raffle_cancelled() RETURNS trigger AS $$
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    SELECT t.user_id,
           'A raffle was cancelled',
           NEW.title || ' was cancelled. Your ' || t.tickets
               || CASE WHEN t.tickets = 1 THEN ' ticket was' ELSE ' tickets were' END
               || ' refunded (' || gold_amount(t.tickets * NEW.ticket_price) || ' gold).',
           'raffleCancelled',
           '/dashboard/raffle/' || NEW.id,
           jsonb_build_object(
               'raffle', NEW.title,
               'tickets', t.tickets,
               'amount', gold_amount(t.tickets * NEW.ticket_price),
               'guildId', NEW.guild_id,
               'raffleId', NEW.id
           )
    FROM (
        SELECT user_id, COUNT(*)::int AS tickets
        FROM raffle_tickets WHERE raffle_id = NEW.id
        GROUP BY user_id
    ) t
    WHERE notification_enabled(t.user_id, 'raffle');
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER raffles_live_event
    AFTER INSERT OR UPDATE OR DELETE ON raffles
    FOR EACH ROW EXECUTE FUNCTION notify_guild_row_changed('raffle');

CREATE TRIGGER raffle_tickets_live_event_insert
    AFTER INSERT ON raffle_tickets
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_tickets_live_event_update
    AFTER UPDATE ON raffle_tickets
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_tickets_live_event_delete
    AFTER DELETE ON raffle_tickets
    REFERENCING OLD TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_winners_live_event_insert
    AFTER INSERT ON raffle_winners
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_winners_live_event_update
    AFTER UPDATE ON raffle_winners
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_winners_live_event_delete
    AFTER DELETE ON raffle_winners
    REFERENCING OLD TABLE AS changed_rows
    FOR EACH STATEMENT EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_winners_notify_won
    AFTER INSERT ON raffle_winners
    FOR EACH ROW
    WHEN (notification_enabled(NEW.user_id, 'raffle'))
    EXECUTE FUNCTION notify_raffle_won();

CREATE TRIGGER raffles_notify_cancelled
    AFTER UPDATE OF status ON raffles
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled')
    EXECUTE FUNCTION notify_raffle_cancelled();
