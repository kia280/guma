package authztest

import (
	"context"
	"sync"

	"github.com/google/uuid"

	"github.com/kia280/guma/internal/authz"
)

type grant struct {
	guildID    uuid.UUID
	userID     uuid.UUID
	permission authz.Permission
}

type Fake struct {
	mu      sync.Mutex
	grants  map[grant]bool
	synced  [][2]uuid.UUID
	CanErr  error
	SyncErr error
}

func New() *Fake {
	return &Fake{grants: make(map[grant]bool)}
}

func (f *Fake) Grant(guildID, userID uuid.UUID, permissions ...authz.Permission) *Fake {
	f.mu.Lock()
	defer f.mu.Unlock()
	for _, p := range permissions {
		f.grants[grant{guildID, userID, p}] = true
	}
	return f
}

func (f *Fake) Can(_ context.Context, guildID, userID uuid.UUID, p authz.Permission) (bool, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.CanErr != nil {
		return false, f.CanErr
	}
	return f.grants[grant{guildID, userID, p}], nil
}

func (f *Fake) SyncMember(_ context.Context, guildID, userID uuid.UUID) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.synced = append(f.synced, [2]uuid.UUID{guildID, userID})
	return f.SyncErr
}

func (f *Fake) Synced() [][2]uuid.UUID {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([][2]uuid.UUID(nil), f.synced...)
}
