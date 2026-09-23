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
	users map[string]devauth.User
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

func (f *fakeDevStore) CreateUser(_ context.Context, name string) (*devauth.User, error) {
	u := devauth.User{ID: "new-user", DisplayName: name}
	f.users[u.ID] = u
	return &u, nil
}

func newTestDevHandler() http.Handler {
	store := &fakeDevStore{users: map[string]devauth.User{
		"alice": {ID: "alice", Email: "alice@example.com"},
	}}
	return newDevAuthHandler(store, zerolog.New(io.Discard))
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
	req := httptest.NewRequest(http.MethodPost, "/v1/dev/login", strings.NewReader(`{"user_id":"bob"}`))

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
