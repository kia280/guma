ALTER TABLE announcements ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

UPDATE announcements
SET pinned_at = COALESCE(published_at, updated_at)
WHERE pinned AND pinned_at IS NULL;

ALTER TABLE announcements
    ADD CONSTRAINT announcements_pinned_at_matches_pinned CHECK (pinned = (pinned_at IS NOT NULL));

DROP INDEX IF EXISTS idx_announcements_guild_published;
CREATE INDEX IF NOT EXISTS idx_announcements_guild_published
    ON announcements(guild_id, pinned_at DESC NULLS LAST, published_at DESC)
    WHERE status = 'published';
