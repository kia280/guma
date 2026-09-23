-- name: CreateGuild :one
INSERT INTO guilds (
    name, description, owner_id, tags,
    timezone, language, public, allow_invites, custom_settings,
    icon_url, banner_url
) VALUES (
    sqlc.arg(name)::text,
    NULLIF(sqlc.arg(description)::text, ''),
    sqlc.arg(owner_id),
    sqlc.arg(tags)::text[],
    'UTC', 'en', false, true,
    sqlc.arg(custom_settings)::jsonb,
    NULLIF(sqlc.arg(icon_url)::text, ''),
    NULLIF(sqlc.arg(banner_url)::text, '')
)
RETURNING id, name,
          COALESCE(description, '') AS description,
          owner_id,
          tags,
          timezone, language, public, allow_invites,
          custom_settings,
          COALESCE(icon_url, '')   AS icon_url,
          COALESCE(banner_url, '') AS banner_url,
          created_at, updated_at;

-- name: GetGuild :one
SELECT id, name,
       COALESCE(description, '') AS description,
       owner_id,
       tags,
       timezone, language, public, allow_invites,
       custom_settings,
       COALESCE(icon_url, '')   AS icon_url,
       COALESCE(banner_url, '') AS banner_url,
       created_at, updated_at
FROM guilds
WHERE id = $1;

-- name: UpdateGuild :one
UPDATE guilds SET
    name        = CASE WHEN sqlc.arg(name)::text        != '' THEN sqlc.arg(name)::text        ELSE name        END,
    description = CASE WHEN sqlc.arg(description)::text != '' THEN sqlc.arg(description)::text ELSE description END,
    tags        = CASE WHEN array_length(sqlc.arg(tags)::text[], 1) > 0 THEN sqlc.arg(tags)::text[] ELSE tags END,
    icon_url    = CASE WHEN sqlc.arg(icon_url)::text    != '' THEN sqlc.arg(icon_url)::text    ELSE icon_url    END,
    banner_url  = CASE WHEN sqlc.arg(banner_url)::text  != '' THEN sqlc.arg(banner_url)::text  ELSE banner_url  END,
    updated_at  = NOW()
WHERE id = sqlc.arg(id)
RETURNING id, name,
          COALESCE(description, '') AS description,
          owner_id,
          tags,
          timezone, language, public, allow_invites,
          custom_settings,
          COALESCE(icon_url, '')   AS icon_url,
          COALESCE(banner_url, '') AS banner_url,
          created_at, updated_at;

-- name: DeleteGuild :exec
DELETE FROM guilds WHERE id = $1;

-- name: ListGuilds :many
SELECT id, name,
       COALESCE(description, '') AS description,
       owner_id,
       tags,
       timezone, language, public, allow_invites,
       custom_settings,
       COALESCE(icon_url, '')   AS icon_url,
       COALESCE(banner_url, '') AS banner_url,
       created_at, updated_at
FROM guilds
WHERE (sqlc.arg(search)::text = '%%' OR name ILIKE sqlc.arg(search)::text OR description ILIKE sqlc.arg(search)::text)
ORDER BY created_at DESC
LIMIT sqlc.arg(page_size)::int
OFFSET sqlc.arg(page_offset)::int;

-- name: CountGuilds :one
SELECT COUNT(*) FROM guilds
WHERE (sqlc.arg(search)::text = '%%' OR name ILIKE sqlc.arg(search)::text OR description ILIKE sqlc.arg(search)::text);

-- name: GetUserCurrentGuild :one
SELECT g.id, g.name,
       COALESCE(g.description, '') AS description,
       g.owner_id,
       g.tags,
       g.timezone, g.language, g.public, g.allow_invites,
       g.custom_settings,
       COALESCE(g.icon_url, '')   AS icon_url,
       COALESCE(g.banner_url, '') AS banner_url,
       g.created_at, g.updated_at
FROM guilds g
JOIN members m ON m.guild_id = g.id
WHERE m.user_id = $1
ORDER BY m.last_active DESC
LIMIT 1;

-- name: GetGuildPublic :one
SELECT public FROM guilds WHERE id = $1;

-- name: GetSingletonGuildID :one
-- Returns the id of the only guild when exactly one exists; pgx.ErrNoRows
-- otherwise (used by user bootstrap to auto-join a new user to a
-- single-guild deployment).
SELECT id FROM guilds
WHERE (SELECT COUNT(*) FROM guilds) = 1;

-- name: GetGuildOwner :one
SELECT owner_id FROM guilds WHERE id = $1;

-- name: GetGuildSettings :one
SELECT timezone, language, public, allow_invites, custom_settings
FROM guilds WHERE id = $1;

-- name: UpdateGuildSettings :exec
UPDATE guilds SET
    timezone        = sqlc.arg(timezone)::text,
    language        = sqlc.arg(language)::text,
    public          = sqlc.arg(public)::bool,
    allow_invites   = sqlc.arg(allow_invites)::bool,
    custom_settings = sqlc.arg(custom_settings)::jsonb,
    updated_at      = NOW()
WHERE id = sqlc.arg(id);

-- name: InsertGuildMember :exec
INSERT INTO members (user_id, guild_id, role)
VALUES ($1, $2, sqlc.arg(role)::text)
ON CONFLICT (user_id, guild_id) DO NOTHING;

-- name: DeleteGuildMember :exec
DELETE FROM members WHERE user_id = $1 AND guild_id = $2;

-- name: CountGuildMembers :one
SELECT COUNT(*) FROM members WHERE guild_id = $1;

-- name: GetGuildMemberRole :one
SELECT role FROM members WHERE guild_id = $1 AND user_id = $2;
