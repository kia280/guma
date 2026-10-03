package guild

import (
	"bytes"
	"context"
	"errors"
	"image"
	"image/png"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/authz/authztest"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
)

type fakeRow struct {
	scan func(dest ...any) error
}

func (r fakeRow) Scan(dest ...any) error { return r.scan(dest...) }

type fakeDB struct {
	upsertCalled bool
	upsertArgs   []any
	statsCalled  bool
	statsMissing bool
}

func (f *fakeDB) Exec(context.Context, string, ...any) (pgconn.CommandTag, error) {
	return pgconn.CommandTag{}, nil
}

func (f *fakeDB) Query(context.Context, string, ...any) (pgx.Rows, error) {
	return nil, errors.New("unexpected query")
}

func (f *fakeDB) QueryRow(_ context.Context, sql string, args ...any) pgx.Row {
	switch {
	case strings.Contains(sql, "name: UpsertGuildLogo"):
		f.upsertCalled = true
		f.upsertArgs = args
		return fakeRow{scan: func(dest ...any) error {
			*dest[0].(*uuid.UUID) = args[1].(uuid.UUID)
			*dest[1].(*string) = "Guild"
			*dest[9].(*string) = args[0].(string)
			*dest[11].(*time.Time) = time.Now()
			*dest[12].(*time.Time) = time.Now()
			return nil
		}}
	case strings.Contains(sql, "name: CountGuildMembers"):
		return fakeRow{scan: func(dest ...any) error {
			*dest[0].(*int64) = 3
			return nil
		}}
	case strings.Contains(sql, "name: GetGuildStats"):
		f.statsCalled = true
		return fakeRow{scan: func(dest ...any) error {
			if f.statsMissing {
				return pgx.ErrNoRows
			}
			*dest[0].(*int32) = 24
			*dest[1].(*int64) = 1250000
			*dest[2].(*string) = "gold"
			*dest[3].(*int32) = 3
			*dest[4].(*int32) = 47
			return nil
		}}
	}
	return fakeRow{scan: func(...any) error { return errors.New("unexpected query row") }}
}

func newTestService(f *fakeDB, az *authztest.Fake) *Service {
	return &Service{q: db.New(f), az: az, logger: zerolog.Nop()}
}

func pngBytes(t *testing.T) []byte {
	t.Helper()
	var buf bytes.Buffer
	require.NoError(t, png.Encode(&buf, image.NewRGBA(image.Rect(0, 0, 2, 2))))
	return buf.Bytes()
}

func TestValidateLogo(t *testing.T) {
	valid := pngBytes(t)

	tests := []struct {
		name        string
		contentType string
		data        []byte
		wantErr     bool
	}{
		{name: "png", contentType: "image/png", data: valid},
		{name: "normalizes content type", contentType: " IMAGE/PNG ", data: valid},
		{name: "svg rejected", contentType: "image/svg+xml", data: []byte("<svg></svg>"), wantErr: true},
		{name: "empty content type", contentType: "", data: valid, wantErr: true},
		{name: "empty data", contentType: "image/png", data: nil, wantErr: true},
		{name: "too large", contentType: "image/png", data: append(valid, make([]byte, MaxLogoBytes)...), wantErr: true},
		{name: "content mismatch", contentType: "image/jpeg", data: valid, wantErr: true},
		{name: "not an image", contentType: "image/png", data: []byte("hello world"), wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ValidateLogo(tt.contentType, tt.data)
			if tt.wantErr {
				require.Error(t, err)
				assert.ErrorIs(t, err, errs.ErrInvalidArgument)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, "image/png", got)
		})
	}
}

func TestUploadLogo_StoresLogo(t *testing.T) {
	guildID := uuid.New()
	userID := uuid.New()

	tests := []struct {
		name    string
		grants  []authz.Permission
		wantErr error
	}{
		{name: "manage guild allowed", grants: []authz.Permission{authz.View, authz.ManageGuild}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := &fakeDB{}
			g, err := newTestService(f, authztest.New().Grant(guildID, userID, tt.grants...)).UploadLogo(context.Background(), UploadLogoParams{
				GuildID:     guildID,
				UserID:      userID,
				ContentType: "image/png",
				Data:        pngBytes(t),
			})
			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				assert.False(t, f.upsertCalled)
				return
			}
			require.NoError(t, err)
			assert.True(t, f.upsertCalled)
			assert.True(t, strings.HasPrefix(g.IconURL, "/v1/guilds/"+guildID.String()+"/logo?v="))
			assert.Equal(t, int32(3), g.MemberCount)
		})
	}
}

func TestUploadLogo_RejectsInvalidImageBeforeWriting(t *testing.T) {
	f := &fakeDB{}
	_, err := newTestService(f, authztest.New()).UploadLogo(context.Background(), UploadLogoParams{
		GuildID:     uuid.New(),
		UserID:      uuid.New(),
		ContentType: "image/svg+xml",
		Data:        []byte("<svg></svg>"),
	})
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
	assert.False(t, f.upsertCalled)
}
