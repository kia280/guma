// Package session carries the authenticated Kratos session across the
// HTTP-gateway → gRPC-handler boundary.
//
// The HTTP middleware validates the incoming session with Kratos, attaches
// the identity ID and the raw Kratos cookie to the request context via
// WithUserID / WithCookie, and the gRPC-gateway Annotator lifts them into
// outgoing gRPC metadata. Handler code reads them back through
// UserID / CookieFromContext. The gRPC auth interceptor parses x-user-id from
// incoming metadata once and stores it on the context as a uuid.UUID, so
// handlers never see the raw string.
package session

import (
	"context"
	"net/http"

	"github.com/google/uuid"
	"google.golang.org/grpc/metadata"
)

const (
	// UserIDMetadataKey carries the authenticated user's identity ID.
	UserIDMetadataKey = "x-user-id"
	// CookieMetadataKey carries the raw Kratos session cookie (name=value).
	CookieMetadataKey = "x-kratos-cookie"

	// CookieName is the Kratos session cookie name used by this project.
	CookieName = "guma_sess"

	// DevCookieName carries the impersonated user ID when dev auth is enabled.
	DevCookieName = "guma_dev_user"
)

type contextKey int

const (
	userIDKey contextKey = iota
	cookieKey
)

// WithUserID returns a new context carrying the authenticated identity ID.
// Used by the HTTP middleware (so the gateway Annotator can lift it), by the
// gRPC auth interceptor once it has validated the metadata, and by tests that
// want to exercise handlers directly.
func WithUserID(ctx context.Context, id uuid.UUID) context.Context {
	return context.WithValue(ctx, userIDKey, id)
}

// UserID returns the authenticated identity ID stored by WithUserID.
func UserID(ctx context.Context) (uuid.UUID, bool) {
	if ctx == nil {
		return uuid.Nil, false
	}
	id, ok := ctx.Value(userIDKey).(uuid.UUID)
	if !ok || id == uuid.Nil {
		return uuid.Nil, false
	}
	return id, true
}

// UserIDFromIncomingContext returns the authenticated identity ID. It first
// checks for a direct context key (set by WithUserID) and falls back to
// parsing x-user-id from incoming gRPC metadata.
func UserIDFromIncomingContext(ctx context.Context) (uuid.UUID, bool) {
	if id, ok := UserID(ctx); ok {
		return id, true
	}
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(UserIDFromMetadata(md))
	if err != nil || id == uuid.Nil {
		return uuid.Nil, false
	}
	return id, true
}

// WithCookie stores the raw Kratos session cookie ("name=value") on ctx so
// handlers can forward it to Kratos if they need richer identity info.
func WithCookie(ctx context.Context, cookie string) context.Context {
	return context.WithValue(ctx, cookieKey, cookie)
}

// CookieFromContext returns the Kratos session cookie ("name=value"). It
// first checks for a direct context key, then falls back to x-kratos-cookie
// in incoming gRPC metadata.
func CookieFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if v, ok := ctx.Value(cookieKey).(string); ok && v != "" {
		return v
	}
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		return CookieFromMetadata(md)
	}
	return ""
}

// Annotator is passed to runtime.WithMetadata on the gRPC-gateway mux; it
// lifts the authenticated user ID and the Kratos session cookie out of the
// HTTP request and into outgoing gRPC metadata.
func Annotator(_ context.Context, r *http.Request) metadata.MD {
	md := metadata.MD{}
	if id, ok := UserID(r.Context()); ok {
		md.Set(UserIDMetadataKey, id.String())
	}
	if c := CookieFromContext(r.Context()); c != "" {
		md.Set(CookieMetadataKey, c)
	}
	return md
}

// UserIDFromMetadata returns the identity ID written by Annotator, or "".
func UserIDFromMetadata(md metadata.MD) string {
	vs := md.Get(UserIDMetadataKey)
	if len(vs) == 0 {
		return ""
	}
	return vs[0]
}

// CookieFromMetadata returns the Kratos cookie written by Annotator, or "".
func CookieFromMetadata(md metadata.MD) string {
	vs := md.Get(CookieMetadataKey)
	if len(vs) == 0 {
		return ""
	}
	return vs[0]
}
