package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/services/devauth"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/session"
)

const (
	devRoutePrefix      = "/v1/dev/"
	devCookieMaxAge     = 30 * 24 * time.Hour
	devRequestBodyLimit = 1 << 16
)

type devUserStore interface {
	ListUsers(ctx context.Context, limit int32) ([]devauth.User, error)
	GetUser(ctx context.Context, userID string) (*devauth.User, error)
	CreateUser(ctx context.Context, displayName, guildID string) (*devauth.User, error)
	ResolveGuild(ctx context.Context, userID string) (*devauth.Guild, error)
	ListGuildMembers(ctx context.Context, guildID string, limit int32) ([]devauth.User, error)
	SeedGuildMembers(ctx context.Context, guildID string, count int) ([]devauth.User, error)
}

type devUserJSON struct {
	ID          string    `json:"id"`
	Email       string    `json:"email"`
	Username    string    `json:"username"`
	DisplayName string    `json:"display_name"`
	AvatarURL   string    `json:"avatar_url,omitempty"`
	Role        string    `json:"role,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

type devGuildJSON struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func newDevAuthHandler(store devUserStore, logger zerolog.Logger) http.Handler {
	h := &devAuthHandler{store: store, logger: logger.With().Str("handler", "dev-auth").Logger()}

	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/dev/session", h.getSession)
	mux.HandleFunc("GET /v1/dev/users", h.listUsers)
	mux.HandleFunc("POST /v1/dev/users", h.createUser)
	mux.HandleFunc("POST /v1/dev/seed", h.seed)
	mux.HandleFunc("POST /v1/dev/login", h.login)
	mux.HandleFunc("POST /v1/dev/logout", h.logout)
	return mux
}

type devAuthHandler struct {
	store  devUserStore
	logger zerolog.Logger
}

func (h *devAuthHandler) getSession(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(session.DevCookieName)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"user": nil})
		return
	}

	u, err := h.store.GetUser(r.Context(), cookie.Value)
	if errors.Is(err, errs.ErrNotFound) || errors.Is(err, errs.ErrInvalidArgument) {
		clearDevCookie(w, r)
		writeJSON(w, http.StatusOK, map[string]any{"user": nil})
		return
	}
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": toDevUserJSON(*u)})
}

func (h *devAuthHandler) listUsers(w http.ResponseWriter, r *http.Request) {
	var limit int32
	if raw := r.URL.Query().Get("limit"); raw != "" {
		n, err := strconv.ParseInt(raw, 10, 32)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "limit must be an integer"})
			return
		}
		limit = int32(n)
	}

	var guild *devauth.Guild
	if r.URL.Query().Get("scope") != "all" {
		g, err := h.resolveGuild(r)
		if err != nil {
			h.writeError(w, r, err)
			return
		}
		guild = g
	}

	var (
		users []devauth.User
		err   error
	)
	if guild != nil {
		users, err = h.store.ListGuildMembers(r.Context(), guild.ID, limit)
	} else {
		users, err = h.store.ListUsers(r.Context(), limit)
	}
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"guild": toDevGuildJSON(guild), "users": toDevUsersJSON(users)})
}

func (h *devAuthHandler) seed(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Count int `json:"count"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	guild, err := h.resolveGuild(r)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if guild == nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no guild to seed"})
		return
	}

	users, err := h.store.SeedGuildMembers(r.Context(), guild.ID, body.Count)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	h.logger.Warn().Str("guild_id", guild.ID).Int("count", len(users)).Msg("dev seeded guild members")
	writeJSON(w, http.StatusCreated, map[string]any{"guild": toDevGuildJSON(guild), "users": toDevUsersJSON(users)})
}

func (h *devAuthHandler) resolveGuild(r *http.Request) (*devauth.Guild, error) {
	var userID string
	if cookie, err := r.Cookie(session.DevCookieName); err == nil {
		userID = cookie.Value
	}
	return h.store.ResolveGuild(r.Context(), userID)
}

func (h *devAuthHandler) createUser(w http.ResponseWriter, r *http.Request) {
	var body struct {
		DisplayName string `json:"display_name"`
		Login       bool   `json:"login"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	guild, err := h.resolveGuild(r)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	var guildID string
	if guild != nil {
		guildID = guild.ID
	}

	u, err := h.store.CreateUser(r.Context(), body.DisplayName, guildID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}
	if body.Login {
		setDevCookie(w, r, u.ID)
	}
	writeJSON(w, http.StatusCreated, map[string]any{"user": toDevUserJSON(*u)})
}

func (h *devAuthHandler) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID string `json:"user_id"`
	}
	if !decodeJSON(w, r, &body) {
		return
	}

	u, err := h.store.GetUser(r.Context(), body.UserID)
	if err != nil {
		h.writeError(w, r, err)
		return
	}

	h.logger.Warn().Str("user_id", u.ID).Str("email", u.Email).Msg("dev login as user")
	setDevCookie(w, r, u.ID)
	writeJSON(w, http.StatusOK, map[string]any{"user": toDevUserJSON(*u)})
}

func (h *devAuthHandler) logout(w http.ResponseWriter, r *http.Request) {
	clearDevCookie(w, r)
	w.WriteHeader(http.StatusNoContent)
}

func (h *devAuthHandler) writeError(w http.ResponseWriter, r *http.Request, err error) {
	status := http.StatusInternalServerError
	switch {
	case errors.Is(err, errs.ErrInvalidArgument):
		status = http.StatusBadRequest
	case errors.Is(err, errs.ErrNotFound):
		status = http.StatusNotFound
	case errors.Is(err, errs.ErrAlreadyExists):
		status = http.StatusConflict
	}

	if status == http.StatusInternalServerError {
		h.logger.Error().Err(err).Str("path", r.URL.Path).Msg("dev auth request failed")
		writeJSON(w, status, map[string]string{"error": "internal server error"})
		return
	}
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, devRequestBodyLimit)
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return false
	}
	return true
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func setDevCookie(w http.ResponseWriter, r *http.Request, userID string) {
	http.SetCookie(w, &http.Cookie{
		Name:     session.DevCookieName,
		Value:    userID,
		Path:     "/",
		MaxAge:   int(devCookieMaxAge.Seconds()),
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	})
}

func clearDevCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     session.DevCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   r.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	})
}

func toDevUserJSON(u devauth.User) devUserJSON {
	return devUserJSON{
		ID:          u.ID,
		Email:       u.Email,
		Username:    u.Username,
		DisplayName: u.DisplayName,
		AvatarURL:   u.AvatarURL,
		Role:        u.Role,
		CreatedAt:   u.CreatedAt,
	}
}

func toDevUsersJSON(users []devauth.User) []devUserJSON {
	out := make([]devUserJSON, 0, len(users))
	for _, u := range users {
		out = append(out, toDevUserJSON(u))
	}
	return out
}

func toDevGuildJSON(g *devauth.Guild) *devGuildJSON {
	if g == nil {
		return nil
	}
	return &devGuildJSON{ID: g.ID, Name: g.Name}
}
