package guild

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kia280/guma/internal/services/errs"
)

func TestStats_Permissions(t *testing.T) {
	tests := []struct {
		name    string
		role    string
		wantErr error
	}{
		{name: "owner allowed", role: "owner"},
		{name: "admin allowed", role: "admin"},
		{name: "moderator denied", role: "moderator", wantErr: errs.ErrPermissionDenied},
		{name: "member denied", role: "member", wantErr: errs.ErrPermissionDenied},
		{name: "non-member denied", role: "", wantErr: errs.ErrPermissionDenied},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := &fakeDB{role: tt.role}
			stats, err := newTestService(f).Stats(context.Background(), uuid.NewString(), uuid.NewString())
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
	f := &fakeDB{role: "owner", statsMissing: true}
	_, err := newTestService(f).Stats(context.Background(), uuid.NewString(), uuid.NewString())
	assert.ErrorIs(t, err, errs.ErrNotFound)
}

func TestStats_InvalidIDs(t *testing.T) {
	f := &fakeDB{role: "owner"}
	svc := newTestService(f)

	_, err := svc.Stats(context.Background(), "not-a-uuid", uuid.NewString())
	assert.ErrorIs(t, err, errs.ErrNotFound)

	_, err = svc.Stats(context.Background(), uuid.NewString(), "not-a-uuid")
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
	assert.False(t, f.statsCalled)
}
