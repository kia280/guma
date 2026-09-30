DELETE FROM item_events WHERE kind = 'deleted';
ALTER TABLE item_events DROP CONSTRAINT IF EXISTS item_events_kind_check;
ALTER TABLE item_events
    ADD CONSTRAINT item_events_kind_check CHECK (kind IN (
        'looted', 'donated', 'requested', 'request_approved', 'request_rejected',
        'received', 'auction_listed', 'lottery_listed', 'returned', 'withdrawn', 'retracted',
        'withdrawal_requested', 'withdrawal_cancelled', 'delivered'
    ));
