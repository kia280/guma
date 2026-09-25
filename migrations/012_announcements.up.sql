CREATE TABLE IF NOT EXISTS announcements (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id     UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    author_id    UUID        NOT NULL REFERENCES users(id),
    title        TEXT        NOT NULL DEFAULT '',
    content      TEXT        NOT NULL DEFAULT '',
    pinned       BOOLEAN     NOT NULL DEFAULT FALSE,
    status       TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK ((status = 'published') = (published_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_announcements_guild_published
    ON announcements(guild_id, pinned DESC, published_at DESC)
    WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_announcements_guild_updated
    ON announcements(guild_id, updated_at DESC);

CREATE OR REPLACE FUNCTION notify_published_announcement_changed() RETURNS trigger AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'published' THEN
        PERFORM notify_live_event('guild', OLD.guild_id, OLD.guild_id, 'announcement', OLD.id::text);
    ELSIF TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'published' THEN
        PERFORM notify_live_event('guild', NEW.guild_id, NEW.guild_id, 'announcement', NEW.id::text);
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER announcements_live_event_published
    AFTER INSERT OR UPDATE OR DELETE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION notify_published_announcement_changed();
