package devauth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/services/pagination"
)

const (
	defaultListLimit = 100
	maxListLimit     = 500
	devEmailDomain   = "dev.guma.local"
	MaxSeedCount     = 200
	moderatorEvery   = 10
)

var (
	seedNamePrefixes = []string{
		"熊", "桑", "夜", "星", "月", "風", "雪", "影", "龍", "貓",
		"Shadow", "Storm", "Frost", "Iron", "Silver", "Night", "Moon", "Sun", "Blood", "Crystal",
		"달빛", "그림자", "폭풍", "별빛", "불꽃", "하늘", "용", "검은",
	}
	seedNameSuffixes = []string{
		"寶寶", "小隊長", "劍士", "法師", "射手", "不睡", "吃貨", "大俠",
		"Blade", "Hunter", "Knight", "Mage", "Wolf", "Fox", "Rider", "Walker",
		"전사", "기사", "마법사", "궁수", "도적", "사냥꾼",
	}
)

var nonSlugChars = regexp.MustCompile(`[^a-z0-9]+`)

// User is the subset of a user shown in the dev tools.
type User struct {
	ID          string
	Email       string
	Username    string
	DisplayName string
	AvatarURL   string
	Role        string
	CreatedAt   time.Time
}

type Guild struct {
	ID   uuid.UUID
	Name string
}

// Service supports development-only impersonation of existing users.
type Service struct {
	pool   *database.Pool
	q      *db.Queries
	syncer authz.MemberSyncer
	logger zerolog.Logger
}

// New creates a dev auth Service.
func New(pool *database.Pool, syncer authz.MemberSyncer, logger zerolog.Logger) *Service {
	return &Service{pool: pool, q: db.New(pool.Pool), syncer: syncer, logger: logger.With().Str("service", "devauth").Logger()}
}

func (s *Service) ResolveGuild(ctx context.Context, userID *uuid.UUID) (*Guild, error) {
	if userID != nil {
		g, err := s.q.GetUserCurrentGuild(ctx, *userID)
		if err == nil {
			return &Guild{ID: g.ID, Name: g.Name}, nil
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: get current guild: %v", errs.ErrInternal, err)
		}
	}

	g, err := s.q.GetOldestGuild(ctx)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("%w: get default guild: %v", errs.ErrInternal, err)
	}
	return &Guild{ID: g.ID, Name: g.Name}, nil
}

func (s *Service) ListGuildMembers(ctx context.Context, guildID uuid.UUID, limit int32) ([]User, error) {
	rows, err := s.q.ListGuildMemberUsers(ctx, db.ListGuildMemberUsersParams{GuildID: guildID, MaxRows: clampLimit(limit)})
	if err != nil {
		return nil, fmt.Errorf("%w: list guild members: %v", errs.ErrInternal, err)
	}

	users := make([]User, 0, len(rows))
	for _, row := range rows {
		users = append(users, User{
			ID:          row.ID.String(),
			Email:       row.Email,
			Username:    row.Username,
			DisplayName: row.DisplayName,
			AvatarURL:   row.AvatarUrl,
			Role:        row.Role,
			CreatedAt:   row.CreatedAt,
		})
	}
	return users, nil
}

func (s *Service) SeedGuildMembers(ctx context.Context, guildID uuid.UUID, count int) ([]User, error) {
	if count < 1 || count > MaxSeedCount {
		return nil, fmt.Errorf("%w: count must be between 1 and %d", errs.ErrInvalidArgument, MaxSeedCount)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin: %v", errs.ErrInternal, err)
	}
	defer tx.Rollback(ctx)
	qtx := s.q.WithTx(tx)

	userIDs := make([]uuid.UUID, 0, count)
	users := make([]User, 0, count)
	for i := 1; i <= count; i++ {
		displayName, err := randomSeedName()
		if err != nil {
			return nil, fmt.Errorf("%w: generate name: %v", errs.ErrInternal, err)
		}
		suffix, err := randomSuffix()
		if err != nil {
			return nil, fmt.Errorf("%w: generate suffix: %v", errs.ErrInternal, err)
		}
		username := "seed-" + suffix
		role := seedRole(i)

		row, err := qtx.CreateUser(ctx, db.CreateUserParams{
			ID:          uuid.New(),
			Email:       username + "@" + devEmailDomain,
			Username:    username,
			DisplayName: displayName,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: create user: %v", errs.ErrInternal, err)
		}
		if err := joinGuild(ctx, qtx, row.ID, guildID, role); err != nil {
			return nil, err
		}
		userIDs = append(userIDs, row.ID)
		users = append(users, User{
			ID:          row.ID.String(),
			Email:       row.Email,
			Username:    row.Username,
			DisplayName: row.DisplayName,
			Role:        role,
			CreatedAt:   row.CreatedAt,
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	for _, userID := range userIDs {
		s.syncMember(ctx, guildID, userID)
	}
	return users, nil
}

func joinGuild(ctx context.Context, q *db.Queries, userID, guildID uuid.UUID, role string) error {
	if err := q.InsertGuildMember(ctx, db.InsertGuildMemberParams{UserID: userID, GuildID: guildID, Role: role}); err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			return fmt.Errorf("%w: guild", errs.ErrNotFound)
		}
		return fmt.Errorf("%w: add guild member: %v", errs.ErrInternal, err)
	}
	if err := q.EnsureWallet(ctx, db.EnsureWalletParams{UserID: userID, GuildID: guildID}); err != nil {
		return fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
	}
	return nil
}

func seedRole(n int) string {
	if n%moderatorEvery == 0 {
		return string(authz.RoleModerator)
	}
	return string(authz.RoleMember)
}

func (s *Service) syncMember(ctx context.Context, guildID, userID uuid.UUID) {
	authz.SyncAfterCommit(ctx, s.syncer, s.logger, guildID, userID)
}

func randomSeedName() (string, error) {
	prefix, err := randomItem(seedNamePrefixes)
	if err != nil {
		return "", err
	}
	suffix, err := randomItem(seedNameSuffixes)
	if err != nil {
		return "", err
	}
	return prefix + suffix, nil
}

func randomItem(items []string) (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(int64(len(items))))
	if err != nil {
		return "", err
	}
	return items[n.Int64()], nil
}

func clampLimit(limit int32) int32 {
	return pagination.Size(limit, defaultListLimit, maxListLimit)
}

// ListUsers returns the most recently created users.
func (s *Service) ListUsers(ctx context.Context, limit int32) ([]User, error) {
	rows, err := s.q.ListUsers(ctx, clampLimit(limit))
	if err != nil {
		return nil, fmt.Errorf("%w: list users: %v", errs.ErrInternal, err)
	}

	users := make([]User, 0, len(rows))
	for _, row := range rows {
		users = append(users, User{
			ID:          row.ID.String(),
			Email:       row.Email,
			Username:    row.Username,
			DisplayName: row.DisplayName,
			AvatarURL:   row.AvatarUrl,
			CreatedAt:   row.CreatedAt,
		})
	}
	return users, nil
}

// GetUser returns the user that a dev session would impersonate.
func (s *Service) GetUser(ctx context.Context, userID uuid.UUID) (*User, error) {
	row, err := s.q.GetUserByID(ctx, userID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: get user: %v", errs.ErrInternal, err)
	}

	return &User{
		ID:          row.ID.String(),
		Email:       row.Email,
		Username:    row.Username,
		DisplayName: row.DisplayName,
		AvatarURL:   row.AvatarUrl,
		CreatedAt:   row.CreatedAt,
	}, nil
}

// CreateUser inserts a local test user that exists only in the app database.
func (s *Service) CreateUser(ctx context.Context, displayName string, guildID *uuid.UUID) (*User, error) {
	displayName = strings.TrimSpace(displayName)

	suffix, err := randomSuffix()
	if err != nil {
		return nil, fmt.Errorf("%w: generate suffix: %v", errs.ErrInternal, err)
	}

	base := strings.Trim(nonSlugChars.ReplaceAllString(strings.ToLower(displayName), "-"), "-")
	if base == "" {
		base = "dev"
	}
	username := base + "-" + suffix
	if displayName == "" {
		displayName = username
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin: %v", errs.ErrInternal, err)
	}
	defer tx.Rollback(ctx)
	qtx := s.q.WithTx(tx)

	row, err := qtx.CreateUser(ctx, db.CreateUserParams{
		ID:          uuid.New(),
		Email:       username + "@" + devEmailDomain,
		Username:    username,
		DisplayName: displayName,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, fmt.Errorf("%w: user", errs.ErrAlreadyExists)
		}
		return nil, fmt.Errorf("%w: create user: %v", errs.ErrInternal, err)
	}

	role := ""
	if guildID != nil {
		role = string(authz.RoleMember)
		if err := joinGuild(ctx, qtx, row.ID, *guildID, role); err != nil {
			return nil, err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	if guildID != nil {
		s.syncMember(ctx, *guildID, row.ID)
	}

	return &User{
		ID:          row.ID.String(),
		Email:       row.Email,
		Username:    row.Username,
		DisplayName: row.DisplayName,
		AvatarURL:   row.AvatarUrl,
		Role:        role,
		CreatedAt:   row.CreatedAt,
	}, nil
}

func randomSuffix() (string, error) {
	b := make([]byte, 3)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
