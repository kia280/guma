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
	h := NewItemTemplateService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), testUserID)
	const guildID = "00000000-0000-0000-0000-000000000002"

	tests := []struct {
		name     string
		call     func() error
		wantCode codes.Code
	}{
		{
			name: "update malformed template id",
			call: func() error {
				_, err := h.UpdateItemTemplate(authed, &gumav1.UpdateItemTemplateRequest{
					GuildId: guildID, TemplateId: "nope", Name: "Sword", Category: "weapon", Rarity: "rare",
				})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "list malformed guild id",
			call: func() error {
				_, err := h.ListItemTemplates(authed, &gumav1.ListItemTemplatesRequest{GuildId: "nope"})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "create malformed guild id",
			call: func() error {
				_, err := h.CreateItemTemplate(authed, &gumav1.CreateItemTemplateRequest{GuildId: "nope", Name: "Sword"})
				return err
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "create unauthenticated",
			call: func() error {
				_, err := h.CreateItemTemplate(context.Background(), &gumav1.CreateItemTemplateRequest{GuildId: guildID, Name: "Sword"})
				return err
			},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "delete malformed template id",
			call: func() error {
				_, err := h.DeleteItemTemplate(authed, &gumav1.DeleteItemTemplateRequest{GuildId: guildID, TemplateId: "nope"})
				return err
			},
			wantCode: codes.InvalidArgument,
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
