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
			want: kratosIdentity{email: "ada@example.com"},
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

func TestDefaultDisplayName(t *testing.T) {
	assert.Equal(t, "Ada L", defaultDisplayName(kratosIdentity{username: "Ada L", discordUsername: "ada"}))
	assert.Equal(t, "ada", defaultDisplayName(kratosIdentity{discordUsername: " ada "}))
	assert.Equal(t, strings.Repeat("名", MaxDisplayNameLength), defaultDisplayName(kratosIdentity{discordUsername: strings.Repeat("名", MaxDisplayNameLength+5)}))

	generated := defaultDisplayName(kratosIdentity{email: "ada@example.com"})
	assert.Regexp(t, `^member-[0-9a-f]{8}$`, generated)
	assert.NotContains(t, generated, "ada")
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
	valid := UpdateParams{DisplayName: " Ada Lovelace ", Bio: " hello "}

	got, err := validateUpdateParams(valid)
	require.NoError(t, err)
	assert.Equal(t, UpdateParams{DisplayName: "Ada Lovelace", Bio: "hello"}, got)

	tests := []struct {
		name   string
		mutate func(p *UpdateParams)
		want   string
	}{
		{name: "empty display name", mutate: func(p *UpdateParams) { p.DisplayName = "   " }, want: "display_name is required"},
		{name: "display name too long", mutate: func(p *UpdateParams) { p.DisplayName = strings.Repeat("名", MaxDisplayNameLength+1) }, want: "display_name must be at most"},
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

func TestValidateUpdateParams_AllowsAnyScript(t *testing.T) {
	for _, name := range []string{"小明明", "測試 成員", "Zoë Müller", "ユーザー1", "사용자-2", "Night法師!", strings.Repeat("名", MaxDisplayNameLength)} {
		t.Run(name, func(t *testing.T) {
			got, err := validateUpdateParams(UpdateParams{DisplayName: " " + name + " "})
			require.NoError(t, err)
			assert.Equal(t, name, got.DisplayName)
		})
	}
}

func TestValidateUpdateParams_NormalizesToNFC(t *testing.T) {
	decomposed := "Zoe\u0308.Mu\u0308ller"
	composed := "Zo\u00eb.M\u00fcller"
	require.NotEqual(t, composed, decomposed)

	got, err := validateUpdateParams(UpdateParams{DisplayName: decomposed, Bio: decomposed})
	require.NoError(t, err)
	assert.Equal(t, composed, got.DisplayName)
	assert.Equal(t, composed, got.Bio)
}

func TestValidateUpdateParams_CountsNormalizedLength(t *testing.T) {
	name := strings.Repeat("e\u0301", MaxDisplayNameLength)

	got, err := validateUpdateParams(UpdateParams{DisplayName: name})
	require.NoError(t, err)
	assert.Equal(t, strings.Repeat("\u00e9", MaxDisplayNameLength), got.DisplayName)
}
