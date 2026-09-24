package devauth

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/kia280/guma/internal/services/errs"
)

func TestSeedRole(t *testing.T) {
	for n, want := range map[int]string{1: "member", 9: "member", 10: "moderator", 20: "moderator", 21: "member"} {
		if got := seedRole(n); got != want {
			t.Fatalf("seedRole(%d) = %q, want %q", n, got, want)
		}
	}
}

func TestRandomSeedName(t *testing.T) {
	for range 50 {
		name, err := randomSeedName()
		if err != nil {
			t.Fatalf("randomSeedName: %v", err)
		}
		if !slices.ContainsFunc(seedNamePrefixes, func(p string) bool { return strings.HasPrefix(name, p) }) {
			t.Fatalf("name %q has no known prefix", name)
		}
		if !slices.ContainsFunc(seedNameSuffixes, func(s string) bool { return strings.HasSuffix(name, s) }) {
			t.Fatalf("name %q has no known suffix", name)
		}
	}
}

func TestSeedGuildMembersValidatesInput(t *testing.T) {
	s := &Service{}
	tests := []struct {
		name    string
		guildID string
		count   int
	}{
		{name: "bad guild id", guildID: "nope", count: 1},
		{name: "zero count", guildID: "00000000-0000-0000-0000-000000000001", count: 0},
		{name: "too many", guildID: "00000000-0000-0000-0000-000000000001", count: MaxSeedCount + 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := s.SeedGuildMembers(context.Background(), tt.guildID, tt.count); !errors.Is(err, errs.ErrInvalidArgument) {
				t.Fatalf("expected invalid argument, got %v", err)
			}
		})
	}
}
