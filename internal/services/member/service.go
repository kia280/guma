package member

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

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	defaultPageSize = 50
	maxPageSize     = 500
)

var validRoles = map[string]bool{"owner": true, "admin": true, "moderator": true, "member": true}

type Member struct {
	ID          string
	UserID      string
	GuildID     string
	DisplayName string
	Email       string
	AvatarURL   string
	Role        string
	Profile     map[string]string
	JoinedAt    time.Time
	LastActive  time.Time
}

type ListParams struct {
	GuildID   string
	CallerID  string
	Role      string
	PageSize  int32
	PageToken string
}

type ListResult struct {
	Members       []*Member
	NextPageToken string
	TotalCount    int32
}

type Service struct {
	q      *db.Queries
	logger zerolog.Logger
}

func New(pool *database.Pool, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{q: q, logger: logger.With().Str("service", "member").Logger()}
}

func (s *Service) List(ctx context.Context, p ListParams) (*ListResult, error) {
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild_id must be a UUID", errs.ErrInvalidArgument)
	}
	callerID, err := uuid.Parse(p.CallerID)
	if err != nil {
		return nil, fmt.Errorf("%w: caller id must be a UUID", errs.ErrInvalidArgument)
	}
	if p.Role != "" && !validRoles[p.Role] {
		return nil, fmt.Errorf("%w: unknown role %q", errs.ErrInvalidArgument, p.Role)
	}
	offset, err := parsePageToken(p.PageToken)
	if err != nil {
		return nil, err
	}
	pageSize := clampPageSize(p.PageSize)

	if _, err := s.q.GetGuildMemberRole(ctx, db.GetGuildMemberRoleParams{GuildID: guildID, UserID: callerID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: not a member of this guild", errs.ErrPermissionDenied)
		}
		return nil, fmt.Errorf("%w: get member role: %v", errs.ErrInternal, err)
	}

	rows, err := s.q.ListGuildMembers(ctx, db.ListGuildMembersParams{
		GuildID:    guildID,
		RoleFilter: p.Role,
		PageOffset: offset,
		PageSize:   pageSize,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list members: %v", errs.ErrInternal, err)
	}
	total, err := s.q.CountGuildMembersByRole(ctx, db.CountGuildMembersByRoleParams{GuildID: guildID, RoleFilter: p.Role})
	if err != nil {
		return nil, fmt.Errorf("%w: count members: %v", errs.ErrInternal, err)
	}

	members := make([]*Member, 0, len(rows))
	for _, r := range rows {
		members = append(members, &Member{
			ID:          r.ID.String(),
			UserID:      r.UserID.String(),
			GuildID:     r.GuildID.String(),
			DisplayName: r.DisplayName,
			Email:       r.Email,
			AvatarURL:   r.AvatarUrl,
			Role:        r.Role,
			Profile:     decodeProfile(r.Profile),
			JoinedAt:    r.JoinedAt,
			LastActive:  r.LastActive,
		})
	}

	return &ListResult{
		Members:       members,
		NextPageToken: nextPageToken(offset, int32(len(rows)), pageSize, total),
		TotalCount:    int32(total),
	}, nil
}

func clampPageSize(size int32) int32 {
	if size <= 0 {
		return defaultPageSize
	}
	if size > maxPageSize {
		return maxPageSize
	}
	return size
}

func parsePageToken(token string) (int32, error) {
	if token == "" {
		return 0, nil
	}
	n, err := strconv.ParseInt(token, 10, 32)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("%w: invalid page_token", errs.ErrInvalidArgument)
	}
	return int32(n), nil
}

func nextPageToken(offset, returned, pageSize int32, total int64) string {
	next := int64(offset) + int64(returned)
	if returned < pageSize || next >= total {
		return ""
	}
	return strconv.FormatInt(next, 10)
}

func decodeProfile(raw []byte) map[string]string {
	out := map[string]string{}
	if len(raw) == 0 {
		return out
	}
	var values map[string]any
	if err := json.Unmarshal(raw, &values); err != nil {
		return out
	}
	for k, v := range values {
		if str, ok := v.(string); ok {
			out[k] = str
		} else {
			out[k] = fmt.Sprint(v)
		}
	}
	return out
}
