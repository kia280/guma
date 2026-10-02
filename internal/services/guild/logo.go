package guild

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/kia280/guma/internal/authz"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const MaxLogoBytes = 512 * 1024

var allowedLogoTypes = map[string]bool{
	"image/png":  true,
	"image/jpeg": true,
	"image/webp": true,
	"image/gif":  true,
}

type Logo struct {
	ContentType string
	Data        []byte
	UpdatedAt   time.Time
}

type UploadLogoParams struct {
	GuildID     string
	UserID      string
	ContentType string
	Data        []byte
}

func LogoURL(guildID uuid.UUID, version int64) string {
	return fmt.Sprintf("/v1/guilds/%s/logo?v=%d", guildID, version)
}

func ValidateLogo(contentType string, data []byte) (string, error) {
	declared := strings.ToLower(strings.TrimSpace(contentType))
	if !allowedLogoTypes[declared] {
		return "", fmt.Errorf("%w: logo must be a PNG, JPEG, WebP, or GIF image", errs.ErrInvalidArgument)
	}
	if len(data) == 0 {
		return "", fmt.Errorf("%w: logo is empty", errs.ErrInvalidArgument)
	}
	if len(data) > MaxLogoBytes {
		return "", fmt.Errorf("%w: logo exceeds %d bytes", errs.ErrInvalidArgument, MaxLogoBytes)
	}
	if detected := http.DetectContentType(data); detected != declared {
		return "", fmt.Errorf("%w: logo content does not match %s", errs.ErrInvalidArgument, declared)
	}
	return declared, nil
}

func (s *Service) UploadLogo(ctx context.Context, p UploadLogoParams) (*Guild, error) {
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(p.UserID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	contentType, err := ValidateLogo(p.ContentType, p.Data)
	if err != nil {
		return nil, err
	}
	if err := authz.Require(ctx, s.az, guildID, userID, authz.ManageGuild); err != nil {
		return nil, err
	}

	row, err := s.q.UpsertGuildLogo(ctx, db.UpsertGuildLogoParams{
		GuildID:     guildID,
		ContentType: contentType,
		Data:        p.Data,
		IconUrl:     LogoURL(guildID, time.Now().UnixMilli()),
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: upload guild logo: %v", errs.ErrInternal, err)
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
	s.logger.Info().Str("guild_id", g.ID).Str("user_id", p.UserID).Int("bytes", len(p.Data)).Msg("guild logo uploaded")
	return g, nil
}

func (s *Service) DeleteLogo(ctx context.Context, guildIDStr, userIDStr string) (*Guild, error) {
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

	row, err := s.q.DeleteGuildLogo(ctx, guildID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: guild", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: delete guild logo: %v", errs.ErrInternal, err)
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
	s.logger.Info().Str("guild_id", g.ID).Str("user_id", userIDStr).Msg("guild logo removed")
	return g, nil
}

func (s *Service) GetLogo(ctx context.Context, guildIDStr string) (*Logo, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild logo", errs.ErrNotFound)
	}
	row, err := s.q.GetGuildLogo(ctx, guildID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: guild logo", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: get guild logo: %v", errs.ErrInternal, err)
	}
	return &Logo{ContentType: row.ContentType, Data: row.Data, UpdatedAt: row.UpdatedAt}, nil
}
