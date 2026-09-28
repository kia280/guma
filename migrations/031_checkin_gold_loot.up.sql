CREATE TABLE IF NOT EXISTS checkin_gold_pots (
    checkin_id  UUID        PRIMARY KEY REFERENCES checkins(id) ON DELETE CASCADE,
    guild_id    UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    total       BIGINT      NOT NULL CONSTRAINT checkin_gold_pots_total_check CHECK (total > 0),
    distributed BIGINT      NOT NULL DEFAULT 0 CONSTRAINT checkin_gold_pots_distributed_check CHECK (distributed >= 0),
    retracted   BIGINT      NOT NULL DEFAULT 0 CONSTRAINT checkin_gold_pots_retracted_check CHECK (retracted >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT checkin_gold_pots_balance_check CHECK (distributed + retracted <= total)
);

CREATE TABLE IF NOT EXISTS checkin_gold_distributions (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkin_id UUID        NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
    guild_id   UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    actor_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
    request_id UUID        NOT NULL,
    total      BIGINT      NOT NULL CONSTRAINT checkin_gold_distributions_total_check CHECK (total > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT checkin_gold_distributions_request_key UNIQUE (checkin_id, request_id)
);

CREATE TABLE IF NOT EXISTS checkin_gold_payouts (
    distribution_id UUID   NOT NULL REFERENCES checkin_gold_distributions(id) ON DELETE CASCADE,
    user_id         UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount          BIGINT NOT NULL CONSTRAINT checkin_gold_payouts_amount_check CHECK (amount > 0),
    transaction_id  UUID   REFERENCES transactions(id) ON DELETE SET NULL,
    PRIMARY KEY (distribution_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_checkin_gold_payouts_user ON checkin_gold_payouts(user_id);

ALTER TABLE bank_contributions DROP CONSTRAINT IF EXISTS bank_contributions_kind_check;
ALTER TABLE bank_contributions
    ADD CONSTRAINT bank_contributions_kind_check
        CHECK (kind IN ('gold', 'checkin_loot', 'auction_proceeds', 'lottery_revenue',
                        'checkin_gold_payout', 'checkin_gold_retracted'));

CREATE OR REPLACE FUNCTION notify_checkin_gold_received() RETURNS trigger AS $$
DECLARE
    checkin RECORD;
BEGIN
    SELECT id, title INTO checkin FROM checkins WHERE id = NEW.reference_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'You received roll call gold',
        'You received ' || gold_amount(NEW.amount) || ' gold from '
            || COALESCE(checkin.title, 'a roll call') || '.',
        'checkinGoldReceived',
        '/dashboard/wallet',
        jsonb_build_object(
            'amount', gold_amount(NEW.amount),
            'checkin', COALESCE(checkin.title, ''),
            'guildId', NEW.guild_id,
            'checkinId', NEW.reference_id,
            'transactionId', NEW.id
        )
    );
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_notify_checkin_gold_received
    AFTER INSERT ON transactions
    FOR EACH ROW
    WHEN (NEW.type = 'CHECKIN_GOLD' AND NEW.amount > 0)
    EXECUTE FUNCTION notify_checkin_gold_received();
