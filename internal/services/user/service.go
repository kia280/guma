package user

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	kratos "github.com/ory/kratos-client-go"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

// User is the domain model for an authenticated user.
type User struct {
	ID             string
	Email          string
	Username       string
	DisplayName    string
	Bio            string
	AvatarURL      string
	GuildIDs       []string
	CurrentGuildID string
	Balance        int64
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// UpdateParams holds the fields for UpdateMe.
type UpdateParams struct {
	DisplayName string
	Username    string
	Bio         string
	AvatarURL   string
}

// Stats holds aggregate stats for a user.
type Stats struct {
	GuildsJoined      int32
	EventsAttended    int32
	AuctionsWon       int32
	LotteriesWon      int32
	TotalEarned       int64
	TotalSpent        int64
	CheckinsCompleted int32
}

// BalancePoint is a single data point in a balance trend series.
type BalancePoint struct {
	Date    string
	Balance int64
}

// Service handles user business logic and database access.
type Service struct {
	pool   *database.Pool
	q      *db.Queries
	kratos *kratos.APIClient
	logger zerolog.Logger
}

// New creates a new user Service. kratosPublicURL is used by GetMe to
// whoami-refresh the user profile from Kratos on every call.
func New(pool *database.Pool, kratosPublicURL string, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	var client *kratos.APIClient
	if trimmed := strings.TrimSuffix(strings.TrimSpace(kratosPublicURL), "/"); trimmed != "" {
		cfg := kratos.NewConfiguration()
		cfg.Servers = kratos.ServerConfigurations{{URL: trimmed}}
		cfg.HTTPClient = &http.Client{Timeout: 5 * time.Second}
		client = kratos.NewAPIClient(cfg)
	}
	return &Service{
		pool:   pool,
		q:      q,
		kratos: client,
		logger: logger.With().Str("service", "user").Logger(),
	}
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

	ident, err := s.fetchKratosIdentity(ctx, kratosCookie)
	if err != nil {
		return nil, err
	}
	if ident.email == "" {
		return nil, fmt.Errorf("%w: kratos identity missing email", errs.ErrFailedPrecondition)
	}

	row, err := s.q.UpsertUserFromKratos(ctx, db.UpsertUserFromKratosParams{
		ID:          id,
		Email:       ident.email,
		Username:    ident.username,
		DisplayName: ident.username,
		AvatarUrl:   ident.avatarURL,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: upsert user: %v", errs.ErrInternal, err)
	}

	if err := s.autoJoinSingletonGuild(ctx, id); err != nil {
		s.logger.Warn().Err(err).Str("user_id", id.String()).Msg("auto-join singleton guild failed")
	}

	guildIDs, err := s.guildIDs(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query guild ids: %v", errs.ErrInternal, err)
	}

	currentGuildID, balance, err := s.currentGuildBalance(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: current guild balance: %v", errs.ErrInternal, err)
	}

	return &User{
		ID:             id.String(),
		Email:          row.Email,
		Username:       row.Username,
		DisplayName:    row.DisplayName,
		Bio:            row.Bio,
		AvatarURL:      row.AvatarUrl,
		GuildIDs:       guildIDs,
		CurrentGuildID: currentGuildID,
		Balance:        balance,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}, nil
}

// kratosIdentity is the subset of Kratos whoami output the user service cares about.
type kratosIdentity struct {
	email     string
	username  string
	avatarURL string
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
		}
	}
	if out.username == "" {
		out.username = out.email
	}
	return out, nil
}

// UpdateMe updates mutable profile fields for the authenticated user.
func (s *Service) UpdateMe(ctx context.Context, userID string, p UpdateParams) (*User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
	}

	row, err := s.q.UpdateUser(ctx, db.UpdateUserParams{
		DisplayName: p.DisplayName,
		Username:    p.Username,
		Bio:         p.Bio,
		AvatarUrl:   p.AvatarURL,
		ID:          id,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: update user: %v", errs.ErrInternal, err)
	}

	guildIDs, err := s.guildIDs(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query guild ids: %v", errs.ErrInternal, err)
	}

	currentGuildID, balance, err := s.currentGuildBalance(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: current guild balance: %v", errs.ErrInternal, err)
	}

	return &User{
		ID:             row.ID.String(),
		Email:          row.Email,
		Username:       row.Username,
		DisplayName:    row.DisplayName,
		Bio:            row.Bio,
		AvatarURL:      row.AvatarUrl,
		GuildIDs:       guildIDs,
		CurrentGuildID: currentGuildID,
		Balance:        balance,
		CreatedAt:      row.CreatedAt,
		UpdatedAt:      row.UpdatedAt,
	}, nil
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
		Username:    row.Username,
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
	checkins, err := s.q.CountUserCheckins(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query checkins: %v", errs.ErrInternal, err)
	}
	events, err := s.q.CountUserEventsAttended(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query events: %v", errs.ErrInternal, err)
	}
	auctionsWon, err := s.q.CountUserAuctionsWon(ctx, &id)
	if err != nil {
		return nil, fmt.Errorf("%w: query auctions won: %v", errs.ErrInternal, err)
	}
	lotteriesWon, err := s.q.CountUserLotteriesWon(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query lotteries won: %v", errs.ErrInternal, err)
	}
	totals, err := s.q.SumUserEarnedSpent(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("%w: query totals: %v", errs.ErrInternal, err)
	}

	return &Stats{
		GuildsJoined:      int32(guilds),
		CheckinsCompleted: int32(checkins),
		EventsAttended:    int32(events),
		AuctionsWon:       int32(auctionsWon),
		LotteriesWon:      int32(lotteriesWon),
		TotalEarned:       totals.TotalEarned,
		TotalSpent:        totals.TotalSpent,
	}, nil
}

// GetBalanceTrend returns a daily cumulative balance trend for the last N days.
func (s *Service) GetBalanceTrend(ctx context.Context, userID string, days int32) ([]*BalancePoint, error) {
	if days <= 0 {
		days = 30
	}
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
	}

	rows, err := s.q.GetUserBalanceTrend(ctx, db.GetUserBalanceTrendParams{
		UserID: id,
		Days:   days,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: query balance trend: %v", errs.ErrInternal, err)
	}

	points := make([]*BalancePoint, 0, len(rows))
	var cumulative int64
	for _, r := range rows {
		cumulative += r.Net
		points = append(points, &BalancePoint{Date: r.Day, Balance: cumulative})
	}
	return points, nil
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

func (s *Service) currentGuildBalance(ctx context.Context, userID uuid.UUID) (string, int64, error) {
	return s.currentGuildBalanceTx(ctx, s.q, userID)
}

func (s *Service) currentGuildBalanceTx(ctx context.Context, q *db.Queries, userID uuid.UUID) (string, int64, error) {
	row, err := q.GetUserCurrentGuildBalance(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", 0, nil
		}
		return "", 0, err
	}
	return row.GuildID.String(), row.Balance, nil
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
