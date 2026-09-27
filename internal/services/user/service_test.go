package user

import (
	"strings"
	"testing"

	kratos "github.com/ory/kratos-client-go"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kia280/guma/internal/services/errs"
)

func TestIdentityFromKratos(t *testing.T) {
	tests := []struct {
		name string
		kid  kratos.Identity
		want kratosIdentity
	}{
		{
			name: "verified email with discord username",
			kid: kratos.Identity{
				Traits:         map[string]any{"email": "ada@example.com"},
				MetadataPublic: map[string]any{"avatar": "https://cdn.example.com/a.png", "discord_username": " ada "},
				VerifiableAddresses: []kratos.VerifiableIdentityAddress{
					{Via: "email", Value: "ada@example.com", Verified: true},
				},
			},
			want: kratosIdentity{
				email:           "ada@example.com",
				username:        "ada@example.com",
				avatarURL:       "https://cdn.example.com/a.png",
				emailVerified:   true,
				discordUsername: "ada",
			},
		},
		{
			name: "pending email is not verified",
			kid: kratos.Identity{
				Traits: map[string]any{"email": "ada@example.com", "name": map[string]any{"first": "Ada", "last": "L"}},
				VerifiableAddresses: []kratos.VerifiableIdentityAddress{
					{Via: "email", Value: "ada@example.com", Verified: false},
				},
			},
			want: kratosIdentity{email: "ada@example.com", username: "Ada L"},
		},
		{
			name: "verified address for another email does not count",
			kid: kratos.Identity{
				Traits: map[string]any{"email": "ada@example.com"},
				VerifiableAddresses: []kratos.VerifiableIdentityAddress{
					{Via: "email", Value: "old@example.com", Verified: true},
				},
			},
			want: kratosIdentity{email: "ada@example.com", username: "ada@example.com"},
		},
		{
			name: "missing traits",
			kid:  kratos.Identity{},
			want: kratosIdentity{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, identityFromKratos(&tt.kid))
		})
	}
}

func TestLinkedAccountFromCredentials(t *testing.T) {
	oidc := func(providers ...map[string]any) map[string]kratos.IdentityCredentials {
		entries := make([]any, 0, len(providers))
		for _, p := range providers {
			entries = append(entries, p)
		}
		return map[string]kratos.IdentityCredentials{
			"oidc": {Config: map[string]any{"providers": entries}},
		}
	}

	tests := []struct {
		name  string
		creds map[string]kratos.IdentityCredentials
		want  *LinkedAccount
	}{
		{
			name:  "discord provider linked",
			creds: oidc(map[string]any{"provider": "google", "subject": "g-1"}, map[string]any{"provider": "discord", "subject": "1234"}),
			want:  &LinkedAccount{Provider: "discord", Subject: "1234", Username: "ada"},
		},
		{
			name:  "other provider only",
			creds: oidc(map[string]any{"provider": "google", "subject": "g-1"}),
			want:  nil,
		},
		{
			name:  "no oidc credential",
			creds: map[string]kratos.IdentityCredentials{"password": {}},
			want:  nil,
		},
		{
			name:  "malformed providers",
			creds: map[string]kratos.IdentityCredentials{"oidc": {Config: map[string]any{"providers": "nope"}}},
			want:  nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, linkedAccountFromCredentials(tt.creds, "discord", "ada"))
		})
	}
}

func TestValidateUpdateParams(t *testing.T) {
	valid := UpdateParams{DisplayName: " Ada Lovelace ", Username: " ada.lovelace-1_ ", Bio: " hello "}

	got, err := validateUpdateParams(valid)
	require.NoError(t, err)
	assert.Equal(t, UpdateParams{DisplayName: "Ada Lovelace", Username: "ada.lovelace-1_", Bio: "hello"}, got)

	tests := []struct {
		name   string
		mutate func(p *UpdateParams)
		want   string
	}{
		{name: "empty display name", mutate: func(p *UpdateParams) { p.DisplayName = "   " }, want: "display_name is required"},
		{name: "display name too long", mutate: func(p *UpdateParams) { p.DisplayName = strings.Repeat("名", MaxDisplayNameLength+1) }, want: "display_name must be at most"},
		{name: "empty username", mutate: func(p *UpdateParams) { p.Username = "" }, want: "username is required"},
		{name: "username too short", mutate: func(p *UpdateParams) { p.Username = "ab" }, want: "username must be between"},
		{name: "username too long", mutate: func(p *UpdateParams) { p.Username = strings.Repeat("a", MaxUsernameLength+1) }, want: "username must be between"},
		{name: "username with spaces and symbols", mutate: func(p *UpdateParams) { p.Username = "a b!!" }, want: "username may only contain"},
		{name: "username starting with punctuation", mutate: func(p *UpdateParams) { p.Username = "_ada" }, want: "username may only contain"},
		{name: "bio too long", mutate: func(p *UpdateParams) { p.Bio = strings.Repeat("b", MaxBioLength+1) }, want: "bio must be at most"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p := valid
			tt.mutate(&p)
			_, err := validateUpdateParams(p)
			require.ErrorIs(t, err, errs.ErrInvalidArgument)
			assert.Contains(t, err.Error(), tt.want)
		})
	}
}

func TestValidateUpdateParams_AllowsUnicodeUsername(t *testing.T) {
	for _, username := range []string{"小明明", "測試_成員", "Zoë.Müller", "ユーザー1", "사용자-2", "नमस्ते", strings.Repeat("名", MaxUsernameLength)} {
		t.Run(username, func(t *testing.T) {
			got, err := validateUpdateParams(UpdateParams{DisplayName: "Ada", Username: " " + username + " "})
			require.NoError(t, err)
			assert.Equal(t, username, got.Username)
		})
	}
}

func TestValidateUpdateParams_NormalizesToNFC(t *testing.T) {
	decomposed := "Zoe\u0308.Mu\u0308ller"
	composed := "Zo\u00eb.M\u00fcller"
	require.NotEqual(t, composed, decomposed)

	got, err := validateUpdateParams(UpdateParams{DisplayName: decomposed, Username: decomposed, Bio: decomposed})
	require.NoError(t, err)
	assert.Equal(t, composed, got.Username)
	assert.Equal(t, composed, got.DisplayName)
	assert.Equal(t, composed, got.Bio)
}

func TestValidateUpdateParams_CountsNormalizedLength(t *testing.T) {
	username := strings.Repeat("e\u0301", MaxUsernameLength)

	got, err := validateUpdateParams(UpdateParams{DisplayName: "Ada", Username: username})
	require.NoError(t, err)
	assert.Equal(t, strings.Repeat("\u00e9", MaxUsernameLength), got.Username)
}

func TestValidateUpdateParams_RejectsInvalidUnicodeUsername(t *testing.T) {
	tests := []struct {
		name     string
		username string
		want     string
	}{
		{name: "too short in runes", username: "小明", want: "username must be between"},
		{name: "too long in runes", username: strings.Repeat("名", MaxUsernameLength+1), want: "username must be between"},
		{name: "ideographic space", username: "小明　明", want: "username may only contain"},
		{name: "emoji", username: "ada😀", want: "username may only contain"},
		{name: "full-width punctuation", username: "小明！", want: "username may only contain"},
		{name: "starts with combining mark", username: "\u0301abc", want: "username may only contain"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := validateUpdateParams(UpdateParams{DisplayName: "Ada", Username: tt.username})
			require.ErrorIs(t, err, errs.ErrInvalidArgument)
			assert.Contains(t, err.Error(), tt.want)
		})
	}
}

func TestValidateUpdateParams_DisplayNameCountsRunes(t *testing.T) {
	p := UpdateParams{DisplayName: strings.Repeat("名", MaxDisplayNameLength), Username: "ada"}

	_, err := validateUpdateParams(p)
	require.NoError(t, err)
}
