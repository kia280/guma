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

func TestItemTemplateService_Validation(t *testing.T) {
	h := NewItemTemplateService(nil, zerolog.Nop())
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
				_, err := h.ListItemTemplates(context.Background(), &gumav1.ListItemTemplatesRequest{GuildId: guildID})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "update malformed template id",
			call: func() error {
				_, err := h.UpdateItemTemplate(authed, &gumav1.UpdateItemTemplateRequest{
					GuildId: guildID, TemplateId: "nope", Name: "Sword", Category: "weapon", Rarity: "rare",
				})
				return err
			},
			wantCode: codes.NotFound,
		},
		{
			name: "delete unauthenticated",
			call: func() error {
				_, err := h.DeleteItemTemplate(context.Background(), &gumav1.DeleteItemTemplateRequest{GuildId: guildID, TemplateId: "x"})
				return err
			},
			wantCode: codes.Unauthenticated,
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
