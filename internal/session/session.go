// Package session carries the authenticated Kratos session across the
// HTTP-gateway → gRPC-handler boundary.
//
// The HTTP middleware validates the incoming session with Kratos, attaches
// the identity ID and the raw Kratos cookie to the request context via
// WithUserID / WithCookie, and the gRPC-gateway Annotator lifts them into
// outgoing gRPC metadata. Handler code reads them back through
// UserIDFromContext / CookieFromContext — those helpers first look at the
// direct context keys (used on the HTTP side and in tests) and then fall
// through to the gRPC incoming metadata, so a single call site works on
// both transports without a dedicated gRPC interceptor.
package session

import (
	"context"
	"net/http"

	"google.golang.org/grpc/metadata"
)

const (
	// UserIDMetadataKey carries the authenticated user's identity ID.
	UserIDMetadataKey = "x-user-id"
	// CookieMetadataKey carries the raw Kratos session cookie (name=value).
	CookieMetadataKey = "x-kratos-cookie"

	// CookieName is the Kratos session cookie name used by this project.
	CookieName = "guma_sess"
)

type contextKey int

const (
	userIDKey contextKey = iota
	cookieKey
)

// WithUserID returns a new context carrying the authenticated identity ID.
// Used by the HTTP middleware (so the gateway Annotator can lift it) and by
// tests that want to exercise handlers directly.
func WithUserID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, userIDKey, id)
}

// UserIDFromContext returns the authenticated identity ID. It first checks
// for a direct context key (set by WithUserID on the HTTP side or in tests)
// and falls back to reading x-user-id from incoming gRPC metadata.
func UserIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if v, ok := ctx.Value(userIDKey).(string); ok && v != "" {
		return v
	}
	if md, ok := metadata.FromIncomingContext(ctx); ok {
		return UserIDFromMetadata(md)
	}
	return ""
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
	if id := UserIDFromContext(r.Context()); id != "" {
		md.Set(UserIDMetadataKey, id)
	}
	if c, err := r.Cookie(CookieName); err == nil {
		md.Set(CookieMetadataKey, c.Name+"="+c.Value)
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
