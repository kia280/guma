package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/services/devauth"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/session"
)

type fakeDevStore struct {
	users        map[string]devauth.User
	userGuilds   map[string]devauth.Guild
	defaultGuild *devauth.Guild
	members      map[string][]devauth.User
	createdGuild string
	seededGuild  string
	seededCount  int
}

func (f *fakeDevStore) ResolveGuild(_ context.Context, userID string) (*devauth.Guild, error) {
	if g, ok := f.userGuilds[userID]; ok {
		return &g, nil
	}
	return f.defaultGuild, nil
}

func (f *fakeDevStore) ListGuildMembers(_ context.Context, guildID string, _ int32) ([]devauth.User, error) {
	return f.members[guildID], nil
}

func (f *fakeDevStore) SeedGuildMembers(_ context.Context, guildID string, count int) ([]devauth.User, error) {
	if count < 1 || count > devauth.MaxSeedCount {
		return nil, fmt.Errorf("%w: count", errs.ErrInvalidArgument)
	}
	f.seededGuild, f.seededCount = guildID, count
	out := make([]devauth.User, count)
	for i := range out {
		out[i] = devauth.User{ID: fmt.Sprintf("seed-%d", i), Role: "member"}
	}
	return out, nil
}

func (f *fakeDevStore) ListUsers(context.Context, int32) ([]devauth.User, error) {
	out := make([]devauth.User, 0, len(f.users))
	for _, u := range f.users {
		out = append(out, u)
	}
	return out, nil
}

func (f *fakeDevStore) GetUser(_ context.Context, id string) (*devauth.User, error) {
	u, ok := f.users[id]
	if !ok {
		return nil, fmt.Errorf("%w: user", errs.ErrNotFound)
	}
	return &u, nil
}

func (f *fakeDevStore) CreateUser(_ context.Context, name, guildID string) (*devauth.User, error) {
	f.createdGuild = guildID
	u := devauth.User{ID: "new-user", DisplayName: name}
	f.users[u.ID] = u
	return &u, nil
}

func newTestDevStore() *fakeDevStore {
	return &fakeDevStore{
		users: map[string]devauth.User{
			"alice": {ID: "alice", Email: "alice@example.com"},
			"bob":   {ID: "bob", Email: "bob@example.com"},
		},
		userGuilds:   map[string]devauth.Guild{"alice": {ID: "guild-a", Name: "Alpha"}},
		defaultGuild: &devauth.Guild{ID: "guild-default", Name: "Default"},
		members: map[string][]devauth.User{
			"guild-a":       {{ID: "alice", Role: "owner"}},
			"guild-default": {{ID: "bob", Role: "member"}},
		},
	}
}

func newTestDevHandler() http.Handler {
	return newDevAuthHandler(newTestDevStore(), zerolog.New(io.Discard))
}

func devCookie(t *testing.T, rr *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rr.Result().Cookies() {
		if c.Name == session.DevCookieName {
			return c
		}
	}
	return nil
}

func TestDevAuthHandler_LoginSetsCookie(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/dev/login", strings.NewReader(`{"user_id":"alice"}`))

	newTestDevHandler().ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
	c := devCookie(t, rr)
	if c == nil || c.Value != "alice" || !c.HttpOnly {
		t.Fatalf("expected httpOnly dev cookie for alice, got %+v", c)
	}
}

func TestDevAuthHandler_LoginUnknownUser(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/dev/login", strings.NewReader(`{"user_id":"ghost"}`))

	newTestDevHandler().ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d", rr.Code)
	}
	if devCookie(t, rr) != nil {
		t.Fatalf("expected no cookie for unknown user")
	}
}

func TestDevAuthHandler_LoginInvalidBody(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/dev/login", strings.NewReader(`{`))

	newTestDevHandler().ServeHTTP(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestDevAuthHandler_Logout(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/dev/logout", nil)

	newTestDevHandler().ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d", rr.Code)
	}
	if c := devCookie(t, rr); c == nil || c.MaxAge >= 0 {
		t.Fatalf("expected expired dev cookie, got %+v", c)
	}
}

func TestDevAuthHandler_Session(t *testing.T) {
	tests := []struct {
		name       string
		cookie     string
		wantUserID string
		wantClear  bool
	}{
		{name: "no cookie"},
		{name: "known user", cookie: "alice", wantUserID: "alice"},
		{name: "stale user", cookie: "ghost", wantClear: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/v1/dev/session", nil)
			if tt.cookie != "" {
				req.AddCookie(&http.Cookie{Name: session.DevCookieName, Value: tt.cookie})
			}

			newTestDevHandler().ServeHTTP(rr, req)

			if rr.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", rr.Code)
			}
			var body struct {
				User *devUserJSON `json:"user"`
			}
			if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
				t.Fatalf("decode: %v", err)
			}
			gotID := ""
			if body.User != nil {
				gotID = body.User.ID
			}
			if gotID != tt.wantUserID {
				t.Fatalf("expected user %q, got %q", tt.wantUserID, gotID)
			}
			if tt.wantClear && devCookie(t, rr) == nil {
				t.Fatalf("expected stale dev cookie to be cleared")
			}
		})
	}
}

func TestDevAuthHandler_CreateUserAndLogin(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/dev/users", strings.NewReader(`{"display_name":"Tester","login":true}`))

	newTestDevHandler().ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}
	if c := devCookie(t, rr); c == nil || c.Value != "new-user" {
		t.Fatalf("expected dev cookie for new user, got %+v", c)
	}
}

func TestDevAuthHandler_CreateUserJoinsResolvedGuild(t *testing.T) {
	store := newTestDevStore()
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/dev/users", strings.NewReader(`{"display_name":"Tester"}`))
	req.AddCookie(&http.Cookie{Name: session.DevCookieName, Value: "alice"})

	newDevAuthHandler(store, zerolog.New(io.Discard)).ServeHTTP(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", rr.Code)
	}
	if store.createdGuild != "guild-a" {
		t.Fatalf("expected new user to join guild-a, got %q", store.createdGuild)
	}
}

func TestDevAuthHandler_ListUsersScopedToGuild(t *testing.T) {
	tests := []struct {
		name      string
		cookie    string
		query     string
		wantGuild string
		wantUsers []string
	}{
		{name: "session guild", cookie: "alice", wantGuild: "guild-a", wantUsers: []string{"alice"}},
		{name: "default guild without session", wantGuild: "guild-default", wantUsers: []string{"bob"}},
		{name: "all users", cookie: "alice", query: "?scope=all", wantUsers: []string{"alice", "bob"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rr := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/v1/dev/users"+tt.query, nil)
			if tt.cookie != "" {
				req.AddCookie(&http.Cookie{Name: session.DevCookieName, Value: tt.cookie})
			}

			newTestDevHandler().ServeHTTP(rr, req)

			if rr.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
			}
			var body struct {
				Guild *devGuildJSON `json:"guild"`
				Users []devUserJSON `json:"users"`
			}
			if err := json.NewDecoder(rr.Body).Decode(&body); err != nil {
				t.Fatalf("decode: %v", err)
			}
			gotGuild := ""
			if body.Guild != nil {
				gotGuild = body.Guild.ID
			}
			if gotGuild != tt.wantGuild {
				t.Fatalf("expected guild %q, got %q", tt.wantGuild, gotGuild)
			}
			got := map[string]bool{}
			for _, u := range body.Users {
				got[u.ID] = true
			}
			if len(got) != len(tt.wantUsers) {
				t.Fatalf("expected users %v, got %+v", tt.wantUsers, body.Users)
			}
			for _, id := range tt.wantUsers {
				if !got[id] {
					t.Fatalf("expected user %q in %+v", id, body.Users)
				}
			}
		})
	}
}

func TestDevAuthHandler_Seed(t *testing.T) {
	tests := []struct {
		name       string
		body       string
		noGuild    bool
		wantStatus int
		wantCount  int
	}{
		{name: "seeds resolved guild", body: `{"count":12}`, wantStatus: http.StatusCreated, wantCount: 12},
		{name: "rejects zero", body: `{"count":0}`, wantStatus: http.StatusBadRequest},
		{name: "rejects too many", body: `{"count":1000}`, wantStatus: http.StatusBadRequest},
		{name: "invalid body", body: `{`, wantStatus: http.StatusBadRequest},
		{name: "no guild", body: `{"count":3}`, noGuild: true, wantStatus: http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := newTestDevStore()
			if tt.noGuild {
				store.defaultGuild = nil
			}
			rr := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/v1/dev/seed", strings.NewReader(tt.body))

			newDevAuthHandler(store, zerolog.New(io.Discard)).ServeHTTP(rr, req)

			if rr.Code != tt.wantStatus {
				t.Fatalf("expected %d, got %d: %s", tt.wantStatus, rr.Code, rr.Body.String())
			}
			if tt.wantCount > 0 && (store.seededGuild != "guild-default" || store.seededCount != tt.wantCount) {
				t.Fatalf("expected %d members seeded into guild-default, got %d into %q", tt.wantCount, store.seededCount, store.seededGuild)
			}
		})
	}
}
