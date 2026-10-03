package notification

import (
	"context"
	"errors"
	"testing"

	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/services/pagination"
)

func TestValidatesInputBeforeQuerying(t *testing.T) {
	s := New(nil, zerolog.Nop())
	ctx := context.Background()
	const user = "00000000-0000-0000-0000-000000000001"

	tests := []struct {
		name string
		call func() error
		want error
	}{
		{name: "list without user", call: func() error { _, err := s.List(ctx, ListParams{}); return err }, want: errs.ErrUnauthenticated},
		{name: "list bad user id", call: func() error { _, err := s.List(ctx, ListParams{UserID: "nope"}); return err }, want: errs.ErrInvalidArgument},
		{name: "list bad page token", call: func() error { _, err := s.List(ctx, ListParams{UserID: user, PageToken: "next"}); return err }, want: errs.ErrInvalidArgument},
		{name: "list negative page token", call: func() error { _, err := s.List(ctx, ListParams{UserID: user, PageToken: "-1"}); return err }, want: errs.ErrInvalidArgument},
		{name: "unread count bad user id", call: func() error { _, err := s.UnreadCount(ctx, "nope"); return err }, want: errs.ErrInvalidArgument},
		{name: "mark read without user", call: func() error { _, err := s.MarkRead(ctx, "", user); return err }, want: errs.ErrUnauthenticated},
		{name: "mark read bad notification id", call: func() error { _, err := s.MarkRead(ctx, user, "nope"); return err }, want: errs.ErrInvalidArgument},
		{name: "mark all read bad user id", call: func() error { _, err := s.MarkAllRead(ctx, "nope"); return err }, want: errs.ErrInvalidArgument},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if err := tt.call(); !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
		})
	}
}

func TestClampPageSize(t *testing.T) {
	for in, want := range map[int32]int32{0: pagination.DefaultSize, -3: pagination.DefaultSize, 7: 7, pagination.MaxSize + 1: pagination.MaxSize} {
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
		{offset: 0, returned: 20, pageSize: 20, total: 45, want: "20"},
		{offset: 40, returned: 5, pageSize: 20, total: 45, want: ""},
		{offset: 20, returned: 20, pageSize: 20, total: 40, want: ""},
		{offset: 0, returned: 0, pageSize: 20, total: 0, want: ""},
	}
	for _, tt := range tests {
		if got := nextPageToken(tt.offset, tt.returned, tt.pageSize, tt.total); got != tt.want {
			t.Fatalf("nextPageToken(%+v) = %q, want %q", tt, got, tt.want)
		}
	}
}

func TestDecodeParams(t *testing.T) {
	got := decodeParams([]byte(`{"item":"Dragon Scale","amount":500,"rank":1}`))
	if got["item"] != "Dragon Scale" || got["amount"] != float64(500) || got["rank"] != float64(1) {
		t.Fatalf("unexpected params %v", got)
	}
	if len(decodeParams([]byte(`not json`))) != 0 {
		t.Fatalf("expected empty params for invalid JSON")
	}
	if len(decodeParams(nil)) != 0 {
		t.Fatalf("expected empty params for empty input")
	}
}
