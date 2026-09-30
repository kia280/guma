package models

import (
	"time"

	"github.com/google/uuid"
)

// Item represents a shared in-game item used across auctions, backpack, bank, roll calls, and raffles
type Item struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Category    string `json:"category,omitempty"`
	Rarity      string `json:"rarity,omitempty"`
}

type ItemLock struct {
	Type string
	ID   string
}

func NewItemLock(lockType string, id *uuid.UUID) *ItemLock {
	if lockType == "" || id == nil {
		return nil
	}
	return &ItemLock{Type: lockType, ID: id.String()}
}

// User represents a user in the system
type User struct {
	ID        uuid.UUID         `json:"id"`
	Email     string            `json:"email"`
	Username  string            `json:"username"`
	Metadata  map[string]string `json:"metadata,omitempty"`
	CreatedAt time.Time         `json:"created_at"`
	UpdatedAt time.Time         `json:"updated_at"`
}

// Guild represents a guild/organization
type Guild struct {
	ID          uuid.UUID     `json:"id"`
	Name        string        `json:"name"`
	Description string        `json:"description,omitempty"`
	OwnerID     uuid.UUID     `json:"owner_id"`
	Settings    GuildSettings `json:"settings"`
	CreatedAt   time.Time     `json:"created_at"`
	UpdatedAt   time.Time     `json:"updated_at"`
	MemberCount int32         `json:"member_count"`
}

// GuildSettings represents guild configuration
type GuildSettings struct {
	Timezone       string            `json:"timezone"`
	Language       string            `json:"language"`
	Public         bool              `json:"public"`
	AllowInvites   bool              `json:"allow_invites"`
	CustomSettings map[string]string `json:"custom_settings,omitempty"`
}

// Member represents a guild member
type Member struct {
	ID          uuid.UUID         `json:"id"`
	UserID      uuid.UUID         `json:"user_id"`
	GuildID     uuid.UUID         `json:"guild_id"`
	DisplayName string            `json:"display_name"`
	Role        string            `json:"role"` // owner, admin, moderator, member
	Profile     map[string]string `json:"profile,omitempty"`
	JoinedAt    time.Time         `json:"joined_at"`
	LastActive  time.Time         `json:"last_active"`
}

// Invitation represents a guild invitation
type Invitation struct {
	ID        uuid.UUID  `json:"id"`
	GuildID   uuid.UUID  `json:"guild_id"`
	Code      string     `json:"code"`
	CreatedBy uuid.UUID  `json:"created_by"`
	Role      string     `json:"role"`
	MaxUses   int32      `json:"max_uses"`
	UseCount  int32      `json:"use_count"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	Revoked   bool       `json:"revoked"`
}

// UserPreferences represents user UI preferences
type UserPreferences struct {
	UserID     uuid.UUID         `json:"user_id"`
	Theme      string            `json:"theme"`       // light, dark, auto
	Language   string            `json:"language"`    // en, ja, etc.
	Timezone   string            `json:"timezone"`    // IANA timezone
	DateFormat string            `json:"date_format"` // date display format
	TimeFormat string            `json:"time_format"` // 12h, 24h
	UISettings map[string]string `json:"ui_settings,omitempty"`
	UpdatedAt  time.Time         `json:"updated_at"`
}

// Event represents a guild event
type Event struct {
	ID          uuid.UUID         `json:"id"`
	GuildID     uuid.UUID         `json:"guild_id"`
	Title       string            `json:"title"`
	Description string            `json:"description,omitempty"`
	Location    string            `json:"location,omitempty"`
	StartTime   time.Time         `json:"start_time"`
	EndTime     time.Time         `json:"end_time"`
	MaxSlots    int32             `json:"max_slots,omitempty"`
	CreatedBy   uuid.UUID         `json:"created_by"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

// Activity represents user/guild activity
type Activity struct {
	ID          uuid.UUID         `json:"id"`
	Type        string            `json:"type"` // guild_created, member_joined, etc.
	ActorID     uuid.UUID         `json:"actor_id"`
	ActorName   string            `json:"actor_name"`
	GuildID     *uuid.UUID        `json:"guild_id,omitempty"`
	Description string            `json:"description"`
	Metadata    map[string]string `json:"metadata,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
}

// Notification represents a user notification
type Notification struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Title     string    `json:"title"`
	Message   string    `json:"message"`
	Type      string    `json:"type"` // info, warning, error, success
	Read      bool      `json:"read"`
	ActionURL string    `json:"action_url,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}
