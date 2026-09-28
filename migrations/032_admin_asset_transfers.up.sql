ALTER TABLE transactions
    ADD COLUMN IF NOT EXISTS actor_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS counterparty_id UUID REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE bank_contributions DROP CONSTRAINT IF EXISTS bank_contributions_kind_check;
ALTER TABLE bank_contributions
    ADD CONSTRAINT bank_contributions_kind_check
        CHECK (kind IN ('gold', 'checkin_loot', 'auction_proceeds', 'lottery_revenue',
                        'checkin_gold_payout', 'checkin_gold_retracted', 'admin_transfer'));

CREATE OR REPLACE FUNCTION acting_admin_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('guma.acting_admin_id', true), '')::uuid;
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

CREATE OR REPLACE FUNCTION log_backpack_item_event() RETURNS trigger AS $$
DECLARE
    admin_id UUID := acting_admin_id();
BEGIN
    IF TG_OP = 'UPDATE' AND admin_id IS NOT NULL THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, subject_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'received', NEW.owner_id, OLD.owner_id, 'admin', admin_id);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, subject_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'received', NEW.owner_id, OLD.owner_id, 'transfer', OLD.owner_id);
    ELSE
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'received', NEW.owner_id, NEW.source, NEW.source_id);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_backpack_item_received() RETURNS trigger AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    sender    TEXT := COALESCE(member_display_name(NEW.guild_id, OLD.owner_id), '');
    admin_id  UUID := acting_admin_id();
    admin     TEXT := COALESCE(member_display_name(NEW.guild_id, admin_id), '');
    note      TEXT := COALESCE(NEW.note, '');
BEGIN
    IF NEW.source = 'admin' THEN
        INSERT INTO notifications (user_id, title, message, type, action_url, params)
        VALUES (
            NEW.owner_id,
            'An admin moved an item to you',
            CASE WHEN admin = '' THEN 'An admin' ELSE admin END
                || ' moved ' || CASE WHEN item_name = '' THEN 'an item' ELSE item_name END
                || ' from ' || CASE WHEN sender = '' THEN 'a guild member' ELSE sender END
                || ' to your backpack.'
                || CASE WHEN note = '' THEN '' ELSE ' Note: ' || note END,
            'itemMovedByAdmin',
            '/dashboard/wallet',
            jsonb_build_object(
                'actor', admin,
                'from', sender,
                'item', item_name,
                'note', note,
                'guildId', NEW.guild_id,
                'backpackItemId', NEW.id
            )
        );
        RETURN NULL;
    END IF;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.owner_id,
        'You received an item',
        CASE WHEN sender = '' THEN 'A guild member' ELSE sender END
            || ' sent you ' || CASE WHEN item_name = '' THEN 'an item' ELSE item_name END || '.'
            || CASE WHEN note = '' THEN '' ELSE ' Note: ' || note END,
        'itemReceived',
        '/dashboard/wallet',
        jsonb_build_object(
            'actor', sender,
            'item', item_name,
            'note', note,
            'guildId', NEW.guild_id,
            'backpackItemId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS backpack_items_notify_received ON backpack_items;
CREATE TRIGGER backpack_items_notify_received
    AFTER UPDATE OF owner_id ON backpack_items
    FOR EACH ROW
    WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id AND NEW.source IN ('transfer', 'admin'))
    EXECUTE FUNCTION notify_backpack_item_received();
