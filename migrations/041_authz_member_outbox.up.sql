CREATE TABLE IF NOT EXISTS authz_member_outbox (
    id           BIGSERIAL   PRIMARY KEY,
    guild_id     UUID        NOT NULL,
    user_id      UUID        NOT NULL,
    attempts     INT         NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_authz_member_outbox_available ON authz_member_outbox(available_at, id);
CREATE INDEX IF NOT EXISTS idx_authz_member_outbox_member    ON authz_member_outbox(guild_id, user_id);

CREATE OR REPLACE FUNCTION enqueue_authz_member_sync() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE'
        AND NEW.role IS NOT DISTINCT FROM OLD.role
        AND NEW.guild_id = OLD.guild_id
        AND NEW.user_id = OLD.user_id THEN
        RETURN NEW;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        INSERT INTO authz_member_outbox (guild_id, user_id) VALUES (OLD.guild_id, OLD.user_id);
    END IF;
    IF TG_OP = 'INSERT'
        OR (TG_OP = 'UPDATE' AND (NEW.guild_id <> OLD.guild_id OR NEW.user_id <> OLD.user_id)) THEN
        INSERT INTO authz_member_outbox (guild_id, user_id) VALUES (NEW.guild_id, NEW.user_id);
    END IF;

    PERFORM pg_notify('authz_member_changed', '');
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER members_enqueue_authz_sync
    AFTER INSERT OR DELETE OR UPDATE OF role, guild_id, user_id ON members
    FOR EACH ROW
    EXECUTE FUNCTION enqueue_authz_member_sync();

INSERT INTO authz_member_outbox (guild_id, user_id)
SELECT guild_id, user_id FROM members;
