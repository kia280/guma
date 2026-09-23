package middleware

import (
	"net/http"

	"github.com/google/uuid"

	"github.com/kia280/guma/internal/session"
)

// DevSessionMiddleware authenticates requests carrying the dev impersonation
// cookie without contacting Kratos. It must only be installed when dev auth
// is enabled.
func DevSessionMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(session.DevCookieName)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			id, err := uuid.Parse(cookie.Value)
			if err != nil {
				next.ServeHTTP(w, r)
				return
			}

			ctx := session.WithUserID(r.Context(), id.String())
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
