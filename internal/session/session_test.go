package session

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAnnotator_ForwardsValidatedCookieOnly(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req.AddCookie(&http.Cookie{Name: CookieName, Value: "raw"})
	req = req.WithContext(WithUserID(req.Context(), "user-1"))

	md := Annotator(context.Background(), req)

	if got := UserIDFromMetadata(md); got != "user-1" {
		t.Fatalf("expected user id user-1, got %q", got)
	}
	if got := CookieFromMetadata(md); got != "" {
		t.Fatalf("expected no cookie without validated session, got %q", got)
	}

	req = req.WithContext(WithCookie(req.Context(), CookieName+"=raw"))
	md = Annotator(context.Background(), req)

	if got := CookieFromMetadata(md); got != CookieName+"=raw" {
		t.Fatalf("expected validated cookie to be forwarded, got %q", got)
	}
}
