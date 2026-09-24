-- name: ListUserNotifications :many
SELECT id, user_id, title, message, type, read,
       COALESCE(action_url, '') AS action_url,
       params, created_at
FROM notifications
WHERE user_id = $1
  AND (NOT sqlc.arg(unread_only)::bool OR NOT read)
ORDER BY created_at DESC, id DESC
LIMIT sqlc.arg(page_size)::int OFFSET sqlc.arg(page_offset)::int;

-- name: CountUserNotifications :one
SELECT COUNT(*) FROM notifications
WHERE user_id = $1
  AND (NOT sqlc.arg(unread_only)::bool OR NOT read);

-- name: CountUnreadNotifications :one
SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND NOT read;

-- name: MarkNotificationRead :one
UPDATE notifications SET read = TRUE
WHERE id = $1 AND user_id = $2
RETURNING id, user_id, title, message, type, read,
          COALESCE(action_url, '') AS action_url,
          params, created_at;

-- name: MarkAllNotificationsRead :execrows
UPDATE notifications SET read = TRUE WHERE user_id = $1 AND NOT read;
