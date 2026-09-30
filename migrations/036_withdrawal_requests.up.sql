CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id       UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    requester_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requester_name TEXT        NOT NULL,
    amount         BIGINT      NOT NULL CHECK (amount > 0),
    note           TEXT,
    status         TEXT        NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewer_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
    review_note    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_guild
    ON withdrawal_requests(guild_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_requester
    ON withdrawal_requests(requester_id, guild_id, created_at DESC);

CREATE TRIGGER withdrawal_requests_notify_live
    AFTER INSERT OR UPDATE OR DELETE ON withdrawal_requests
    FOR EACH ROW EXECUTE FUNCTION notify_guild_row_changed('withdrawal');

CREATE OR REPLACE FUNCTION notify_withdrawal_request_submitted() RETURNS trigger AS $$
DECLARE
    note TEXT := COALESCE(NEW.note, '');
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    SELECT m.user_id,
           'New withdrawal request',
           NEW.requester_name || ' requested to withdraw ' || gold_amount(NEW.amount) || ' gold.'
               || CASE WHEN note = '' THEN '' ELSE ' Note: ' || note END,
           'withdrawalRequestSubmitted',
           '/dashboard/admin?tab=inbox&type=withdrawal&request=' || NEW.id,
           jsonb_build_object(
               'actor', NEW.requester_name,
               'amount', gold_amount(NEW.amount),
               'note', note,
               'guildId', NEW.guild_id,
               'requestId', NEW.id
           )
    FROM members m
    WHERE m.guild_id = NEW.guild_id
      AND m.role IN ('owner', 'admin', 'moderator')
      AND m.user_id <> NEW.requester_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER withdrawal_requests_notify_submitted
    AFTER INSERT ON withdrawal_requests
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION notify_withdrawal_request_submitted();

CREATE OR REPLACE FUNCTION notify_withdrawal_request_reviewed() RETURNS trigger AS $$
DECLARE
    approved BOOLEAN := NEW.status = 'approved';
    reviewer TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.reviewer_id), '');
    note     TEXT := COALESCE(NEW.review_note, '');
BEGIN
    IF NEW.reviewer_id IS NOT DISTINCT FROM NEW.requester_id THEN
        RETURN NULL;
    END IF;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.requester_id,
        CASE WHEN approved THEN 'Withdrawal approved' ELSE 'Withdrawal rejected' END,
        CASE WHEN reviewer = '' THEN 'A reviewer' ELSE reviewer END
            || CASE WHEN approved THEN ' approved ' ELSE ' rejected ' END
            || 'your withdrawal of ' || gold_amount(NEW.amount) || ' gold.'
            || CASE WHEN approved THEN '' ELSE ' The amount was returned to your wallet.' END
            || CASE WHEN note = '' THEN '' ELSE ' Note: ' || note END,
        CASE WHEN approved THEN 'withdrawalRequestApproved' ELSE 'withdrawalRequestRejected' END,
        '/dashboard/wallet',
        jsonb_build_object(
            'actor', reviewer,
            'amount', gold_amount(NEW.amount),
            'note', note,
            'guildId', NEW.guild_id,
            'requestId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER withdrawal_requests_notify_reviewed
    AFTER UPDATE OF status ON withdrawal_requests
    FOR EACH ROW
    WHEN (OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected'))
    EXECUTE FUNCTION notify_withdrawal_request_reviewed();
