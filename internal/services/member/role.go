package member

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/kia280/guma/internal/authz"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

type UpdateRoleParams struct {
	GuildID uuid.UUID
	ActorID uuid.UUID
	UserID  uuid.UUID
	Role    string
}

func (s *Service) UpdateRole(ctx context.Context, p UpdateRoleParams) (*Member, error) {
	guildID, actorID, userID := p.GuildID, p.ActorID, p.UserID
	newRole, ok := authz.ParseRole(p.Role)
	if !ok {
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
		UserIds: []uuid.UUID{userID},
	})
	if err != nil {
		return nil, fmt.Errorf("%w: lock members: %v", errs.ErrInternal, err)
	}
	if len(locked) == 0 {
		return nil, fmt.Errorf("%w: member", errs.ErrNotFound)
	}
	currentRole, ok := authz.ParseRole(locked[0].Role)
	if !ok {
		return nil, fmt.Errorf("%w: member has unknown role %q", errs.ErrInternal, locked[0].Role)
	}
	permission, err := roleChangePermission(currentRole, newRole)
	if err != nil {
		return nil, err
	}
	if err := authz.Require(ctx, s.az, guildID, actorID, permission); err != nil {
		return nil, err
	}

	if currentRole != newRole {
		if _, err := qtx.UpdateGuildMemberRole(ctx, db.UpdateGuildMemberRoleParams{
			Role: string(newRole), GuildID: guildID, UserID: userID,
		}); err != nil {
			return nil, fmt.Errorf("%w: update role: %v", errs.ErrInternal, err)
		}
		if err := qtx.InsertMemberRoleChange(ctx, db.InsertMemberRoleChangeParams{
			GuildID: guildID, UserID: userID, ActorID: &actorID, OldRole: string(currentRole), NewRole: string(newRole),
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

	if currentRole != newRole {
		authz.SyncAfterCommit(ctx, s.az, s.logger, guildID, userID)
		s.logger.Info().Str("actor_id", actorID.String()).Str("user_id", userID.String()).Str("guild_id", guildID.String()).
			Str("old_role", string(currentRole)).Str("new_role", string(newRole)).Msg("member role changed")
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

func roleChangePermission(currentRole, newRole authz.Role) (authz.Permission, error) {
	switch {
	case currentRole == authz.RoleOwner:
		return "", fmt.Errorf("%w: the owner's role cannot be changed", errs.ErrPermissionDenied)
	case newRole == authz.RoleOwner:
		return "", fmt.Errorf("%w: ownership cannot be assigned", errs.ErrPermissionDenied)
	case currentRole == authz.RoleAdmin:
		return authz.ManageAdmins, nil
	}
	return authz.ManageRoles, nil
}
