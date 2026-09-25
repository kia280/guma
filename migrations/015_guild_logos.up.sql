CREATE TABLE IF NOT EXISTS guild_logos (
    guild_id     UUID        PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    content_type TEXT        NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
    data         BYTEA       NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 524288),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
