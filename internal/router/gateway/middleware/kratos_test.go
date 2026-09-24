package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/rs/zerolog"
)

func TestKratosSessionMiddleware_Success(t *testing.T) {
	kratos := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/sessions/whoami" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if !strings.Contains(r.Header.Get("Cookie"), "guma_sess=valid") {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(map[string]any{
			"id":     "sess-123",
			"active": true,
			"identity": map[string]any{
				"id":         "ident-1",
				"schema_id":  "default",
				"schema_url": "file://schemas/default.schema.json",
				"traits": map[string]any{
					"email": "user@example.com",
				},
			},
			"expires_at":       "2099-01-01T00:00:00Z",
			"authenticated_at": "2099-01-01T00:00:00Z",
			"issued_at":        "2099-01-01T00:00:00Z",
		}); err != nil {
			t.Fatalf("failed to encode response: %v", err)
		}
	}))
	defer kratos.Close()

	logger := zerolog.New(io.Discard)

	var called bool
	handler := KratosSessionMiddleware(kratos.URL, logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		session, ok := SessionFromContext(r.Context())
		if !ok {
			t.Fatalf("expected session on context")
		}
		if session.Identity.ID != "ident-1" {
			t.Fatalf("unexpected identity id: %s", session.Identity.ID)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/v1/navigation", nil)
	req.AddCookie(&http.Cookie{Name: "guma_sess", Value: "valid"})
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if !called {
		t.Fatalf("expected downstream handler to be called")
	}
}

func TestKratosSessionMiddleware_MissingSession(t *testing.T) {
	logger := zerolog.New(io.Discard)

	handler := KratosSessionMiddleware("http://example.com", logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("next handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/v1/navigation", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rr.Code)
	}
}

func TestKratosSessionMiddleware_InvalidSession(t *testing.T) {
	kratos := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	}))
	defer kratos.Close()

	logger := zerolog.New(io.Discard)

	handler := KratosSessionMiddleware(kratos.URL, logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("next handler should not be called")
	}))

	req := httptest.NewRequest(http.MethodGet, "/v1/navigation", nil)
	req.AddCookie(&http.Cookie{Name: "guma_sess", Value: "invalid"})
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rr.Code)
	}
}

func TestKratosSessionMiddleware_AllowsOptions(t *testing.T) {
	logger := zerolog.New(io.Discard)

	var called bool
	handler := KratosSessionMiddleware("http://example.com", logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusNoContent)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/v1/navigation", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected status 204, got %d", rr.Code)
	}
	if !called {
		t.Fatalf("expected downstream handler to be called for OPTIONS requests")
	}
}
