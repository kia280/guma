-- name: ListCheckinTemplates :many
SELECT id, guild_id, name, title, loot_list, created_by, created_at, updated_at
FROM checkin_templates
WHERE guild_id = $1
ORDER BY name ASC;

-- name: CreateCheckinTemplate :one
INSERT INTO checkin_templates (guild_id, name, title, loot_list, created_by)
VALUES ($1, sqlc.arg(name)::text, sqlc.arg(title)::text, sqlc.arg(loot_list)::jsonb, $2)
RETURNING id, guild_id, name, title, loot_list, created_by, created_at, updated_at;

-- name: UpdateCheckinTemplate :one
UPDATE checkin_templates SET
    name       = sqlc.arg(name)::text,
    title      = sqlc.arg(title)::text,
    loot_list  = sqlc.arg(loot_list)::jsonb,
    updated_at = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id)
RETURNING id, guild_id, name, title, loot_list, created_by, created_at, updated_at;

-- name: DeleteCheckinTemplate :execrows
DELETE FROM checkin_templates WHERE id = $1 AND guild_id = $2;
