DROP TRIGGER IF EXISTS announcements_live_event_published ON announcements;
DROP FUNCTION IF EXISTS notify_published_announcement_changed();
DROP TABLE IF EXISTS announcements;
