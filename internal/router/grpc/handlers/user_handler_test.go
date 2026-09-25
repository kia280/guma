package handlers

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	usersvc "github.com/kia280/guma/internal/services/user"
)

func TestUserService_GetMe_Unauthenticated(t *testing.T) {
	service := NewUserService(nil, "", zerolog.New(os.Stdout))

	_, err := service.GetMe(context.Background(), &gumav1.GetMeRequest{})
	require.Error(t, err)
	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.Unauthenticated, st.Code())
}

func TestUserToProto_IdentityFields(t *testing.T) {
	now := time.Now()
	verified := true

	got := userToProto(&usersvc.User{
		ID:               "u-1",
		Email:            "ada@example.com",
		CurrentGuildID:   "g-1",
		CurrentGuildRole: "moderator",
		EmailVerified:    &verified,
		Discord:          &usersvc.LinkedAccount{Provider: "discord", Subject: "1234", Username: "ada"},
		CreatedAt:        now,
		UpdatedAt:        now,
	})

	require.NotNil(t, got.EmailVerified)
	assert.True(t, *got.EmailVerified)
	assert.Equal(t, "moderator", got.GuildRole)
	require.NotNil(t, got.Discord)
	assert.Equal(t, "discord", got.Discord.Provider)
	assert.Equal(t, "1234", got.Discord.Subject)
	assert.Equal(t, "ada", got.Discord.Username)
}

func TestUserToProto_UnknownIdentityState(t *testing.T) {
	got := userToProto(&usersvc.User{ID: "u-1"})

	assert.Nil(t, got.EmailVerified)
	assert.Nil(t, got.Discord)
	assert.Empty(t, got.GuildRole)
}
