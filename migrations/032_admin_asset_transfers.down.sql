DROP TRIGGER IF EXISTS backpack_items_notify_received ON backpack_items;
CREATE TRIGGER backpack_items_notify_received
    AFTER UPDATE OF owner_id ON backpack_items
    FOR EACH ROW
    WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id AND NEW.source = 'transfer')
    EXECUTE FUNCTION notify_backpack_item_received();

CREATE OR REPLACE FUNCTION notify_backpack_item_received() RETURNS trigger AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    sender    TEXT := COALESCE(member_display_name(NEW.guild_id, OLD.owner_id), '');
    note      TEXT := COALESCE(NEW.note, '');
BEGIN
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

DROP FUNCTION IF EXISTS acting_admin_id();

UPDATE bank_contributions SET kind = 'gold' WHERE kind = 'admin_transfer';
ALTER TABLE bank_contributions DROP CONSTRAINT IF EXISTS bank_contributions_kind_check;
ALTER TABLE bank_contributions
    ADD CONSTRAINT bank_contributions_kind_check
        CHECK (kind IN ('gold', 'checkin_loot', 'auction_proceeds', 'lottery_revenue',
                        'checkin_gold_payout', 'checkin_gold_retracted'));

ALTER TABLE transactions
    DROP COLUMN IF EXISTS counterparty_id,
    DROP COLUMN IF EXISTS actor_id;
