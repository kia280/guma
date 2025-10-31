package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

type sessionContextKey struct{}

// KratosIdentity represents a subset of identity data returned by Ory Kratos.
type KratosIdentity struct {
	ID     string         `json:"id"`
	Traits map[string]any `json:"traits"`
}

// KratosSession is the subset of session data we care about from the Kratos whoami endpoint.
type KratosSession struct {
	ID              string         `json:"id"`
	Active          bool           `json:"active"`
	Identity        KratosIdentity `json:"identity"`
	ExpiresAt       time.Time      `json:"expires_at"`
	AuthenticatedAt time.Time      `json:"authenticated_at"`
	IssuedAt        time.Time      `json:"issued_at"`
}

// SessionFromContext retrieves the Kratos session stored on the request context.
func SessionFromContext(ctx context.Context) (*KratosSession, bool) {
	if ctx == nil {
		return nil, false
	}

	session, ok := ctx.Value(sessionContextKey{}).(*KratosSession)
	return session, ok
}

// KratosSessionMiddleware validates incoming requests against the Kratos whoami endpoint using the
// session cookie (and optional X-Session-Token header). When validation succeeds the resolved session
// is attached to the request context for downstream handlers.
func KratosSessionMiddleware(baseURL string, logger zerolog.Logger) func(http.Handler) http.Handler {
	logger = logger.With().Str("middleware", "kratos-session").Logger()

	trimmedBaseURL := strings.TrimSuffix(strings.TrimSpace(baseURL), "/")
	if trimmedBaseURL == "" {
		logger.Warn().Msg("kratos public URL empty, authentication middleware disabled")
		return func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				next.ServeHTTP(w, r)
			})
		}
	}

	whoamiURL := trimmedBaseURL + "/sessions/whoami"
	client := &http.Client{Timeout: 5 * time.Second}

	skipPaths := map[string]struct{}{
		"/health":  {},
		"/healthz": {},
		"/ready":   {},
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions || shouldSkipPath(r.URL.Path, skipPaths) {
				next.ServeHTTP(w, r)
				return
			}

			cookieHeader := r.Header.Get("Cookie")
			sessionToken := r.Header.Get("X-Session-Token")

			if cookieHeader == "" && sessionToken == "" {
				writeAuthError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			req, err := http.NewRequestWithContext(r.Context(), http.MethodGet, whoamiURL, http.NoBody)
			if err != nil {
				logger.Error().Err(err).Str("path", r.URL.Path).Msg("failed to construct kratos whoami request")
				writeAuthError(w, http.StatusServiceUnavailable, "identity service unavailable")
				return
			}

			if cookieHeader != "" {
				req.Header.Set("Cookie", cookieHeader)
			}
			if sessionToken != "" {
				req.Header.Set("X-Session-Token", sessionToken)
			}

			resp, err := client.Do(req)
			if err != nil {
				logger.Error().Err(err).Str("path", r.URL.Path).Msg("failed to call kratos whoami")
				writeAuthError(w, http.StatusServiceUnavailable, "identity service unavailable")
				return
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				logger.Debug().
					Int("status_code", resp.StatusCode).
					Str("path", r.URL.Path).
					Msg("kratos session validation failed")
				writeAuthError(w, http.StatusUnauthorized, "invalid session")
				return
			}

			var session KratosSession
			if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
				logger.Error().Err(err).Msg("failed to decode kratos session response")
				writeAuthError(w, http.StatusServiceUnavailable, "identity service unavailable")
				return
			}

			if !session.Active {
				logger.Debug().Str("session_id", session.ID).Msg("kratos session inactive")
				writeAuthError(w, http.StatusUnauthorized, "inactive session")
				return
			}

			ctx := context.WithValue(r.Context(), sessionContextKey{}, &session)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func shouldSkipPath(path string, skip map[string]struct{}) bool {
	if _, ok := skip[path]; ok {
		return true
	}
	// Allow trailing slash variants
	if strings.HasSuffix(path, "/") {
		if _, ok := skip[strings.TrimSuffix(path, "/")]; ok {
			return true
		}
	}
	return false
}

func writeAuthError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)

	_ = json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}
