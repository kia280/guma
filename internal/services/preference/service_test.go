package preference

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

var testUser = uuid.MustParse("00000000-0000-0000-0000-000000000001")

type fakeStore struct {
	getRow    db.GetNotificationPreferencesRow
	getErr    error
	upsertArg db.UpsertNotificationPreferencesParams
	upsertRow db.UpsertNotificationPreferencesRow
	upsertErr error
	writes    int
}

func (f *fakeStore) GetNotificationPreferences(context.Context, uuid.UUID) (db.GetNotificationPreferencesRow, error) {
	return f.getRow, f.getErr
}

func (f *fakeStore) UpsertNotificationPreferences(_ context.Context, arg db.UpsertNotificationPreferencesParams) (db.UpsertNotificationPreferencesRow, error) {
	f.writes++
	f.upsertArg = arg
	return f.upsertRow, f.upsertErr
}

func boolPtr(v bool) *bool { return &v }

func TestGetReturnsDefaultsWhenNoRow(t *testing.T) {
	s := newService(&fakeStore{getErr: pgx.ErrNoRows}, zerolog.Nop())

	got, err := s.Get(context.Background(), testUser)
	require.NoError(t, err)
	assert.Equal(t, DefaultNotifications, got.Notifications)
	assert.True(t, got.UpdatedAt.IsZero())
}

func TestGetReturnsStoredRow(t *testing.T) {
	updated := time.Date(2026, 9, 25, 10, 0, 0, 0, time.UTC)
	s := newService(&fakeStore{getRow: db.GetNotificationPreferencesRow{
		EmailNotifications: false,
		AuctionAlerts:      true,
		RaffleAlerts:       false,
		EventReminders:     true,
		RollCallReminders:  false,
		UpdatedAt:          updated,
	}}, zerolog.Nop())

	got, err := s.Get(context.Background(), testUser)
	require.NoError(t, err)
	assert.Equal(t, NotificationPreferences{AuctionAlerts: true, EventReminders: true}, got.Notifications)
	assert.Equal(t, updated, got.UpdatedAt)
}

func TestGetWrapsStoreErrors(t *testing.T) {
	s := newService(&fakeStore{getErr: errors.New("boom")}, zerolog.Nop())
	_, err := s.Get(context.Background(), testUser)
	assert.ErrorIs(t, err, errs.ErrInternal)
}

func TestUpdateNotificationsSendsOnlyProvidedFields(t *testing.T) {
	store := &fakeStore{upsertRow: db.UpsertNotificationPreferencesRow{
		EmailNotifications: true,
		AuctionAlerts:      false,
		RaffleAlerts:       true,
		EventReminders:     false,
		RollCallReminders:  true,
	}}
	s := newService(store, zerolog.Nop())

	got, err := s.UpdateNotifications(context.Background(), testUser, NotificationPatch{AuctionAlerts: boolPtr(false)})
	require.NoError(t, err)
	assert.Equal(t, 1, store.writes)
	assert.Equal(t, testUser, store.upsertArg.UserID)
	assert.True(t, store.upsertArg.AuctionAlerts.Valid)
	assert.False(t, store.upsertArg.AuctionAlerts.Bool)
	assert.False(t, store.upsertArg.EmailNotifications.Valid)
	assert.False(t, store.upsertArg.RaffleAlerts.Valid)
	assert.False(t, store.upsertArg.EventReminders.Valid)
	assert.False(t, store.upsertArg.RollCallReminders.Valid)
	assert.False(t, got.Notifications.AuctionAlerts)
	assert.True(t, got.Notifications.EmailNotifications)
}

func TestUpdateNotificationsMapsMissingUserToNotFound(t *testing.T) {
	s := newService(&fakeStore{upsertErr: &pgconn.PgError{Code: foreignKeyViolation}}, zerolog.Nop())
	_, err := s.UpdateNotifications(context.Background(), testUser, NotificationPatch{EmailNotifications: boolPtr(false)})
	assert.ErrorIs(t, err, errs.ErrNotFound)
}

func TestUpdateNotificationsWrapsStoreErrors(t *testing.T) {
	s := newService(&fakeStore{upsertErr: errors.New("boom")}, zerolog.Nop())
	_, err := s.UpdateNotifications(context.Background(), testUser, NotificationPatch{EmailNotifications: boolPtr(false)})
	assert.ErrorIs(t, err, errs.ErrInternal)
}
