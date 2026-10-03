package handlers

import (
	"context"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

func TestRollCallTemplateService_Validation(t *testing.T) {
	h := NewRollCallTemplateService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"

	tests := []struct {
		name     string
		call     func() error
		wantCode codes.Code
	}{
		{
			name: "list unauthenticated",
			call: func() error {
				_, err := h.ListRollCallTemplates(context.Background(), &gumav1.ListRollCallTemplatesRequest{GuildId: guildID})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "create unauthenticated",
			call: func() error {
				_, err := h.CreateRollCallTemplate(context.Background(), &gumav1.CreateRollCallTemplateRequest{GuildId: guildID, Name: "n", Title: "t"})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "create malformed item template id",
			call: func() error {
				_, err := h.CreateRollCallTemplate(authed, &gumav1.CreateRollCallTemplateRequest{
					GuildId: guildID, Name: "n", Title: "t", ItemTemplateIds: []string{"nope"},
				})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "update malformed template id",
			call: func() error {
				_, err := h.UpdateRollCallTemplate(authed, &gumav1.UpdateRollCallTemplateRequest{
					GuildId: guildID, TemplateId: "nope", Name: "n", Title: "t",
				})
				return err
			},
			wantCode: codes.NotFound,
		},
		{
			name: "delete unauthenticated",
			call: func() error {
				_, err := h.DeleteRollCallTemplate(context.Background(), &gumav1.DeleteRollCallTemplateRequest{GuildId: guildID, TemplateId: "x"})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "delete malformed template id",
			call: func() error {
				_, err := h.DeleteRollCallTemplate(authed, &gumav1.DeleteRollCallTemplateRequest{GuildId: guildID, TemplateId: "nope"})
				return err
			},
			wantCode: codes.NotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.call()
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}
