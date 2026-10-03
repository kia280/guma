package gateway

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/rs/zerolog"
	"google.golang.org/grpc/metadata"

	"github.com/kia280/guma/internal/session"
)

const (
	kratosUserID = "0b5d6c3e-1f2a-4b7c-8d9e-0a1b2c3d4e5f"
	devUserID    = "7f1c2a4e-3b8d-4c1e-9a6f-2d5e8b0c1f3a"
	kratosCookie = "real-session"
)

func newFakeKratos(t *testing.T) *httptest.Server {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(session.CookieName)
		if r.URL.Path != "/sessions/whoami" || err != nil || c.Value != kratosCookie {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":     "session-id",
			"active": true,
			"identity": map[string]any{
				"id":         kratosUserID,
				"schema_id":  "default",
				"schema_url": "http://kratos/schemas/default",
				"traits":     map[string]any{"email": "real@example.com"},
			},
		})
	}))
	t.Cleanup(srv.Close)
	return srv
}

type identitySeen struct {
	called   bool
	userID   string
	cookie   string
	metadata metadata.MD
}

func recordIdentity(seen *identitySeen) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen.called = true
		if id, ok := session.UserID(r.Context()); ok {
			seen.userID = id.String()
		}
		seen.cookie = session.CookieFromContext(r.Context())
		seen.metadata = session.Annotator(r.Context(), r)
		w.WriteHeader(http.StatusOK)
	})
}

func newAuthRequest(path string, cookies ...*http.Cookie) *http.Request {
	req := httptest.NewRequest(http.MethodGet, path, nil)
	for _, c := range cookies {
		req.AddCookie(c)
	}
	return req
}

func TestWithAuth_DevCookieTakesPrecedenceOverKratosWhenEnabled(t *testing.T) {
	kratos := newFakeKratos(t)
	var seen identitySeen
	handler := withAuth(recordIdentity(&seen), kratos.URL, newTestDevStore(), zerolog.New(io.Discard))

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, newAuthRequest("/v1/me",
		&http.Cookie{Name: session.CookieName, Value: kratosCookie},
		&http.Cookie{Name: session.DevCookieName, Value: devUserID},
	))

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if seen.userID != devUserID {
		t.Fatalf("expected dev user %q, got %q", devUserID, seen.userID)
	}
	if seen.cookie != "" {
		t.Fatalf("expected no kratos cookie for dev session, got %q", seen.cookie)
	}
	if got := session.UserIDFromMetadata(seen.metadata); got != devUserID {
		t.Fatalf("expected forwarded user id %q, got %q", devUserID, got)
	}
	if got := session.CookieFromMetadata(seen.metadata); got != "" {
		t.Fatalf("expected no forwarded kratos cookie, got %q", got)
	}
}

func TestWithAuth_KratosUserWithoutDevCookieWhenEnabled(t *testing.T) {
	kratos := newFakeKratos(t)
	var seen identitySeen
	handler := withAuth(recordIdentity(&seen), kratos.URL, newTestDevStore(), zerolog.New(io.Discard))

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, newAuthRequest("/v1/me", &http.Cookie{Name: session.CookieName, Value: kratosCookie}))

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if seen.userID != kratosUserID {
		t.Fatalf("expected kratos user %q, got %q", kratosUserID, seen.userID)
	}
}

func TestWithAuth_DevCookieIgnoredWhenDisabled(t *testing.T) {
	kratos := newFakeKratos(t)
	var seen identitySeen
	handler := withAuth(recordIdentity(&seen), kratos.URL, nil, zerolog.New(io.Discard))

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, newAuthRequest("/v1/me",
		&http.Cookie{Name: session.CookieName, Value: kratosCookie},
		&http.Cookie{Name: session.DevCookieName, Value: devUserID},
	))

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}
	if seen.userID != kratosUserID {
		t.Fatalf("expected kratos user %q, got %q", kratosUserID, seen.userID)
	}
	if got := session.UserIDFromMetadata(seen.metadata); got != kratosUserID {
		t.Fatalf("expected forwarded user id %q, got %q", kratosUserID, got)
	}
}

func TestWithAuth_DevCookieAloneRejectedWhenDisabled(t *testing.T) {
	kratos := newFakeKratos(t)
	var seen identitySeen
	handler := withAuth(recordIdentity(&seen), kratos.URL, nil, zerolog.New(io.Discard))

	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, newAuthRequest("/v1/me", &http.Cookie{Name: session.DevCookieName, Value: devUserID}))

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", rr.Code)
	}
	if seen.called {
		t.Fatalf("expected request to be rejected before reaching the handler")
	}
}

func TestWithAuth_DevRoutesUnreachableWhenDisabled(t *testing.T) {
	kratos := newFakeKratos(t)
	var seen identitySeen
	handler := withAuth(recordIdentity(&seen), kratos.URL, nil, zerolog.New(io.Discard))

	for _, path := range []string{"/v1/dev/session", "/v1/dev/users"} {
		seen = identitySeen{}
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, newAuthRequest(path, &http.Cookie{Name: session.DevCookieName, Value: devUserID}))
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("%s: expected status 401, got %d", path, rr.Code)
		}
	}

	seen = identitySeen{}
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, newAuthRequest("/v1/dev/session", &http.Cookie{Name: session.CookieName, Value: kratosCookie}))
	if rr.Code != http.StatusOK || !seen.called {
		t.Fatalf("expected authenticated dev path to fall through to the API handler, got %d", rr.Code)
	}
	if rr.Body.Len() != 0 {
		t.Fatalf("expected dev auth handler to be absent, got body %q", rr.Body.String())
	}
}

func TestGatewayMetadataForwardsOnlyAllowlistedHeaders(t *testing.T) {
	mux := newServeMux(zerolog.New(io.Discard))

	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req.Header.Set("Grpc-Metadata-X-User-Id", devUserID)
	req.Header.Set("Grpc-Metadata-X-Kratos-Cookie", "guma_sess=forged")
	req.Header.Set("Grpc-Metadata-X-Trace", "dropped")
	req.Header.Set("User-Agent", "dropped")
	req.Header.Set("X-Request-Id", "request-1")
	ctx := session.WithUserID(req.Context(), uuid.MustParse(kratosUserID))
	ctx = session.WithCookie(ctx, "guma_sess="+kratosCookie)
	req = req.WithContext(ctx)

	annotated, err := runtime.AnnotateContext(context.Background(), mux, req, "/guma.v1.UserService/GetMe")
	if err != nil {
		t.Fatalf("annotate context: %v", err)
	}
	md, _ := metadata.FromOutgoingContext(annotated)

	if got := md.Get(session.UserIDMetadataKey); len(got) != 1 || got[0] != kratosUserID {
		t.Fatalf("expected only the authenticated user id, got %v", got)
	}
	if got := md.Get(session.CookieMetadataKey); len(got) != 1 || got[0] != "guma_sess="+kratosCookie {
		t.Fatalf("expected only the authenticated kratos cookie, got %v", got)
	}
	if got := md.Get("x-request-id"); len(got) != 1 || got[0] != "request-1" {
		t.Fatalf("expected allowlisted header to be forwarded, got %v", got)
	}
	for _, key := range []string{"x-trace", "grpcgateway-user-agent"} {
		if got := md.Get(key); len(got) != 0 {
			t.Fatalf("expected %s not to be forwarded, got %v", key, got)
		}
	}
}
