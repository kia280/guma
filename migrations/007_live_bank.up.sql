CREATE TRIGGER guild_bank_notify_live
AFTER INSERT OR UPDATE OR DELETE ON guild_bank
FOR EACH ROW EXECUTE FUNCTION notify_guild_row_changed('bank');

CREATE TRIGGER bank_items_notify_live
AFTER INSERT OR UPDATE OR DELETE ON bank_items
FOR EACH ROW EXECUTE FUNCTION notify_guild_row_changed('bank');

CREATE TRIGGER bank_contributions_notify_live
AFTER INSERT OR UPDATE OR DELETE ON bank_contributions
FOR EACH ROW EXECUTE FUNCTION notify_guild_row_changed('bank');

CREATE TRIGGER fund_requests_notify_live
AFTER INSERT OR UPDATE OR DELETE ON fund_requests
FOR EACH ROW EXECUTE FUNCTION notify_guild_row_changed('bank');

CREATE TRIGGER item_requests_notify_live
AFTER INSERT OR UPDATE OR DELETE ON item_requests
FOR EACH ROW EXECUTE FUNCTION notify_guild_row_changed('bank');
