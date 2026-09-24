CREATE OR REPLACE FUNCTION notify_bid_changed() RETURNS trigger AS $$
DECLARE
    changed_auction_id UUID;
    auction_guild_id   UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        changed_auction_id := OLD.auction_id;
    ELSE
        changed_auction_id := NEW.auction_id;
    END IF;

    SELECT guild_id INTO auction_guild_id FROM auctions WHERE id = changed_auction_id;
    IF auction_guild_id IS NULL THEN
        RETURN NULL;
    END IF;

    PERFORM notify_live_event('guild', auction_guild_id, auction_guild_id, 'auction', changed_auction_id::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auctions_notify_live_event
    AFTER INSERT OR UPDATE OR DELETE ON auctions
    FOR EACH ROW
    EXECUTE FUNCTION notify_guild_row_changed('auction');

CREATE TRIGGER bids_notify_live_event
    AFTER INSERT OR UPDATE OR DELETE ON bids
    FOR EACH ROW
    EXECUTE FUNCTION notify_bid_changed();
