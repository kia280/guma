package checkintemplate

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

var (
	testGuild    = uuid.MustParse("00000000-0000-0000-0000-000000000001")
	testUser     = uuid.MustParse("00000000-0000-0000-0000-000000000002")
	testTemplate = uuid.MustParse("00000000-0000-0000-0000-000000000003")
)

type fakeStore struct {
	role      string
	roleErr   error
	rows      []db.CheckinTemplate
	createArg db.CreateCheckinTemplateParams
	updateArg db.UpdateCheckinTemplateParams
	writeErr  error
	deleted   int64
	calls     int
}

func (f *fakeStore) GetGuildMemberRole(context.Context, db.GetGuildMemberRoleParams) (string, error) {
	return f.role, f.roleErr
}

func (f *fakeStore) ListCheckinTemplates(context.Context, uuid.UUID) ([]db.CheckinTemplate, error) {
	f.calls++
	return f.rows, nil
}

func (f *fakeStore) CreateCheckinTemplate(_ context.Context, arg db.CreateCheckinTemplateParams) (db.CheckinTemplate, error) {
	f.calls++
	f.createArg = arg
	if f.writeErr != nil {
		return db.CheckinTemplate{}, f.writeErr
	}
	return db.CheckinTemplate{
		ID: testTemplate, GuildID: arg.GuildID, Name: arg.Name, Title: arg.Title,
		LootList: arg.LootList, CreatedBy: arg.CreatedBy, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}, nil
}

func (f *fakeStore) UpdateCheckinTemplate(_ context.Context, arg db.UpdateCheckinTemplateParams) (db.CheckinTemplate, error) {
	f.calls++
	f.updateArg = arg
	if f.writeErr != nil {
		return db.CheckinTemplate{}, f.writeErr
	}
	return db.CheckinTemplate{ID: arg.ID, GuildID: arg.GuildID, Name: arg.Name, Title: arg.Title, LootList: arg.LootList}, nil
}

func (f *fakeStore) DeleteCheckinTemplate(context.Context, db.DeleteCheckinTemplateParams) (int64, error) {
	f.calls++
	return f.deleted, nil
}

func validCreate() CreateParams {
	return CreateParams{
		GuildID:  testGuild.String(),
		UserID:   testUser.String(),
		Name:     "  Weekly raid  ",
		Title:    " Raid night ",
		LootList: []models.Item{{Name: " Sword "}, {Name: "Shield", Rarity: "RARE"}},
	}
}

func TestCreateStoresNormalizedTemplate(t *testing.T) {
	store := &fakeStore{role: "moderator"}
	s := newService(store, zerolog.Nop())

	tmpl, err := s.Create(context.Background(), validCreate())
	require.NoError(t, err)

	assert.Equal(t, "Weekly raid", store.createArg.Name)
	assert.Equal(t, "Raid night", store.createArg.Title)
	assert.Equal(t, testUser, store.createArg.CreatedBy)
	var loot []models.Item
	require.NoError(t, json.Unmarshal(store.createArg.LootList, &loot))
	assert.Equal(t, []models.Item{{Name: "Sword"}, {Name: "Shield", Rarity: "RARE"}}, loot)
	assert.Equal(t, testTemplate.String(), tmpl.ID)
	assert.Equal(t, loot, tmpl.LootList)
}

func TestCreateEncodesEmptyLootAsArray(t *testing.T) {
	store := &fakeStore{role: "admin"}
	s := newService(store, zerolog.Nop())
	p := validCreate()
	p.LootList = nil

	tmpl, err := s.Create(context.Background(), p)
	require.NoError(t, err)
	assert.JSONEq(t, "[]", string(store.createArg.LootList))
	assert.Empty(t, tmpl.LootList)
	assert.NotNil(t, tmpl.LootList)
}

func TestCreateValidatesInput(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*CreateParams)
	}{
		{name: "blank name", mutate: func(p *CreateParams) { p.Name = "  " }},
		{name: "long name", mutate: func(p *CreateParams) { p.Name = strings.Repeat("名", maxNameLength+1) }},
		{name: "blank title", mutate: func(p *CreateParams) { p.Title = "" }},
		{name: "long title", mutate: func(p *CreateParams) { p.Title = strings.Repeat("a", maxTitleLength+1) }},
		{name: "blank loot item", mutate: func(p *CreateParams) { p.LootList = []models.Item{{Name: " "}} }},
		{name: "too many loot items", mutate: func(p *CreateParams) { p.LootList = make([]models.Item, maxLootItems+1) }},
		{name: "bad guild id", mutate: func(p *CreateParams) { p.GuildID = "nope" }},
		{name: "bad user id", mutate: func(p *CreateParams) { p.UserID = "nope" }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &fakeStore{role: "owner"}
			s := newService(store, zerolog.Nop())
			p := validCreate()
			tt.mutate(&p)
			_, err := s.Create(context.Background(), p)
			assert.ErrorIs(t, err, errs.ErrInvalidArgument)
			assert.Zero(t, store.calls)
		})
	}
}

func TestManagementRequiresManagerRole(t *testing.T) {
	tests := []struct {
		name    string
		role    string
		roleErr error
		wantErr error
	}{
		{name: "owner", role: "owner"},
		{name: "admin", role: "admin"},
		{name: "moderator", role: "moderator"},
		{name: "member", role: "member", wantErr: errs.ErrPermissionDenied},
		{name: "not a member", roleErr: pgx.ErrNoRows, wantErr: errs.ErrPermissionDenied},
		{name: "role lookup failure", roleErr: errors.New("boom"), wantErr: errs.ErrInternal},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := &fakeStore{role: tt.role, roleErr: tt.roleErr, deleted: 1}
			s := newService(store, zerolog.Nop())
			ctx := context.Background()

			_, listErr := s.List(ctx, testGuild.String(), testUser.String())
			_, createErr := s.Create(ctx, validCreate())
			_, updateErr := s.Update(ctx, UpdateParams{
				GuildID: testGuild.String(), TemplateID: testTemplate.String(), UserID: testUser.String(),
				Name: "n", Title: "t",
			})
			deleteErr := s.Delete(ctx, testGuild.String(), testTemplate.String(), testUser.String())

			for _, err := range []error{listErr, createErr, updateErr, deleteErr} {
				if tt.wantErr == nil {
					assert.NoError(t, err)
				} else {
					assert.ErrorIs(t, err, tt.wantErr)
				}
			}
			if tt.wantErr != nil {
				assert.Zero(t, store.calls)
			}
		})
	}
}

func TestCreateDuplicateNameReturnsAlreadyExists(t *testing.T) {
	store := &fakeStore{role: "admin", writeErr: &pgconn.PgError{Code: "23505"}}
	s := newService(store, zerolog.Nop())

	_, err := s.Create(context.Background(), validCreate())
	assert.ErrorIs(t, err, errs.ErrAlreadyExists)
}

func TestUpdateMissingTemplateReturnsNotFound(t *testing.T) {
	store := &fakeStore{role: "admin", writeErr: pgx.ErrNoRows}
	s := newService(store, zerolog.Nop())

	_, err := s.Update(context.Background(), UpdateParams{
		GuildID: testGuild.String(), TemplateID: testTemplate.String(), UserID: testUser.String(),
		Name: "n", Title: "t",
	})
	assert.ErrorIs(t, err, errs.ErrNotFound)
	assert.Equal(t, testTemplate, store.updateArg.ID)
	assert.Equal(t, testGuild, store.updateArg.GuildID)
}

func TestUpdateMalformedTemplateIDReturnsNotFound(t *testing.T) {
	store := &fakeStore{role: "admin"}
	s := newService(store, zerolog.Nop())

	_, err := s.Update(context.Background(), UpdateParams{
		GuildID: testGuild.String(), TemplateID: "nope", UserID: testUser.String(), Name: "n", Title: "t",
	})
	assert.ErrorIs(t, err, errs.ErrNotFound)
	assert.Zero(t, store.calls)
}

func TestDeleteMissingTemplateReturnsNotFound(t *testing.T) {
	store := &fakeStore{role: "admin", deleted: 0}
	s := newService(store, zerolog.Nop())

	err := s.Delete(context.Background(), testGuild.String(), testTemplate.String(), testUser.String())
	assert.ErrorIs(t, err, errs.ErrNotFound)
}

func TestListDecodesLoot(t *testing.T) {
	store := &fakeStore{role: "moderator", rows: []db.CheckinTemplate{
		{ID: testTemplate, GuildID: testGuild, Name: "a", Title: "A", LootList: []byte(`[{"id":"","name":"Gem"}]`)},
		{ID: uuid.New(), GuildID: testGuild, Name: "b", Title: "B", LootList: []byte(`[]`)},
	}}
	s := newService(store, zerolog.Nop())

	templates, err := s.List(context.Background(), testGuild.String(), testUser.String())
	require.NoError(t, err)
	require.Len(t, templates, 2)
	assert.Equal(t, []models.Item{{Name: "Gem"}}, templates[0].LootList)
	assert.Equal(t, []models.Item{}, templates[1].LootList)
}
