package devauth

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	defaultListLimit = 100
	maxListLimit     = 500
	devEmailDomain   = "dev.guma.local"
)

var nonSlugChars = regexp.MustCompile(`[^a-z0-9]+`)

// User is the subset of a user shown in the dev tools.
type User struct {
	ID          string
	Email       string
	Username    string
	DisplayName string
	AvatarURL   string
	CreatedAt   time.Time
}

// Service supports development-only impersonation of existing users.
type Service struct {
	q *db.Queries
}

// New creates a dev auth Service.
func New(pool *database.Pool) *Service {
	return &Service{q: db.New(pool.Pool)}
}

// ListUsers returns the most recently created users.
func (s *Service) ListUsers(ctx context.Context, limit int32) ([]User, error) {
	if limit <= 0 {
		limit = defaultListLimit
	}
	if limit > maxListLimit {
		limit = maxListLimit
	}

	rows, err := s.q.ListUsers(ctx, limit)
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
func (s *Service) GetUser(ctx context.Context, userID string) (*User, error) {
	id, err := uuid.Parse(userID)
	if err != nil {
		return nil, fmt.Errorf("%w: user_id must be a UUID", errs.ErrInvalidArgument)
	}

	row, err := s.q.GetUserByID(ctx, id)
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
func (s *Service) CreateUser(ctx context.Context, displayName string) (*User, error) {
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

	row, err := s.q.CreateUser(ctx, db.CreateUserParams{
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

	return &User{
		ID:          row.ID.String(),
		Email:       row.Email,
		Username:    row.Username,
		DisplayName: row.DisplayName,
		AvatarURL:   row.AvatarUrl,
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
