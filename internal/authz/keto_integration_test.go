package authz

import (
	"context"
	"os"
	"slices"
	"testing"

	"github.com/google/uuid"
)

var expectedRolePermissions = map[Role][]Permission{
	RoleMember: {View},
	RoleModerator: {
		View, ViewMemberContacts, ManageRollCalls, ManageRollCallTemplates, ReviewBankRequests,
		ManageAnnouncements, ReviewWithdrawals, DeliverItems,
	},
	RoleAdmin: {
		View, ViewMemberContacts, ManageRollCalls, ManageRollCallTemplates, ReviewBankRequests,
		ManageAnnouncements, ReviewWithdrawals, DeliverItems,
		ManageGuild, ViewStats, ManageRoles, DeleteRollCalls, ManageRaffles, ManageAuctions,
		DeleteBankItems, ManageMemberAssets,
	},
	RoleOwner: Permissions,
}

func dialTestKeto(t *testing.T) *Keto {
	t.Helper()
	readAddr, writeAddr := os.Getenv("GUMA_TEST_KETO_READ_ADDR"), os.Getenv("GUMA_TEST_KETO_WRITE_ADDR")
	if readAddr == "" || writeAddr == "" {
		t.Skip("set GUMA_TEST_KETO_READ_ADDR and GUMA_TEST_KETO_WRITE_ADDR to run against Keto")
	}
	k, err := DialKeto(readAddr, writeAddr)
	if err != nil {
		t.Fatalf("dial keto: %v", err)
	}
	t.Cleanup(func() { k.Close() }) //nolint:errcheck
	return k
}

func assertPermissions(t *testing.T, k *Keto, guildID, userID uuid.UUID, want []Permission) {
	t.Helper()
	ctx := context.Background()
	for _, p := range Permissions {
		got, err := k.Can(ctx, guildID, userID, p)
		if err != nil {
			t.Fatalf("Can(%s): %v", p, err)
		}
		if got != slices.Contains(want, p) {
			t.Errorf("Can(%s) = %v, want %v", p, got, !got)
		}
	}
}

func memberTuples(t *testing.T, k *Keto, guildID, userID uuid.UUID) []Role {
	t.Helper()
	var roles []Role
	if err := k.ListMemberRoles(context.Background(), func(m MemberRole) error {
		if m.GuildID == guildID && m.UserID == userID {
			roles = append(roles, m.Role)
		}
		return nil
	}); err != nil {
		t.Fatalf("ListMemberRoles: %v", err)
	}
	return roles
}

func TestKetoRolePermissions(t *testing.T) {
	k := dialTestKeto(t)
	ctx := context.Background()
	for _, role := range Roles {
		t.Run(string(role), func(t *testing.T) {
			guildID, userID := uuid.New(), uuid.New()
			if err := k.SetMemberRole(ctx, guildID, userID, role); err != nil {
				t.Fatalf("SetMemberRole: %v", err)
			}
			assertPermissions(t, k, guildID, userID, expectedRolePermissions[role])
			assertPermissions(t, k, guildID, uuid.New(), nil)
			assertPermissions(t, k, uuid.New(), userID, nil)
		})
	}
}

func TestKetoSetMemberRoleReconciles(t *testing.T) {
	k := dialTestKeto(t)
	ctx := context.Background()
	guildID, userID := uuid.New(), uuid.New()

	for _, role := range []Role{RoleAdmin, RoleAdmin, RoleMember, RoleModerator, RoleModerator} {
		if err := k.SetMemberRole(ctx, guildID, userID, role); err != nil {
			t.Fatalf("SetMemberRole(%s): %v", role, err)
		}
		if got := memberTuples(t, k, guildID, userID); !slices.Equal(got, []Role{role}) {
			t.Fatalf("after SetMemberRole(%s) tuples = %v", role, got)
		}
		assertPermissions(t, k, guildID, userID, expectedRolePermissions[role])
	}

	if err := k.SetMemberRole(ctx, guildID, userID, ""); err != nil {
		t.Fatalf("remove member: %v", err)
	}
	if got := memberTuples(t, k, guildID, userID); len(got) != 0 {
		t.Fatalf("after removal tuples = %v", got)
	}
	assertPermissions(t, k, guildID, userID, nil)

	if err := k.SetMemberRole(ctx, guildID, userID, Role("superuser")); err == nil {
		t.Fatal("SetMemberRole accepted an unknown role")
	}
}
