CREATE OR REPLACE FUNCTION notify_wallet_changed() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.balance = OLD.balance THEN
        RETURN NEW;
    END IF;

    PERFORM pg_notify('wallet_changed', json_build_object(
        'user_id', NEW.user_id,
        'guild_id', NEW.guild_id,
        'balance', NEW.balance
    )::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallets_notify_changed
    AFTER INSERT OR UPDATE OF balance ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION notify_wallet_changed();
