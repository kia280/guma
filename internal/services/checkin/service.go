package checkin

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
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	defaultLootCategory = "misc"
	defaultLootRarity   = "common"
	maxAttendanceNotes  = 500
)

// CheckIn is the domain model for a check-in event.
type CheckIn struct {
	ID              string
	GuildID         string
	CreatedBy       string
	Title           string
	Description     string
	Datetime        string // ISO 8601
	ExpireTime      string // ISO 8601
	ImageURL        string
	LootList        []models.Item
	AttendanceCount int32
	IsExpired       bool
	IsCancelled     bool
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// CheckInAttendee is the domain model for a check-in attendee.
type CheckInAttendee struct {
	ID          string
	CheckInID   string
	UserID      string
	DisplayName string
	AvatarURL   string
	Notes       string
	AttendedAt  time.Time
}

// ListParams holds the inputs for List.
type ListParams struct {
	GuildID  string
	Status   string // "active" | "expired" | "cancelled" | ""
	PageSize int
	Offset   int
}

// ListResult is returned by List.
type ListResult struct {
	CheckIns   []*CheckIn
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
	LootList    []models.Item
}

// UpdateParams holds the inputs for Update.
type UpdateParams struct {
	GuildID     string
	CheckInID   string
	Title       string
	Description string
	Datetime    string
	ExpireTime  string
	ImageURL    string
	LootList    []models.Item
}

// ListAttendeesResult is returned by ListAttendees.
type ListAttendeesResult struct {
	Attendees  []*CheckInAttendee
	TotalCount int32
	NextOffset int
}

// checkinRow is the common subset of fields returned by checkin queries.
type checkinRow struct {
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
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// Service handles check-in business logic.
type Service struct {
	pool   *database.Pool
	q      *db.Queries
	logger zerolog.Logger
}

// New creates a new checkin Service.
func New(pool *database.Pool, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{
		pool:   pool,
		q:      q,
		logger: logger.With().Str("service", "checkin").Logger(),
	}
}

// List returns paginated check-ins for a guild.
func (s *Service) List(ctx context.Context, p ListParams) (*ListResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}

	rows, err := s.q.ListCheckins(ctx, db.ListCheckinsParams{
		GuildID: guildID, StatusFilter: p.Status,
		PageSize: int32(pageSize), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list checkins: %v", errs.ErrInternal, err)
	}

	checkins := make([]*CheckIn, 0, len(rows))
	for _, r := range rows {
		checkins = append(checkins, toCheckIn(checkinRow{
			ID: r.ID, GuildID: r.GuildID, CreatedBy: r.CreatedBy,
			Title: r.Title, Description: r.Description,
			Datetime: r.Datetime, ExpireTime: r.ExpireTime,
			ImageUrl: r.ImageUrl, LootList: r.LootList,
			AttendanceCount: r.AttendanceCount, IsExpired: r.IsExpired, IsCancelled: r.IsCancelled,
			CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		}))
	}

	total, _ := s.q.CountCheckins(ctx, db.CountCheckinsParams{GuildID: guildID, StatusFilter: p.Status})

	nextOffset := 0
	if len(checkins) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListResult{CheckIns: checkins, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// Get fetches a single check-in by ID.
func (s *Service) Get(ctx context.Context, guildIDStr, checkinIDStr string) (*CheckIn, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	checkinID, err := uuid.Parse(checkinIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	r, err := s.q.GetCheckin(ctx, db.GetCheckinParams{ID: checkinID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	return toCheckIn(checkinRow{
		ID: r.ID, GuildID: r.GuildID, CreatedBy: r.CreatedBy,
		Title: r.Title, Description: r.Description,
		Datetime: r.Datetime, ExpireTime: r.ExpireTime,
		ImageUrl: r.ImageUrl, LootList: r.LootList,
		AttendanceCount: r.AttendanceCount, IsExpired: r.IsExpired, IsCancelled: r.IsCancelled,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}), nil
}

// Create inserts a new check-in. Requires admin or moderator role.
func (s *Service) Create(ctx context.Context, p CreateParams) (*CheckIn, error) {
	if err := validateCheckInFields(p.Title, p.Datetime, p.ExpireTime); err != nil {
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

	loot, err := prepareBankLoot(p.LootList)
	if err != nil {
		return nil, err
	}
	lootJSON, err := marshalLoot(loot)
	if err != nil {
		return nil, fmt.Errorf("%w: encode loot: %v", errs.ErrInternal, err)
	}
	donorName, _ := s.q.GetUserDisplayName(ctx, createdBy)

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(tx)

	r, err := qtx.CreateCheckin(ctx, db.CreateCheckinParams{
		GuildID: guildID, CreatedBy: createdBy, Title: p.Title,
		Description: p.Description, Datetime: p.Datetime, ExpireTime: p.ExpireTime,
		ImageUrl: p.ImageURL, LootList: lootJSON,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: create checkin: %v", errs.ErrInternal, err)
	}
	for _, item := range loot {
		itemJSON, err := json.Marshal(item)
		if err != nil {
			return nil, fmt.Errorf("%w: encode bank item: %v", errs.ErrInternal, err)
		}
		if err := qtx.InsertCheckinBankItem(ctx, db.InsertCheckinBankItemParams{
			ID: uuid.MustParse(item.ID), GuildID: guildID, DonorID: createdBy,
			DonorName: donorName, Item: itemJSON, CheckinID: r.ID,
		}); err != nil {
			return nil, fmt.Errorf("%w: insert bank item: %v", errs.ErrInternal, err)
		}
	}
	if len(loot) > 0 {
		if err := qtx.InsertCheckinLootContribution(ctx, db.InsertCheckinLootContributionParams{
			GuildID: guildID, UserID: createdBy, Username: donorName,
			Note: p.Title, Items: lootJSON, CheckinID: r.ID,
		}); err != nil {
			return nil, fmt.Errorf("%w: record bank activity: %v", errs.ErrInternal, err)
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	c := toCheckIn(checkinRow{
		ID: r.ID, GuildID: r.GuildID, CreatedBy: r.CreatedBy,
		Title: r.Title, Description: r.Description,
		Datetime: r.Datetime, ExpireTime: r.ExpireTime,
		ImageUrl: r.ImageUrl, LootList: r.LootList,
		AttendanceCount: r.AttendanceCount, IsExpired: r.IsExpired, IsCancelled: r.IsCancelled,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	})
	s.logger.Info().Str("checkin_id", c.ID).Str("guild_id", p.GuildID).Int("bank_items", len(loot)).Msg("checkin created")
	return c, nil
}

// Update modifies an existing check-in.
func (s *Service) Update(ctx context.Context, p UpdateParams) (*CheckIn, error) {
	if err := validateCheckInFields(p.Title, p.Datetime, p.ExpireTime); err != nil {
		return nil, err
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	checkinID, err := uuid.Parse(p.CheckInID)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}

	lootJSON, err := marshalLoot(p.LootList)
	if err != nil {
		return nil, fmt.Errorf("%w: encode loot: %v", errs.ErrInternal, err)
	}

	r, err := s.q.UpdateCheckin(ctx, db.UpdateCheckinParams{
		Title: p.Title, Description: p.Description,
		Datetime: p.Datetime, ExpireTime: p.ExpireTime,
		ImageUrl: p.ImageURL, LootList: lootJSON,
		ID: checkinID, GuildID: guildID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	return toCheckIn(checkinRow{
		ID: r.ID, GuildID: r.GuildID, CreatedBy: r.CreatedBy,
		Title: r.Title, Description: r.Description,
		Datetime: r.Datetime, ExpireTime: r.ExpireTime,
		ImageUrl: r.ImageUrl, LootList: r.LootList,
		AttendanceCount: r.AttendanceCount, IsExpired: r.IsExpired, IsCancelled: r.IsCancelled,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}), nil
}

// Delete removes a check-in.
func (s *Service) Delete(ctx context.Context, guildIDStr, checkinIDStr string) error {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	checkinID, err := uuid.Parse(checkinIDStr)
	if err != nil {
		return fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	n, err := s.q.DeleteCheckin(ctx, db.DeleteCheckinParams{ID: checkinID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: delete checkin: %v", errs.ErrInternal, err)
	}
	if n == 0 {
		return fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	return nil
}

// Cancel marks an open check-in as cancelled so no further attendance is accepted.
func (s *Service) Cancel(ctx context.Context, guildIDStr, checkinIDStr, userIDStr string) (*CheckIn, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	checkinID, err := uuid.Parse(checkinIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, userID, "owner", "admin"); err != nil {
		return nil, err
	}

	current, err := s.q.GetCheckin(ctx, db.GetCheckinParams{ID: checkinID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
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

	r, err := qtx.CancelCheckin(ctx, db.CancelCheckinParams{ID: checkinID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: check-in is no longer open", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: cancel checkin: %v", errs.ErrInternal, err)
	}
	if _, err := qtx.RejectPendingRequestsForCheckinLoot(ctx, db.RejectPendingRequestsForCheckinLootParams{
		ReviewerID: &userID, ReviewNote: retractedLootNote, GuildID: guildID, CheckinID: &checkinID,
	}); err != nil {
		return nil, fmt.Errorf("%w: reject loot requests: %v", errs.ErrInternal, err)
	}
	retracted, err := qtx.RetractCheckinLoot(ctx, db.RetractCheckinLootParams{CheckinID: &checkinID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: retract loot: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("checkin_id", checkinIDStr).Str("guild_id", guildIDStr).Str("user_id", userIDStr).Int64("retracted_loot", retracted).Msg("checkin cancelled")
	return toCheckIn(checkinRow{
		ID: r.ID, GuildID: r.GuildID, CreatedBy: r.CreatedBy,
		Title: r.Title, Description: r.Description,
		Datetime: r.Datetime, ExpireTime: r.ExpireTime,
		ImageUrl: r.ImageUrl, LootList: r.LootList,
		AttendanceCount: r.AttendanceCount, IsExpired: r.IsExpired, IsCancelled: r.IsCancelled,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
	}), nil
}

// SubmitAttendance records a user's attendance for a check-in.
func (s *Service) SubmitAttendance(ctx context.Context, guildIDStr, checkinIDStr, userIDStr, notes string) (*CheckInAttendee, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	checkinID, err := uuid.Parse(checkinIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	notes, err = normalizeAttendanceNotes(notes)
	if err != nil {
		return nil, err
	}

	window, err := s.q.GetCheckinAttendanceWindow(ctx, db.GetCheckinAttendanceWindowParams{ID: checkinID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	if err := checkAttendanceOpen(window.ExpireTime, window.IsCancelled, time.Now().UTC()); err != nil {
		return nil, err
	}

	info, _ := s.q.GetUserDisplayAndAvatar(ctx, userID)

	attendeeID, err := s.q.InsertCheckinAttendee(ctx, db.InsertCheckinAttendeeParams{
		CheckinID: checkinID, UserID: userID,
		DisplayName: info.DisplayName, AvatarUrl: info.AvatarUrl, Notes: notes,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: already attended this check-in", errs.ErrAlreadyExists)
	}

	_ = s.q.IncrementCheckinAttendance(ctx, checkinID)

	return &CheckInAttendee{
		ID: attendeeID.String(), CheckInID: checkinIDStr, UserID: userIDStr,
		DisplayName: info.DisplayName, AvatarURL: info.AvatarUrl, Notes: notes, AttendedAt: time.Now().UTC(),
	}, nil
}

// ListAttendees returns paginated attendees for a check-in.
func (s *Service) ListAttendees(ctx context.Context, guildIDStr, checkinIDStr string, pageSize, offset int) (*ListAttendeesResult, error) {
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}
	checkinID, err := uuid.Parse(checkinIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}

	exists, err := s.q.CheckinExists(ctx, db.CheckinExistsParams{ID: checkinID, GuildID: guildID})
	if err != nil || !exists {
		return nil, fmt.Errorf("%w: checkin", errs.ErrNotFound)
	}

	rows, err := s.q.ListCheckinAttendees(ctx, db.ListCheckinAttendeesParams{
		CheckinID: checkinID, PageSize: int32(pageSize), PageOffset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list attendees: %v", errs.ErrInternal, err)
	}

	attendees := make([]*CheckInAttendee, 0, len(rows))
	for _, r := range rows {
		attendees = append(attendees, &CheckInAttendee{
			ID: r.ID.String(), CheckInID: r.CheckinID.String(), UserID: r.UserID.String(),
			DisplayName: r.DisplayName, AvatarURL: r.AvatarUrl, Notes: r.Notes, AttendedAt: r.AttendedAt,
		})
	}

	total, _ := s.q.CountCheckinAttendees(ctx, checkinID)

	nextOffset := 0
	if len(attendees) == pageSize {
		nextOffset = offset + pageSize
	}
	return &ListAttendeesResult{Attendees: attendees, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// --- helpers ---

const retractedLootNote = "The roll call was cancelled, so its loot was removed from the guild bank."

func checkCancellable(isCancelled, isExpired bool) error {
	if isCancelled {
		return fmt.Errorf("%w: check-in is already cancelled", errs.ErrFailedPrecondition)
	}
	if isExpired {
		return fmt.Errorf("%w: check-in has already finished", errs.ErrFailedPrecondition)
	}
	return nil
}

func checkAttendanceOpen(expireTime time.Time, isCancelled bool, now time.Time) error {
	if isCancelled {
		return fmt.Errorf("%w: check-in has been cancelled", errs.ErrFailedPrecondition)
	}
	if now.After(expireTime) {
		return fmt.Errorf("%w: check-in window has expired", errs.ErrFailedPrecondition)
	}
	return nil
}

func normalizeAttendanceNotes(notes string) (string, error) {
	notes = strings.TrimSpace(notes)
	if utf8.RuneCountInString(notes) > maxAttendanceNotes {
		return "", fmt.Errorf("%w: notes must be at most %d characters", errs.ErrInvalidArgument, maxAttendanceNotes)
	}
	return notes, nil
}

func toCheckIn(r checkinRow) *CheckIn {
	c := &CheckIn{
		ID: r.ID.String(), GuildID: r.GuildID.String(), CreatedBy: r.CreatedBy.String(),
		Title: r.Title, Description: r.Description,
		Datetime: r.Datetime, ExpireTime: r.ExpireTime,
		ImageURL: r.ImageUrl, AttendanceCount: r.AttendanceCount,
		IsExpired: r.IsExpired, IsCancelled: r.IsCancelled, CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		LootList: []models.Item{},
	}
	if len(r.LootList) > 0 {
		_ = json.Unmarshal(r.LootList, &c.LootList)
	}
	if c.LootList == nil {
		c.LootList = []models.Item{}
	}
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
		item.Name = strings.TrimSpace(item.Name)
		if item.Name == "" {
			return nil, fmt.Errorf("%w: loot item name is required", errs.ErrInvalidArgument)
		}
		item.ID = uuid.NewString()
		item.Category = strings.ToLower(strings.TrimSpace(item.Category))
		if item.Category == "" {
			item.Category = defaultLootCategory
		}
		item.Rarity = strings.ToLower(strings.TrimSpace(item.Rarity))
		if item.Rarity == "" {
			item.Rarity = defaultLootRarity
		}
		loot = append(loot, item)
	}
	return loot, nil
}

func validateCheckInFields(title, datetime, expireTime string) error {
	if strings.TrimSpace(title) == "" {
		return fmt.Errorf("%w: title is required", errs.ErrInvalidArgument)
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
func ParsePageToken(token string) int {
	if token == "" {
		return 0
	}
	n, _ := strconv.Atoi(token)
	return n
}
