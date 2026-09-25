package user

import (
	"testing"

	kratos "github.com/ory/kratos-client-go"
	"github.com/stretchr/testify/assert"
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
