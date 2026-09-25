package checkintemplate

import (
	"context"
	"errors"
	"strings"
	"testing"

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
	testSword    = uuid.MustParse("00000000-0000-0000-0000-000000000004")
	testShield   = uuid.MustParse("00000000-0000-0000-0000-000000000005")
)

type fakeStore struct {
	role          string
	roleErr       error
	knownItems    map[uuid.UUID]bool
	countArg      db.CountGuildItemTemplatesParams
	checkinCreate db.CreateCheckinTemplateParams
	checkinUpdate db.UpdateCheckinTemplateParams
	itemCreate    db.CreateItemTemplateParams
	itemUpdate    db.UpdateItemTemplateParams
	checkinRow    db.GetCheckinTemplateRow
	checkinRows   []db.ListCheckinTemplatesRow
	writeErr      error
	deleted       int64
	writes        int
}

func (f *fakeStore) GetGuildMemberRole(context.Context, db.GetGuildMemberRoleParams) (string, error) {
	return f.role, f.roleErr
}

func (f *fakeStore) ListCheckinTemplates(context.Context, uuid.UUID) ([]db.ListCheckinTemplatesRow, error) {
	return f.checkinRows, nil
}

func (f *fakeStore) GetCheckinTemplate(_ context.Context, arg db.GetCheckinTemplateParams) (db.GetCheckinTemplateRow, error) {
	row := f.checkinRow
	row.ID = arg.ID
	return row, nil
}

func (f *fakeStore) CreateCheckinTemplate(_ context.Context, arg db.CreateCheckinTemplateParams) (uuid.UUID, error) {
	f.writes++
	f.checkinCreate = arg
	return testTemplate, f.writeErr
}

func (f *fakeStore) UpdateCheckinTemplate(_ context.Context, arg db.UpdateCheckinTemplateParams) (uuid.UUID, error) {
	f.writes++
	f.checkinUpdate = arg
	return arg.ID, f.writeErr
}

func (f *fakeStore) DeleteCheckinTemplate(context.Context, db.DeleteCheckinTemplateParams) (int64, error) {
	f.writes++
	return f.deleted, nil
}

func (f *fakeStore) ListItemTemplates(context.Context, uuid.UUID) ([]db.ItemTemplate, error) {
	return nil, nil
}

func (f *fakeStore) CreateItemTemplate(_ context.Context, arg db.CreateItemTemplateParams) (db.ItemTemplate, error) {
	f.writes++
	f.itemCreate = arg
	return db.ItemTemplate{ID: testSword, GuildID: arg.GuildID, Name: arg.Name, Category: arg.Category, Rarity: arg.Rarity}, f.writeErr
}

func (f *fakeStore) UpdateItemTemplate(_ context.Context, arg db.UpdateItemTemplateParams) (db.ItemTemplate, error) {
	f.writes++
	f.itemUpdate = arg
	return db.ItemTemplate{ID: arg.ID, GuildID: arg.GuildID, Name: arg.Name}, f.writeErr
}

func (f *fakeStore) DeleteItemTemplate(context.Context, db.DeleteItemTemplateParams) (int64, error) {
	f.writes++
	return f.deleted, nil
}

func (f *fakeStore) CountGuildItemTemplates(_ context.Context, arg db.CountGuildItemTemplatesParams) (int64, error) {
	f.countArg = arg
	var n int64
	for _, id := range arg.Ids {
		if f.knownItems[id] {
			n++
		}
	}
	return n, nil
}

func newFake(role string) *fakeStore {
	return &fakeStore{role: role, knownItems: map[uuid.UUID]bool{testSword: true, testShield: true}, deleted: 1}
}

func validFields() Fields {
	return Fields{
		Name:            "  Weekly raid  ",
		Title:           " Raid night ",
		ItemTemplateIDs: []string{testSword.String(), testShield.String(), testSword.String()},
	}
}

func validItem() ItemFields {
	return ItemFields{Name: " Dragon Scale ", Description: " shiny ", Category: "MATERIAL", Rarity: " Epic "}
}

func TestCreateCheckinTemplateKeepsItemOrderAndDuplicates(t *testing.T) {
	store := newFake("moderator")
	store.checkinRow = db.GetCheckinTemplateRow{
		GuildID: testGuild, Name: "Weekly raid", Title: "Raid night",
		Items: []byte(`[{"id":"` + testSword.String() + `","name":"Sword","category":"weapon","rarity":"rare"}]`),
	}
	s := newService(store, zerolog.Nop())

	tmpl, err := s.Create(context.Background(), testGuild.String(), testUser.String(), validFields())
	require.NoError(t, err)

	assert.Equal(t, "Weekly raid", store.checkinCreate.Name)
	assert.Equal(t, "Raid night", store.checkinCreate.Title)
	assert.Equal(t, testUser, store.checkinCreate.CreatedBy)
	assert.Equal(t, []uuid.UUID{testSword, testShield, testSword}, store.checkinCreate.ItemTemplateIds)
	assert.ElementsMatch(t, []uuid.UUID{testSword, testShield}, store.countArg.Ids)
	assert.Equal(t, testTemplate.String(), tmpl.ID)
	assert.Equal(t, []models.Item{{ID: testSword.String(), Name: "Sword", Category: "weapon", Rarity: "rare"}}, tmpl.Items)
}

func TestCreateCheckinTemplateWithoutItemsSkipsItemCheck(t *testing.T) {
	store := newFake("admin")
	s := newService(store, zerolog.Nop())
	f := validFields()
	f.ItemTemplateIDs = nil

	tmpl, err := s.Create(context.Background(), testGuild.String(), testUser.String(), f)
	require.NoError(t, err)
	assert.Empty(t, store.countArg.Ids)
	assert.NotNil(t, store.checkinCreate.ItemTemplateIds)
	assert.Equal(t, []models.Item{}, tmpl.Items)
}

func TestCreateCheckinTemplateRejectsItemsFromOtherGuilds(t *testing.T) {
	store := newFake("admin")
	s := newService(store, zerolog.Nop())
	f := validFields()
	f.ItemTemplateIDs = []string{testSword.String(), uuid.NewString()}

	_, err := s.Create(context.Background(), testGuild.String(), testUser.String(), f)
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
	assert.Zero(t, store.writes)
}

func TestCreateCheckinTemplateValidatesInput(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*Fields)
	}{
		{name: "blank name", mutate: func(f *Fields) { f.Name = "  " }},
		{name: "long name", mutate: func(f *Fields) { f.Name = strings.Repeat("名", maxNameLength+1) }},
		{name: "blank title", mutate: func(f *Fields) { f.Title = "" }},
		{name: "long title", mutate: func(f *Fields) { f.Title = strings.Repeat("a", maxTitleLength+1) }},
		{name: "malformed item id", mutate: func(f *Fields) { f.ItemTemplateIDs = []string{"nope"} }},
		{name: "too many items", mutate: func(f *Fields) { f.ItemTemplateIDs = make([]string, maxItems+1) }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFake("owner")
			s := newService(store, zerolog.Nop())
			f := validFields()
			tt.mutate(&f)
			_, err := s.Create(context.Background(), testGuild.String(), testUser.String(), f)
			assert.ErrorIs(t, err, errs.ErrInvalidArgument)
			assert.Zero(t, store.writes)
		})
	}
}

func TestCreateItemTemplateNormalizesFields(t *testing.T) {
	store := newFake("admin")
	s := newItemService(store, zerolog.Nop())

	_, err := s.Create(context.Background(), testGuild.String(), testUser.String(), validItem())
	require.NoError(t, err)
	assert.Equal(t, db.CreateItemTemplateParams{
		GuildID: testGuild, CreatedBy: testUser,
		Name: "Dragon Scale", Description: "shiny", Category: "material", Rarity: "epic",
	}, store.itemCreate)
}

func TestCreateItemTemplateValidatesInput(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*ItemFields)
	}{
		{name: "blank name", mutate: func(f *ItemFields) { f.Name = " " }},
		{name: "long description", mutate: func(f *ItemFields) { f.Description = strings.Repeat("a", maxDescriptionLength+1) }},
		{name: "unknown category", mutate: func(f *ItemFields) { f.Category = "vehicle" }},
		{name: "missing rarity", mutate: func(f *ItemFields) { f.Rarity = "" }},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFake("owner")
			s := newItemService(store, zerolog.Nop())
			f := validItem()
			tt.mutate(&f)
			_, err := s.Create(context.Background(), testGuild.String(), testUser.String(), f)
			assert.ErrorIs(t, err, errs.ErrInvalidArgument)
			assert.Zero(t, store.writes)
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
			store := newFake(tt.role)
			store.roleErr = tt.roleErr
			checkins := newService(store, zerolog.Nop())
			items := newItemService(store, zerolog.Nop())
			ctx := context.Background()
			guild, tmpl, user := testGuild.String(), testTemplate.String(), testUser.String()

			_, listErr := checkins.List(ctx, guild, user)
			_, createErr := checkins.Create(ctx, guild, user, validFields())
			_, updateErr := checkins.Update(ctx, guild, tmpl, user, validFields())
			deleteErr := checkins.Delete(ctx, guild, tmpl, user)
			_, itemListErr := items.List(ctx, guild, user)
			_, itemCreateErr := items.Create(ctx, guild, user, validItem())
			_, itemUpdateErr := items.Update(ctx, guild, tmpl, user, validItem())
			itemDeleteErr := items.Delete(ctx, guild, tmpl, user)

			for _, err := range []error{
				listErr, createErr, updateErr, deleteErr,
				itemListErr, itemCreateErr, itemUpdateErr, itemDeleteErr,
			} {
				if tt.wantErr == nil {
					assert.NoError(t, err)
				} else {
					assert.ErrorIs(t, err, tt.wantErr)
				}
			}
			if tt.wantErr != nil {
				assert.Zero(t, store.writes)
			}
		})
	}
}

func TestDuplicateNamesReturnAlreadyExists(t *testing.T) {
	store := newFake("admin")
	store.writeErr = &pgconn.PgError{Code: "23505"}

	_, err := newService(store, zerolog.Nop()).Create(context.Background(), testGuild.String(), testUser.String(), validFields())
	assert.ErrorIs(t, err, errs.ErrAlreadyExists)
	_, err = newItemService(store, zerolog.Nop()).Create(context.Background(), testGuild.String(), testUser.String(), validItem())
	assert.ErrorIs(t, err, errs.ErrAlreadyExists)
}

func TestUpdateMissingTemplatesReturnNotFound(t *testing.T) {
	store := newFake("admin")
	store.writeErr = pgx.ErrNoRows
	ctx := context.Background()

	_, err := newService(store, zerolog.Nop()).Update(ctx, testGuild.String(), testTemplate.String(), testUser.String(), validFields())
	assert.ErrorIs(t, err, errs.ErrNotFound)
	assert.Equal(t, testGuild, store.checkinUpdate.GuildID)

	_, err = newItemService(store, zerolog.Nop()).Update(ctx, testGuild.String(), testTemplate.String(), testUser.String(), validItem())
	assert.ErrorIs(t, err, errs.ErrNotFound)
	assert.Equal(t, testGuild, store.itemUpdate.GuildID)
}

func TestMalformedTemplateIDReturnsNotFound(t *testing.T) {
	store := newFake("admin")
	ctx := context.Background()

	_, err := newService(store, zerolog.Nop()).Update(ctx, testGuild.String(), "nope", testUser.String(), validFields())
	assert.ErrorIs(t, err, errs.ErrNotFound)
	err = newItemService(store, zerolog.Nop()).Delete(ctx, testGuild.String(), "nope", testUser.String())
	assert.ErrorIs(t, err, errs.ErrNotFound)
	assert.Zero(t, store.writes)
}

func TestDeleteMissingTemplatesReturnNotFound(t *testing.T) {
	store := newFake("admin")
	store.deleted = 0
	ctx := context.Background()

	err := newService(store, zerolog.Nop()).Delete(ctx, testGuild.String(), testTemplate.String(), testUser.String())
	assert.ErrorIs(t, err, errs.ErrNotFound)
	err = newItemService(store, zerolog.Nop()).Delete(ctx, testGuild.String(), testTemplate.String(), testUser.String())
	assert.ErrorIs(t, err, errs.ErrNotFound)
}

func TestListCheckinTemplatesDecodesItems(t *testing.T) {
	store := newFake("moderator")
	store.checkinRows = []db.ListCheckinTemplatesRow{
		{ID: testTemplate, GuildID: testGuild, Name: "a", Title: "A", Items: []byte(`[{"id":"x","name":"Gem","rarity":"epic"}]`)},
		{ID: uuid.New(), GuildID: testGuild, Name: "b", Title: "B", Items: []byte(`[]`)},
	}
	s := newService(store, zerolog.Nop())

	templates, err := s.List(context.Background(), testGuild.String(), testUser.String())
	require.NoError(t, err)
	require.Len(t, templates, 2)
	assert.Equal(t, []models.Item{{ID: "x", Name: "Gem", Rarity: "epic"}}, templates[0].Items)
	assert.Equal(t, []models.Item{}, templates[1].Items)
}
