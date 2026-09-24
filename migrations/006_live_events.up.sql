CREATE OR REPLACE FUNCTION notify_live_event(
    p_scope       TEXT,
    p_target_id   UUID,
    p_guild_id    UUID,
    p_resource    TEXT,
    p_resource_id TEXT
) RETURNS VOID AS $$
BEGIN
    PERFORM pg_notify('live_events', json_build_object(
        'scope', p_scope,
        'target_id', p_target_id,
        'guild_id', p_guild_id,
        'resource', p_resource,
        'resource_id', p_resource_id
    )::text);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_guild_row_changed() RETURNS trigger AS $$
DECLARE
    changed RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        changed := OLD;
    ELSE
        changed := NEW;
    END IF;

    PERFORM notify_live_event('guild', changed.guild_id, changed.guild_id, TG_ARGV[0], changed.id::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
