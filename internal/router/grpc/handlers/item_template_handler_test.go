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
			name: "list missing guild",
			call: func() error {
				_, err := h.ListItemTemplates(authed, &gumav1.ListItemTemplatesRequest{})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "create unknown category",
			call: func() error {
				_, err := h.CreateItemTemplate(authed, &gumav1.CreateItemTemplateRequest{
					GuildId: guildID, Name: "Sword", Category: "vehicle", Rarity: "rare",
				})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "create unknown rarity",
			call: func() error {
				_, err := h.CreateItemTemplate(authed, &gumav1.CreateItemTemplateRequest{
					GuildId: guildID, Name: "Sword", Category: "weapon", Rarity: "shiny",
				})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "update missing template id",
			call: func() error {
				_, err := h.UpdateItemTemplate(authed, &gumav1.UpdateItemTemplateRequest{
					GuildId: guildID, Name: "Sword", Category: "weapon", Rarity: "rare",
				})
				return err
			},
			wantCode: codes.InvalidArgument,
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
