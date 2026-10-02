package handlers

import (
	"context"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	announcementsvc "github.com/kia280/guma/internal/services/announcement"
	"github.com/kia280/guma/internal/session"
)

func TestAnnouncementService_Validation(t *testing.T) {
	h := NewAnnouncementService(nil, zerolog.Nop())
	anon := context.Background()
	authed := session.WithUserID(anon, "00000000-0000-0000-0000-000000000001")
	const guild = "00000000-0000-0000-0000-00000000000a"
	const ann = "00000000-0000-0000-0000-0000000000f1"

	tests := []struct {
		name     string
		call     func() error
		wantCode codes.Code
	}{
		{
			name: "list unauthenticated",
			call: func() error {
				_, err := h.ListAnnouncements(anon, &gumav1.ListAnnouncementsRequest{GuildId: guild})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "create unauthenticated",
			call: func() error {
				_, err := h.CreateAnnouncementDraft(anon, &gumav1.CreateAnnouncementDraftRequest{GuildId: guild})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "create malformed guild",
			call: func() error {
				_, err := h.CreateAnnouncementDraft(authed, &gumav1.CreateAnnouncementDraftRequest{GuildId: "nope"})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "update malformed announcement",
			call: func() error {
				_, err := h.UpdateAnnouncement(authed, &gumav1.UpdateAnnouncementRequest{GuildId: guild, AnnouncementId: "nope"})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "publish unauthenticated",
			call: func() error {
				_, err := h.PublishAnnouncement(anon, &gumav1.PublishAnnouncementRequest{GuildId: guild, AnnouncementId: ann})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "unpublish unauthenticated",
			call: func() error {
				_, err := h.UnpublishAnnouncement(anon, &gumav1.UnpublishAnnouncementRequest{GuildId: guild, AnnouncementId: ann})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.call()
			require.Error(t, err)
			assert.Equal(t, tt.wantCode, status.Code(err))
		})
	}
}

func TestAnnouncementToProto(t *testing.T) {
	now := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	draft := &announcementsvc.Announcement{
		ID: "a1", GuildID: "g1", AuthorID: "u1", AuthorName: "Kia",
		Title: "Raid", Content: "Tonight", Pinned: true, Status: announcementsvc.StatusDraft,
		CreatedAt: now, UpdatedAt: now,
	}
	got := announcementToProto(draft)
	assert.Nil(t, got.PublishedAt)
	assert.Equal(t, "draft", got.Status)
	assert.Equal(t, "Kia", got.AuthorName)
	assert.True(t, got.Pinned)

	draft.Status = announcementsvc.StatusPublished
	draft.PublishedAt = &now
	got = announcementToProto(draft)
	require.NotNil(t, got.PublishedAt)
	assert.True(t, got.PublishedAt.AsTime().Equal(now))
}
