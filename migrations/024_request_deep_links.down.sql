CREATE OR REPLACE FUNCTION notify_bank_request_reviewed() RETURNS trigger AS $$
DECLARE
    kind      TEXT := TG_ARGV[0];
    approved  BOOLEAN := NEW.status = 'approved';
    reviewer  TEXT := COALESCE(notification_user_name(NEW.reviewer_id), '');
    note      TEXT := COALESCE(NEW.review_note, '');
    subject   TEXT;
    params    JSONB;
BEGIN
    IF NEW.reviewer_id IS NOT DISTINCT FROM NEW.requester_id THEN
        RETURN NULL;
    END IF;

    IF kind = 'fund' THEN
        subject := 'your guild bank request for ' || gold_amount(NEW.amount) || ' gold';
        params := jsonb_build_object('amount', gold_amount(NEW.amount));
    ELSE
        subject := 'your request for ' || COALESCE(to_jsonb(NEW)->'item'->>'name', 'an item');
        params := jsonb_build_object('item', COALESCE(to_jsonb(NEW)->'item'->>'name', ''));
    END IF;

    params := params || jsonb_build_object(
        'actor', reviewer,
        'note', note,
        'guildId', NEW.guild_id,
        'requestId', NEW.id
    );

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.requester_id,
        CASE kind
            WHEN 'fund' THEN CASE WHEN approved THEN 'Fund request approved' ELSE 'Fund request rejected' END
            ELSE CASE WHEN approved THEN 'Item request approved' ELSE 'Item request rejected' END
        END,
        CASE WHEN reviewer = '' THEN 'A reviewer' ELSE reviewer END
            || CASE WHEN approved THEN ' approved ' ELSE ' rejected ' END
            || subject || '.'
            || CASE WHEN note = '' THEN '' ELSE ' Note: ' || note END,
        kind || 'Request' || CASE WHEN approved THEN 'Approved' ELSE 'Rejected' END,
        '/dashboard/guild-bank',
        params
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION notify_bank_request_submitted() RETURNS trigger AS $$
DECLARE
    kind    TEXT := TG_ARGV[0];
    reason  TEXT := COALESCE(NEW.reason, '');
    subject TEXT;
    params  JSONB;
BEGIN
    IF kind = 'fund' THEN
        subject := gold_amount(NEW.amount) || ' gold from the guild bank';
        params := jsonb_build_object('amount', gold_amount(NEW.amount));
    ELSE
        subject := COALESCE(to_jsonb(NEW)->'item'->>'name', 'an item') || ' from the guild bank';
        params := jsonb_build_object('item', COALESCE(to_jsonb(NEW)->'item'->>'name', ''));
    END IF;

    params := params || jsonb_build_object(
        'actor', NEW.requester_name,
        'reason', reason,
        'guildId', NEW.guild_id,
        'requestId', NEW.id
    );

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    SELECT m.user_id,
           CASE kind WHEN 'fund' THEN 'New fund request' ELSE 'New item request' END,
           NEW.requester_name || ' requested ' || subject || '.'
               || CASE WHEN reason = '' THEN '' ELSE ' Reason: ' || reason END,
           kind || 'RequestSubmitted',
           '/dashboard/admin',
           params
    FROM members m
    WHERE m.guild_id = NEW.guild_id
      AND m.role IN ('owner', 'admin', 'moderator')
      AND m.user_id <> NEW.requester_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
