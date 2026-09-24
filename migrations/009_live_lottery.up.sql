CREATE TRIGGER lotteries_live_event
    AFTER INSERT OR UPDATE OR DELETE ON lotteries
    FOR EACH ROW EXECUTE FUNCTION notify_guild_row_changed('lottery');

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
