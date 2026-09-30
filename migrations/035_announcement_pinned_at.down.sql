DROP INDEX IF EXISTS idx_announcements_guild_published;
CREATE INDEX IF NOT EXISTS idx_announcements_guild_published
    ON announcements(guild_id, pinned DESC, published_at DESC)
    WHERE status = 'published';

ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_pinned_at_matches_pinned;
ALTER TABLE announcements DROP COLUMN IF EXISTS pinned_at;
