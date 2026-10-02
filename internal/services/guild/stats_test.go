package guild

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/authz/authztest"
	"github.com/kia280/guma/internal/services/errs"
)

func TestStats_Permissions(t *testing.T) {
	guildID, userID := uuid.New(), uuid.New()
	tests := []struct {
		name    string
		grants  []authz.Permission
		wantErr error
	}{
		{name: "view stats allowed", grants: []authz.Permission{authz.View, authz.ViewStats}},
		{name: "staff without view stats denied", grants: []authz.Permission{authz.View, authz.ReviewBankRequests}, wantErr: errs.ErrPermissionDenied},
		{name: "member denied", grants: []authz.Permission{authz.View}, wantErr: errs.ErrPermissionDenied},
		{name: "non-member denied", wantErr: errs.ErrPermissionDenied},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := &fakeDB{}
			stats, err := newTestService(f, authztest.New().Grant(guildID, userID, tt.grants...)).Stats(context.Background(), guildID.String(), userID.String())
			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				assert.False(t, f.statsCalled)
				return
			}
			require.NoError(t, err)
			assert.True(t, f.statsCalled)
			assert.Equal(t, &Stats{
				MemberCount:      24,
				BankBalance:      1250000,
				BankCurrency:     "gold",
				ActiveEventCount: 3,
				BankItemCount:    47,
			}, stats)
		})
	}
}

func TestStats_MissingGuild(t *testing.T) {
	guildID, userID := uuid.New(), uuid.New()
	f := &fakeDB{statsMissing: true}
	_, err := newTestService(f, authztest.New().Grant(guildID, userID, authz.ViewStats)).Stats(context.Background(), guildID.String(), userID.String())
	assert.ErrorIs(t, err, errs.ErrNotFound)
}

func TestStats_InvalidIDs(t *testing.T) {
	f := &fakeDB{}
	svc := newTestService(f, authztest.New())

	_, err := svc.Stats(context.Background(), "not-a-uuid", uuid.NewString())
	assert.ErrorIs(t, err, errs.ErrNotFound)

	_, err = svc.Stats(context.Background(), uuid.NewString(), "not-a-uuid")
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
	assert.False(t, f.statsCalled)
}

func TestStats_CheckerFailureIsInternal(t *testing.T) {
	f := &fakeDB{}
	_, err := newTestService(f, &authztest.Fake{CanErr: errors.New("keto down")}).Stats(context.Background(), uuid.NewString(), uuid.NewString())
	assert.ErrorIs(t, err, errs.ErrInternal)
	assert.False(t, f.statsCalled)
}
