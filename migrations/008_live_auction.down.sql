DROP TRIGGER IF EXISTS bids_notify_live_event ON bids;
DROP TRIGGER IF EXISTS auctions_notify_live_event ON auctions;
DROP FUNCTION IF EXISTS notify_bid_changed();
