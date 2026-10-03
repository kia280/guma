package middleware

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/session"
)

const devUserID = "7f1c2a4e-3b8d-4c1e-9a6f-2d5e8b0c1f3a"

func TestDevSessionMiddleware_ValidCookieBypassesKratos(t *testing.T) {
	kratos := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("kratos should not be called for dev sessions")
	}))
	defer kratos.Close()

	var gotUserID, gotCookie string
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if id, ok := session.UserID(r.Context()); ok {
			gotUserID = id.String()
		}
		gotCookie = session.CookieFromContext(r.Context())
		w.WriteHeader(http.StatusOK)
	})
	handler := DevSessionMiddleware()(KratosSessionMiddleware(kratos.URL, zerolog.New(io.Discard))(next))

	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req.AddCookie(&http.Cookie{Name: session.DevCookieName, Value: devUserID})
	req.AddCookie(&http.Cookie{Name: session.CookieName, Value: "real-session"})
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if gotUserID != devUserID {
		t.Fatalf("expected user id %q, got %q", devUserID, gotUserID)
	}
	if gotCookie != "" {
		t.Fatalf("expected no kratos cookie on dev session, got %q", gotCookie)
	}
}

func TestDevSessionMiddleware_InvalidCookieFallsBackToKratos(t *testing.T) {
	handler := DevSessionMiddleware()(KratosSessionMiddleware("http://example.com", zerolog.New(io.Discard))(
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			t.Fatalf("next handler should not be called")
		}),
	))

	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req.AddCookie(&http.Cookie{Name: session.DevCookieName, Value: "not-a-uuid"})
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rr.Code)
	}
}
