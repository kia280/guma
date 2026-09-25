-- name: CreateAnnouncementDraft :one
INSERT INTO announcements (guild_id, author_id)
VALUES ($1, $2)
RETURNING id;

-- name: GetAnnouncement :one
SELECT a.id, a.guild_id, a.author_id,
       COALESCE(NULLIF(u.display_name, ''), u.username, '')::text AS author_name,
       a.title, a.content, a.pinned, a.status, a.published_at, a.created_at, a.updated_at
FROM announcements a
JOIN users u ON u.id = a.author_id
WHERE a.id = $1 AND a.guild_id = $2;

-- name: ListGuildAnnouncements :many
SELECT a.id, a.guild_id, a.author_id,
       COALESCE(NULLIF(u.display_name, ''), u.username, '')::text AS author_name,
       a.title, a.content, a.pinned, a.status, a.published_at, a.created_at, a.updated_at
FROM announcements a
JOIN users u ON u.id = a.author_id
WHERE a.guild_id = $1
  AND (sqlc.arg(include_drafts)::bool OR a.status = 'published')
ORDER BY (a.status = 'draft') DESC,
         CASE WHEN a.status = 'published' THEN a.pinned ELSE FALSE END DESC,
         COALESCE(a.published_at, a.updated_at) DESC,
         a.id DESC
LIMIT sqlc.arg(page_size)::int;

-- name: UpdateAnnouncement :execrows
UPDATE announcements
SET title = $3, content = $4, pinned = $5, updated_at = NOW()
WHERE id = $1 AND guild_id = $2
  AND (status = 'draft' OR (btrim($3) <> '' AND btrim($4) <> ''));

-- name: PublishAnnouncement :execrows
UPDATE announcements
SET status = 'published', published_at = NOW(), updated_at = NOW()
WHERE id = $1 AND guild_id = $2 AND status = 'draft'
  AND btrim(title) <> '' AND btrim(content) <> '';

-- name: UnpublishAnnouncement :execrows
UPDATE announcements
SET status = 'draft', published_at = NULL, updated_at = NOW()
WHERE id = $1 AND guild_id = $2 AND status = 'published';

-- name: DeleteAnnouncementDraft :execrows
DELETE FROM announcements
WHERE id = $1 AND guild_id = $2 AND status = 'draft';
