-- name: ListRollCallTemplates :many
SELECT ct.id, ct.guild_id, ct.name, ct.title, ct.created_by, ct.created_at, ct.updated_at,
       (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'id', it.id, 'name', it.name, 'description', it.description,
                   'category', it.category, 'rarity', it.rarity) ORDER BY u.ord), '[]'::jsonb)
        FROM unnest(ct.item_template_ids) WITH ORDINALITY AS u(item_id, ord)
        JOIN item_templates it ON it.id = u.item_id AND it.guild_id = ct.guild_id)::jsonb AS items
FROM roll_call_templates ct
WHERE ct.guild_id = $1
ORDER BY ct.name ASC;

-- name: GetRollCallTemplate :one
SELECT ct.id, ct.guild_id, ct.name, ct.title, ct.created_by, ct.created_at, ct.updated_at,
       (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                   'id', it.id, 'name', it.name, 'description', it.description,
                   'category', it.category, 'rarity', it.rarity) ORDER BY u.ord), '[]'::jsonb)
        FROM unnest(ct.item_template_ids) WITH ORDINALITY AS u(item_id, ord)
        JOIN item_templates it ON it.id = u.item_id AND it.guild_id = ct.guild_id)::jsonb AS items
FROM roll_call_templates ct
WHERE ct.id = $1 AND ct.guild_id = $2;

-- name: CreateRollCallTemplate :one
INSERT INTO roll_call_templates (guild_id, name, title, item_template_ids, created_by)
VALUES ($1, sqlc.arg(name)::text, sqlc.arg(title)::text, sqlc.arg(item_template_ids)::uuid[], $2)
RETURNING id;

-- name: UpdateRollCallTemplate :one
UPDATE roll_call_templates SET
    name              = sqlc.arg(name)::text,
    title             = sqlc.arg(title)::text,
    item_template_ids = sqlc.arg(item_template_ids)::uuid[],
    updated_at        = NOW()
WHERE id = sqlc.arg(id) AND guild_id = sqlc.arg(guild_id)
RETURNING id;

-- name: DeleteRollCallTemplate :execrows
DELETE FROM roll_call_templates WHERE id = $1 AND guild_id = $2;
