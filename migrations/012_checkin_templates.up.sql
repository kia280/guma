CREATE TABLE IF NOT EXISTS checkin_templates (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id   UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    title      TEXT        NOT NULL,
    loot_list  JSONB       NOT NULL DEFAULT '[]',
    created_by UUID        NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT checkin_templates_guild_name_key UNIQUE (guild_id, name)
);
