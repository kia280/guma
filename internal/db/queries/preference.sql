-- name: GetNotificationPreferences :one
SELECT email_notifications, auction_alerts, lottery_alerts, event_reminders, checkin_reminders, updated_at
FROM user_preferences
WHERE user_id = $1;

-- name: UpsertNotificationPreferences :one
INSERT INTO user_preferences (
    user_id, email_notifications, auction_alerts, lottery_alerts, event_reminders, checkin_reminders
)
VALUES (
    sqlc.arg(user_id),
    COALESCE(sqlc.narg(email_notifications)::bool, TRUE),
    COALESCE(sqlc.narg(auction_alerts)::bool, TRUE),
    COALESCE(sqlc.narg(lottery_alerts)::bool, TRUE),
    COALESCE(sqlc.narg(event_reminders)::bool, FALSE),
    COALESCE(sqlc.narg(checkin_reminders)::bool, TRUE)
)
ON CONFLICT (user_id) DO UPDATE SET
    email_notifications = COALESCE(sqlc.narg(email_notifications)::bool, user_preferences.email_notifications),
    auction_alerts      = COALESCE(sqlc.narg(auction_alerts)::bool, user_preferences.auction_alerts),
    lottery_alerts      = COALESCE(sqlc.narg(lottery_alerts)::bool, user_preferences.lottery_alerts),
    event_reminders     = COALESCE(sqlc.narg(event_reminders)::bool, user_preferences.event_reminders),
    checkin_reminders   = COALESCE(sqlc.narg(checkin_reminders)::bool, user_preferences.checkin_reminders),
    updated_at          = NOW()
RETURNING email_notifications, auction_alerts, lottery_alerts, event_reminders, checkin_reminders, updated_at;
