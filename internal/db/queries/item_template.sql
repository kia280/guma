-- name: ListItemTemplates :many
SELECT id, guild_id, name, description, category, rarity, created_by, created_at, updated_at
FROM item_templates
WHERE guild_id = $1
ORDER BY name ASC;

-- name: CreateItemTemplate :one
INSERT INTO item_templates (guild_id, name, description, category, rarity, created_by)
VALUES ($1, sqlc.arg(name)::text, sqlc.arg(description)::text, sqlc.arg(category)::text, sqlc.arg(rarity)::text, $2)
RETURNING id, guild_id, name, description, category, rarity, created_by, created_at, updated_at;

-- name: UpdateItemTemplate :one
UPDATE item_templates SET
    name        = sqlc.arg(name)::text,
    description = sqlc.arg(description)::text,
    category    = sqlc.arg(category)::text,
    rarity      = sqlc.arg(rarity)::text,
    updated_at  = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id)
RETURNING id, guild_id, name, description, category, rarity, created_by, created_at, updated_at;

-- name: DeleteItemTemplate :execrows
DELETE FROM item_templates WHERE id = $1 AND guild_id = $2;

-- name: CountGuildItemTemplates :one
SELECT COUNT(*) FROM item_templates
WHERE guild_id = $1 AND id = ANY(sqlc.arg(ids)::uuid[]);
