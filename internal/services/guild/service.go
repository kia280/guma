package guild

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/services/pagination"
)

// Guild is the domain model for a guild.
type Guild struct {
	ID          string
	Name        string
	Description string
	OwnerID     string
	Settings    GuildSettings
	IconURL     string
	BannerURL   string
	MemberCount int32
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// GuildSettings holds configurable guild options stored as individual DB columns.
type GuildSettings struct {
	Timezone       string
	Language       string
	Public         bool
	AllowInvites   bool
	CustomSettings map[string]string
}

// CreateParams holds the inputs for CreateGuild.
type CreateParams struct {
	Name           string
	Description    string
	CustomSettings map[string]string
	IconURL        string
	BannerURL      string
	OwnerID        string
}

// UpdateParams holds the inputs for UpdateGuild.
type UpdateParams struct {
	GuildID     string
	UserID      string
	Name        string
	Description string
	IconURL     string
	BannerURL   string
}

// ListParams holds the inputs for ListGuilds.
type ListParams struct {
	Search   string
	PageSize int
	Offset   int
}

// ListResult is returned by ListGuilds.
type ListResult struct {
	Guilds     []*Guild
	TotalCount int32
	NextOffset int
}

// Service handles guild business logic and database access.
type Service struct {
	q      *db.Queries
	az     authz.Authorizer
	logger zerolog.Logger
}

// New creates a new guild Service.
func New(pool *database.Pool, az authz.Authorizer, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{
		q:      q,
		az:     az,
		logger: logger.With().Str("service", "guild").Logger(),
	}
}

// mkGuild constructs a Guild domain value from the common column set.
func mkGuild(
	id, ownerID uuid.UUID,
	name, description string,
	timezone, language string,
	public, allowInvites bool,
	customSettings []byte,
	iconURL, bannerURL string,
	createdAt, updatedAt time.Time,
) *Guild {
	cs := map[string]string{}
	if len(customSettings) > 0 {
		_ = json.Unmarshal(customSettings, &cs)
	}
	return &Guild{
		ID:          id.String(),
		Name:        name,
		Description: description,
		OwnerID:     ownerID.String(),
		Settings: GuildSettings{
			Timezone:       timezone,
			Language:       language,
			Public:         public,
			AllowInvites:   allowInvites,
			CustomSettings: cs,
		},
		IconURL:   iconURL,
		BannerURL: bannerURL,
		CreatedAt: createdAt,
		UpdatedAt: updatedAt,
	}
}

// Create inserts a new guild and adds the owner as a member.
func (s *Service) Create(ctx context.Context, p CreateParams) (*Guild, error) {
	ownerID, err := uuid.Parse(p.OwnerID)
	if err != nil {
		return nil, fmt.Errorf("%w: owner id", errs.ErrInvalidArgument)
	}

	cs := p.CustomSettings
	if cs == nil {
		cs = map[string]string{}
	}
	csJSON, err := json.Marshal(cs)
	if err != nil {
		return nil, fmt.Errorf("%w: encode custom_settings: %v", errs.ErrInternal, err)
	}

	row, err := s.q.CreateGuild(ctx, db.CreateGuildParams{
		Name:           p.Name,
		Description:    p.Description,
		OwnerID:        ownerID,
		CustomSettings: csJSON,
		IconUrl:        p.IconURL,
		BannerUrl:      p.BannerURL,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: create guild: %v", errs.ErrInternal, err)
	}

	g := mkGuild(
		row.ID, row.OwnerID,
		row.Name, row.Description,
		row.Timezone, row.Language, row.Public, row.AllowInvites,
		row.CustomSettings,
		row.IconUrl, row.BannerUrl,
		row.CreatedAt, row.UpdatedAt,
	)

	if err := s.q.InsertGuildMember(ctx, db.InsertGuildMemberParams{
		UserID:  ownerID,
		GuildID: row.ID,
		Role:    string(authz.RoleOwner),
	}); err != nil {
		return nil, fmt.Errorf("%w: add owner member: %v", errs.ErrInternal, err)
	}
	authz.SyncAfterCommit(ctx, s.az, s.logger, row.ID, ownerID)

	g.MemberCount = 1
	s.logger.Info().Str("guild_id", g.ID).Str("owner_id", p.OwnerID).Msg("guild created")
	return g, nil
}

// Get fetches a single guild by ID.
func (s *Service) Get(ctx context.Context, guildID string) (*Guild, error) {
	id, err := uuid.Parse(guildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	return s.fetch(ctx, id)
}

// Update modifies an existing guild. The requesting user must be owner or admin.
func (s *Service) Update(ctx context.Context, p UpdateParams) (*Guild, error) {
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(p.UserID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageGuild); err != nil {
		return nil, err
	}

	row, err := s.q.UpdateGuild(ctx, db.UpdateGuildParams{
		Name:        p.Name,
		Description: p.Description,
		IconUrl:     p.IconURL,
		BannerUrl:   p.BannerURL,
		ID:          guildID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: update guild: %v", errs.ErrInternal, err)
	}

	g := mkGuild(
		row.ID, row.OwnerID,
		row.Name, row.Description,
		row.Timezone, row.Language, row.Public, row.AllowInvites,
		row.CustomSettings,
		row.IconUrl, row.BannerUrl,
		row.CreatedAt, row.UpdatedAt,
	)
	g.MemberCount, _ = s.memberCount(ctx, guildID)
	return g, nil
}

// Delete removes a guild. Only the owner can delete.
func (s *Service) Delete(ctx context.Context, guildIDStr, userIDStr string) error {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.DeleteGuild); err != nil {
		return err
	}
	if err := s.q.DeleteGuild(ctx, guildID); err != nil {
		return fmt.Errorf("%w: delete guild: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("guild_id", guildIDStr).Str("user_id", userIDStr).Msg("guild deleted")
	return nil
}

// List returns a paginated, searchable list of guilds.
func (s *Service) List(ctx context.Context, p ListParams) (*ListResult, error) {
	pageSize := pagination.StandardSize(p.PageSize)

	search := "%" + p.Search + "%"

	rows, err := s.q.ListGuilds(ctx, db.ListGuildsParams{
		Search:     search,
		PageSize:   int32(pageSize),
		PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list guilds: %v", errs.ErrInternal, err)
	}

	guilds := make([]*Guild, 0, len(rows))
	for _, row := range rows {
		g := mkGuild(
			row.ID, row.OwnerID,
			row.Name, row.Description,
			row.Timezone, row.Language, row.Public, row.AllowInvites,
			row.CustomSettings,
			row.IconUrl, row.BannerUrl,
			row.CreatedAt, row.UpdatedAt,
		)
		g.MemberCount, _ = s.memberCount(ctx, row.ID)
		guilds = append(guilds, g)
	}

	total, err := s.q.CountGuilds(ctx, search)
	if err != nil {
		return nil, fmt.Errorf("%w: count guilds: %v", errs.ErrInternal, err)
	}

	nextOffset := 0
	if len(guilds) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListResult{Guilds: guilds, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// GetCurrent returns the most recently active guild for the user, or nil if not in any guild.
func (s *Service) GetCurrent(ctx context.Context, userIDStr string) (*Guild, error) {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, nil
	}

	row, err := s.q.GetUserCurrentGuild(ctx, userID)
	if err != nil {
		return nil, nil // not a member of any guild
	}
	g := mkGuild(
		row.ID, row.OwnerID,
		row.Name, row.Description,
		row.Timezone, row.Language, row.Public, row.AllowInvites,
		row.CustomSettings,
		row.IconUrl, row.BannerUrl,
		row.CreatedAt, row.UpdatedAt,
	)
	g.MemberCount, _ = s.memberCount(ctx, row.ID)
	return g, nil
}

// Join adds the user to a public guild. No-ops if already a member.
func (s *Service) Join(ctx context.Context, guildIDStr, userIDStr string) (*Guild, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}

	public, err := s.q.GetGuildPublic(ctx, guildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	if !public {
		return nil, fmt.Errorf("%w: guild is not public", errs.ErrPermissionDenied)
	}

	if err := s.q.InsertGuildMember(ctx, db.InsertGuildMemberParams{
		UserID:  userID,
		GuildID: guildID,
		Role:    string(authz.RoleMember),
	}); err != nil {
		return nil, fmt.Errorf("%w: join guild: %v", errs.ErrInternal, err)
	}
	authz.SyncAfterCommit(ctx, s.az, s.logger, guildID, userID)
	return s.fetch(ctx, guildID)
}

// Leave removes the user from a guild. Owner must transfer ownership first.
func (s *Service) Leave(ctx context.Context, guildIDStr, userIDStr string) error {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}

	ownerID, err := s.q.GetGuildOwner(ctx, guildID)
	if err != nil {
		return fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	if ownerID == userID {
		return fmt.Errorf("%w: owner must transfer ownership before leaving", errs.ErrFailedPrecondition)
	}
	if err := s.q.DeleteGuildMember(ctx, db.DeleteGuildMemberParams{
		UserID:  userID,
		GuildID: guildID,
	}); err != nil {
		return fmt.Errorf("%w: leave guild: %v", errs.ErrInternal, err)
	}
	authz.SyncAfterCommit(ctx, s.az, s.logger, guildID, userID)
	return nil
}

// GetSettings returns the settings for a guild.
func (s *Service) GetSettings(ctx context.Context, guildIDStr string) (*GuildSettings, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}

	row, err := s.q.GetGuildSettings(ctx, guildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}

	cs := map[string]string{}
	if len(row.CustomSettings) > 0 {
		_ = json.Unmarshal(row.CustomSettings, &cs)
	}
	return &GuildSettings{
		Timezone:       row.Timezone,
		Language:       row.Language,
		Public:         row.Public,
		AllowInvites:   row.AllowInvites,
		CustomSettings: cs,
	}, nil
}

// UpdateSettings replaces guild settings. Requires owner or admin role.
func (s *Service) UpdateSettings(ctx context.Context, guildIDStr, userIDStr string, settings GuildSettings) (*GuildSettings, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageGuild); err != nil {
		return nil, err
	}

	cs := settings.CustomSettings
	if cs == nil {
		cs = map[string]string{}
	}
	csJSON, err := json.Marshal(cs)
	if err != nil {
		return nil, fmt.Errorf("%w: encode custom_settings: %v", errs.ErrInternal, err)
	}

	if err := s.q.UpdateGuildSettings(ctx, db.UpdateGuildSettingsParams{
		Timezone:       settings.Timezone,
		Language:       settings.Language,
		Public:         settings.Public,
		AllowInvites:   settings.AllowInvites,
		CustomSettings: csJSON,
		ID:             guildID,
	}); err != nil {
		return nil, fmt.Errorf("%w: update settings: %v", errs.ErrInternal, err)
	}
	settings.CustomSettings = cs
	return &settings, nil
}

// --- internal helpers ---

func (s *Service) fetch(ctx context.Context, guildID uuid.UUID) (*Guild, error) {
	row, err := s.q.GetGuild(ctx, guildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	g := mkGuild(
		row.ID, row.OwnerID,
		row.Name, row.Description,
		row.Timezone, row.Language, row.Public, row.AllowInvites,
		row.CustomSettings,
		row.IconUrl, row.BannerUrl,
		row.CreatedAt, row.UpdatedAt,
	)
	g.MemberCount, _ = s.memberCount(ctx, guildID)
	return g, nil
}

func (s *Service) memberCount(ctx context.Context, guildID uuid.UUID) (int32, error) {
	n, err := s.q.CountGuildMembers(ctx, guildID)
	return int32(n), err
}

// NextPageToken encodes the offset as a page token string.
func NextPageToken(offset int) string {
	if offset == 0 {
		return ""
	}
	return strconv.Itoa(offset)
}

// ParsePageToken decodes a page token string to an offset.
func ParsePageToken(token string) (int, error) {
	if token == "" {
		return 0, nil
	}
	n, err := strconv.ParseInt(token, 10, 32)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("%w: invalid page_token", errs.ErrInvalidArgument)
	}
	return int(n), nil
}
