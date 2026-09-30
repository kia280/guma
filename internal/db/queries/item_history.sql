-- name: GetBackpackItemOwner :one
SELECT owner_id FROM backpack_items WHERE id = $1 AND guild_id = $2;

-- name: ListItemEvents :many
SELECT e.seq, e.kind, e.source, e.actor_id, e.subject_id, e.reference_id, e.created_at,
       COALESCE(member_display_name(e.guild_id, e.actor_id), '')::text AS actor_name,
       COALESCE(member_display_name(e.guild_id, e.subject_id), '')::text AS subject_name,
       COALESCE(CASE e.source
           WHEN 'roll_call' THEN (SELECT c.title FROM roll_calls c WHERE c.id = e.reference_id)
           WHEN 'auction' THEN (SELECT a.item->>'name' FROM auctions a WHERE a.id = e.reference_id)
           WHEN 'lottery' THEN (SELECT l.title FROM lotteries l WHERE l.id = e.reference_id)
           WHEN 'admin'   THEN member_display_name(e.guild_id, e.reference_id)
       END, '')::text AS reference_label
FROM (
    SELECT ie.seq, ie.guild_id, ie.kind, ie.source, ie.actor_id, ie.subject_id, ie.reference_id, ie.created_at,
           ie.seq AS position, false AS is_derived
    FROM item_events ie
    WHERE ie.guild_id = $1 AND ie.item_id = $2
    UNION ALL
    SELECT -looted.seq, looted.guild_id, 'kept', 'roll_call', rc.completed_by, NULL::uuid, rc.id, rc.completed_at,
           (SELECT MAX(prior.seq) FROM item_events prior
            WHERE prior.guild_id = looted.guild_id AND prior.item_id = looted.item_id
              AND prior.created_at <= rc.completed_at),
           true
    FROM item_events looted
    JOIN roll_calls rc ON rc.id = looted.reference_id
    WHERE looted.guild_id = $1 AND looted.item_id = $2
      AND looted.kind = 'looted' AND looted.source = 'roll_call'
      AND rc.completed_at IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM item_events gone
          WHERE gone.guild_id = looted.guild_id AND gone.item_id = looted.item_id
            AND gone.kind IN ('received', 'retracted', 'deleted') AND gone.created_at <= rc.completed_at
      )
) e
ORDER BY e.position, e.is_derived;

-- name: InsertItemEvent :exec
INSERT INTO item_events (guild_id, item_id, kind, actor_id, subject_id, source, reference_id)
VALUES ($1, $2, sqlc.arg(kind)::text, sqlc.narg(actor_id)::uuid, sqlc.narg(subject_id)::uuid,
        sqlc.arg(source)::text, sqlc.narg(reference_id)::uuid);
