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
			name: "list missing guild",
			call: func() error {
				_, err := h.ListRollCallTemplates(authed, &gumav1.ListRollCallTemplatesRequest{})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "create blank name",
			call: func() error {
				_, err := h.CreateRollCallTemplate(authed, &gumav1.CreateRollCallTemplateRequest{GuildId: guildID, Name: " ", Title: "t"})
				return err
			},
			wantCode: codes.InvalidArgument,
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
			name: "update missing template id",
			call: func() error {
				_, err := h.UpdateRollCallTemplate(authed, &gumav1.UpdateRollCallTemplateRequest{GuildId: guildID, Name: "n", Title: "t"})
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
