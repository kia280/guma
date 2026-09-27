-- name: GetBackpackItemOwner :one
SELECT owner_id FROM backpack_items WHERE id = $1 AND guild_id = $2;

-- name: ListItemEvents :many
SELECT e.seq, e.kind, e.source, e.actor_id, e.subject_id, e.reference_id, e.created_at,
       COALESCE(notification_user_name(e.actor_id), '')::text AS actor_name,
       COALESCE(notification_user_name(e.subject_id), '')::text AS subject_name,
       COALESCE(CASE e.source
           WHEN 'checkin' THEN (SELECT c.title FROM checkins c WHERE c.id = e.reference_id)
           WHEN 'auction' THEN (SELECT a.item->>'name' FROM auctions a WHERE a.id = e.reference_id)
           WHEN 'lottery' THEN (SELECT l.title FROM lotteries l WHERE l.id = e.reference_id)
       END, '')::text AS reference_label
FROM item_events e
WHERE e.guild_id = $1 AND e.item_id = $2
ORDER BY e.seq;

-- name: InsertItemEvent :exec
INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
VALUES ($1, $2, sqlc.arg(kind)::text, sqlc.narg(actor_id)::uuid, sqlc.arg(source)::text, sqlc.narg(reference_id)::uuid);
