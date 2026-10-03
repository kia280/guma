CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email            TEXT        NOT NULL UNIQUE,
    username         TEXT        UNIQUE,
    display_name     TEXT,
    bio              TEXT,
    avatar_url       TEXT,
    metadata         JSONB       NOT NULL DEFAULT '{}',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    discord_username TEXT
);

CREATE TABLE user_preferences (
    user_id             UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme               TEXT        NOT NULL DEFAULT 'auto',
    language            TEXT        NOT NULL DEFAULT 'en',
    timezone            TEXT        NOT NULL DEFAULT 'UTC',
    date_format         TEXT        NOT NULL DEFAULT 'YYYY-MM-DD',
    time_format         TEXT        NOT NULL DEFAULT '24h',
    ui_settings         JSONB       NOT NULL DEFAULT '{}',
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    email_notifications BOOLEAN     NOT NULL DEFAULT TRUE,
    auction_alerts      BOOLEAN     NOT NULL DEFAULT TRUE,
    raffle_alerts       BOOLEAN     NOT NULL DEFAULT TRUE,
    event_reminders     BOOLEAN     NOT NULL DEFAULT FALSE,
    roll_call_reminders BOOLEAN     NOT NULL DEFAULT TRUE
);

CREATE TABLE guilds (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT        NOT NULL,
    description     TEXT,
    owner_id        UUID        NOT NULL REFERENCES users(id),
    timezone        TEXT        NOT NULL DEFAULT 'UTC',
    language        TEXT        NOT NULL DEFAULT 'en',
    public          BOOLEAN     NOT NULL DEFAULT FALSE,
    allow_invites   BOOLEAN     NOT NULL DEFAULT TRUE,
    custom_settings JSONB       NOT NULL DEFAULT '{}',
    icon_url        TEXT,
    banner_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE guild_logos (
    guild_id     UUID        PRIMARY KEY REFERENCES guilds(id) ON DELETE CASCADE,
    content_type TEXT        NOT NULL CHECK (content_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/gif')),
    data         BYTEA       NOT NULL CHECK ((octet_length(data) >= 1) AND (octet_length(data) <= 524288)),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE members (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id     UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    display_name TEXT        NOT NULL,
    role         TEXT        NOT NULL DEFAULT 'member',
    profile      JSONB       NOT NULL DEFAULT '{}',
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, guild_id)
);

CREATE INDEX idx_members_guild_id ON members (guild_id);
CREATE INDEX idx_members_user_id ON members (user_id);
CREATE UNIQUE INDEX members_guild_display_name_key ON members (guild_id, lower(display_name));

CREATE TABLE authz_member_outbox (
    id           BIGSERIAL   PRIMARY KEY,
    guild_id     UUID        NOT NULL,
    user_id      UUID        NOT NULL,
    attempts     INT         NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_authz_member_outbox_available ON authz_member_outbox (available_at, id);
CREATE INDEX idx_authz_member_outbox_member ON authz_member_outbox (guild_id, user_id);

CREATE TABLE member_role_changes (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id   UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
    old_role   TEXT        NOT NULL,
    new_role   TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT member_role_changes_check CHECK (old_role <> new_role)
);

CREATE INDEX idx_member_role_changes_guild_created ON member_role_changes (guild_id, created_at DESC, id DESC);
CREATE INDEX idx_member_role_changes_user ON member_role_changes (user_id, created_at DESC);

CREATE TABLE invitations (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id   UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    code       TEXT        NOT NULL UNIQUE,
    created_by UUID        NOT NULL REFERENCES users(id),
    role       TEXT        NOT NULL DEFAULT 'member',
    max_uses   INTEGER     NOT NULL DEFAULT 0,
    use_count  INTEGER     NOT NULL DEFAULT 0,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_code ON invitations (code);

CREATE TABLE notifications (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT        NOT NULL,
    message    TEXT        NOT NULL,
    type       TEXT        NOT NULL DEFAULT 'info',
    read       BOOLEAN     NOT NULL DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    params     JSONB       NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_notifications_user_created ON notifications (user_id, created_at DESC, id DESC);
CREATE INDEX idx_notifications_user_unread ON notifications (user_id) WHERE NOT read;

CREATE TABLE activity (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    type        TEXT        NOT NULL,
    actor_id    UUID        NOT NULL REFERENCES users(id),
    actor_name  TEXT        NOT NULL,
    guild_id    UUID        REFERENCES guilds(id) ON DELETE SET NULL,
    description TEXT        NOT NULL,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_guild ON activity (guild_id);

CREATE TABLE announcements (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id     UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    author_id    UUID        NOT NULL REFERENCES users(id),
    title        TEXT        NOT NULL DEFAULT '',
    content      TEXT        NOT NULL DEFAULT '',
    pinned       BOOLEAN     NOT NULL DEFAULT FALSE,
    status       TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    published_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    pinned_at    TIMESTAMPTZ,
    CONSTRAINT announcements_check CHECK ((status = 'published') = (published_at IS NOT NULL)),
    CONSTRAINT announcements_pinned_at_matches_pinned CHECK (pinned = (pinned_at IS NOT NULL))
);

CREATE INDEX idx_announcements_guild_published ON announcements (guild_id, pinned_at DESC NULLS LAST, published_at DESC) WHERE status = 'published';
CREATE INDEX idx_announcements_guild_updated ON announcements (guild_id, updated_at DESC);

CREATE TABLE guild_events (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id          UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    created_by        UUID        NOT NULL REFERENCES users(id),
    title             TEXT        NOT NULL,
    description       TEXT,
    type              TEXT        NOT NULL DEFAULT 'other',
    start_date        TIMESTAMPTZ NOT NULL,
    end_date          TIMESTAMPTZ NOT NULL,
    is_all_day        BOOLEAN     NOT NULL DEFAULT FALSE,
    location          TEXT,
    priority          TEXT        NOT NULL DEFAULT 'medium',
    is_recurring      BOOLEAN     NOT NULL DEFAULT FALSE,
    recurring_pattern JSONB,
    participant_ids   UUID[]      NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_guild_events_dates ON guild_events (start_date, end_date);
CREATE INDEX idx_guild_events_guild ON guild_events (guild_id);

CREATE TABLE wallets (
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id   UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    balance    BIGINT      NOT NULL DEFAULT 0,
    currency   TEXT        NOT NULL DEFAULT 'gold',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE transactions (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id        UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    type            TEXT        NOT NULL,
    amount          BIGINT      NOT NULL,
    balance_after   BIGINT      NOT NULL,
    description     TEXT,
    reference_id    UUID,
    reference_type  TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
    counterparty_id UUID        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_transactions_user ON transactions (user_id, guild_id);

CREATE TABLE guild_bank (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id   UUID        NOT NULL UNIQUE REFERENCES guilds(id) ON DELETE CASCADE,
    balance    BIGINT      NOT NULL DEFAULT 0,
    currency   TEXT        NOT NULL DEFAULT 'gold',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    description TEXT,
    category    TEXT,
    rarity      TEXT
);

CREATE TABLE item_templates (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id    UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name        TEXT        NOT NULL,
    description TEXT        NOT NULL DEFAULT '',
    category    TEXT        NOT NULL,
    rarity      TEXT        NOT NULL,
    created_by  UUID        NOT NULL REFERENCES users(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT item_templates_guild_name_key UNIQUE (guild_id, name)
);

CREATE TABLE roll_calls (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id         UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    created_by       UUID        NOT NULL REFERENCES users(id),
    title            TEXT        NOT NULL,
    description      TEXT,
    datetime         TIMESTAMPTZ NOT NULL,
    expire_time      TIMESTAMPTZ NOT NULL,
    image_url        TEXT,
    loot_list        JSONB       NOT NULL DEFAULT '[]',
    attendance_count INTEGER     NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at     TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    completed_by     UUID        REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_roll_calls_guild ON roll_calls (guild_id);

CREATE TABLE roll_call_templates (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id          UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name              TEXT        NOT NULL,
    title             TEXT        NOT NULL,
    item_template_ids UUID[]      NOT NULL DEFAULT '{}',
    created_by        UUID        NOT NULL REFERENCES users(id),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT roll_call_templates_guild_name_key UNIQUE (guild_id, name)
);

CREATE TABLE roll_call_attendees (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    roll_call_id  UUID        NOT NULL REFERENCES roll_calls(id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name  TEXT,
    avatar_url    TEXT,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes         TEXT        NOT NULL DEFAULT '' CHECK (char_length(notes) <= 500),
    UNIQUE (roll_call_id, user_id)
);

CREATE INDEX idx_roll_call_attendees ON roll_call_attendees (roll_call_id);

CREATE TABLE roll_call_gold_pots (
    roll_call_id UUID        PRIMARY KEY REFERENCES roll_calls(id) ON DELETE CASCADE,
    guild_id     UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    total        BIGINT      NOT NULL CHECK (total > 0),
    distributed  BIGINT      NOT NULL DEFAULT 0 CHECK (distributed >= 0),
    retracted    BIGINT      NOT NULL DEFAULT 0 CHECK (retracted >= 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT roll_call_gold_pots_balance_check CHECK ((distributed + retracted) <= total)
);

CREATE TABLE roll_call_gold_distributions (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    roll_call_id UUID        NOT NULL REFERENCES roll_calls(id) ON DELETE CASCADE,
    guild_id     UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    actor_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    request_id   UUID        NOT NULL,
    total        BIGINT      NOT NULL CHECK (total > 0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT roll_call_gold_distributions_request_key UNIQUE (roll_call_id, request_id)
);

CREATE TABLE roll_call_gold_payouts (
    distribution_id UUID   NOT NULL REFERENCES roll_call_gold_distributions(id) ON DELETE CASCADE,
    user_id         UUID   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount          BIGINT NOT NULL CHECK (amount > 0),
    transaction_id  UUID   REFERENCES transactions(id) ON DELETE SET NULL,
    PRIMARY KEY (distribution_id, user_id)
);

CREATE INDEX idx_roll_call_gold_payouts_user ON roll_call_gold_payouts (user_id);

CREATE TABLE bank_contributions (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id       UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username       TEXT        NOT NULL,
    amount         BIGINT      NOT NULL,
    note           TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    kind           TEXT        NOT NULL DEFAULT 'gold' CHECK (kind IN ('gold', 'roll_call_loot', 'auction_proceeds', 'raffle_revenue', 'roll_call_gold_payout', 'roll_call_gold_retracted', 'admin_transfer')),
    items          JSONB       NOT NULL DEFAULT '[]',
    roll_call_id   UUID        REFERENCES roll_calls(id) ON DELETE SET NULL,
    reference_type TEXT,
    reference_id   UUID
);

CREATE INDEX idx_bank_contributions ON bank_contributions (guild_id);

CREATE TABLE bank_items (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id       UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    donor_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    donor_name     TEXT        NOT NULL,
    item           JSONB       NOT NULL,
    quantity       INTEGER     NOT NULL DEFAULT 1,
    note           TEXT,
    donated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    roll_call_id   UUID        REFERENCES roll_calls(id) ON DELETE SET NULL,
    locked_by_type TEXT        CHECK (locked_by_type IN ('auction', 'raffle')),
    locked_by_id   UUID,
    locked_at      TIMESTAMPTZ,
    CONSTRAINT bank_items_lock_complete_check CHECK ((locked_by_type IS NULL) = (locked_by_id IS NULL))
);

CREATE INDEX idx_bank_items_guild ON bank_items (guild_id);
CREATE INDEX idx_bank_items_lock ON bank_items (locked_by_type, locked_by_id) WHERE locked_by_type IS NOT NULL;
CREATE INDEX idx_bank_items_roll_call ON bank_items (roll_call_id);

CREATE TABLE item_requests (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id       UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    bank_item_id   UUID        REFERENCES bank_items(id) ON DELETE SET NULL,
    requester_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requester_name TEXT        NOT NULL,
    reason         TEXT,
    status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id    UUID        REFERENCES users(id),
    review_note    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at    TIMESTAMPTZ,
    item           JSONB       NOT NULL
);

CREATE INDEX idx_item_requests_guild ON item_requests (guild_id, status);
CREATE UNIQUE INDEX idx_item_requests_one_pending ON item_requests (bank_item_id, requester_id) WHERE status = 'pending';

CREATE TABLE fund_requests (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id       UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    requester_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requester_name TEXT        NOT NULL,
    amount         BIGINT      NOT NULL CHECK (amount > 0),
    reason         TEXT,
    status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewer_id    UUID        REFERENCES users(id),
    review_note    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at    TIMESTAMPTZ
);

CREATE INDEX idx_fund_requests_guild ON fund_requests (guild_id, status);

CREATE TABLE withdrawal_requests (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id       UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    requester_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requester_name TEXT        NOT NULL,
    amount         BIGINT      NOT NULL CHECK (amount > 0),
    note           TEXT,
    status         TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    reviewer_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
    review_note    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at    TIMESTAMPTZ
);

CREATE INDEX idx_withdrawal_requests_guild ON withdrawal_requests (guild_id, status, created_at DESC);
CREATE INDEX idx_withdrawal_requests_requester ON withdrawal_requests (requester_id, guild_id, created_at DESC);

CREATE TABLE backpack_items (
    id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id              UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    item                  JSONB       NOT NULL,
    source                TEXT        NOT NULL,
    source_id             UUID,
    note                  TEXT,
    acquired_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_by_type        TEXT        CHECK (locked_by_type IN ('auction', 'raffle')),
    locked_by_id          UUID,
    locked_at             TIMESTAMPTZ,
    delivery_requested_at TIMESTAMPTZ,
    CONSTRAINT backpack_items_lock_complete_check CHECK ((locked_by_type IS NULL) = (locked_by_id IS NULL))
);

CREATE INDEX idx_backpack_items_lock ON backpack_items (locked_by_type, locked_by_id) WHERE locked_by_type IS NOT NULL;
CREATE INDEX idx_backpack_items_pending_delivery ON backpack_items (guild_id, delivery_requested_at) WHERE delivery_requested_at IS NOT NULL;
CREATE INDEX idx_backpack_owner ON backpack_items (owner_id, guild_id);

CREATE TABLE item_events (
    seq          BIGSERIAL   PRIMARY KEY,
    guild_id     UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    item_id      UUID        NOT NULL,
    kind         TEXT        NOT NULL CHECK (kind IN ('looted', 'donated', 'requested', 'request_approved', 'request_rejected', 'received', 'auction_listed', 'raffle_listed', 'returned', 'withdrawn', 'retracted', 'withdrawal_requested', 'withdrawal_cancelled', 'delivered', 'deleted')),
    actor_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
    subject_id   UUID        REFERENCES users(id) ON DELETE SET NULL,
    source       TEXT        NOT NULL DEFAULT '',
    reference_id UUID,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_item_events_item ON item_events (guild_id, item_id, seq);
CREATE INDEX idx_item_events_reference ON item_events (reference_id) WHERE kind = 'requested';

CREATE TABLE auctions (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id          UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    seller_id         UUID        NOT NULL REFERENCES users(id),
    item              JSONB       NOT NULL,
    starting_bid      BIGINT      NOT NULL,
    current_bid       BIGINT      NOT NULL DEFAULT 0,
    current_bidder_id UUID        REFERENCES users(id),
    min_bid_increment BIGINT      NOT NULL DEFAULT 100,
    start_time        TIMESTAMPTZ NOT NULL,
    end_time          TIMESTAMPTZ NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'UPCOMING',
    is_blind          BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_type       TEXT        CHECK (source_type IN ('backpack', 'bank')),
    settled_at        TIMESTAMPTZ,
    source_item_id    UUID,
    cancelled_at      TIMESTAMPTZ
);

CREATE INDEX idx_auctions_guild ON auctions (guild_id, status);
CREATE INDEX idx_auctions_status_times ON auctions (status, start_time, end_time);

CREATE TABLE bids (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID        NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    bidder_id  UUID        NOT NULL REFERENCES users(id),
    amount     BIGINT      NOT NULL,
    is_winning BOOLEAN     NOT NULL DEFAULT FALSE,
    placed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bids_auction ON bids (auction_id);

CREATE TABLE raffles (
    id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id             UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    created_by           UUID        NOT NULL REFERENCES users(id),
    title                TEXT        NOT NULL,
    description          TEXT,
    ticket_price         BIGINT      NOT NULL DEFAULT 0,
    tickets_sold         INTEGER     NOT NULL DEFAULT 0,
    max_tickets          INTEGER     NOT NULL DEFAULT 0,
    max_tickets_per_user INTEGER     NOT NULL DEFAULT 0,
    status               TEXT        NOT NULL DEFAULT 'upcoming',
    draw_date            TIMESTAMPTZ NOT NULL,
    prizes               JSONB       NOT NULL DEFAULT '[]',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at         TIMESTAMPTZ
);

CREATE INDEX idx_raffles_guild ON raffles (guild_id, status);

CREATE TABLE raffle_tickets (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    raffle_id     UUID        NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_number TEXT        NOT NULL,
    purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raffle_tickets_user ON raffle_tickets (raffle_id, user_id);

CREATE TABLE raffle_winners (
    id                UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
    raffle_id         UUID    NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
    user_id           UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank              INTEGER NOT NULL,
    prize_amount      BIGINT  NOT NULL DEFAULT 0,
    prize_description TEXT,
    ticket_number     TEXT    NOT NULL
);

CREATE FUNCTION acting_admin_id() RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(current_setting('guma.acting_admin_id', true), '')::uuid;
$$;

CREATE FUNCTION assign_member_display_name() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.display_name IS NULL OR btrim(NEW.display_name) = '' THEN
        NEW.display_name := unique_member_name(
            NEW.guild_id,
            (SELECT COALESCE(NULLIF(btrim(display_name), ''), username) FROM users WHERE id = NEW.user_id),
            NEW.id
        );
    ELSE
        NEW.display_name := btrim(NEW.display_name);
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION enqueue_authz_member_sync() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'UPDATE'
        AND NEW.role IS NOT DISTINCT FROM OLD.role
        AND NEW.guild_id = OLD.guild_id
        AND NEW.user_id = OLD.user_id THEN
        RETURN NEW;
    END IF;

    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        INSERT INTO authz_member_outbox (guild_id, user_id) VALUES (OLD.guild_id, OLD.user_id);
    END IF;
    IF TG_OP = 'INSERT'
        OR (TG_OP = 'UPDATE' AND (NEW.guild_id <> OLD.guild_id OR NEW.user_id <> OLD.user_id)) THEN
        INSERT INTO authz_member_outbox (guild_id, user_id) VALUES (NEW.guild_id, NEW.user_id);
    END IF;

    PERFORM pg_notify('authz_member_changed', '');
    RETURN NULL;
END;
$$;

CREATE FUNCTION gold_amount(minor_units BIGINT) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE
AS $$
    SELECT trim_scale(minor_units / 100.0);
$$;

CREATE FUNCTION log_backpack_item_event() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    admin_id UUID := acting_admin_id();
BEGIN
    IF TG_OP = 'UPDATE' AND admin_id IS NOT NULL THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, subject_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'received', NEW.owner_id, OLD.owner_id, 'admin', admin_id);
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, subject_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'received', NEW.owner_id, OLD.owner_id, 'transfer', OLD.owner_id);
    ELSE
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'received', NEW.owner_id, NEW.source, NEW.source_id);
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION log_bank_item_event() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    admin_id UUID := acting_admin_id();
BEGIN
    IF NEW.roll_call_id IS NOT NULL THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'looted', NEW.donor_id, 'roll_call', NEW.roll_call_id);
    ELSIF admin_id IS NOT NULL THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, source, reference_id)
        VALUES (NEW.guild_id, NEW.id, 'donated', NEW.donor_id, 'admin', admin_id);
    ELSE
        INSERT INTO item_events (guild_id, item_id, kind, actor_id)
        VALUES (NEW.guild_id, NEW.id, 'donated', NEW.donor_id);
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION log_item_request_event() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    target UUID := NEW.bank_item_id;
BEGIN
    IF target IS NULL THEN
        SELECT item_id INTO target FROM item_events
        WHERE reference_id = NEW.id AND kind = 'requested'
        ORDER BY seq
        LIMIT 1;
    END IF;
    IF target IS NULL THEN
        RETURN NULL;
    END IF;

    IF TG_OP = 'INSERT' THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, reference_id)
        VALUES (NEW.guild_id, target, 'requested', NEW.requester_id, NEW.id);
    ELSIF NEW.status IN ('approved', 'rejected') THEN
        INSERT INTO item_events (guild_id, item_id, kind, actor_id, subject_id, reference_id)
        VALUES (NEW.guild_id, target, 'request_' || NEW.status, NEW.reviewer_id, NEW.requester_id, NEW.id);
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION member_display_name(p_guild_id UUID, p_user_id UUID) RETURNS TEXT
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(
        (SELECT NULLIF(display_name, '') FROM members WHERE guild_id = p_guild_id AND user_id = p_user_id),
        (SELECT COALESCE(NULLIF(display_name, ''), username) FROM users WHERE id = p_user_id),
        ''
    );
$$;

CREATE FUNCTION notification_enabled(p_user_id UUID, p_kind TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(
        (SELECT CASE p_kind
                    WHEN 'auction'   THEN auction_alerts
                    WHEN 'raffle'    THEN raffle_alerts
                    WHEN 'event'     THEN event_reminders
                    WHEN 'roll_call' THEN roll_call_reminders
                    ELSE TRUE
                END
         FROM user_preferences
         WHERE user_id = p_user_id),
        TRUE
    );
$$;

CREATE FUNCTION notification_user_name(p_user_id UUID) RETURNS TEXT
LANGUAGE sql STABLE
AS $$
    SELECT COALESCE(NULLIF(display_name, ''), username, '')
    FROM users
    WHERE id = p_user_id;
$$;

CREATE FUNCTION notify_auction_cancelled() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    SELECT b.bidder_id,
           'An auction was cancelled',
           CASE WHEN item_name = '' THEN 'An auction' ELSE item_name END || ' was cancelled.'
               || CASE WHEN r.refunded
                       THEN ' Your bid of ' || gold_amount(NEW.current_bid) || ' gold was refunded.'
                       ELSE '' END,
           'auctionCancelled',
           '/dashboard/auction/' || NEW.id,
           jsonb_build_object(
               'item', item_name,
               'amount', gold_amount(CASE WHEN r.refunded THEN NEW.current_bid ELSE 0 END),
               'refunded', CASE WHEN r.refunded THEN 'yes' ELSE 'no' END,
               'guildId', NEW.guild_id,
               'auctionId', NEW.id
           )
    FROM (SELECT DISTINCT bidder_id FROM bids WHERE auction_id = NEW.id) b
    CROSS JOIN LATERAL (
        SELECT b.bidder_id = NEW.current_bidder_id AND NEW.current_bid > 0 AS refunded
    ) r
    WHERE b.bidder_id IS DISTINCT FROM NEW.seller_id
      AND notification_enabled(b.bidder_id, 'auction');
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_auction_ended() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    winner    TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.current_bidder_id), '');
    has_winner BOOLEAN := NEW.current_bidder_id IS NOT NULL AND NEW.current_bid > 0;
    base      JSONB := jsonb_build_object(
        'item', item_name,
        'amount', gold_amount(NEW.current_bid),
        'guildId', NEW.guild_id,
        'auctionId', NEW.id
    );
BEGIN
    IF has_winner AND notification_enabled(NEW.current_bidder_id, 'auction') THEN
        INSERT INTO notifications (user_id, title, message, type, action_url, params)
        VALUES (
            NEW.current_bidder_id,
            'You won an auction',
            'You won ' || CASE WHEN item_name = '' THEN 'an auction' ELSE item_name END
                || ' for ' || gold_amount(NEW.current_bid) || ' gold. It is now in your backpack.',
            'auctionWon',
            '/dashboard/auction/' || NEW.id,
            base
        );
    END IF;

    IF NEW.seller_id IS DISTINCT FROM NEW.current_bidder_id
       AND notification_enabled(NEW.seller_id, 'auction') THEN
        INSERT INTO notifications (user_id, title, message, type, action_url, params)
        VALUES (
            NEW.seller_id,
            CASE WHEN has_winner THEN 'Your auction sold' ELSE 'Your auction ended without bids' END,
            CASE WHEN has_winner
                THEN CASE WHEN winner = '' THEN 'Someone' ELSE winner END
                    || ' won ' || CASE WHEN item_name = '' THEN 'your auction' ELSE item_name END
                    || ' for ' || gold_amount(NEW.current_bid) || ' gold.'
                ELSE CASE WHEN item_name = '' THEN 'Your auction' ELSE item_name END
                    || ' ended without bids.'
            END,
            CASE WHEN has_winner THEN 'auctionSold' ELSE 'auctionUnsold' END,
            '/dashboard/auction/' || NEW.id,
            base || jsonb_build_object(
                'actor', winner,
                'destination', CASE WHEN NEW.source_type = 'backpack' THEN 'wallet' ELSE 'bank' END
            )
        );
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_auction_outbid() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    bidder    TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.current_bidder_id), '');
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        OLD.current_bidder_id,
        'You have been outbid',
        CASE WHEN bidder = '' THEN 'Someone' ELSE bidder END
            || ' outbid you on ' || CASE WHEN item_name = '' THEN 'an auction' ELSE item_name END
            || ' with ' || gold_amount(NEW.current_bid) || ' gold.',
        'auctionOutbid',
        '/dashboard/auction/' || NEW.id,
        jsonb_build_object(
            'actor', bidder,
            'item', item_name,
            'amount', gold_amount(NEW.current_bid),
            'guildId', NEW.guild_id,
            'auctionId', NEW.id
        )
    );
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_backpack_changed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        PERFORM notify_live_event('user', OLD.owner_id, OLD.guild_id, 'backpack', OLD.id::text);
    END IF;
    IF TG_OP IN ('INSERT', 'UPDATE') AND (TG_OP = 'INSERT' OR NEW.owner_id IS DISTINCT FROM OLD.owner_id) THEN
        PERFORM notify_live_event('user', NEW.owner_id, NEW.guild_id, 'backpack', NEW.id::text);
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_backpack_item_received() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    sender    TEXT := COALESCE(member_display_name(NEW.guild_id, OLD.owner_id), '');
    admin_id  UUID := acting_admin_id();
    admin     TEXT := COALESCE(member_display_name(NEW.guild_id, admin_id), '');
    note      TEXT := COALESCE(NEW.note, '');
BEGIN
    IF NEW.source = 'admin' THEN
        INSERT INTO notifications (user_id, title, message, type, action_url, params)
        VALUES (
            NEW.owner_id,
            'An admin moved an item to you',
            CASE WHEN admin = '' THEN 'An admin' ELSE admin END
                || ' moved ' || CASE WHEN item_name = '' THEN 'an item' ELSE item_name END
                || ' from ' || CASE WHEN sender = '' THEN 'a guild member' ELSE sender END
                || ' to your backpack.'
                || CASE WHEN note = '' THEN '' ELSE ' Note: ' || note END,
            'itemMovedByAdmin',
            '/dashboard/wallet',
            jsonb_build_object(
                'actor', admin,
                'from', sender,
                'item', item_name,
                'note', note,
                'guildId', NEW.guild_id,
                'backpackItemId', NEW.id
            )
        );
        RETURN NULL;
    END IF;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.owner_id,
        'You received an item',
        CASE WHEN sender = '' THEN 'A guild member' ELSE sender END
            || ' sent you ' || CASE WHEN item_name = '' THEN 'an item' ELSE item_name END || '.'
            || CASE WHEN note = '' THEN '' ELSE ' Note: ' || note END,
        'itemReceived',
        '/dashboard/wallet',
        jsonb_build_object(
            'actor', sender,
            'item', item_name,
            'note', note,
            'guildId', NEW.guild_id,
            'backpackItemId', NEW.id
        )
    );
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_bank_request_reviewed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    kind      TEXT := TG_ARGV[0];
    approved  BOOLEAN := NEW.status = 'approved';
    reviewer  TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.reviewer_id), '');
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
        CASE WHEN kind = 'item' AND approved
            THEN '/dashboard/wallet?source=' || NEW.id
            ELSE '/dashboard/guild-bank?request=' || NEW.id
        END,
        params
    );
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_bank_request_submitted() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
           '/dashboard/admin?tab=bankRequests&request=' || NEW.id,
           params
    FROM members m
    WHERE m.guild_id = NEW.guild_id
      AND m.role IN ('owner', 'admin', 'moderator')
      AND m.user_id <> NEW.requester_id;
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_bid_changed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    changed_auction_id UUID;
    auction_guild_id   UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        changed_auction_id := OLD.auction_id;
    ELSE
        changed_auction_id := NEW.auction_id;
    END IF;

    SELECT guild_id INTO auction_guild_id FROM auctions WHERE id = changed_auction_id;
    IF auction_guild_id IS NULL THEN
        RETURN NULL;
    END IF;

    PERFORM notify_live_event('guild', auction_guild_id, auction_guild_id, 'auction', changed_auction_id::text);
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_delivery_changed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    changed RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        changed := OLD;
    ELSE
        changed := NEW;
    END IF;
    PERFORM notify_live_event('guild', changed.guild_id, changed.guild_id, 'delivery', changed.id::text);
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_gold_transfer_received() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

CREATE FUNCTION notify_guild_row_changed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    changed RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        changed := OLD;
    ELSE
        changed := NEW;
    END IF;

    PERFORM notify_live_event('guild', changed.guild_id, changed.guild_id, TG_ARGV[0], changed.id::text);
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_item_delivered() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    item_name TEXT;
    officer   TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.actor_id), '');
BEGIN
    SELECT COALESCE(bi.item->>'name', '') INTO item_name
    FROM backpack_items bi
    WHERE bi.id = NEW.item_id AND bi.guild_id = NEW.guild_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.subject_id,
        'Item delivered',
        CASE WHEN officer = '' THEN 'An officer' ELSE officer END
            || ' confirmed handing over ' || CASE WHEN COALESCE(item_name, '') = '' THEN 'your item' ELSE item_name END
            || ' in game.',
        'itemDelivered',
        '/dashboard/wallet',
        jsonb_build_object(
            'actor', officer,
            'item', COALESCE(item_name, ''),
            'guildId', NEW.guild_id
        )
    );
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_live_event(p_scope TEXT, p_target_id UUID, p_guild_id UUID, p_resource TEXT, p_resource_id TEXT) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_notify('live_events', json_build_object(
        'scope', p_scope,
        'target_id', p_target_id,
        'guild_id', p_guild_id,
        'resource', p_resource,
        'resource_id', p_resource_id
    )::text);
END;
$$;

CREATE FUNCTION notify_loot_assigned() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    item_name TEXT := COALESCE(NEW.item->>'name', '');
    roll_call RECORD;
BEGIN
    SELECT id, title INTO roll_call FROM roll_calls WHERE id = NEW.source_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.owner_id,
        'You received roll call loot',
        'You received ' || CASE WHEN item_name = '' THEN 'an item' ELSE item_name END
            || ' from ' || COALESCE(roll_call.title, 'a roll call') || '.',
        'lootAssigned',
        '/dashboard/wallet?source=' || NEW.source_id,
        jsonb_build_object(
            'item', item_name,
            'rollCall', COALESCE(roll_call.title, ''),
            'guildId', NEW.guild_id,
            'rollCallId', NEW.source_id,
            'backpackItemId', NEW.id
        )
    );
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_member_role_changed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    actor TEXT := COALESCE(member_display_name(NEW.guild_id, NEW.actor_id), '');
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'Your guild role changed',
        CASE WHEN actor = '' THEN 'An admin' ELSE actor END
            || ' changed your role from ' || NEW.old_role || ' to ' || NEW.new_role || '.',
        'memberRoleChanged',
        '/dashboard/profile',
        jsonb_build_object(
            'actor', actor,
            'oldRole', NEW.old_role,
            'newRole', NEW.new_role,
            'guildId', NEW.guild_id
        )
    );
    PERFORM notify_live_event('guild', NEW.guild_id, NEW.guild_id, 'member', NEW.user_id::text);
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_notification_changed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    changed RECORD;
BEGIN
    IF TG_OP = 'DELETE' THEN
        changed := OLD;
    ELSE
        changed := NEW;
    END IF;

    PERFORM notify_live_event('user', changed.user_id, NULL, 'notification', changed.id::text);
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_published_announcement_changed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.status = 'published' THEN
        PERFORM notify_live_event('guild', OLD.guild_id, OLD.guild_id, 'announcement', OLD.id::text);
    ELSIF TG_OP IN ('INSERT', 'UPDATE') AND NEW.status = 'published' THEN
        PERFORM notify_live_event('guild', NEW.guild_id, NEW.guild_id, 'announcement', NEW.id::text);
    END IF;
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_raffle_cancelled() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    SELECT t.user_id,
           'A raffle was cancelled',
           NEW.title || ' was cancelled. Your ' || t.tickets
               || CASE WHEN t.tickets = 1 THEN ' ticket was' ELSE ' tickets were' END
               || ' refunded (' || gold_amount(t.tickets * NEW.ticket_price) || ' gold).',
           'raffleCancelled',
           '/dashboard/raffle/' || NEW.id,
           jsonb_build_object(
               'raffle', NEW.title,
               'tickets', t.tickets,
               'amount', gold_amount(t.tickets * NEW.ticket_price),
               'guildId', NEW.guild_id,
               'raffleId', NEW.id
           )
    FROM (
        SELECT user_id, COUNT(*)::int AS tickets
        FROM raffle_tickets WHERE raffle_id = NEW.id
        GROUP BY user_id
    ) t
    WHERE notification_enabled(t.user_id, 'raffle');
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_raffle_rows_changed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    changed RECORD;
BEGIN
    FOR changed IN
        SELECT DISTINCT r.guild_id, r.id
        FROM changed_rows c
        JOIN raffles r ON r.id = c.raffle_id
    LOOP
        PERFORM notify_live_event('guild', changed.guild_id, changed.guild_id, 'raffle', changed.id::text);
    END LOOP;
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_raffle_won() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    raffle RECORD;
    prize  TEXT := COALESCE(NULLIF(NEW.prize_description, ''), '');
BEGIN
    SELECT id, guild_id, title INTO raffle FROM raffles WHERE id = NEW.raffle_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'You won a raffle prize',
        'You placed #' || NEW.rank || ' in ' || raffle.title || ' and won '
            || CASE WHEN prize = '' THEN gold_amount(NEW.prize_amount) || ' gold' ELSE prize END || '.',
        'raffleWon',
        '/dashboard/raffle/' || NEW.raffle_id,
        jsonb_build_object(
            'raffle', raffle.title,
            'rank', NEW.rank,
            'prize', prize,
            'amount', gold_amount(NEW.prize_amount),
            'prizeType', CASE WHEN prize = '' THEN 'gold' ELSE 'item' END,
            'guildId', raffle.guild_id,
            'raffleId', NEW.raffle_id
        )
    );
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_roll_call_gold_received() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    roll_call RECORD;
BEGIN
    SELECT id, title INTO roll_call FROM roll_calls WHERE id = NEW.reference_id;

    INSERT INTO notifications (user_id, title, message, type, action_url, params)
    VALUES (
        NEW.user_id,
        'You received roll call gold',
        'You received ' || gold_amount(NEW.amount) || ' gold from '
            || COALESCE(roll_call.title, 'a roll call') || '.',
        'rollCallGoldReceived',
        '/dashboard/wallet',
        jsonb_build_object(
            'amount', gold_amount(NEW.amount),
            'rollCall', COALESCE(roll_call.title, ''),
            'guildId', NEW.guild_id,
            'rollCallId', NEW.reference_id,
            'transactionId', NEW.id
        )
    );
    RETURN NULL;
END;
$$;

CREATE FUNCTION notify_wallet_changed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

CREATE FUNCTION notify_withdrawal_request_reviewed() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

CREATE FUNCTION notify_withdrawal_request_submitted() RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
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
$$;

CREATE FUNCTION unique_member_name(p_guild_id UUID, p_base TEXT, p_member_id UUID) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    base      TEXT := left(COALESCE(NULLIF(btrim(p_base), ''), 'member'), 29);
    candidate TEXT := base;
    suffix    INT  := 1;
BEGIN
    WHILE EXISTS (
        SELECT 1 FROM members
        WHERE guild_id = p_guild_id
          AND lower(display_name) = lower(candidate)
          AND id IS DISTINCT FROM p_member_id
    ) LOOP
        suffix := suffix + 1;
        candidate := base || '-' || suffix;
    END LOOP;
    RETURN candidate;
END;
$$;

CREATE TRIGGER members_assign_display_name
    BEFORE INSERT OR UPDATE OF display_name ON members
    FOR EACH ROW
    EXECUTE FUNCTION assign_member_display_name();

CREATE TRIGGER members_enqueue_authz_sync
    AFTER INSERT OR DELETE OR UPDATE OF role, guild_id, user_id ON members
    FOR EACH ROW
    EXECUTE FUNCTION enqueue_authz_member_sync();

CREATE TRIGGER member_role_changes_notify
    AFTER INSERT ON member_role_changes
    FOR EACH ROW
    EXECUTE FUNCTION notify_member_role_changed();

CREATE TRIGGER notifications_notify_changed
    AFTER INSERT OR DELETE ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION notify_notification_changed();

CREATE TRIGGER notifications_notify_updated
    AFTER UPDATE ON notifications
    FOR EACH ROW
    WHEN (OLD.* IS DISTINCT FROM NEW.*)
    EXECUTE FUNCTION notify_notification_changed();

CREATE TRIGGER announcements_live_event_published
    AFTER INSERT OR DELETE OR UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION notify_published_announcement_changed();

CREATE TRIGGER wallets_notify_changed
    AFTER INSERT OR UPDATE OF balance ON wallets
    FOR EACH ROW
    EXECUTE FUNCTION notify_wallet_changed();

CREATE TRIGGER transactions_notify_gold_transfer_received
    AFTER INSERT ON transactions
    FOR EACH ROW
    WHEN ((NEW.type = 'TRANSFER_IN') AND (NEW.amount > 0))
    EXECUTE FUNCTION notify_gold_transfer_received();

CREATE TRIGGER transactions_notify_roll_call_gold_received
    AFTER INSERT ON transactions
    FOR EACH ROW
    WHEN ((NEW.type = 'ROLL_CALL_GOLD') AND (NEW.amount > 0))
    EXECUTE FUNCTION notify_roll_call_gold_received();

CREATE TRIGGER guild_bank_notify_live
    AFTER INSERT OR DELETE OR UPDATE ON guild_bank
    FOR EACH ROW
    EXECUTE FUNCTION notify_guild_row_changed('bank');

CREATE TRIGGER bank_contributions_notify_live
    AFTER INSERT OR DELETE OR UPDATE ON bank_contributions
    FOR EACH ROW
    EXECUTE FUNCTION notify_guild_row_changed('bank');

CREATE TRIGGER bank_items_log_event
    AFTER INSERT ON bank_items
    FOR EACH ROW
    EXECUTE FUNCTION log_bank_item_event();

CREATE TRIGGER bank_items_notify_live
    AFTER INSERT OR DELETE OR UPDATE ON bank_items
    FOR EACH ROW
    EXECUTE FUNCTION notify_guild_row_changed('bank');

CREATE TRIGGER item_requests_log_insert_event
    AFTER INSERT ON item_requests
    FOR EACH ROW
    EXECUTE FUNCTION log_item_request_event();

CREATE TRIGGER item_requests_log_review_event
    AFTER UPDATE OF status ON item_requests
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION log_item_request_event();

CREATE TRIGGER item_requests_notify_live
    AFTER INSERT OR DELETE OR UPDATE ON item_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_guild_row_changed('bank');

CREATE TRIGGER item_requests_notify_reviewed
    AFTER UPDATE OF status ON item_requests
    FOR EACH ROW
    WHEN ((OLD.status = 'pending') AND (NEW.status IN ('approved', 'rejected')))
    EXECUTE FUNCTION notify_bank_request_reviewed('item');

CREATE TRIGGER item_requests_notify_submitted
    AFTER INSERT ON item_requests
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION notify_bank_request_submitted('item');

CREATE TRIGGER fund_requests_notify_live
    AFTER INSERT OR DELETE OR UPDATE ON fund_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_guild_row_changed('bank');

CREATE TRIGGER fund_requests_notify_reviewed
    AFTER UPDATE OF status ON fund_requests
    FOR EACH ROW
    WHEN ((OLD.status = 'pending') AND (NEW.status IN ('approved', 'rejected')))
    EXECUTE FUNCTION notify_bank_request_reviewed('fund');

CREATE TRIGGER fund_requests_notify_submitted
    AFTER INSERT ON fund_requests
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION notify_bank_request_submitted('fund');

CREATE TRIGGER withdrawal_requests_notify_live
    AFTER INSERT OR DELETE OR UPDATE ON withdrawal_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_guild_row_changed('withdrawal');

CREATE TRIGGER withdrawal_requests_notify_reviewed
    AFTER UPDATE OF status ON withdrawal_requests
    FOR EACH ROW
    WHEN ((OLD.status = 'pending') AND (NEW.status IN ('approved', 'rejected')))
    EXECUTE FUNCTION notify_withdrawal_request_reviewed();

CREATE TRIGGER withdrawal_requests_notify_submitted
    AFTER INSERT ON withdrawal_requests
    FOR EACH ROW
    WHEN (NEW.status = 'pending')
    EXECUTE FUNCTION notify_withdrawal_request_submitted();

CREATE TRIGGER backpack_items_log_insert_event
    AFTER INSERT ON backpack_items
    FOR EACH ROW
    EXECUTE FUNCTION log_backpack_item_event();

CREATE TRIGGER backpack_items_log_transfer_event
    AFTER UPDATE OF owner_id ON backpack_items
    FOR EACH ROW
    WHEN (OLD.owner_id IS DISTINCT FROM NEW.owner_id)
    EXECUTE FUNCTION log_backpack_item_event();

CREATE TRIGGER backpack_items_notify_delivery_removed
    AFTER DELETE ON backpack_items
    FOR EACH ROW
    WHEN (OLD.delivery_requested_at IS NOT NULL)
    EXECUTE FUNCTION notify_delivery_changed();

CREATE TRIGGER backpack_items_notify_delivery_requested
    AFTER UPDATE OF delivery_requested_at ON backpack_items
    FOR EACH ROW
    WHEN (OLD.delivery_requested_at IS DISTINCT FROM NEW.delivery_requested_at)
    EXECUTE FUNCTION notify_delivery_changed();

CREATE TRIGGER backpack_items_notify_live
    AFTER INSERT OR DELETE OR UPDATE ON backpack_items
    FOR EACH ROW
    EXECUTE FUNCTION notify_backpack_changed();

CREATE TRIGGER backpack_items_notify_loot_assigned
    AFTER INSERT ON backpack_items
    FOR EACH ROW
    WHEN ((NEW.source = 'roll_call') AND (NEW.source_id IS NOT NULL))
    EXECUTE FUNCTION notify_loot_assigned();

CREATE TRIGGER backpack_items_notify_received
    AFTER UPDATE OF owner_id ON backpack_items
    FOR EACH ROW
    WHEN ((OLD.owner_id IS DISTINCT FROM NEW.owner_id) AND (NEW.source IN ('transfer', 'admin')))
    EXECUTE FUNCTION notify_backpack_item_received();

CREATE TRIGGER item_events_notify_delivered
    AFTER INSERT ON item_events
    FOR EACH ROW
    WHEN ((NEW.kind = 'delivered') AND (NEW.subject_id IS NOT NULL))
    EXECUTE FUNCTION notify_item_delivered();

CREATE TRIGGER auctions_notify_cancelled
    AFTER UPDATE OF status ON auctions
    FOR EACH ROW
    WHEN ((OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'CANCELLED'))
    EXECUTE FUNCTION notify_auction_cancelled();

CREATE TRIGGER auctions_notify_ended
    AFTER UPDATE OF status ON auctions
    FOR EACH ROW
    WHEN ((OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'ENDED'))
    EXECUTE FUNCTION notify_auction_ended();

CREATE TRIGGER auctions_notify_live_event
    AFTER INSERT OR DELETE OR UPDATE ON auctions
    FOR EACH ROW
    EXECUTE FUNCTION notify_guild_row_changed('auction');

CREATE TRIGGER auctions_notify_outbid
    AFTER UPDATE OF current_bidder_id ON auctions
    FOR EACH ROW
    WHEN ((OLD.current_bidder_id IS NOT NULL) AND (NEW.current_bidder_id IS NOT NULL) AND (OLD.current_bidder_id IS DISTINCT FROM NEW.current_bidder_id) AND (NOT NEW.is_blind) AND notification_enabled(OLD.current_bidder_id, 'auction'))
    EXECUTE FUNCTION notify_auction_outbid();

CREATE TRIGGER bids_notify_live_event
    AFTER INSERT OR DELETE OR UPDATE ON bids
    FOR EACH ROW
    EXECUTE FUNCTION notify_bid_changed();

CREATE TRIGGER raffles_live_event
    AFTER INSERT OR DELETE OR UPDATE ON raffles
    FOR EACH ROW
    EXECUTE FUNCTION notify_guild_row_changed('raffle');

CREATE TRIGGER raffles_notify_cancelled
    AFTER UPDATE OF status ON raffles
    FOR EACH ROW
    WHEN ((OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status = 'cancelled'))
    EXECUTE FUNCTION notify_raffle_cancelled();

CREATE TRIGGER raffle_tickets_live_event_delete
    AFTER DELETE ON raffle_tickets
    REFERENCING OLD TABLE AS changed_rows
    FOR EACH STATEMENT
    EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_tickets_live_event_insert
    AFTER INSERT ON raffle_tickets
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT
    EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_tickets_live_event_update
    AFTER UPDATE ON raffle_tickets
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT
    EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_winners_live_event_delete
    AFTER DELETE ON raffle_winners
    REFERENCING OLD TABLE AS changed_rows
    FOR EACH STATEMENT
    EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_winners_live_event_insert
    AFTER INSERT ON raffle_winners
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT
    EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_winners_live_event_update
    AFTER UPDATE ON raffle_winners
    REFERENCING NEW TABLE AS changed_rows
    FOR EACH STATEMENT
    EXECUTE FUNCTION notify_raffle_rows_changed();

CREATE TRIGGER raffle_winners_notify_won
    AFTER INSERT ON raffle_winners
    FOR EACH ROW
    WHEN (notification_enabled(NEW.user_id, 'raffle'))
    EXECUTE FUNCTION notify_raffle_won();

INSERT INTO users (id, email, username, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'system@guma.local', 'system', 'System');

INSERT INTO guilds (id, name, description, owner_id, public)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Sunbaby',
    'Default guild',
    '00000000-0000-0000-0000-000000000001',
    TRUE
);
