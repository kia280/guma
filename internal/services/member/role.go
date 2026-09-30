package member

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	roleOwner = "owner"
	roleAdmin = "admin"
)

type UpdateRoleParams struct {
	GuildID string
	ActorID string
	UserID  string
	Role    string
}

func (s *Service) UpdateRole(ctx context.Context, p UpdateRoleParams) (*Member, error) {
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild_id must be a UUID", errs.ErrInvalidArgument)
	}
	actorID, err := uuid.Parse(p.ActorID)
	if err != nil {
		return nil, fmt.Errorf("%w: caller id must be a UUID", errs.ErrInvalidArgument)
	}
	userID, err := uuid.Parse(p.UserID)
	if err != nil {
		return nil, fmt.Errorf("%w: member", errs.ErrNotFound)
	}
	if !validRoles[p.Role] {
		return nil, fmt.Errorf("%w: unknown role %q", errs.ErrInvalidArgument, p.Role)
	}
	if actorID == userID {
		return nil, fmt.Errorf("%w: you cannot change your own role", errs.ErrPermissionDenied)
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	locked, err := qtx.LockGuildMemberRoles(ctx, db.LockGuildMemberRolesParams{
		GuildID: guildID,
		UserIds: []uuid.UUID{actorID, userID},
	})
	if err != nil {
		return nil, fmt.Errorf("%w: lock members: %v", errs.ErrInternal, err)
	}
	roles := make(map[uuid.UUID]string, len(locked))
	for _, row := range locked {
		roles[row.UserID] = row.Role
	}
	actorRole, ok := roles[actorID]
	if !ok {
		return nil, fmt.Errorf("%w: not a member of this guild", errs.ErrPermissionDenied)
	}
	if actorRole != roleOwner && actorRole != roleAdmin {
		return nil, fmt.Errorf("%w: only owners and admins can change roles", errs.ErrPermissionDenied)
	}
	currentRole, ok := roles[userID]
	if !ok {
		return nil, fmt.Errorf("%w: member", errs.ErrNotFound)
	}
	if err := authorizeRoleChange(actorRole, currentRole, p.Role); err != nil {
		return nil, err
	}

	if currentRole != p.Role {
		if _, err := qtx.UpdateGuildMemberRole(ctx, db.UpdateGuildMemberRoleParams{
			Role: p.Role, GuildID: guildID, UserID: userID,
		}); err != nil {
			return nil, fmt.Errorf("%w: update role: %v", errs.ErrInternal, err)
		}
		if err := qtx.InsertMemberRoleChange(ctx, db.InsertMemberRoleChangeParams{
			GuildID: guildID, UserID: userID, ActorID: &actorID, OldRole: currentRole, NewRole: p.Role,
		}); err != nil {
			return nil, fmt.Errorf("%w: record role change: %v", errs.ErrInternal, err)
		}
	}

	row, err := qtx.GetGuildMember(ctx, db.GetGuildMemberParams{GuildID: guildID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: member", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: load member: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}

	if currentRole != p.Role {
		s.logger.Info().Str("actor_id", p.ActorID).Str("user_id", p.UserID).Str("guild_id", p.GuildID).
			Str("old_role", currentRole).Str("new_role", p.Role).Msg("member role changed")
	}

	return &Member{
		ID:              row.ID.String(),
		UserID:          row.UserID.String(),
		GuildID:         row.GuildID.String(),
		DisplayName:     row.DisplayName,
		DiscordUsername: row.DiscordUsername,
		AvatarURL:       row.AvatarUrl,
		Role:            row.Role,
		Profile:         decodeProfile(row.Profile),
		JoinedAt:        row.JoinedAt,
		LastActive:      row.LastActive,
	}, nil
}

func authorizeRoleChange(actorRole, currentRole, newRole string) error {
	switch {
	case currentRole == roleOwner:
		return fmt.Errorf("%w: the owner's role cannot be changed", errs.ErrPermissionDenied)
	case newRole == roleOwner:
		return fmt.Errorf("%w: ownership cannot be assigned", errs.ErrPermissionDenied)
	case actorRole == roleOwner:
		return nil
	case actorRole != roleAdmin:
		return fmt.Errorf("%w: only owners and admins can change roles", errs.ErrPermissionDenied)
	case currentRole == roleAdmin:
		return fmt.Errorf("%w: only the owner can change an admin's role", errs.ErrPermissionDenied)
	}
	return nil
}
