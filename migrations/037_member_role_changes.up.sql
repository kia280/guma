CREATE TABLE IF NOT EXISTS member_role_changes (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id   UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
    old_role   TEXT        NOT NULL,
    new_role   TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (old_role <> new_role)
);

CREATE INDEX IF NOT EXISTS idx_member_role_changes_guild_created
    ON member_role_changes(guild_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_member_role_changes_user
    ON member_role_changes(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION notify_member_role_changed() RETURNS trigger AS $$
DECLARE
    actor TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.actor_id), '');
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'Your guild role changed',
        CASE WHEN actor = '' THEN 'An admin' ELSE actor END
            || ' changed your role from ' || NEW.old_role || ' to ' || NEW.new_role || '.',
        'memberRoleChanged',
        '/dashboard/profile',
        jsonb_build_object(
            'actor', actor,
            'oldRole', NEW.old_role,
            'newRole', NEW.new_role,
            'guildId', NEW.guild_id
        )
    );
    PERFORM notify_live_event('guild', NEW.guild_id, NEW.guild_id, 'member', NEW.user_id::text);
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS member_role_changes_notify ON member_role_changes;
CREATE TRIGGER member_role_changes_notify
    AFTER INSERT ON member_role_changes
    FOR EACH ROW
    EXECUTE FUNCTION notify_member_role_changed();
