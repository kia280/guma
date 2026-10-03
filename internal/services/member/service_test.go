package member

import (
	"context"
	"errors"
	"testing"

	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/services/errs"
)

func TestListValidatesInput(t *testing.T) {
	s := New(nil, nil, zerolog.Nop())
	const guild = "00000000-0000-0000-0000-000000000001"
	const caller = "00000000-0000-0000-0000-000000000002"
	tests := []struct {
		name string
		p    ListParams
	}{
		{name: "bad guild id", p: ListParams{GuildID: "nope", CallerID: caller}},
		{name: "bad caller id", p: ListParams{GuildID: guild, CallerID: "nope"}},
		{name: "bad page token", p: ListParams{GuildID: guild, CallerID: caller, PageToken: "next"}},
		{name: "negative page token", p: ListParams{GuildID: guild, CallerID: caller, PageToken: "-5"}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := s.List(context.Background(), tt.p); !errors.Is(err, errs.ErrInvalidArgument) {
				t.Fatalf("expected invalid argument, got %v", err)
			}
		})
	}
}

func TestClampPageSize(t *testing.T) {
	for in, want := range map[int32]int32{0: defaultPageSize, -1: defaultPageSize, 10: 10, maxPageSize + 1: maxPageSize} {
		if got := clampPageSize(in); got != want {
			t.Fatalf("clampPageSize(%d) = %d, want %d", in, got, want)
		}
	}
}

func TestNextPageToken(t *testing.T) {
	tests := []struct {
		offset, returned, pageSize int32
		total                      int64
		want                       string
	}{
		{offset: 0, returned: 50, pageSize: 50, total: 120, want: "50"},
		{offset: 100, returned: 20, pageSize: 50, total: 120, want: ""},
		{offset: 50, returned: 50, pageSize: 50, total: 100, want: ""},
		{offset: 0, returned: 0, pageSize: 50, total: 0, want: ""},
	}
	for _, tt := range tests {
		if got := nextPageToken(tt.offset, tt.returned, tt.pageSize, tt.total); got != tt.want {
			t.Fatalf("nextPageToken(%+v) = %q, want %q", tt, got, tt.want)
		}
	}
}

func TestDecodeProfile(t *testing.T) {
	got := decodeProfile([]byte(`{"class":"mage","level":42}`))
	if got["class"] != "mage" || got["level"] != "42" {
		t.Fatalf("unexpected profile %v", got)
	}
	if len(decodeProfile([]byte(`not json`))) != 0 {
		t.Fatalf("expected empty profile for invalid JSON")
	}
}

func TestUpdateRoleValidatesInput(t *testing.T) {
	s := New(nil, nil, zerolog.Nop())
	const guild = "00000000-0000-0000-0000-000000000001"
	const actor = "00000000-0000-0000-0000-000000000002"
	const target = "00000000-0000-0000-0000-000000000003"
	tests := []struct {
		name string
		p    UpdateRoleParams
		want error
	}{
		{name: "bad guild id", p: UpdateRoleParams{GuildID: "nope", ActorID: actor, UserID: target, Role: "admin"}, want: errs.ErrInvalidArgument},
		{name: "bad actor id", p: UpdateRoleParams{GuildID: guild, ActorID: "nope", UserID: target, Role: "admin"}, want: errs.ErrInvalidArgument},
		{name: "bad user id", p: UpdateRoleParams{GuildID: guild, ActorID: actor, UserID: "nope", Role: "admin"}, want: errs.ErrNotFound},
		{name: "own role", p: UpdateRoleParams{GuildID: guild, ActorID: actor, UserID: actor, Role: "member"}, want: errs.ErrPermissionDenied},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := s.UpdateRole(context.Background(), tt.p); !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func TestRoleChangePermission(t *testing.T) {
	tests := []struct {
		current, next authz.Role
		want          authz.Permission
	}{
		{authz.RoleMember, authz.RoleAdmin, authz.ManageRoles},
		{authz.RoleMember, authz.RoleModerator, authz.ManageRoles},
		{authz.RoleModerator, authz.RoleMember, authz.ManageRoles},
		{authz.RoleModerator, authz.RoleAdmin, authz.ManageRoles},
		{authz.RoleAdmin, authz.RoleMember, authz.ManageAdmins},
		{authz.RoleAdmin, authz.RoleModerator, authz.ManageAdmins},
		{authz.RoleAdmin, authz.RoleAdmin, authz.ManageAdmins},
	}
	for _, tt := range tests {
		got, err := roleChangePermission(tt.current, tt.next)
		if err != nil || got != tt.want {
			t.Fatalf("changing %s to %s: got %q, %v; want %q", tt.current, tt.next, got, err, tt.want)
		}
	}
	for _, tt := range []struct{ current, next authz.Role }{
		{authz.RoleOwner, authz.RoleAdmin},
		{authz.RoleOwner, authz.RoleMember},
		{authz.RoleMember, authz.RoleOwner},
		{authz.RoleAdmin, authz.RoleOwner},
	} {
		if _, err := roleChangePermission(tt.current, tt.next); !errors.Is(err, errs.ErrPermissionDenied) {
			t.Fatalf("changing %s to %s: expected permission denied, got %v", tt.current, tt.next, err)
		}
	}
}
