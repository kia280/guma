package session

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/google/uuid"
	"google.golang.org/grpc/metadata"
)

func TestAnnotator_ForwardsValidatedCookieOnly(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/v1/me", nil)
	req.AddCookie(&http.Cookie{Name: CookieName, Value: "raw"})
	userID := uuid.MustParse("11111111-1111-1111-1111-111111111111")
	req = req.WithContext(WithUserID(req.Context(), userID))

	md := Annotator(context.Background(), req)

	if got := UserIDFromMetadata(md); got != userID.String() {
		t.Fatalf("expected user id %s, got %q", userID, got)
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

func TestUserIDFromIncomingContext(t *testing.T) {
	userID := uuid.MustParse("11111111-1111-1111-1111-111111111111")

	tests := []struct {
		name   string
		ctx    context.Context
		want   uuid.UUID
		wantOK bool
	}{
		{name: "empty", ctx: context.Background()},
		{name: "context value", ctx: WithUserID(context.Background(), userID), want: userID, wantOK: true},
		{name: "nil context value", ctx: WithUserID(context.Background(), uuid.Nil)},
		{
			name:   "metadata",
			ctx:    metadata.NewIncomingContext(context.Background(), metadata.Pairs(UserIDMetadataKey, userID.String())),
			want:   userID,
			wantOK: true,
		},
		{
			name: "malformed metadata",
			ctx:  metadata.NewIncomingContext(context.Background(), metadata.Pairs(UserIDMetadataKey, "not-a-uuid")),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := UserIDFromIncomingContext(tt.ctx)
			if got != tt.want || ok != tt.wantOK {
				t.Fatalf("UserIDFromIncomingContext() = %s, %v; want %s, %v", got, ok, tt.want, tt.wantOK)
			}
		})
	}
}
