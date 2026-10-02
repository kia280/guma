DROP TRIGGER IF EXISTS members_enqueue_authz_sync ON members;
DROP FUNCTION IF EXISTS enqueue_authz_member_sync();
DROP TABLE IF EXISTS authz_member_outbox;
