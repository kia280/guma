package authz

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/services/errs"
)

type Role string

const (
	RoleOwner     Role = "owner"
	RoleAdmin     Role = "admin"
	RoleModerator Role = "moderator"
	RoleMember    Role = "member"
)

var Roles = []Role{RoleOwner, RoleAdmin, RoleModerator, RoleMember}

func ParseRole(s string) (Role, bool) {
	for _, r := range Roles {
		if string(r) == s {
			return r, true
		}
	}
	return "", false
}

type Permission string

const (
	View                    Permission = "view"
	ViewMemberContacts      Permission = "view_member_contacts"
	ManageRollCalls         Permission = "manage_roll_calls"
	ManageRollCallTemplates Permission = "manage_roll_call_templates"
	ReviewBankRequests      Permission = "review_bank_requests"
	ManageAnnouncements     Permission = "manage_announcements"
	ReviewWithdrawals       Permission = "review_withdrawals"
	DeliverItems            Permission = "deliver_items"
	ManageGuild             Permission = "manage_guild"
	ViewStats               Permission = "view_stats"
	ManageRoles             Permission = "manage_roles"
	DeleteRollCalls         Permission = "delete_roll_calls"
	ManageRaffles           Permission = "manage_raffles"
	ManageAuctions          Permission = "manage_auctions"
	DeleteBankItems         Permission = "delete_bank_items"
	ManageMemberAssets      Permission = "manage_member_assets"
	DeleteGuild             Permission = "delete_guild"
	ManageAdmins            Permission = "manage_admins"
)

var Permissions = []Permission{
	View, ViewMemberContacts, ManageRollCalls, ManageRollCallTemplates, ReviewBankRequests,
	ManageAnnouncements, ReviewWithdrawals, DeliverItems, ManageGuild, ViewStats, ManageRoles,
	DeleteRollCalls, ManageRaffles, ManageAuctions, DeleteBankItems, ManageMemberAssets,
	DeleteGuild, ManageAdmins,
}

type Checker interface {
	Can(ctx context.Context, guildID, userID uuid.UUID, p Permission) (bool, error)
}

type MemberSyncer interface {
	SyncMember(ctx context.Context, guildID, userID uuid.UUID) error
}

type Authorizer interface {
	Checker
	MemberSyncer
}

func Require(ctx context.Context, c Checker, guildID, userID uuid.UUID, p Permission) error {
	ok, err := c.Can(ctx, guildID, userID, p)
	if err != nil {
		return fmt.Errorf("%w: check guild permission %s: %v", errs.ErrInternal, p, err)
	}
	if !ok {
		return fmt.Errorf("%w: requires guild permission %s", errs.ErrPermissionDenied, p)
	}
	return nil
}

type authorizer struct {
	Checker
	MemberSyncer
}

func New(checker Checker, syncer MemberSyncer) Authorizer {
	return authorizer{Checker: checker, MemberSyncer: syncer}
}

func SyncAfterCommit(ctx context.Context, s MemberSyncer, logger zerolog.Logger, guildID, userID uuid.UUID) {
	if err := s.SyncMember(ctx, guildID, userID); err != nil {
		logger.Warn().Err(err).Str("guild_id", guildID.String()).Str("user_id", userID.String()).
			Msg("member authorization sync deferred to outbox")
	}
}
