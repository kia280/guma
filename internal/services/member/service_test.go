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
