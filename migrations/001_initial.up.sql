-- 001_initial.up.sql
-- Full initial schema: base tables + all feature tables

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    email        TEXT        NOT NULL UNIQUE,
    username     TEXT        NOT NULL UNIQUE,
    display_name TEXT,
    bio          TEXT,
    avatar_url   TEXT,
    metadata     JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- User Preferences
-- ============================================================
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id     UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme       TEXT        NOT NULL DEFAULT 'auto',
    language    TEXT        NOT NULL DEFAULT 'en',
    timezone    TEXT        NOT NULL DEFAULT 'UTC',
    date_format TEXT        NOT NULL DEFAULT 'YYYY-MM-DD',
    time_format TEXT        NOT NULL DEFAULT '24h',
    ui_settings JSONB       NOT NULL DEFAULT '{}',
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Guilds
-- ============================================================
CREATE TABLE IF NOT EXISTS guilds (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT        NOT NULL,
    description     TEXT,
    owner_id        UUID        NOT NULL REFERENCES users(id),
    tags            TEXT[]      NOT NULL DEFAULT '{}',
    timezone        TEXT        NOT NULL DEFAULT 'UTC',
    language        TEXT        NOT NULL DEFAULT 'en',
    public          BOOLEAN     NOT NULL DEFAULT false,
    allow_invites   BOOLEAN     NOT NULL DEFAULT true,
    custom_settings JSONB       NOT NULL DEFAULT '{}',
    icon_url        TEXT,
    banner_url      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Members
-- ============================================================
CREATE TABLE IF NOT EXISTS members (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id     UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    display_name TEXT,
    role         TEXT        NOT NULL DEFAULT 'member',
    profile      JSONB       NOT NULL DEFAULT '{}',
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, guild_id)
);

-- ============================================================
-- Invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS invitations (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id   UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    code       TEXT        NOT NULL UNIQUE,
    created_by UUID        NOT NULL REFERENCES users(id),
    role       TEXT        NOT NULL DEFAULT 'member',
    max_uses   INT         NOT NULL DEFAULT 0,
    use_count  INT         NOT NULL DEFAULT 0,
    revoked    BOOLEAN     NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      TEXT        NOT NULL,
    message    TEXT        NOT NULL,
    type       TEXT        NOT NULL DEFAULT 'info',
    read       BOOLEAN     NOT NULL DEFAULT FALSE,
    action_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Activity Log
-- ============================================================
CREATE TABLE IF NOT EXISTS activity (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    type        TEXT        NOT NULL,
    actor_id    UUID        NOT NULL REFERENCES users(id),
    actor_name  TEXT        NOT NULL,
    guild_id    UUID        REFERENCES guilds(id) ON DELETE SET NULL,
    description TEXT        NOT NULL,
    metadata    JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Items
-- ============================================================
CREATE TABLE IF NOT EXISTS items (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        TEXT NOT NULL,
    description TEXT,
    category    TEXT,
    rarity      TEXT
);

-- ============================================================
-- Guild Events
-- ============================================================
CREATE TABLE IF NOT EXISTS guild_events (
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

-- ============================================================
-- Wallets
-- ============================================================
CREATE TABLE IF NOT EXISTS wallets (
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id   UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    balance    BIGINT      NOT NULL DEFAULT 0,
    currency   TEXT        NOT NULL DEFAULT 'gold',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, guild_id)
);

CREATE TABLE IF NOT EXISTS transactions (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id       UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    type           TEXT        NOT NULL,
    amount         BIGINT      NOT NULL,
    balance_after  BIGINT      NOT NULL,
    description    TEXT,
    reference_id   UUID,
    reference_type TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS backpack_items (
    id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    guild_id    UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    item        JSONB       NOT NULL,
    source      TEXT        NOT NULL,
    source_id   UUID,
    note        TEXT,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Auctions
-- ============================================================
CREATE TABLE IF NOT EXISTS auctions (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id          UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    seller_id         UUID        NOT NULL REFERENCES users(id),
    item              JSONB       NOT NULL,
    starting_bid      BIGINT      NOT NULL,
    current_bid       BIGINT      NOT NULL DEFAULT 0,
    current_bidder_id UUID        REFERENCES users(id),
    min_bid_increment BIGINT      NOT NULL DEFAULT 1,
    start_time        TIMESTAMPTZ NOT NULL,
    end_time          TIMESTAMPTZ NOT NULL,
    status            TEXT        NOT NULL DEFAULT 'UPCOMING',
    is_blind          BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bids (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    auction_id UUID        NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
    bidder_id  UUID        NOT NULL REFERENCES users(id),
    amount     BIGINT      NOT NULL,
    is_winning BOOLEAN     NOT NULL DEFAULT FALSE,
    placed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Check-ins
-- ============================================================
CREATE TABLE IF NOT EXISTS checkins (
    id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id         UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    created_by       UUID        NOT NULL REFERENCES users(id),
    title            TEXT        NOT NULL,
    description      TEXT,
    datetime         TIMESTAMPTZ NOT NULL,
    expire_time      TIMESTAMPTZ NOT NULL,
    image_url        TEXT,
    loot_list        JSONB       NOT NULL DEFAULT '[]',
    attendance_count INT         NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS checkin_attendees (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    checkin_id   UUID        NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
    user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT,
    avatar_url   TEXT,
    attended_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (checkin_id, user_id)
);

-- ============================================================
-- Lotteries
-- ============================================================
CREATE TABLE IF NOT EXISTS lotteries (
    id                   UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id             UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    created_by           UUID        NOT NULL REFERENCES users(id),
    title                TEXT        NOT NULL,
    description          TEXT,
    ticket_price         BIGINT      NOT NULL DEFAULT 0,
    tickets_sold         INT         NOT NULL DEFAULT 0,
    max_tickets          INT         NOT NULL DEFAULT 0,
    max_tickets_per_user INT         NOT NULL DEFAULT 0,
    status               TEXT        NOT NULL DEFAULT 'upcoming',
    draw_date            TIMESTAMPTZ NOT NULL,
    prizes               JSONB       NOT NULL DEFAULT '[]',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lottery_tickets (
    id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    lottery_id    UUID        NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ticket_number TEXT        NOT NULL,
    purchased_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lottery_winners (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    lottery_id        UUID        NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
    user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank              INT         NOT NULL,
    prize_amount      BIGINT      NOT NULL DEFAULT 0,
    prize_description TEXT,
    ticket_number     TEXT        NOT NULL
);

-- ============================================================
-- Guild Bank
-- ============================================================
CREATE TABLE IF NOT EXISTS guild_bank (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id   UUID        NOT NULL UNIQUE REFERENCES guilds(id) ON DELETE CASCADE,
    balance    BIGINT      NOT NULL DEFAULT 0,
    currency   TEXT        NOT NULL DEFAULT 'gold',
    goal       BIGINT      NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bank_contributions (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id   UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    username   TEXT        NOT NULL,
    amount     BIGINT      NOT NULL,
    note       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fund_requests (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id       UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    requester_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requester_name TEXT        NOT NULL,
    amount         BIGINT      NOT NULL,
    reason         TEXT,
    status         TEXT        NOT NULL DEFAULT 'pending',
    reviewer_id    UUID        REFERENCES users(id),
    review_note    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS bank_items (
    id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id   UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    donor_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    donor_name TEXT        NOT NULL,
    item       JSONB       NOT NULL,
    quantity   INT         NOT NULL DEFAULT 1,
    note       TEXT,
    donated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS item_requests (
    id             UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id       UUID        NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    bank_item_id   UUID        NOT NULL REFERENCES bank_items(id) ON DELETE CASCADE,
    requester_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requester_name TEXT        NOT NULL,
    reason         TEXT,
    status         TEXT        NOT NULL DEFAULT 'pending',
    reviewer_id    UUID        REFERENCES users(id),
    review_note    TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at    TIMESTAMPTZ
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_members_user_id      ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_guild_id     ON members(guild_id);
CREATE INDEX IF NOT EXISTS idx_invitations_code     ON invitations(code);
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_guild       ON activity(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_events_guild   ON guild_events(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_events_dates   ON guild_events(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_transactions_user    ON transactions(user_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_backpack_owner       ON backpack_items(owner_id, guild_id);
CREATE INDEX IF NOT EXISTS idx_auctions_guild       ON auctions(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_bids_auction         ON bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_checkins_guild       ON checkins(guild_id);
CREATE INDEX IF NOT EXISTS idx_checkin_attendees    ON checkin_attendees(checkin_id);
CREATE INDEX IF NOT EXISTS idx_lotteries_guild      ON lotteries(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_lottery_tickets_user ON lottery_tickets(lottery_id, user_id);
CREATE INDEX IF NOT EXISTS idx_bank_contributions   ON bank_contributions(guild_id);
CREATE INDEX IF NOT EXISTS idx_fund_requests_guild  ON fund_requests(guild_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_items_guild     ON bank_items(guild_id);
CREATE INDEX IF NOT EXISTS idx_item_requests_guild  ON item_requests(guild_id, status);

-- ============================================================
-- Seed: default guild owned by a stable system user
-- ============================================================
INSERT INTO users (id, email, username, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'system@guma.local', 'system', 'System')
ON CONFLICT (id) DO NOTHING;

INSERT INTO guilds (id, name, description, owner_id, public)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Sunbaby',
    'Default guild',
    '00000000-0000-0000-0000-000000000001',
    TRUE
)
ON CONFLICT (id) DO NOTHING;
