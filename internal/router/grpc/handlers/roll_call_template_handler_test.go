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

func TestCheckInTemplateService_Validation(t *testing.T) {
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
				_, err := h.ListCheckInTemplates(authed, &gumav1.ListCheckInTemplatesRequest{})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "list unauthenticated",
			call: func() error {
				_, err := h.ListCheckInTemplates(context.Background(), &gumav1.ListCheckInTemplatesRequest{GuildId: guildID})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "create unauthenticated",
			call: func() error {
				_, err := h.CreateCheckInTemplate(context.Background(), &gumav1.CreateCheckInTemplateRequest{GuildId: guildID, Name: "n", Title: "t"})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "create blank name",
			call: func() error {
				_, err := h.CreateCheckInTemplate(authed, &gumav1.CreateCheckInTemplateRequest{GuildId: guildID, Name: " ", Title: "t"})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "create malformed item template id",
			call: func() error {
				_, err := h.CreateCheckInTemplate(authed, &gumav1.CreateCheckInTemplateRequest{
					GuildId: guildID, Name: "n", Title: "t", ItemTemplateIds: []string{"nope"},
				})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "update missing template id",
			call: func() error {
				_, err := h.UpdateCheckInTemplate(authed, &gumav1.UpdateCheckInTemplateRequest{GuildId: guildID, Name: "n", Title: "t"})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "update malformed template id",
			call: func() error {
				_, err := h.UpdateCheckInTemplate(authed, &gumav1.UpdateCheckInTemplateRequest{
					GuildId: guildID, TemplateId: "nope", Name: "n", Title: "t",
				})
				return err
			},
			wantCode: codes.NotFound,
		},
		{
			name: "delete unauthenticated",
			call: func() error {
				_, err := h.DeleteCheckInTemplate(context.Background(), &gumav1.DeleteCheckInTemplateRequest{GuildId: guildID, TemplateId: "x"})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "delete malformed template id",
			call: func() error {
				_, err := h.DeleteCheckInTemplate(authed, &gumav1.DeleteCheckInTemplateRequest{GuildId: guildID, TemplateId: "nope"})
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
