package rollcalltemplate

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/authz/authztest"
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
	knownItems             map[uuid.UUID]bool
	countArg               db.CountGuildItemTemplatesParams
	rollCallTemplateCreate db.CreateRollCallTemplateParams
	rollCallTemplateUpdate db.UpdateRollCallTemplateParams
	itemCreate             db.CreateItemTemplateParams
	itemUpdate             db.UpdateItemTemplateParams
	rollCallRow            db.GetRollCallTemplateRow
	rollCallRows           []db.ListRollCallTemplatesRow
	writeErr               error
	deleted                int64
	writes                 int
}

func (f *fakeStore) ListRollCallTemplates(context.Context, uuid.UUID) ([]db.ListRollCallTemplatesRow, error) {
	return f.rollCallRows, nil
}

func (f *fakeStore) GetRollCallTemplate(_ context.Context, arg db.GetRollCallTemplateParams) (db.GetRollCallTemplateRow, error) {
	row := f.rollCallRow
	row.ID = arg.ID
	return row, nil
}

func (f *fakeStore) CreateRollCallTemplate(_ context.Context, arg db.CreateRollCallTemplateParams) (uuid.UUID, error) {
	f.writes++
	f.rollCallTemplateCreate = arg
	return testTemplate, f.writeErr
}

func (f *fakeStore) UpdateRollCallTemplate(_ context.Context, arg db.UpdateRollCallTemplateParams) (uuid.UUID, error) {
	f.writes++
	f.rollCallTemplateUpdate = arg
	return arg.ID, f.writeErr
}

func (f *fakeStore) DeleteRollCallTemplate(context.Context, db.DeleteRollCallTemplateParams) (int64, error) {
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

func newFake() *fakeStore {
	return &fakeStore{knownItems: map[uuid.UUID]bool{testSword: true, testShield: true}, deleted: 1}
}

func manager() *authztest.Fake {
	return authztest.New().Grant(testGuild, testUser, authz.ManageRollCallTemplates)
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

func TestCreateRollCallTemplateKeepsItemOrderAndDuplicates(t *testing.T) {
	store := newFake()
	store.rollCallRow = db.GetRollCallTemplateRow{
		GuildID: testGuild, Name: "Weekly raid", Title: "Raid night",
		Items: []byte(`[{"id":"` + testSword.String() + `","name":"Sword","category":"weapon","rarity":"rare"}]`),
	}
	s := newService(store, manager(), zerolog.Nop())

	tmpl, err := s.Create(context.Background(), testGuild.String(), testUser.String(), validFields())
	require.NoError(t, err)

	assert.Equal(t, "Weekly raid", store.rollCallTemplateCreate.Name)
	assert.Equal(t, "Raid night", store.rollCallTemplateCreate.Title)
	assert.Equal(t, testUser, store.rollCallTemplateCreate.CreatedBy)
	assert.Equal(t, []uuid.UUID{testSword, testShield, testSword}, store.rollCallTemplateCreate.ItemTemplateIds)
	assert.ElementsMatch(t, []uuid.UUID{testSword, testShield}, store.countArg.Ids)
	assert.Equal(t, testTemplate.String(), tmpl.ID)
	assert.Equal(t, []models.Item{{ID: testSword.String(), Name: "Sword", Category: "weapon", Rarity: "rare"}}, tmpl.Items)
}

func TestCreateRollCallTemplateWithoutItemsSkipsItemCheck(t *testing.T) {
	store := newFake()
	s := newService(store, manager(), zerolog.Nop())
	f := validFields()
	f.ItemTemplateIDs = nil

	tmpl, err := s.Create(context.Background(), testGuild.String(), testUser.String(), f)
	require.NoError(t, err)
	assert.Empty(t, store.countArg.Ids)
	assert.NotNil(t, store.rollCallTemplateCreate.ItemTemplateIds)
	assert.Equal(t, []models.Item{}, tmpl.Items)
}

func TestCreateRollCallTemplateRejectsItemsFromOtherGuilds(t *testing.T) {
	store := newFake()
	s := newService(store, manager(), zerolog.Nop())
	f := validFields()
	f.ItemTemplateIDs = []string{testSword.String(), uuid.NewString()}

	_, err := s.Create(context.Background(), testGuild.String(), testUser.String(), f)
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
	assert.Zero(t, store.writes)
}

func TestCreateRollCallTemplateRejectsMalformedItemIDs(t *testing.T) {
	store := newFake()
	s := newService(store, manager(), zerolog.Nop())
	f := validFields()
	f.ItemTemplateIDs = []string{"nope"}

	_, err := s.Create(context.Background(), testGuild.String(), testUser.String(), f)
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
	assert.Zero(t, store.writes)
}

func TestCreateItemTemplateNormalizesFields(t *testing.T) {
	store := newFake()
	s := newItemService(store, manager(), zerolog.Nop())

	_, err := s.Create(context.Background(), testGuild.String(), testUser.String(), validItem())
	require.NoError(t, err)
	assert.Equal(t, db.CreateItemTemplateParams{
		GuildID: testGuild, CreatedBy: testUser,
		Name: "Dragon Scale", Description: "shiny", Category: "material", Rarity: "epic",
	}, store.itemCreate)
}

func TestManagementOperationsSucceed(t *testing.T) {
	tests := []struct {
		name    string
		checker *authztest.Fake
		wantErr error
	}{
		{name: "granted", checker: manager()},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newFake()
			rollCalls := newService(store, tt.checker, zerolog.Nop())
			items := newItemService(store, tt.checker, zerolog.Nop())
			ctx := context.Background()
			guild, tmpl, user := testGuild.String(), testTemplate.String(), testUser.String()

			_, listErr := rollCalls.List(ctx, guild, user)
			_, createErr := rollCalls.Create(ctx, guild, user, validFields())
			_, updateErr := rollCalls.Update(ctx, guild, tmpl, user, validFields())
			deleteErr := rollCalls.Delete(ctx, guild, tmpl, user)
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
	store := newFake()
	store.writeErr = &pgconn.PgError{Code: "23505"}

	_, err := newService(store, manager(), zerolog.Nop()).Create(context.Background(), testGuild.String(), testUser.String(), validFields())
	assert.ErrorIs(t, err, errs.ErrAlreadyExists)
	_, err = newItemService(store, manager(), zerolog.Nop()).Create(context.Background(), testGuild.String(), testUser.String(), validItem())
	assert.ErrorIs(t, err, errs.ErrAlreadyExists)
}

func TestUpdateMissingTemplatesReturnNotFound(t *testing.T) {
	store := newFake()
	store.writeErr = pgx.ErrNoRows
	ctx := context.Background()

	_, err := newService(store, manager(), zerolog.Nop()).Update(ctx, testGuild.String(), testTemplate.String(), testUser.String(), validFields())
	assert.ErrorIs(t, err, errs.ErrNotFound)
	assert.Equal(t, testGuild, store.rollCallTemplateUpdate.GuildID)

	_, err = newItemService(store, manager(), zerolog.Nop()).Update(ctx, testGuild.String(), testTemplate.String(), testUser.String(), validItem())
	assert.ErrorIs(t, err, errs.ErrNotFound)
	assert.Equal(t, testGuild, store.itemUpdate.GuildID)
}

func TestMalformedTemplateIDReturnsNotFound(t *testing.T) {
	store := newFake()
	ctx := context.Background()

	_, err := newService(store, manager(), zerolog.Nop()).Update(ctx, testGuild.String(), "nope", testUser.String(), validFields())
	assert.ErrorIs(t, err, errs.ErrNotFound)
	err = newItemService(store, manager(), zerolog.Nop()).Delete(ctx, testGuild.String(), "nope", testUser.String())
	assert.ErrorIs(t, err, errs.ErrNotFound)
	assert.Zero(t, store.writes)
}

func TestDeleteMissingTemplatesReturnNotFound(t *testing.T) {
	store := newFake()
	store.deleted = 0
	ctx := context.Background()

	err := newService(store, manager(), zerolog.Nop()).Delete(ctx, testGuild.String(), testTemplate.String(), testUser.String())
	assert.ErrorIs(t, err, errs.ErrNotFound)
	err = newItemService(store, manager(), zerolog.Nop()).Delete(ctx, testGuild.String(), testTemplate.String(), testUser.String())
	assert.ErrorIs(t, err, errs.ErrNotFound)
}

func TestListRollCallTemplatesDecodesItems(t *testing.T) {
	store := newFake()
	store.rollCallRows = []db.ListRollCallTemplatesRow{
		{ID: testTemplate, GuildID: testGuild, Name: "a", Title: "A", Items: []byte(`[{"id":"x","name":"Gem","rarity":"epic"}]`)},
		{ID: uuid.New(), GuildID: testGuild, Name: "b", Title: "B", Items: []byte(`[]`)},
	}
	s := newService(store, manager(), zerolog.Nop())

	templates, err := s.List(context.Background(), testGuild.String(), testUser.String())
	require.NoError(t, err)
	require.Len(t, templates, 2)
	assert.Equal(t, []models.Item{{ID: "x", Name: "Gem", Rarity: "epic"}}, templates[0].Items)
	assert.Equal(t, []models.Item{}, templates[1].Items)
}
