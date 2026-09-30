package user

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	kratos "github.com/ory/kratos-client-go"
	"github.com/rs/zerolog"
	"golang.org/x/text/unicode/norm"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

// User is the domain model for an authenticated user.
type User struct {
	ID             string
	Email          string
	DisplayName    string
	Bio            string
	AvatarURL      string
	GuildIDs       []string
	CurrentGuildID string
	Balance        int64
	CreatedAt      time.Time
	UpdatedAt      time.Time

	EmailVerified    *bool
	Discord          *LinkedAccount
	CurrentGuildRole string
}

// LinkedAccount is an external identity provider account linked to the user.
type LinkedAccount struct {
	Provider string
	Subject  string
	Username string
}

// UpdateParams holds the fields for UpdateMe.
type UpdateParams struct {
	DisplayName string
	Bio         string
	AvatarURL   string
}

const (
	MaxDisplayNameLength = 32
	MaxBioLength         = 500
	uniqueViolation      = "23505"
)

// Stats holds aggregate stats for a user.
type Stats struct {
	GuildsJoined      int32
	EventsAttended    int32
	AuctionsWon       int32
	RafflesWon        int32
	TotalEarned       int64
	TotalSpent        int64
	RollCallsAttended int32
}

// Service handles user business logic and database access.
type Service struct {
	pool   *database.Pool
	q      *db.Queries
	kratos *kratos.APIClient
	logger zerolog.Logger

	kratosAdmin *kratos.APIClient
	devAuth     bool
}

// Option configures optional Service behavior.
type Option func(*Service)

// WithDevAuth lets GetMe serve users that have no Kratos session by reading
// the existing users row. Only enable it for development impersonation.
func WithDevAuth(enabled bool) Option {
	return func(s *Service) {
		s.devAuth = enabled
	}
}

// WithKratosAdminURL enables looking up linked identity provider accounts
// through the Kratos admin API.
func WithKratosAdminURL(url string) Option {
	return func(s *Service) {
		s.kratosAdmin = newKratosClient(url)
	}
}

// New creates a new user Service. kratosPublicURL is used by GetMe to
// whoami-refresh the user profile from Kratos on every call.
func New(pool *database.Pool, kratosPublicURL string, logger zerolog.Logger, opts ...Option) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	s := &Service{
		pool:   pool,
		q:      q,
		kratos: newKratosClient(kratosPublicURL),
		logger: logger.With().Str("service", "user").Logger(),
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

func newKratosClient(baseURL string) *kratos.APIClient {
	trimmed := strings.TrimSuffix(strings.TrimSpace(baseURL), "/")
	if trimmed == "" {
		return nil
	}
	cfg := kratos.NewConfiguration()
	cfg.Servers = kratos.ServerConfigurations{{URL: trimmed}}
	cfg.HTTPClient = &http.Client{Timeout: 5 * time.Second}
	return kratos.NewAPIClient(cfg)
}

// GetMe returns the full profile for the authenticated user. It first
// whoamis Kratos using the forwarded session cookie so the users row stays
// in sync with the canonical identity (email, avatar), bootstrapping the
// row on first touch. kratosCookie is a raw "name=value" Cookie header
// value forwarded by the gateway.
func (s *Service) GetMe(ctx context.Context, userID, kratosCookie string) (*User, error) {
	s.logger.Info().
		Str("user_id", userID).
		Str("kratos_cookie", kratosCookie).
		Msg("GetMe")

	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
	}

	row, ident, err := s.loadProfile(ctx, id, kratosCookie)
	if err != nil {
		return nil, err
	}

	if err := s.autoJoinSingletonGuild(ctx, id); err != nil {
		s.logger.Warn().Err(err).Str("user_id", id.String()).Msg("auto-join singleton guild failed")
	}

	return s.assembleUser(ctx, id, row, ident)
}

func (s *Service) assembleUser(ctx context.Context, id uuid.UUID, row db.GetUserByIDRow, ident *kratosIdentity) (*User, error) {
	guildIDs, err := s.guildIDs(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query guild ids: %v", errs.ErrInternal, err)
	}

	current, err := s.currentGuild(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: current guild balance: %v", errs.ErrInternal, err)
	}

	u := &User{
		ID:               id.String(),
		Email:            row.Email,
		DisplayName:      current.displayNameOr(row.DisplayName),
		Bio:              row.Bio,
		AvatarURL:        row.AvatarUrl,
		GuildIDs:         guildIDs,
		CurrentGuildID:   current.id,
		CurrentGuildRole: current.role,
		Balance:          current.balance,
		CreatedAt:        row.CreatedAt,
		UpdatedAt:        row.UpdatedAt,
	}
	if ident != nil {
		verified := ident.emailVerified
		u.EmailVerified = &verified
		u.Discord = s.discordLink(ctx, id, ident)
	}
	return u, nil
}

func (s *Service) loadProfile(ctx context.Context, id uuid.UUID, kratosCookie string) (db.GetUserByIDRow, *kratosIdentity, error) {
	if kratosCookie == "" && s.devAuth {
		row, err := s.q.GetUserByID(ctx, id)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return db.GetUserByIDRow{}, nil, fmt.Errorf("%w: user", errs.ErrNotFound)
			}
			return db.GetUserByIDRow{}, nil, fmt.Errorf("%w: get user: %v", errs.ErrInternal, err)
		}
		return row, nil, nil
	}

	ident, err := s.fetchKratosIdentity(ctx, kratosCookie)
	if err != nil {
		return db.GetUserByIDRow{}, nil, err
	}
	if ident.email == "" {
		return db.GetUserByIDRow{}, nil, fmt.Errorf("%w: kratos identity missing email", errs.ErrFailedPrecondition)
	}

	row, err := s.q.UpsertUserFromKratos(ctx, db.UpsertUserFromKratosParams{
		ID:              id,
		Email:           ident.email,
		DisplayName:     defaultDisplayName(ident),
		AvatarUrl:       ident.avatarURL,
		DiscordUsername: ident.discordUsername,
	})
	if err != nil {
		return db.GetUserByIDRow{}, nil, fmt.Errorf("%w: upsert user: %v", errs.ErrInternal, err)
	}
	return db.GetUserByIDRow(row), &ident, nil
}

func defaultDisplayName(ident kratosIdentity) string {
	for _, name := range []string{ident.username, ident.discordUsername} {
		if name = norm.NFC.String(strings.TrimSpace(name)); name != "" {
			return truncateRunes(name, MaxDisplayNameLength)
		}
	}
	suffix := make([]byte, 4)
	_, _ = rand.Read(suffix)
	return "member-" + hex.EncodeToString(suffix)
}

func truncateRunes(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max])
}

// kratosIdentity is the subset of Kratos whoami output the user service cares about.
type kratosIdentity struct {
	email           string
	username        string
	avatarURL       string
	emailVerified   bool
	discordUsername string
}

const discordProvider = "discord"

func (s *Service) discordLink(ctx context.Context, id uuid.UUID, ident *kratosIdentity) *LinkedAccount {
	if s.kratosAdmin == nil {
		return nil
	}
	kid, resp, err := s.kratosAdmin.IdentityAPI.GetIdentity(ctx, id.String()).
		IncludeCredential([]string{"oidc"}).
		Execute()
	if resp != nil && resp.Body != nil {
		defer resp.Body.Close()
	}
	if err != nil || kid == nil {
		s.logger.Warn().Err(err).Str("user_id", id.String()).Msg("kratos admin identity lookup failed")
		return nil
	}
	if kid.Credentials == nil {
		return nil
	}
	return linkedAccountFromCredentials(*kid.Credentials, discordProvider, ident.discordUsername)
}

func linkedAccountFromCredentials(creds map[string]kratos.IdentityCredentials, provider, username string) *LinkedAccount {
	oidc, ok := creds["oidc"]
	if !ok {
		return nil
	}
	providers, _ := oidc.Config["providers"].([]any)
	for _, entry := range providers {
		p, ok := entry.(map[string]any)
		if !ok {
			continue
		}
		if name, _ := p["provider"].(string); name != provider {
			continue
		}
		subject, _ := p["subject"].(string)
		return &LinkedAccount{Provider: provider, Subject: subject, Username: username}
	}
	return nil
}

func (s *Service) fetchKratosIdentity(ctx context.Context, cookie string) (kratosIdentity, error) {
	if s.kratos == nil {
		return kratosIdentity{}, fmt.Errorf("%w: kratos client not configured", errs.ErrInternal)
	}
	if cookie == "" {
		return kratosIdentity{}, fmt.Errorf("%w: kratos session cookie missing", errs.ErrUnauthenticated)
	}

	sess, resp, err := s.kratos.FrontendAPI.ToSession(ctx).Cookie(cookie).Execute()
	if resp != nil && resp.Body != nil {
		defer resp.Body.Close()
	}
	if err != nil || sess == nil {
		return kratosIdentity{}, fmt.Errorf("%w: kratos whoami: %v", errs.ErrUnauthenticated, err)
	}

	kid, ok := sess.GetIdentityOk()
	if !ok || kid == nil {
		return kratosIdentity{}, fmt.Errorf("%w: kratos session has no identity", errs.ErrUnauthenticated)
	}
	return identityFromKratos(kid), nil
}

func identityFromKratos(kid *kratos.Identity) kratosIdentity {
	out := kratosIdentity{}
	if traits, ok := kid.GetTraitsOk(); ok && traits != nil {
		if traitMap, ok := (*traits).(map[string]any); ok {
			if email, ok := traitMap["email"].(string); ok {
				out.email = email
			}
			if name, ok := traitMap["name"].(map[string]any); ok {
				first, _ := name["first"].(string)
				last, _ := name["last"].(string)
				out.username = strings.TrimSpace(strings.TrimSpace(first) + " " + strings.TrimSpace(last))
			}
		}
	}
	if meta, ok := kid.GetMetadataPublicOk(); ok && meta != nil {
		if metaMap, ok := (*meta).(map[string]any); ok {
			if avatar, ok := metaMap["avatar"].(string); ok {
				out.avatarURL = avatar
			}
			if name, ok := metaMap["discord_username"].(string); ok {
				out.discordUsername = strings.TrimSpace(name)
			}
		}
	}
	for _, addr := range kid.VerifiableAddresses {
		if addr.Via == "email" && addr.Value == out.email && addr.Verified {
			out.emailVerified = true
		}
	}
	return out
}

// UpdateMe updates mutable profile fields for the authenticated user.
// kratosCookie is optional and only used to enrich the response with the
// identity state; a failed lookup leaves those fields unset.
func (s *Service) UpdateMe(ctx context.Context, userID, kratosCookie string, p UpdateParams) (*User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
	}

	p, err = validateUpdateParams(p)
	if err != nil {
		return nil, err
	}

	row, err := s.updateProfile(ctx, id, p)
	if err != nil {
		return nil, err
	}

	var ident *kratosIdentity
	if kratosCookie != "" {
		fetched, err := s.fetchKratosIdentity(ctx, kratosCookie)
		if err != nil {
			s.logger.Warn().Err(err).Str("user_id", id.String()).Msg("kratos identity lookup failed")
		} else {
			ident = &fetched
		}
	}

	return s.assembleUser(ctx, id, db.GetUserByIDRow(row), ident)
}

func (s *Service) updateProfile(ctx context.Context, id uuid.UUID, p UpdateParams) (db.UpdateUserRow, error) {
	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return db.UpdateUserRow{}, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	row, err := qtx.UpdateUser(ctx, db.UpdateUserParams{
		DisplayName: p.DisplayName,
		Bio:         p.Bio,
		AvatarUrl:   p.AvatarURL,
		ID:          id,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.UpdateUserRow{}, fmt.Errorf("%w: user", errs.ErrNotFound)
		}
		return db.UpdateUserRow{}, fmt.Errorf("%w: update user: %v", errs.ErrInternal, err)
	}

	current, err := qtx.GetUserCurrentGuildBalance(ctx, id)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
	case err != nil:
		return db.UpdateUserRow{}, fmt.Errorf("%w: current guild: %v", errs.ErrInternal, err)
	default:
		if _, err := qtx.UpdateMemberDisplayName(ctx, db.UpdateMemberDisplayNameParams{
			DisplayName: p.DisplayName, UserID: id, GuildID: current.GuildID,
		}); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.Code == uniqueViolation {
				return db.UpdateUserRow{}, fmt.Errorf("%w: display_name is already used in this guild", errs.ErrAlreadyExists)
			}
			return db.UpdateUserRow{}, fmt.Errorf("%w: update guild name: %v", errs.ErrInternal, err)
		}
	}

	if err := pgtx.Commit(ctx); err != nil {
		return db.UpdateUserRow{}, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	return row, nil
}

func validateUpdateParams(p UpdateParams) (UpdateParams, error) {
	p.DisplayName = norm.NFC.String(strings.TrimSpace(p.DisplayName))
	p.Bio = norm.NFC.String(strings.TrimSpace(p.Bio))
	p.AvatarURL = strings.TrimSpace(p.AvatarURL)

	switch {
	case p.DisplayName == "":
		return p, fmt.Errorf("%w: display_name is required", errs.ErrInvalidArgument)
	case utf8.RuneCountInString(p.DisplayName) > MaxDisplayNameLength:
		return p, fmt.Errorf("%w: display_name must be at most %d characters", errs.ErrInvalidArgument, MaxDisplayNameLength)
	case utf8.RuneCountInString(p.Bio) > MaxBioLength:
		return p, fmt.Errorf("%w: bio must be at most %d characters", errs.ErrInvalidArgument, MaxBioLength)
	}
	return p, nil
}

// GetUser returns the public profile for any user by ID.
func (s *Service) GetUser(ctx context.Context, userID string) (*User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
	}

	row, err := s.q.GetUserPublicByID(ctx, id)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: get user: %v", errs.ErrInternal, err)
	}

	return &User{
		ID:          row.ID.String(),
		DisplayName: row.DisplayName,
		AvatarURL:   row.AvatarUrl,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}, nil
}

// GetStats returns aggregate stats for the authenticated user.
func (s *Service) GetStats(ctx context.Context, userID string) (*Stats, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
	}

	guilds, err := s.q.CountUserGuilds(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query guilds joined: %v", errs.ErrInternal, err)
	}
	attendance, err := s.q.CountUserAttendance(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query attendance: %v", errs.ErrInternal, err)
	}
	events, err := s.q.CountUserEventsAttended(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query events: %v", errs.ErrInternal, err)
	}
	auctionsWon, err := s.q.CountUserAuctionsWon(ctx, &id)
	if err != nil {
		return nil, fmt.Errorf("%w: query auctions won: %v", errs.ErrInternal, err)
	}
	rafflesWon, err := s.q.CountUserRafflesWon(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query raffles won: %v", errs.ErrInternal, err)
	}
	totals, err := s.q.SumUserEarnedSpent(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query totals: %v", errs.ErrInternal, err)
	}

	return &Stats{
		GuildsJoined:      int32(guilds),
		RollCallsAttended: int32(attendance),
		EventsAttended:    int32(events),
		AuctionsWon:       int32(auctionsWon),
		RafflesWon:        int32(rafflesWon),
		TotalEarned:       totals.TotalEarned,
		TotalSpent:        totals.TotalSpent,
	}, nil
}

// --- internal helpers ---

// autoJoinSingletonGuild drops a freshly-bootstrapped user into the one and
// only guild when the deployment has exactly one. A no-op if the user is
// already a member of any guild, if there are zero guilds, or if there are
// two or more. Failures are non-fatal to the caller.
func (s *Service) autoJoinSingletonGuild(ctx context.Context, userID uuid.UUID) error {
	count, err := s.q.CountUserGuilds(ctx, userID)
	if err != nil {
		return fmt.Errorf("count user guilds: %w", err)
	}
	if count > 0 {
		return nil
	}

	guildID, err := s.q.GetSingletonGuildID(ctx)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil
		}
		return fmt.Errorf("get singleton guild: %w", err)
	}

	if err := s.q.InsertGuildMember(ctx, db.InsertGuildMemberParams{
		UserID:  userID,
		GuildID: guildID,
		Role:    "admin",
	}); err != nil {
		return fmt.Errorf("insert guild member: %w", err)
	}
	s.logger.Info().
		Str("user_id", userID.String()).
		Str("guild_id", guildID.String()).
		Msg("auto-joined user to singleton guild")
	return nil
}

type currentGuild struct {
	id          string
	role        string
	balance     int64
	displayName string
}

func (c currentGuild) displayNameOr(fallback string) string {
	if c.displayName != "" {
		return c.displayName
	}
	return fallback
}

func (s *Service) currentGuild(ctx context.Context, userID uuid.UUID) (currentGuild, error) {
	row, err := s.q.GetUserCurrentGuildBalance(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return currentGuild{}, nil
		}
		return currentGuild{}, err
	}
	return currentGuild{id: row.GuildID.String(), role: row.Role, balance: row.Balance, displayName: row.DisplayName}, nil
}

func (s *Service) guildIDs(ctx context.Context, userID uuid.UUID) ([]string, error) {
	return s.guildIDsTx(ctx, s.q, userID)
}

func (s *Service) guildIDsTx(ctx context.Context, q *db.Queries, userID uuid.UUID) ([]string, error) {
	ids, err := q.ListUserGuildIDs(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		out = append(out, id.String())
	}
	return out, nil
}
