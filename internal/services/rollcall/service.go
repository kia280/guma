package rollcall

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	defaultLootCategory  = "misc"
	defaultLootRarity    = "common"
	maxCheckInNotes      = 500
	maxTitleLength       = 200
	maxDescriptionLength = 2000
	maxLootEntries       = 100
	maxLootNameLength    = 100
	maxLootDescLength    = 500
	maxLootTagLength     = 50
)

// RollCall is the domain model for a roll call event.
type RollCall struct {
	ID              string
	GuildID         string
	CreatedBy       string
	Title           string
	Description     string
	Datetime        string // ISO 8601
	ExpireTime      string // ISO 8601
	ImageURL        string
	LootList        []models.Item
	Loot            []LootEntry
	GoldPot         *GoldPot
	AttendanceCount int32
	IsExpired       bool
	IsCancelled     bool
	IsCompleted     bool
	CompletedAt     *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// Attendee is the domain model for a roll call attendee.
type Attendee struct {
	ID          string
	RollCallID  string
	UserID      string
	DisplayName string
	AvatarURL   string
	Notes       string
	CheckedInAt time.Time
}

// ListParams holds the inputs for List.
type ListParams struct {
	GuildID  string
	Status   string // "active" | "expired" | "cancelled" | "completed" | ""
	PageSize int
	Offset   int
}

// ListResult is returned by List.
type ListResult struct {
	RollCalls  []*RollCall
	TotalCount int32
	NextOffset int
}

// CreateParams holds the inputs for Create.
type CreateParams struct {
	GuildID     string
	CreatedBy   string
	Title       string
	Description string
	Datetime    string
	ExpireTime  string
	ImageURL    string
	Loot        []LootEntry
}

// UpdateParams holds the inputs for Update.
type UpdateParams struct {
	GuildID     string
	RollCallID  string
	UpdatedBy   string
	Title       string
	Description *string
	Datetime    string
	ExpireTime  string
	ImageURL    *string
	Loot        []LootEntry
}

// UpdateLootParams holds the inputs for UpdateLoot.
type UpdateLootParams struct {
	GuildID    string
	RollCallID string
	UpdatedBy  string
	LootList   []models.Item
}

// ListAttendeesResult is returned by ListAttendees.
type ListAttendeesResult struct {
	Attendees  []*Attendee
	TotalCount int32
	NextOffset int
}

// rollCallRow is the common subset of fields returned by roll call queries.
type rollCallRow struct {
	ID              uuid.UUID
	GuildID         uuid.UUID
	CreatedBy       uuid.UUID
	Title           string
	Description     string
	Datetime        string
	ExpireTime      string
	ImageUrl        string
	LootList        []byte
	AttendanceCount int32
	IsExpired       bool
	IsCancelled     bool
	IsCompleted     bool
	CompletedAt     pgtype.Timestamptz
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// Service handles roll call business logic.
type Service struct {
	pool   *database.Pool
	q      *db.Queries
	logger zerolog.Logger
}

// New creates a new roll call Service.
func New(pool *database.Pool, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{
		pool:   pool,
		q:      q,
		logger: logger.With().Str("service", "rollcall").Logger(),
	}
}

// List returns paginated roll calls for a guild.
func (s *Service) List(ctx context.Context, p ListParams) (*ListResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}

	rows, err := s.q.ListRollCalls(ctx, db.ListRollCallsParams{
		GuildID: guildID, StatusFilter: p.Status,
		PageSize: int32(pageSize), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list roll calls: %v", errs.ErrInternal, err)
	}

	rollCalls := make([]*RollCall, 0, len(rows))
	for _, r := range rows {
		rollCalls = append(rollCalls, toRollCall(rollCallRow(r)))
	}

	if err := s.attachGoldPots(ctx, guildID, rollCalls); err != nil {
		return nil, err
	}

	total, _ := s.q.CountRollCalls(ctx, db.CountRollCallsParams{GuildID: guildID, StatusFilter: p.Status})

	nextOffset := 0
	if len(rollCalls) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListResult{RollCalls: rollCalls, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// Get fetches a single roll call by ID.
func (s *Service) Get(ctx context.Context, guildIDStr, rollCallIDStr string) (*RollCall, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	rollCallID, err := uuid.Parse(rollCallIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	r, err := s.q.GetRollCall(ctx, db.GetRollCallParams{ID: rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	c := toRollCall(rollCallRow(r))
	if c.hasGoldLoot() {
		if c.GoldPot, err = s.loadGoldPot(ctx, guildID, rollCallID); err != nil {
			return nil, err
		}
	}
	return c, nil
}

// Create inserts a new roll call. Requires admin or moderator role.
func (s *Service) Create(ctx context.Context, p CreateParams) (*RollCall, error) {
	if err := validateRollCallFields(p.Title, p.Description, p.Datetime, p.ExpireTime); err != nil {
		return nil, err
	}
	if err := checkLootCount(len(p.Loot)); err != nil {
		return nil, err
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	createdBy, err := uuid.Parse(p.CreatedBy)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, createdBy, "owner", "admin", "moderator"); err != nil {
		return nil, err
	}

	prepared, err := prepareLoot(p.Loot)
	if err != nil {
		return nil, err
	}
	loot := prepared.items
	lootJSON, err := json.Marshal(prepared.stored)
	if err != nil {
		return nil, fmt.Errorf("%w: encode loot: %v", errs.ErrInternal, err)
	}
	itemsJSON, err := marshalLoot(loot)
	if err != nil {
		return nil, fmt.Errorf("%w: encode loot: %v", errs.ErrInternal, err)
	}
	donorName, _ := s.q.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: createdBy})

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(tx)

	r, err := qtx.CreateRollCall(ctx, db.CreateRollCallParams{
		GuildID: guildID, CreatedBy: createdBy, Title: p.Title,
		Description: p.Description, Datetime: p.Datetime, ExpireTime: p.ExpireTime,
		ImageUrl: p.ImageURL, LootList: lootJSON,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: create roll call: %v", errs.ErrInternal, err)
	}
	for _, item := range loot {
		itemJSON, err := json.Marshal(item)
		if err != nil {
			return nil, fmt.Errorf("%w: encode bank item: %v", errs.ErrInternal, err)
		}
		if err := qtx.InsertRollCallBankItem(ctx, db.InsertRollCallBankItemParams{
			ID: uuid.MustParse(item.ID), GuildID: guildID, DonorID: createdBy,
			DonorName: donorName, Item: itemJSON, RollCallID: r.ID,
		}); err != nil {
			return nil, fmt.Errorf("%w: insert bank item: %v", errs.ErrInternal, err)
		}
	}
	if err := s.depositGoldLoot(ctx, qtx, guildID, r.ID, prepared.gold); err != nil {
		return nil, err
	}
	if len(loot) > 0 || prepared.gold > 0 {
		if err := qtx.InsertRollCallLootContribution(ctx, db.InsertRollCallLootContributionParams{
			GuildID: guildID, UserID: createdBy, Username: donorName, Amount: prepared.gold,
			Note: p.Title, Items: itemsJSON, RollCallID: r.ID,
		}); err != nil {
			return nil, fmt.Errorf("%w: record bank activity: %v", errs.ErrInternal, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	c := toRollCall(rollCallRow(r))
	if prepared.gold > 0 {
		c.GoldPot = &GoldPot{Total: prepared.gold}
	}
	s.logger.Info().Str("roll_call_id", c.ID).Str("guild_id", p.GuildID).Int("bank_items", len(loot)).Int64("gold", prepared.gold).Msg("roll call created")
	return c, nil
}

// Update modifies an existing roll call.
func (s *Service) Update(ctx context.Context, p UpdateParams) (*RollCall, error) {
	description := ""
	if p.Description != nil {
		description = *p.Description
	}
	if err := validateRollCallFields(p.Title, description, p.Datetime, p.ExpireTime); err != nil {
		return nil, err
	}
	if err := checkExpireTimeInFuture(p.ExpireTime, time.Now().UTC()); err != nil {
		return nil, err
	}
	if len(p.Loot) > 0 {
		return nil, fmt.Errorf("%w: loot list cannot be changed after publishing", errs.ErrInvalidArgument)
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	rollCallID, err := uuid.Parse(p.RollCallID)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(p.UpdatedBy)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, userID, "owner", "admin", "moderator"); err != nil {
		return nil, err
	}

	current, err := s.q.GetRollCall(ctx, db.GetRollCallParams{ID: rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	if err := checkEditable(current.IsCancelled, current.IsExpired); err != nil {
		return nil, err
	}

	params := db.UpdateRollCallParams{
		Title: strings.TrimSpace(p.Title), Datetime: p.Datetime, ExpireTime: p.ExpireTime,
		ID: rollCallID, GuildID: guildID,
	}
	if p.Description != nil {
		params.SetDescription = true
		params.Description = strings.TrimSpace(*p.Description)
	}
	if p.ImageURL != nil {
		params.SetImageUrl = true
		params.ImageUrl = strings.TrimSpace(*p.ImageURL)
	}

	r, err := s.q.UpdateRollCall(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: roll call is no longer open", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: update roll call: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("roll_call_id", p.RollCallID).Str("guild_id", p.GuildID).Str("user_id", p.UpdatedBy).Msg("roll call updated")
	c := toRollCall(rollCallRow(r))
	if c.hasGoldLoot() {
		if c.GoldPot, err = s.loadGoldPot(ctx, guildID, rollCallID); err != nil {
			return nil, err
		}
	}
	return c, nil
}

// Delete removes a roll call. Requires owner or admin role.
func (s *Service) Delete(ctx context.Context, guildIDStr, rollCallIDStr, userIDStr string) error {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	rollCallID, err := uuid.Parse(rollCallIDStr)
	if err != nil {
		return fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, userID, "owner", "admin"); err != nil {
		return err
	}
	n, err := s.q.DeleteRollCall(ctx, db.DeleteRollCallParams{ID: rollCallID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: delete roll call: %v", errs.ErrInternal, err)
	}
	if n == 0 {
		return fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	return nil
}

// Cancel marks an open roll call as cancelled so no further attendance is accepted.
func (s *Service) Cancel(ctx context.Context, guildIDStr, rollCallIDStr, userIDStr string) (*RollCall, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	rollCallID, err := uuid.Parse(rollCallIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, userID, "owner", "admin"); err != nil {
		return nil, err
	}

	current, err := s.q.GetRollCall(ctx, db.GetRollCallParams{ID: rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	if err := checkCancellable(current.IsCancelled, current.IsExpired); err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	r, err := qtx.CancelRollCall(ctx, db.CancelRollCallParams{ID: rollCallID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: roll call is no longer open", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: cancel roll call: %v", errs.ErrInternal, err)
	}
	if _, err := qtx.RejectPendingRequestsForRollCallLoot(ctx, db.RejectPendingRequestsForRollCallLootParams{
		ReviewerID: &userID, ReviewNote: retractedLootNote, GuildID: guildID, RollCallID: &rollCallID,
	}); err != nil {
		return nil, fmt.Errorf("%w: reject loot requests: %v", errs.ErrInternal, err)
	}
	if err := qtx.LogRetractedRollCallLoot(ctx, db.LogRetractedRollCallLootParams{
		ActorID: userID, RollCallID: &rollCallID, GuildID: guildID,
	}); err != nil {
		return nil, fmt.Errorf("%w: log retracted loot: %v", errs.ErrInternal, err)
	}
	retracted, err := qtx.RetractRollCallLoot(ctx, db.RetractRollCallLootParams{RollCallID: &rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: retract loot: %v", errs.ErrInternal, err)
	}
	goldPot, err := s.retractGoldLoot(ctx, qtx, guildID, rollCallID, userID, r.Title)
	if err != nil {
		return nil, err
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("roll_call_id", rollCallIDStr).Str("guild_id", guildIDStr).Str("user_id", userIDStr).Int64("retracted_loot", retracted).Msg("roll call cancelled")
	c := toRollCall(rollCallRow(r))
	c.GoldPot = goldPot
	return c, nil
}

func (s *Service) UpdateLoot(ctx context.Context, p UpdateLootParams) (*RollCall, error) {
	if err := checkLootCount(len(p.LootList)); err != nil {
		return nil, err
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	rollCallID, err := uuid.Parse(p.RollCallID)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(p.UpdatedBy)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, userID, "owner", "admin", "moderator"); err != nil {
		return nil, err
	}
	donorName, _ := s.q.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: userID})

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	state, err := qtx.LockRollCallState(ctx, db.LockRollCallStateParams{ID: rollCallID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: load roll call: %v", errs.ErrInternal, err)
	}
	if err := checkLootEditable(state.IsCancelled, state.IsCompleted); err != nil {
		return nil, err
	}
	entries := decodeLoot(state.LootList)
	bankRows, err := qtx.LockRollCallBankItems(ctx, db.LockRollCallBankItemsParams{RollCallID: rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: load loot in vault: %v", errs.ErrInternal, err)
	}
	vault := make(map[string]bool, len(bankRows))
	for _, row := range bankRows {
		vault[row.ID.String()] = row.IsLocked
	}

	plan, err := planLootUpdate(lootItems(entries), vault, p.LootList)
	if err != nil {
		return nil, err
	}

	for _, item := range plan.changed {
		itemJSON, err := json.Marshal(item)
		if err != nil {
			return nil, fmt.Errorf("%w: encode bank item: %v", errs.ErrInternal, err)
		}
		n, err := qtx.UpdateRollCallBankItem(ctx, db.UpdateRollCallBankItemParams{
			Item: itemJSON, ID: uuid.MustParse(item.ID), GuildID: guildID, RollCallID: rollCallID,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: update bank item: %v", errs.ErrInternal, err)
		}
		if n != 1 {
			return nil, fmt.Errorf("%w: loot item %q is no longer available in the guild vault", errs.ErrFailedPrecondition, item.Name)
		}
	}
	if len(plan.removed) > 0 {
		if _, err := qtx.RejectPendingRequestsForLootItems(ctx, db.RejectPendingRequestsForLootItemsParams{
			ReviewerID: &userID, ReviewNote: removedLootNote, GuildID: guildID, BankItemIds: plan.removed,
		}); err != nil {
			return nil, fmt.Errorf("%w: reject loot requests: %v", errs.ErrInternal, err)
		}
		if err := qtx.LogRemovedRollCallLoot(ctx, db.LogRemovedRollCallLootParams{
			ActorID: userID, Ids: plan.removed, GuildID: guildID, RollCallID: rollCallID,
		}); err != nil {
			return nil, fmt.Errorf("%w: log removed loot: %v", errs.ErrInternal, err)
		}
		n, err := qtx.RemoveRollCallLoot(ctx, db.RemoveRollCallLootParams{Ids: plan.removed, GuildID: guildID, RollCallID: rollCallID})
		if err != nil {
			return nil, fmt.Errorf("%w: remove loot: %v", errs.ErrInternal, err)
		}
		if n != int64(len(plan.removed)) {
			return nil, fmt.Errorf("%w: some loot is no longer available in the guild vault", errs.ErrFailedPrecondition)
		}
	}
	for _, item := range plan.added {
		itemJSON, err := json.Marshal(item)
		if err != nil {
			return nil, fmt.Errorf("%w: encode bank item: %v", errs.ErrInternal, err)
		}
		if err := qtx.InsertRollCallBankItem(ctx, db.InsertRollCallBankItemParams{
			ID: uuid.MustParse(item.ID), GuildID: guildID, DonorID: userID,
			DonorName: donorName, Item: itemJSON, RollCallID: rollCallID,
		}); err != nil {
			return nil, fmt.Errorf("%w: insert bank item: %v", errs.ErrInternal, err)
		}
	}
	if len(plan.added) > 0 {
		addedJSON, err := marshalLoot(plan.added)
		if err != nil {
			return nil, fmt.Errorf("%w: encode loot: %v", errs.ErrInternal, err)
		}
		if err := qtx.InsertRollCallLootContribution(ctx, db.InsertRollCallLootContributionParams{
			GuildID: guildID, UserID: userID, Username: donorName,
			Note: state.Title, Items: addedJSON, RollCallID: rollCallID,
		}); err != nil {
			return nil, fmt.Errorf("%w: record bank activity: %v", errs.ErrInternal, err)
		}
	}

	lootJSON, err := json.Marshal(storeLoot(entries, plan.final))
	if err != nil {
		return nil, fmt.Errorf("%w: encode loot: %v", errs.ErrInternal, err)
	}
	r, err := qtx.SetRollCallLootList(ctx, db.SetRollCallLootListParams{LootList: lootJSON, ID: rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: update loot list: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("roll_call_id", p.RollCallID).Str("guild_id", p.GuildID).Str("user_id", p.UpdatedBy).
		Int("added", len(plan.added)).Int("changed", len(plan.changed)).Int("removed", len(plan.removed)).
		Msg("roll call loot updated")
	c := toRollCall(rollCallRow(r))
	if c.hasGoldLoot() {
		if c.GoldPot, err = s.loadGoldPot(ctx, guildID, rollCallID); err != nil {
			return nil, err
		}
	}
	return c, nil
}

func (s *Service) Complete(ctx context.Context, guildIDStr, rollCallIDStr, userIDStr string, keepLeftovers bool) (*RollCall, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	rollCallID, err := uuid.Parse(rollCallIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, userID, "owner", "admin", "moderator"); err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	state, err := qtx.LockRollCallState(ctx, db.LockRollCallStateParams{ID: rollCallID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: load roll call: %v", errs.ErrInternal, err)
	}
	remaining, err := qtx.CountRollCallBankItems(ctx, db.CountRollCallBankItemsParams{RollCallID: rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: count loot in vault: %v", errs.ErrInternal, err)
	}
	var goldPot *GoldPot
	pot, err := qtx.LockRollCallGoldPot(ctx, db.LockRollCallGoldPotParams{RollCallID: rollCallID, GuildID: guildID})
	switch {
	case err == nil:
		goldPot = &GoldPot{Total: pot.Total, Distributed: pot.Distributed, Retracted: pot.Retracted, Completed: pot.IsCompleted}
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, fmt.Errorf("%w: load gold pot: %v", errs.ErrInternal, err)
	}
	var goldRemaining int64
	if goldPot != nil {
		goldRemaining = goldPot.Remaining()
	}
	if err := checkCompletable(state.IsCancelled, state.IsCompleted, state.IsExpired, remaining, goldRemaining, keepLeftovers); err != nil {
		return nil, err
	}
	r, err := qtx.CompleteRollCall(ctx, db.CompleteRollCallParams{CompletedBy: &userID, ID: rollCallID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: roll call can no longer be completed", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: complete roll call: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("roll_call_id", rollCallIDStr).Str("guild_id", guildIDStr).Str("user_id", userIDStr).
		Int64("kept_loot", remaining).Int64("kept_gold", goldRemaining).Msg("roll call completed")
	c := toRollCall(rollCallRow(r))
	if goldPot != nil {
		goldPot.Completed = true
	}
	c.GoldPot = goldPot
	return c, nil
}

// CheckIn records that a member checked in to a roll call.
func (s *Service) CheckIn(ctx context.Context, guildIDStr, rollCallIDStr, userIDStr, notes string) (*Attendee, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	rollCallID, err := uuid.Parse(rollCallIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	notes, err = normalizeCheckInNotes(notes)
	if err != nil {
		return nil, err
	}

	window, err := s.q.GetRollCallCheckInWindow(ctx, db.GetRollCallCheckInWindowParams{ID: rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	if err := checkCheckInOpen(window.ExpireTime, window.IsCancelled, time.Now().UTC()); err != nil {
		return nil, err
	}

	info, _ := s.q.GetUserDisplayAndAvatar(ctx, db.GetUserDisplayAndAvatarParams{GuildID: guildID, UserID: userID})

	attendeeID, err := s.q.InsertRollCallAttendee(ctx, db.InsertRollCallAttendeeParams{
		RollCallID: rollCallID, UserID: userID,
		DisplayName: info.DisplayName, AvatarUrl: info.AvatarUrl, Notes: notes,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: already checked in to this roll call", errs.ErrAlreadyExists)
	}

	_ = s.q.IncrementRollCallAttendance(ctx, rollCallID)

	return &Attendee{
		ID: attendeeID.String(), RollCallID: rollCallIDStr, UserID: userIDStr,
		DisplayName: info.DisplayName, AvatarURL: info.AvatarUrl, Notes: notes, CheckedInAt: time.Now().UTC(),
	}, nil
}

// ListAttendees returns paginated attendees for a roll call.
func (s *Service) ListAttendees(ctx context.Context, guildIDStr, rollCallIDStr string, pageSize, offset int) (*ListAttendeesResult, error) {
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	rollCallID, err := uuid.Parse(rollCallIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}

	exists, err := s.q.RollCallExists(ctx, db.RollCallExistsParams{ID: rollCallID, GuildID: guildID})
	if err != nil || !exists {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}

	rows, err := s.q.ListRollCallAttendees(ctx, db.ListRollCallAttendeesParams{
		RollCallID: rollCallID, PageSize: int32(pageSize), PageOffset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list attendees: %v", errs.ErrInternal, err)
	}

	attendees := make([]*Attendee, 0, len(rows))
	for _, r := range rows {
		attendees = append(attendees, &Attendee{
			ID: r.ID.String(), RollCallID: r.RollCallID.String(), UserID: r.UserID.String(),
			DisplayName: r.DisplayName, AvatarURL: r.AvatarUrl, Notes: r.Notes, CheckedInAt: r.CheckedInAt,
		})
	}

	total, _ := s.q.CountRollCallAttendees(ctx, rollCallID)

	nextOffset := 0
	if len(attendees) == pageSize {
		nextOffset = offset + pageSize
	}
	return &ListAttendeesResult{Attendees: attendees, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// --- helpers ---

func (s *Service) AssignLoot(ctx context.Context, guildIDStr, rollCallIDStr, itemIDStr, actorIDStr, recipientIDStr string) (string, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return "", fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	rollCallID, err := uuid.Parse(rollCallIDStr)
	if err != nil {
		return "", fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		return "", fmt.Errorf("%w: loot item", errs.ErrNotFound)
	}
	actorID, err := uuid.Parse(actorIDStr)
	if err != nil {
		return "", fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	recipientID, err := uuid.Parse(recipientIDStr)
	if err != nil {
		return "", fmt.Errorf("%w: recipient", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, actorID, "owner", "admin", "moderator"); err != nil {
		return "", err
	}
	if exists, err := s.q.RollCallExists(ctx, db.RollCallExistsParams{ID: rollCallID, GuildID: guildID}); err != nil || !exists {
		return "", fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	attended, err := s.q.IsRollCallAttendee(ctx, db.IsRollCallAttendeeParams{RollCallID: rollCallID, UserID: recipientID})
	if err != nil {
		return "", fmt.Errorf("%w: load attendance: %v", errs.ErrInternal, err)
	}
	if !attended {
		return "", fmt.Errorf("%w: recipient did not attend this roll call", errs.ErrFailedPrecondition)
	}
	recipientName, _ := s.q.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: recipientID})

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	state, err := qtx.LockRollCallState(ctx, db.LockRollCallStateParams{ID: rollCallID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("%w: roll call", errs.ErrNotFound)
		}
		return "", fmt.Errorf("%w: load roll call: %v", errs.ErrInternal, err)
	}
	if state.IsCompleted {
		return "", fmt.Errorf("%w: completed roll calls cannot assign loot", errs.ErrFailedPrecondition)
	}
	if _, err := qtx.RejectPendingRequestsForLootItem(ctx, db.RejectPendingRequestsForLootItemParams{
		ReviewerID: &actorID, ReviewNote: fmt.Sprintf(assignedLootNote, recipientName), GuildID: guildID, BankItemID: &itemID,
	}); err != nil {
		return "", fmt.Errorf("%w: reject loot requests: %v", errs.ErrInternal, err)
	}
	itemJSON, err := qtx.TakeRollCallLootItem(ctx, db.TakeRollCallLootItemParams{ID: itemID, GuildID: guildID, RollCallID: &rollCallID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", fmt.Errorf("%w: loot item is no longer in the guild bank", errs.ErrFailedPrecondition)
		}
		return "", fmt.Errorf("%w: take loot item: %v", errs.ErrInternal, err)
	}
	backpackItemID, err := qtx.InsertBackpackItem(ctx, db.InsertBackpackItemParams{
		ID: &itemID, OwnerID: recipientID, GuildID: guildID, Item: itemJSON, Source: "roll_call", SourceID: &rollCallID,
	})
	if err != nil {
		return "", fmt.Errorf("%w: deliver loot: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return "", fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("roll_call_id", rollCallIDStr).Str("item_id", itemIDStr).Str("recipient_id", recipientIDStr).Msg("loot assigned")
	return backpackItemID.String(), nil
}

const assignedLootNote = "Assigned directly to %s from the roll call."

const retractedLootNote = "The roll call was cancelled, so its loot was removed from the guild bank."

const removedLootNote = "The item was removed from the roll call loot."

func checkCancellable(isCancelled, isExpired bool) error {
	if isCancelled {
		return fmt.Errorf("%w: roll call is already cancelled", errs.ErrFailedPrecondition)
	}
	if isExpired {
		return fmt.Errorf("%w: roll call has already finished", errs.ErrFailedPrecondition)
	}
	return nil
}

func checkLootEditable(isCancelled, isCompleted bool) error {
	if isCancelled {
		return fmt.Errorf("%w: cancelled roll calls cannot change their loot", errs.ErrFailedPrecondition)
	}
	if isCompleted {
		return fmt.Errorf("%w: completed roll calls cannot change their loot", errs.ErrFailedPrecondition)
	}
	return nil
}

func checkCompletable(isCancelled, isCompleted, isExpired bool, lootInVault, goldRemaining int64, keepLeftovers bool) error {
	if isCancelled {
		return fmt.Errorf("%w: cancelled roll calls cannot be completed", errs.ErrFailedPrecondition)
	}
	if isCompleted {
		return fmt.Errorf("%w: roll call is already completed", errs.ErrFailedPrecondition)
	}
	if !isExpired {
		return fmt.Errorf("%w: roll call is still open", errs.ErrFailedPrecondition)
	}
	if keepLeftovers {
		return nil
	}
	if lootInVault > 0 {
		return fmt.Errorf("%w: %d loot items have not been distributed yet", errs.ErrFailedPrecondition, lootInVault)
	}
	if goldRemaining > 0 {
		return fmt.Errorf("%w: %d of the roll call gold has not been distributed yet", errs.ErrFailedPrecondition, goldRemaining)
	}
	return nil
}

type lootPlan struct {
	final   []models.Item
	added   []models.Item
	changed []models.Item
	removed []uuid.UUID
}

func planLootUpdate(current []models.Item, vault map[string]bool, requested []models.Item) (*lootPlan, error) {
	existing := make(map[string]models.Item, len(current))
	for _, item := range current {
		existing[item.ID] = item
	}
	plan := &lootPlan{final: make([]models.Item, 0, len(requested))}
	kept := make(map[string]bool, len(requested))
	for _, item := range requested {
		if item.ID == "" {
			added, err := normalizeLootItem(item)
			if err != nil {
				return nil, err
			}
			added.ID = uuid.NewString()
			plan.added = append(plan.added, added)
			plan.final = append(plan.final, added)
			continue
		}
		stored, ok := existing[item.ID]
		if !ok {
			return nil, fmt.Errorf("%w: loot item %s does not belong to this roll call", errs.ErrInvalidArgument, item.ID)
		}
		if kept[item.ID] {
			return nil, fmt.Errorf("%w: loot item %s is listed more than once", errs.ErrInvalidArgument, item.ID)
		}
		kept[item.ID] = true
		next, err := normalizeLootItem(item)
		if err != nil {
			return nil, err
		}
		if previous, err := normalizeLootItem(stored); err == nil && previous == next {
			plan.final = append(plan.final, stored)
			continue
		}
		if err := checkLootInVault(stored, vault); err != nil {
			return nil, err
		}
		plan.changed = append(plan.changed, next)
		plan.final = append(plan.final, next)
	}
	for _, item := range current {
		if kept[item.ID] {
			continue
		}
		if err := checkLootInVault(item, vault); err != nil {
			return nil, err
		}
		plan.removed = append(plan.removed, uuid.MustParse(item.ID))
	}
	return plan, nil
}

func checkLootInVault(item models.Item, vault map[string]bool) error {
	locked, inVault := vault[item.ID]
	if !inVault {
		return fmt.Errorf("%w: loot item %q has already left the guild vault", errs.ErrFailedPrecondition, item.Name)
	}
	if locked {
		return fmt.Errorf("%w: loot item %q is listed in an auction or raffle", errs.ErrFailedPrecondition, item.Name)
	}
	return nil
}

func checkEditable(isCancelled, isExpired bool) error {
	if isCancelled {
		return fmt.Errorf("%w: cancelled roll calls cannot be edited", errs.ErrFailedPrecondition)
	}
	if isExpired {
		return fmt.Errorf("%w: finished roll calls cannot be edited", errs.ErrFailedPrecondition)
	}
	return nil
}

func checkExpireTimeInFuture(expireTime string, now time.Time) error {
	expiresAt, err := time.Parse(time.RFC3339, expireTime)
	if err != nil {
		return fmt.Errorf("%w: expire_time must be an RFC3339 timestamp", errs.ErrInvalidArgument)
	}
	if !expiresAt.After(now) {
		return fmt.Errorf("%w: expire_time must be in the future", errs.ErrInvalidArgument)
	}
	return nil
}

func checkCheckInOpen(expireTime time.Time, isCancelled bool, now time.Time) error {
	if isCancelled {
		return fmt.Errorf("%w: roll call has been cancelled", errs.ErrFailedPrecondition)
	}
	if now.After(expireTime) {
		return fmt.Errorf("%w: roll call has expired", errs.ErrFailedPrecondition)
	}
	return nil
}

func normalizeCheckInNotes(notes string) (string, error) {
	notes = strings.TrimSpace(notes)
	if utf8.RuneCountInString(notes) > maxCheckInNotes {
		return "", fmt.Errorf("%w: notes must be at most %d characters", errs.ErrInvalidArgument, maxCheckInNotes)
	}
	return notes, nil
}

func toRollCall(r rollCallRow) *RollCall {
	c := &RollCall{
		ID: r.ID.String(), GuildID: r.GuildID.String(), CreatedBy: r.CreatedBy.String(),
		Title: r.Title, Description: r.Description,
		Datetime: r.Datetime, ExpireTime: r.ExpireTime,
		ImageURL: r.ImageUrl, AttendanceCount: r.AttendanceCount,
		IsExpired: r.IsExpired, IsCancelled: r.IsCancelled, IsCompleted: r.IsCompleted,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}
	if r.CompletedAt.Valid {
		completedAt := r.CompletedAt.Time
		c.CompletedAt = &completedAt
	}
	c.Loot = decodeLoot(r.LootList)
	c.LootList = lootItems(c.Loot)
	return c
}

func marshalLoot(items []models.Item) ([]byte, error) {
	if items == nil {
		return json.Marshal([]models.Item{})
	}
	return json.Marshal(items)
}

func prepareBankLoot(items []models.Item) ([]models.Item, error) {
	loot := make([]models.Item, 0, len(items))
	for _, item := range items {
		item, err := normalizeLootItem(item)
		if err != nil {
			return nil, err
		}
		item.ID = uuid.NewString()
		loot = append(loot, item)
	}
	return loot, nil
}

func normalizeLootItem(item models.Item) (models.Item, error) {
	item.Name = strings.TrimSpace(item.Name)
	if item.Name == "" {
		return item, fmt.Errorf("%w: loot item name is required", errs.ErrInvalidArgument)
	}
	item.Description = strings.TrimSpace(item.Description)
	item.Category = strings.ToLower(strings.TrimSpace(item.Category))
	if item.Category == "" {
		item.Category = defaultLootCategory
	}
	item.Rarity = strings.ToLower(strings.TrimSpace(item.Rarity))
	if item.Rarity == "" {
		item.Rarity = defaultLootRarity
	}
	for _, c := range []struct {
		field, value string
		max          int
	}{
		{"loot item name", item.Name, maxLootNameLength},
		{"loot item description", item.Description, maxLootDescLength},
		{"loot item category", item.Category, maxLootTagLength},
		{"loot item rarity", item.Rarity, maxLootTagLength},
	} {
		if err := checkLength(c.field, c.value, c.max); err != nil {
			return item, err
		}
	}
	return item, nil
}

func validateRollCallFields(title, description, datetime, expireTime string) error {
	if strings.TrimSpace(title) == "" {
		return fmt.Errorf("%w: title is required", errs.ErrInvalidArgument)
	}
	if err := checkLength("title", title, maxTitleLength); err != nil {
		return err
	}
	if err := checkLength("description", description, maxDescriptionLength); err != nil {
		return err
	}
	eventAt, err := time.Parse(time.RFC3339, datetime)
	if err != nil {
		return fmt.Errorf("%w: datetime must be an RFC3339 timestamp", errs.ErrInvalidArgument)
	}
	expiresAt, err := time.Parse(time.RFC3339, expireTime)
	if err != nil {
		return fmt.Errorf("%w: expire_time must be an RFC3339 timestamp", errs.ErrInvalidArgument)
	}
	if !expiresAt.After(eventAt) {
		return fmt.Errorf("%w: expire_time must be after datetime", errs.ErrInvalidArgument)
	}
	return nil
}

func checkLength(field, value string, maxLength int) error {
	if utf8.RuneCountInString(value) > maxLength {
		return fmt.Errorf("%w: %s must be at most %d characters", errs.ErrInvalidArgument, field, maxLength)
	}
	return nil
}

func checkLootCount(n int) error {
	if n > maxLootEntries {
		return fmt.Errorf("%w: loot list must have at most %d entries", errs.ErrInvalidArgument, maxLootEntries)
	}
	return nil
}

func (s *Service) requireRole(ctx context.Context, guildID, userID uuid.UUID, roles ...string) error {
	role, err := s.q.GetGuildMemberRole(ctx, db.GetGuildMemberRoleParams{GuildID: guildID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: not a member of this guild", errs.ErrPermissionDenied)
		}
		return fmt.Errorf("%w: not a member of this guild", errs.ErrPermissionDenied)
	}
	for _, r := range roles {
		if role == r {
			return nil
		}
	}
	return fmt.Errorf("%w: requires role %v", errs.ErrPermissionDenied, roles)
}

// NextPageToken encodes the offset as a page token string.
func NextPageToken(offset int) string {
	if offset == 0 {
		return ""
	}
	return strconv.Itoa(offset)
}

// ParsePageToken decodes a page token string to an offset.
func ParsePageToken(token string) (int, error) {
	if token == "" {
		return 0, nil
	}
	n, err := strconv.ParseInt(token, 10, 32)
	if err != nil || n < 0 {
		return 0, fmt.Errorf("%w: invalid page_token", errs.ErrInvalidArgument)
	}
	return int(n), nil
}
