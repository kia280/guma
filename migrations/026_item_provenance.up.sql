CREATE TABLE IF NOT EXISTS item_events (
    seq          BIGSERIAL   PRIMARY KEY,
    guild_id     UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    item_id      UUID        NOT NULL,
    kind         TEXT        NOT NULL CHECK (kind IN (
        'looted', 'donated', 'requested', 'request_approved', 'request_rejected',
        'received', 'auction_listed', 'lottery_listed', 'returned', 'withdrawn', 'retracted'
    )),
    actor_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    subject_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
    source       TEXT        NOT NULL DEFAULT '',
    reference_id UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_item_events_item ON item_events(guild_id, item_id, seq);
CREATE INDEX IF NOT EXISTS idx_item_events_reference ON item_events(reference_id) WHERE kind = 'requested';

INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id, created_at)
SELECT guild_id, id,
       CASE WHEN checkin_id IS NULL THEN 'donated' ELSE 'looted' END,
       donor_id,
       CASE WHEN checkin_id IS NULL THEN '' ELSE 'checkin' END,
       checkin_id, donated_at
FROM bank_items
ORDER BY donated_at;

INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id, created_at)
SELECT guild_id, id, 'received', owner_id, source, source_id, acquired_at
FROM backpack_items
ORDER BY acquired_at;

INSERT INTO item_events (guild_id, item_id, kind, source, reference_id, created_at)
SELECT guild_id, id, locked_by_type || '_listed', locked_by_type, locked_by_id, COALESCE(locked_at, NOW())
FROM (
    SELECT guild_id, id, locked_by_type, locked_by_id, locked_at FROM bank_items WHERE locked_by_type IS NOT NULL
    UNION ALL
    SELECT guild_id, id, locked_by_type, locked_by_id, locked_at FROM backpack_items WHERE locked_by_type IS NOT NULL
) locked
ORDER BY locked_at;

CREATE OR REPLACE FUNCTION log_bank_item_event() RETURNS trigger AS $$
BEGIN
    IF NEW.checkin_id IS NOT NULL THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'looted', NEW.donor_id, 'checkin', NEW.checkin_id);
    ELSE
        INSERT INTO item_events (guild_id, item_id, kind, actor_id)
        VALUES (NEW.guild_id, NEW.id, 'donated', NEW.donor_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER bank_items_log_event
    AFTER INSERT ON bank_items
    FOR EACH ROW EXECUTE FUNCTION log_bank_item_event();

CREATE OR REPLACE FUNCTION log_backpack_item_event() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, subject_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'received', NEW.owner_id, OLD.owner_id, 'transfer', OLD.owner_id);
    ELSE
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'received', NEW.owner_id, NEW.source, NEW.source_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER backpack_items_log_insert_event
    AFTER INSERT ON backpack_items
    FOR EACH ROW EXECUTE FUNCTION log_backpack_item_event();

CREATE TRIGGER backpack_items_log_transfer_event
    AFTER UPDATE OF owner_id ON backpack_items
    FOR EACH ROW
    WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
    EXECUTE FUNCTION log_backpack_item_event();

CREATE OR REPLACE FUNCTION log_item_request_event() RETURNS trigger AS $$
DECLARE
    target UUID := NEW.bank_item_id;
BEGIN
    IF target IS NULL THEN
        SELECT item_id INTO target FROM item_events
        WHERE reference_id = NEW.id AND kind = 'requested'
        ORDER BY seq
        LIMIT 1;
    END IF;
    IF target IS NULL THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, reference_id)
        VALUES (NEW.guild_id, target, 'requested', NEW.requester_id, NEW.id);
    ELSIF NEW.status IN ('approved', 'rejected') THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, subject_id, reference_id)
        VALUES (NEW.guild_id, target, 'request_' || NEW.status, NEW.reviewer_id, NEW.requester_id, NEW.id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_requests_log_insert_event
    AFTER INSERT ON item_requests
    FOR EACH ROW EXECUTE FUNCTION log_item_request_event();

CREATE TRIGGER item_requests_log_review_event
    AFTER UPDATE OF status ON item_requests
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_item_request_event();
