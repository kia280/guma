DROP TRIGGER IF EXISTS member_role_changes_notify ON member_role_changes;
DROP FUNCTION IF EXISTS notify_member_role_changed();
DROP TABLE IF EXISTS member_role_changes;
