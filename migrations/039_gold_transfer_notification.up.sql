CREATE OR REPLACE FUNCTION notify_gold_transfer_received() RETURNS trigger AS $$
DECLARE
    sender TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.counterparty_id), '');
    note   TEXT := COALESCE(NULLIF(NEW.description, 'Transfer'), '');
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'You received gold',
        CASE WHEN sender = '' THEN 'A guild member' ELSE sender END
            || ' sent you ' || gold_amount(NEW.amount) || ' gold.'
            || CASE WHEN note = '' THEN '' ELSE ' Note: ' || note END,
        'goldReceived',
        '/dashboard/wallet',
        jsonb_build_object(
            'actor', sender,
            'amount', gold_amount(NEW.amount),
            'note', note,
            'guildId', NEW.guild_id,
            'transactionId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_notify_gold_transfer_received
    AFTER INSERT ON transactions
    FOR EACH ROW
    WHEN (NEW.type = 'TRANSFER_IN' AND NEW.amount > 0)
    EXECUTE FUNCTION notify_gold_transfer_received();
