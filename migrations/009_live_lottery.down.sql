DROP TRIGGER IF EXISTS lottery_winners_live_event_delete ON lottery_winners;
DROP TRIGGER IF EXISTS lottery_winners_live_event_update ON lottery_winners;
DROP TRIGGER IF EXISTS lottery_winners_live_event_insert ON lottery_winners;
DROP TRIGGER IF EXISTS lottery_tickets_live_event_delete ON lottery_tickets;
DROP TRIGGER IF EXISTS lottery_tickets_live_event_update ON lottery_tickets;
DROP TRIGGER IF EXISTS lottery_tickets_live_event_insert ON lottery_tickets;
DROP FUNCTION IF EXISTS notify_lottery_rows_changed();
DROP TRIGGER IF EXISTS lotteries_live_event ON lotteries;
