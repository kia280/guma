package authz_test

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/authz/authztest"
	"github.com/kia280/guma/internal/services/errs"
)

func TestRequireOrNotFound(t *testing.T) {
	guild, user := uuid.New(), uuid.New()
	tests := []struct {
		name    string
		checker *authztest.Fake
		wantErr error
	}{
		{name: "granted", checker: authztest.New().Grant(guild, user, authz.ManageAnnouncements)},
		{name: "denied hides the resource", checker: authztest.New(), wantErr: errs.ErrNotFound},
		{name: "checker failure", checker: &authztest.Fake{CanErr: errors.New("keto down")}, wantErr: errs.ErrInternal},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := authz.RequireOrNotFound(context.Background(), tt.checker, guild, user, authz.ManageAnnouncements, "announcement")
			if tt.wantErr == nil && err != nil {
				t.Fatalf("unexpected error %v", err)
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Fatalf("expected %v, got %v", tt.wantErr, err)
			}
		})
	}
}

func TestAllowed(t *testing.T) {
	guild, user := uuid.New(), uuid.New()
	tests := []struct {
		name    string
		checker *authztest.Fake
		want    bool
		wantErr error
	}{
		{name: "granted", checker: authztest.New().Grant(guild, user, authz.ViewMemberContacts), want: true},
		{name: "denied", checker: authztest.New(), want: false},
		{name: "checker failure", checker: &authztest.Fake{CanErr: errors.New("keto down")}, wantErr: errs.ErrInternal},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := authz.Allowed(context.Background(), tt.checker, guild, user, authz.ViewMemberContacts)
			if tt.wantErr == nil && err != nil {
				t.Fatalf("unexpected error %v", err)
			}
			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Fatalf("expected %v, got %v", tt.wantErr, err)
			}
			if got != tt.want {
				t.Fatalf("Allowed = %v, want %v", got, tt.want)
			}
		})
	}
}
