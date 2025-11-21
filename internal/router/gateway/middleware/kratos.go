package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	kratos "github.com/ory/kratos-client-go"
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
// session cookie. When validation succeeds the resolved session is attached to the request context
// for downstream handlers.
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

	config := kratos.NewConfiguration()
	config.Servers = kratos.ServerConfigurations{
		{
			URL: trimmedBaseURL,
		},
	}
	config.HTTPClient = &http.Client{Timeout: 5 * time.Second}
	client := kratos.NewAPIClient(config)

	skipPaths := map[string]struct{}{
		"/health/live":  {},
		"/health/ready": {},
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodOptions || shouldSkipPath(r.URL.Path, skipPaths) {
				next.ServeHTTP(w, r)
				return
			}

			cookie, err := r.Cookie("guma_session")
			if err != nil {
				writeAuthError(w, http.StatusUnauthorized, "authentication required")
				return
			}

			session, resp, err := client.FrontendAPI.ToSession(context.Background()).
				Cookie(cookie.String()).
				Execute()
			if resp != nil && resp.Body != nil {
				defer resp.Body.Close()
			}

			if err != nil {
				status := http.StatusServiceUnavailable
				message := "identity service unavailable"

				if resp != nil && resp.StatusCode == http.StatusUnauthorized {
					status = http.StatusUnauthorized
					message = "invalid session"
					logger.Debug().
						Int("status_code", resp.StatusCode).
						Str("path", r.URL.Path).
						Msg("kratos session validation failed")
				} else {
					logger.Error().Err(err).Str("path", r.URL.Path).Msg("failed to call kratos to_session")
				}

				writeAuthError(w, status, message)
				return
			}

			if session == nil || !session.GetActive() {
				logger.Debug().Msg("kratos session inactive")
				writeAuthError(w, http.StatusUnauthorized, "inactive session")
				return
			}

			identity := KratosIdentity{}
			if ident, ok := session.GetIdentityOk(); ok && ident != nil {
				identity.ID = ident.GetId()
				if traits, ok := ident.GetTraitsOk(); ok && traits != nil {
					if traitMap, ok := (*traits).(map[string]any); ok {
						identity.Traits = traitMap
					}
				}
			}

			ctx := context.WithValue(r.Context(), sessionContextKey{}, &KratosSession{
				ID:              session.GetId(),
				Active:          session.GetActive(),
				Identity:        identity,
				ExpiresAt:       session.GetExpiresAt(),
				AuthenticatedAt: session.GetAuthenticatedAt(),
				IssuedAt:        session.GetIssuedAt(),
			})
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
