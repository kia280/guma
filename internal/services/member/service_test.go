package member

import (
	"context"
	"errors"
	"testing"

	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/services/errs"
)

func TestListValidatesInput(t *testing.T) {
	s := New(nil, zerolog.Nop())
	const guild = "00000000-0000-0000-0000-000000000001"
	const caller = "00000000-0000-0000-0000-000000000002"
	tests := []struct {
		name string
		p    ListParams
	}{
		{name: "bad guild id", p: ListParams{GuildID: "nope", CallerID: caller}},
		{name: "bad caller id", p: ListParams{GuildID: guild, CallerID: "nope"}},
		{name: "unknown role", p: ListParams{GuildID: guild, CallerID: caller, Role: "king"}},
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

func TestCanSeeDiscord(t *testing.T) {
	for role, want := range map[string]bool{"owner": true, "admin": true, "moderator": true, "member": false, "": false} {
		if got := canSeeDiscord(role); got != want {
			t.Errorf("canSeeDiscord(%q) = %v, want %v", role, got, want)
		}
	}
}

func TestUpdateRoleValidatesInput(t *testing.T) {
	s := New(nil, zerolog.Nop())
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
		{name: "unknown role", p: UpdateRoleParams{GuildID: guild, ActorID: actor, UserID: target, Role: "king"}, want: errs.ErrInvalidArgument},
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

func TestAuthorizeRoleChange(t *testing.T) {
	tests := []struct {
		actor, current, next string
		allowed              bool
	}{
		{"owner", "member", "admin", true},
		{"owner", "admin", "member", true},
		{"owner", "admin", "moderator", true},
		{"owner", "moderator", "member", true},
		{"owner", "member", "owner", false},
		{"owner", "owner", "admin", false},
		{"admin", "member", "moderator", true},
		{"admin", "member", "admin", true},
		{"admin", "moderator", "member", true},
		{"admin", "moderator", "admin", true},
		{"admin", "admin", "member", false},
		{"admin", "admin", "admin", false},
		{"admin", "owner", "member", false},
		{"admin", "member", "owner", false},
		{"moderator", "member", "moderator", false},
		{"member", "member", "moderator", false},
	}
	for _, tt := range tests {
		err := authorizeRoleChange(tt.actor, tt.current, tt.next)
		if tt.allowed && err != nil {
			t.Fatalf("%s changing %s to %s: unexpected error %v", tt.actor, tt.current, tt.next, err)
		}
		if !tt.allowed && !errors.Is(err, errs.ErrPermissionDenied) {
			t.Fatalf("%s changing %s to %s: expected permission denied, got %v", tt.actor, tt.current, tt.next, err)
		}
	}
}
