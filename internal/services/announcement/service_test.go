package announcement

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/authz/authztest"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

func TestDraftAccessRequiresManagePermission(t *testing.T) {
	guild, user := uuid.New(), uuid.New()
	s := New(nil, authztest.New().Grant(guild, user, authz.View), zerolog.Nop())
	ctx := context.Background()

	_, err := s.List(ctx, ListParams{GuildID: guild, UserID: user, IncludeDrafts: true})
	if !errors.Is(err, errs.ErrPermissionDenied) {
		t.Fatalf("listing drafts: expected permission denied, got %v", err)
	}
}

func TestNonMemberCannotListAnnouncements(t *testing.T) {
	s := New(nil, authztest.New(), zerolog.Nop())
	_, err := s.List(context.Background(), ListParams{GuildID: uuid.New(), UserID: uuid.New()})
	if !errors.Is(err, errs.ErrPermissionDenied) {
		t.Fatalf("expected permission denied, got %v", err)
	}
}

func TestUpdateRejection(t *testing.T) {
	if err := updateRejection(&Announcement{Status: StatusPublished}); !errors.Is(err, errs.ErrInvalidArgument) {
		t.Fatalf("expected invalid argument for blank published update, got %v", err)
	}
	if err := updateRejection(&Announcement{Status: StatusDraft}); !errors.Is(err, errs.ErrFailedPrecondition) {
		t.Fatalf("expected failed precondition for unexpected draft rejection, got %v", err)
	}
}

func TestPublishRejection(t *testing.T) {
	tests := []struct {
		name string
		a    Announcement
		want string
	}{
		{name: "already published", a: Announcement{Status: StatusPublished, Title: "t", Content: "c"}, want: "already published"},
		{name: "blank title", a: Announcement{Status: StatusDraft, Title: "  ", Content: "c"}, want: "title and content are required"},
		{name: "blank content", a: Announcement{Status: StatusDraft, Title: "t", Content: "\n"}, want: "title and content are required"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := publishRejection(&tt.a)
			if !errors.Is(err, errs.ErrFailedPrecondition) || !strings.Contains(err.Error(), tt.want) {
				t.Fatalf("unexpected error %v", err)
			}
		})
	}
}

func TestToAnnouncement(t *testing.T) {
	now := time.Now().UTC()
	row := db.GetAnnouncementRow{
		ID: uuid.New(), GuildID: uuid.New(), AuthorID: uuid.New(), AuthorName: "Kia",
		Title: "Raid night", Content: "Bring potions", Pinned: true, Status: StatusDraft,
		CreatedAt: now, UpdatedAt: now,
	}
	if got := toAnnouncement(row); got.PublishedAt != nil || got.AuthorName != "Kia" || !got.Pinned {
		t.Fatalf("unexpected draft mapping %+v", got)
	}

	row.Status = StatusPublished
	row.PublishedAt = pgtype.Timestamptz{Time: now, Valid: true}
	if got := toAnnouncement(row); got.PublishedAt == nil || !got.PublishedAt.Equal(now) {
		t.Fatalf("expected published_at %v, got %+v", now, got.PublishedAt)
	}
}

func TestClampPageSize(t *testing.T) {
	for in, want := range map[int32]int32{0: defaultPageSize, -1: defaultPageSize, 10: 10, maxPageSize + 1: maxPageSize} {
		if got := clampPageSize(in); got != want {
			t.Fatalf("clampPageSize(%d) = %d, want %d", in, got, want)
		}
	}
}
