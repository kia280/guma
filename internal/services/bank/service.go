package bank

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

// GuildBank is the domain model for the guild bank.
type GuildBank struct {
	ID              string
	GuildID         string
	Balance         int64
	Currency        string
	TopContributors []*TopContributor
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// TopContributor holds aggregated contribution data.
type TopContributor struct {
	UserID           string
	Username         string
	AvatarURL        string
	TotalContributed int64
}

const (
	ContributionKindGold            = "gold"
	ContributionKindRollCallLoot    = "roll_call_loot"
	ContributionKindAuctionProceeds = "auction_proceeds"
)

// BankContribution is the domain model for a bank contribution.
type BankContribution struct {
	ID            string
	GuildID       string
	UserID        string
	Username      string
	AvatarURL     string
	Amount        int64
	Note          string
	CreatedAt     time.Time
	Kind          string
	Items         []models.Item
	RollCallID    string
	ReferenceType string
	ReferenceID   string
}

// FundRequest is the domain model for a fund request.
type FundRequest struct {
	ID                 string
	GuildID            string
	RequesterID        string
	RequesterName      string
	RequesterAvatarURL string
	Amount             int64
	Reason             string
	Status             string
	ReviewerID         string
	ReviewNote         string
	CreatedAt          time.Time
	ReviewedAt         *time.Time
}

// BankItem is the domain model for an item in the guild bank.
type BankItem struct {
	ID                  string
	GuildID             string
	DonorID             string
	DonorName           string
	Item                models.Item
	Quantity            int32
	Note                string
	DonatedAt           time.Time
	RollCallID          string
	RollCallTitle       string
	RollCallCompleted   bool
	PendingRequestCount int32
	RequestedByMe       bool
	Lock                *models.ItemLock
}

// ItemRequest is the domain model for an item request.
type ItemRequest struct {
	ID                 string
	GuildID            string
	BankItemID         string
	RequesterID        string
	RequesterName      string
	RequesterAvatarURL string
	Reason             string
	Status             string
	ReviewerID         string
	ReviewNote         string
	Item               models.Item
	CreatedAt          time.Time
	ReviewedAt         *time.Time
}

const (
	StatusPending  = "pending"
	StatusApproved = "approved"
	StatusRejected = "rejected"
)

var reviewerRoles = []string{"owner", "admin", "moderator"}

var itemDeleterRoles = []string{"owner", "admin"}

const (
	itemEventDeleted = "deleted"
	deletedItemNote  = "The item was removed from the guild bank."
)

// ListFundRequestsParams holds inputs for ListFundRequests.
type ListFundRequestsParams struct {
	GuildID  string
	UserID   string
	Status   string
	PageSize int
	Offset   int
}

// ListFundRequestsResult is returned by ListFundRequests.
type ListFundRequestsResult struct {
	Requests   []*FundRequest
	TotalCount int32
	NextOffset int
}

type ListItemRequestsParams struct {
	GuildID  string
	UserID   string
	Status   string
	PageSize int
	Offset   int
}

type ListItemRequestsResult struct {
	Requests   []*ItemRequest
	TotalCount int32
	NextOffset int
}

// ListContributionsParams holds inputs for ListContributions.
type ListContributionsParams struct {
	GuildID  string
	PageSize int
	Offset   int
}

// ListContributionsResult is returned by ListContributions.
type ListContributionsResult struct {
	Contributions []*BankContribution
	TotalCount    int32
	NextOffset    int
}

// ListBankItemsParams holds inputs for ListBankItems.
type ListBankItemsParams struct {
	GuildID    string
	ViewerID   string
	RollCallID string
	Category   string
	Rarity     string
	PageSize   int
	Offset     int
}

// ListBankItemsResult is returned by ListBankItems.
type ListBankItemsResult struct {
	Items      []*BankItem
	TotalCount int32
	NextOffset int
}

// Service handles guild bank business logic.
type Service struct {
	pool   *database.Pool
	q      *db.Queries
	logger zerolog.Logger
}

// New creates a new bank Service.
func New(pool *database.Pool, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{
		pool:   pool,
		q:      q,
		logger: logger.With().Str("service", "bank").Logger(),
	}
}

// GetBank returns the guild bank, auto-creating it if missing.
func (s *Service) GetBank(ctx context.Context, guildIDStr string) (*GuildBank, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}

	if err := s.q.EnsureGuildBank(ctx, guildID); err != nil {
		return nil, fmt.Errorf("%w: ensure bank: %v", errs.ErrInternal, err)
	}

	row, err := s.q.GetGuildBank(ctx, guildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild bank", errs.ErrNotFound)
	}

	b := &GuildBank{
		ID: row.ID.String(), GuildID: row.GuildID.String(),
		Balance: row.Balance, Currency: row.Currency,
		CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		TopContributors: []*TopContributor{},
	}

	tops, _ := s.q.ListTopBankContributors(ctx, guildID)
	for _, t := range tops {
		b.TopContributors = append(b.TopContributors, &TopContributor{
			UserID: t.UserID.String(), Username: t.Username,
			AvatarURL: t.AvatarUrl, TotalContributed: t.Total,
		})
	}
	return b, nil
}

// ContributeFunds transfers funds from user wallet to guild bank.
func (s *Service) ContributeFunds(ctx context.Context, guildIDStr, userIDStr string, amount int64, note string) (*BankContribution, *GuildBank, error) {
	if amount <= 0 {
		return nil, nil, fmt.Errorf("%w: amount must be positive", errs.ErrInvalidArgument)
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}

	username, _ := s.q.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: userID})

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: userID, GuildID: guildID}); err != nil {
		return nil, nil, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
	}

	newBalance, err := qtx.DeductWalletIfSufficient(ctx, db.DeductWalletIfSufficientParams{
		Amount: amount, UserID: userID, GuildID: guildID,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("%w: insufficient wallet balance", errs.ErrFailedPrecondition)
	}

	if _, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
		UserID: userID, GuildID: guildID, Type: "BANK_CONTRIBUTION",
		Amount: -amount, BalanceAfter: newBalance,
		Description: note, ReferenceID: "", ReferenceType: "bank",
	}); err != nil {
		return nil, nil, fmt.Errorf("%w: record transaction: %v", errs.ErrInternal, err)
	}

	if err := qtx.EnsureGuildBank(ctx, guildID); err != nil {
		return nil, nil, fmt.Errorf("%w: ensure bank: %v", errs.ErrInternal, err)
	}
	if err := qtx.CreditGuildBank(ctx, db.CreditGuildBankParams{Amount: amount, GuildID: guildID}); err != nil {
		return nil, nil, fmt.Errorf("%w: credit bank: %v", errs.ErrInternal, err)
	}

	cr, err := qtx.InsertBankContribution(ctx, db.InsertBankContributionParams{
		GuildID: guildID, UserID: userID, Username: username, Amount: amount, Note: note,
	})
	if err != nil {
		return nil, nil, fmt.Errorf("%w: record contribution: %v", errs.ErrInternal, err)
	}

	if err := pgtx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}

	contrib := &BankContribution{
		ID: cr.ID.String(), GuildID: guildIDStr, UserID: userIDStr,
		Username: username, Amount: amount, Note: note, CreatedAt: cr.CreatedAt,
		Kind: ContributionKindGold, Items: []models.Item{},
	}

	bank, _ := s.GetBank(ctx, guildIDStr)
	return contrib, bank, nil
}

// RequestFunds inserts a pending fund request.
func (s *Service) RequestFunds(ctx context.Context, guildIDStr, userIDStr string, amount int64, reason string) (*FundRequest, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("%w: amount must be positive", errs.ErrInvalidArgument)
	}
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, fmt.Errorf("%w: reason is required", errs.ErrInvalidArgument)
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, userID); err != nil {
		return nil, err
	}

	bank, err := s.GetBank(ctx, guildIDStr)
	if err != nil {
		return nil, err
	}
	if amount > bank.Balance {
		return nil, fmt.Errorf("%w: amount exceeds bank balance", errs.ErrFailedPrecondition)
	}

	requesterName, _ := s.q.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: userID})

	r, err := s.q.InsertFundRequest(ctx, db.InsertFundRequestParams{
		GuildID: guildID, RequesterID: userID, RequesterName: requesterName,
		Amount: amount, Reason: reason,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: create fund request: %v", errs.ErrInternal, err)
	}
	return toFundRequest(r.ID, r.GuildID, r.RequesterID, r.RequesterName, r.RequesterAvatarUrl, r.Amount, r.Reason, r.Status, r.ReviewerID, r.ReviewNote, r.CreatedAt, r.ReviewedAt), nil
}

// ReviewFundRequest approves or rejects a fund request.
func (s *Service) ReviewFundRequest(ctx context.Context, guildIDStr, requestIDStr, reviewerIDStr, status, note string) (*FundRequest, error) {
	if err := validateDecision(status); err != nil {
		return nil, err
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: fund request", errs.ErrNotFound)
	}
	requestID, err := uuid.Parse(requestIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: fund request", errs.ErrNotFound)
	}
	reviewerID, err := uuid.Parse(reviewerIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, reviewerID, reviewerRoles...); err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	pending, err := qtx.LockFundRequest(ctx, db.LockFundRequestParams{ID: requestID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: fund request", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: load fund request: %v", errs.ErrInternal, err)
	}
	if err := checkReviewable(pending.Status); err != nil {
		return nil, err
	}

	if status == StatusApproved {
		if _, err := qtx.DeductGuildBankIfSufficient(ctx, db.DeductGuildBankIfSufficientParams{
			Amount: pending.Amount, GuildID: guildID,
		}); err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("%w: insufficient bank balance", errs.ErrFailedPrecondition)
			}
			return nil, fmt.Errorf("%w: deduct bank: %v", errs.ErrInternal, err)
		}

		if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: pending.RequesterID, GuildID: guildID}); err != nil {
			return nil, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
		}
		newBalance, err := qtx.CreditWallet(ctx, db.CreditWalletParams{
			Amount: pending.Amount, UserID: pending.RequesterID, GuildID: guildID,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: credit wallet: %v", errs.ErrInternal, err)
		}

		if _, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
			UserID: pending.RequesterID, GuildID: guildID, Type: "FUND_REQUEST_APPROVED",
			Amount: pending.Amount, BalanceAfter: newBalance,
			Description: note, ReferenceID: requestIDStr, ReferenceType: "fund_request",
		}); err != nil {
			return nil, fmt.Errorf("%w: record transaction: %v", errs.ErrInternal, err)
		}
	}

	r, err := qtx.UpdateFundRequestStatus(ctx, db.UpdateFundRequestStatusParams{
		Status: status, ReviewerID: &reviewerID, ReviewNote: note,
		ID: requestID, GuildID: guildID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: update fund request: %v", errs.ErrInternal, err)
	}

	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("fund_request_id", requestIDStr).Str("reviewer_id", reviewerIDStr).Str("status", status).Msg("fund request reviewed")
	return toFundRequest(r.ID, r.GuildID, r.RequesterID, r.RequesterName, r.RequesterAvatarUrl, r.Amount, r.Reason, r.Status, r.ReviewerID, r.ReviewNote, r.CreatedAt, r.ReviewedAt), nil
}

// ListFundRequests returns paginated fund requests.
func (s *Service) ListFundRequests(ctx context.Context, p ListFundRequestsParams) (*ListFundRequestsResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	if err := validateStatusFilter(p.Status); err != nil {
		return nil, err
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	userID, err := uuid.Parse(p.UserID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, userID); err != nil {
		return nil, err
	}

	rows, err := s.q.ListFundRequests(ctx, db.ListFundRequestsParams{
		GuildID: guildID, StatusFilter: p.Status,
		PageSize: int32(pageSize), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list fund requests: %v", errs.ErrInternal, err)
	}

	requests := make([]*FundRequest, 0, len(rows))
	for _, r := range rows {
		requests = append(requests, toFundRequest(r.ID, r.GuildID, r.RequesterID, r.RequesterName, r.RequesterAvatarUrl, r.Amount, r.Reason, r.Status, r.ReviewerID, r.ReviewNote, r.CreatedAt, r.ReviewedAt))
	}

	total, _ := s.q.CountFundRequests(ctx, db.CountFundRequestsParams{GuildID: guildID, StatusFilter: p.Status})

	nextOffset := 0
	if len(requests) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListFundRequestsResult{Requests: requests, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// ListContributions returns paginated contributions.
func (s *Service) ListContributions(ctx context.Context, p ListContributionsParams) (*ListContributionsResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}

	rows, err := s.q.ListBankContributions(ctx, db.ListBankContributionsParams{
		GuildID: guildID, PageSize: int32(pageSize), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list contributions: %v", errs.ErrInternal, err)
	}

	contribs := make([]*BankContribution, 0, len(rows))
	for _, r := range rows {
		c := &BankContribution{
			ID: r.ID.String(), GuildID: r.GuildID.String(), UserID: r.UserID.String(),
			Username: r.Username, AvatarURL: r.AvatarUrl, Amount: r.Amount, Note: r.Note, CreatedAt: r.CreatedAt,
			Kind: r.Kind, Items: []models.Item{}, ReferenceType: r.ReferenceType,
		}
		if r.ReferenceID != nil {
			c.ReferenceID = r.ReferenceID.String()
		}
		if len(r.Items) > 0 {
			_ = json.Unmarshal(r.Items, &c.Items)
		}
		if r.RollCallID != nil {
			c.RollCallID = r.RollCallID.String()
		}
		contribs = append(contribs, c)
	}

	total, _ := s.q.CountBankContributions(ctx, guildID)

	nextOffset := 0
	if len(contribs) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListContributionsResult{Contributions: contribs, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// DonateItem moves a backpack item to the guild bank.
func (s *Service) DonateItem(ctx context.Context, guildIDStr, userIDStr, backpackItemIDStr, note string) (*BankItem, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	backpackItemID, err := uuid.Parse(backpackItemIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: backpack item", errs.ErrNotFound)
	}

	donorName, _ := s.q.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: userID})

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	itemJSON, err := qtx.DeleteBackpackItemReturningItem(ctx, db.DeleteBackpackItemReturningItemParams{
		ID: backpackItemID, OwnerID: userID, GuildID: guildID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: backpack item", errs.ErrNotFound)
	}

	var item models.Item
	if err := json.Unmarshal(itemJSON, &item); err != nil {
		return nil, fmt.Errorf("%w: decode item: %v", errs.ErrInternal, err)
	}

	r, err := qtx.InsertBankItem(ctx, db.InsertBankItemParams{
		ID: backpackItemID, GuildID: guildID, DonorID: userID, DonorName: donorName, Item: itemJSON, Note: note,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: insert bank item: %v", errs.ErrInternal, err)
	}

	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}

	bi := &BankItem{
		ID: r.ID.String(), GuildID: r.GuildID.String(), DonorID: r.DonorID.String(),
		DonorName: r.DonorName, Item: item, Quantity: r.Quantity,
		Note: r.Note, DonatedAt: r.DonatedAt,
	}
	s.logger.Info().Str("bank_item_id", bi.ID).Str("donor_id", userIDStr).Msg("item donated to bank")
	return bi, nil
}

// ListBankItems returns paginated bank items with optional filters.
func (s *Service) ListBankItems(ctx context.Context, p ListBankItemsParams) (*ListBankItemsResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	viewerID, err := uuid.Parse(p.ViewerID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}

	rows, err := s.q.ListBankItems(ctx, db.ListBankItemsParams{
		GuildID: guildID, CategoryFilter: p.Category, RarityFilter: p.Rarity,
		PageSize: int32(pageSize), PageOffset: int32(p.Offset), ViewerID: viewerID,
		RollCallFilter: p.RollCallID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list bank items: %v", errs.ErrInternal, err)
	}

	items := make([]*BankItem, 0, len(rows))
	for _, r := range rows {
		bi := &BankItem{
			ID: r.ID.String(), GuildID: r.GuildID.String(), DonorID: r.DonorID.String(),
			DonorName: r.DonorName, Quantity: r.Quantity,
			Note: r.Note, DonatedAt: r.DonatedAt, RollCallTitle: r.RollCallTitle, RollCallCompleted: r.RollCallCompleted,
			PendingRequestCount: r.PendingRequestCount, RequestedByMe: r.RequestedByMe,
			Lock: models.NewItemLock(r.LockedByType, r.LockedByID),
		}
		if r.RollCallID != nil {
			bi.RollCallID = r.RollCallID.String()
		}
		if len(r.Item) > 0 {
			_ = json.Unmarshal(r.Item, &bi.Item)
		}
		items = append(items, bi)
	}

	total, _ := s.q.CountBankItems(ctx, db.CountBankItemsParams{
		GuildID: guildID, CategoryFilter: p.Category, RarityFilter: p.Rarity,
		RollCallFilter: p.RollCallID,
	})

	nextOffset := 0
	if len(items) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListBankItemsResult{Items: items, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// RequestItem inserts a pending item request.
func (s *Service) RequestItem(ctx context.Context, guildIDStr, userIDStr, bankItemIDStr, reason string) (*ItemRequest, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, fmt.Errorf("%w: reason is required", errs.ErrInvalidArgument)
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: bank item", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	bankItemID, err := uuid.Parse(bankItemIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: bank item", errs.ErrNotFound)
	}
	if err := s.requireRole(ctx, guildID, userID); err != nil {
		return nil, err
	}

	requesterName, _ := s.q.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: userID})

	r, err := s.q.InsertItemRequest(ctx, db.InsertItemRequestParams{
		GuildID: guildID, BankItemID: bankItemID, RequesterID: userID,
		RequesterName: requesterName, Reason: reason,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		switch {
		case errors.Is(err, pgx.ErrNoRows):
			if exists, _ := s.q.BankItemExists(ctx, db.BankItemExistsParams{ID: bankItemID, GuildID: guildID}); exists {
				return nil, fmt.Errorf("%w: bank item is in an auction or raffle", errs.ErrFailedPrecondition)
			}
			return nil, fmt.Errorf("%w: bank item", errs.ErrNotFound)
		case errors.As(err, &pgErr) && pgErr.Code == "23505":
			return nil, fmt.Errorf("%w: a pending request for this item already exists", errs.ErrAlreadyExists)
		}
		return nil, fmt.Errorf("%w: create item request: %v", errs.ErrInternal, err)
	}
	return toItemRequest(db.ListItemRequestsRow(r)), nil
}

// ReviewItemRequest approves or rejects an item request.
func (s *Service) ReviewItemRequest(ctx context.Context, guildIDStr, requestIDStr, reviewerIDStr, status, note string) (*ItemRequest, error) {
	if err := validateDecision(status); err != nil {
		return nil, err
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: item request", errs.ErrNotFound)
	}
	requestID, err := uuid.Parse(requestIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: item request", errs.ErrNotFound)
	}
	reviewerID, err := uuid.Parse(reviewerIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, reviewerID, reviewerRoles...); err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	pending, err := qtx.LockItemRequest(ctx, db.LockItemRequestParams{ID: requestID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: item request", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: load item request: %v", errs.ErrInternal, err)
	}
	if err := checkReviewable(pending.Status); err != nil {
		return nil, err
	}

	r, err := qtx.UpdateItemRequestStatus(ctx, db.UpdateItemRequestStatusParams{
		Status: status, ReviewerID: &reviewerID, ReviewNote: note,
		ID: requestID, GuildID: guildID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: update item request: %v", errs.ErrInternal, err)
	}

	if status == StatusApproved {
		if pending.BankItemID == nil {
			return nil, fmt.Errorf("%w: bank item is no longer available", errs.ErrFailedPrecondition)
		}

		if err := qtx.RejectCompetingItemRequests(ctx, db.RejectCompetingItemRequestsParams{
			ReviewerID: &reviewerID, BankItemID: pending.BankItemID, GuildID: guildID, ID: requestID,
		}); err != nil {
			return nil, fmt.Errorf("%w: reject competing requests: %v", errs.ErrInternal, err)
		}

		itemJSON, err := qtx.DeleteBankItemReturningItem(ctx, db.DeleteBankItemReturningItemParams{
			ID: *pending.BankItemID, GuildID: guildID,
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("%w: bank item is no longer available", errs.ErrFailedPrecondition)
			}
			return nil, fmt.Errorf("%w: remove bank item: %v", errs.ErrInternal, err)
		}

		if err := qtx.InsertBackpackItemFromRequest(ctx, db.InsertBackpackItemFromRequestParams{
			ID: *pending.BankItemID, OwnerID: pending.RequesterID, GuildID: guildID, Item: itemJSON, SourceID: &requestID,
		}); err != nil {
			return nil, fmt.Errorf("%w: add to backpack: %v", errs.ErrInternal, err)
		}
	}

	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("item_request_id", requestIDStr).Str("reviewer_id", reviewerIDStr).Str("status", status).Msg("item request reviewed")
	return toItemRequest(db.ListItemRequestsRow(r)), nil
}

func (s *Service) DeleteBankItem(ctx context.Context, guildIDStr, userIDStr, bankItemIDStr string) error {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return fmt.Errorf("%w: bank item", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	bankItemID, err := uuid.Parse(bankItemIDStr)
	if err != nil {
		return fmt.Errorf("%w: bank item", errs.ErrNotFound)
	}
	if err := s.requireRole(ctx, guildID, userID, itemDeleterRoles...); err != nil {
		return err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	bankItem, err := qtx.GetBankItemForUpdate(ctx, db.GetBankItemForUpdateParams{ID: bankItemID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: bank item", errs.ErrNotFound)
		}
		return fmt.Errorf("%w: load bank item: %v", errs.ErrInternal, err)
	}
	if bankItem.LockedByType != "" {
		return fmt.Errorf("%w: bank item is in an auction or raffle", errs.ErrFailedPrecondition)
	}

	rejected, err := qtx.RejectPendingRequestsForBankItem(ctx, db.RejectPendingRequestsForBankItemParams{
		ReviewerID: &userID, ReviewNote: deletedItemNote, BankItemID: &bankItemID, GuildID: guildID,
	})
	if err != nil {
		return fmt.Errorf("%w: reject pending requests: %v", errs.ErrInternal, err)
	}

	if err := qtx.InsertItemEvent(ctx, db.InsertItemEventParams{
		GuildID: guildID, ItemID: bankItemID, Kind: itemEventDeleted, ActorID: &userID,
	}); err != nil {
		return fmt.Errorf("%w: log item deletion: %v", errs.ErrInternal, err)
	}

	if _, err := qtx.DeleteBankItemReturningItem(ctx, db.DeleteBankItemReturningItemParams{
		ID: bankItemID, GuildID: guildID,
	}); err != nil {
		return fmt.Errorf("%w: remove bank item: %v", errs.ErrInternal, err)
	}

	if err := pgtx.Commit(ctx); err != nil {
		return fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("bank_item_id", bankItemIDStr).Str("deleted_by", userIDStr).Int64("rejected_requests", rejected).Msg("bank item deleted")
	return nil
}

func (s *Service) ListItemRequests(ctx context.Context, p ListItemRequestsParams) (*ListItemRequestsResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	if err := validateStatusFilter(p.Status); err != nil {
		return nil, err
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	userID, err := uuid.Parse(p.UserID)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, userID); err != nil {
		return nil, err
	}

	rows, err := s.q.ListItemRequests(ctx, db.ListItemRequestsParams{
		GuildID: guildID, StatusFilter: p.Status,
		PageSize: int32(pageSize), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list item requests: %v", errs.ErrInternal, err)
	}

	requests := make([]*ItemRequest, 0, len(rows))
	for _, r := range rows {
		requests = append(requests, toItemRequest(r))
	}

	total, _ := s.q.CountItemRequests(ctx, db.CountItemRequestsParams{GuildID: guildID, StatusFilter: p.Status})

	nextOffset := 0
	if len(requests) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListItemRequestsResult{Requests: requests, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// --- helpers ---

func toFundRequest(id, guildID, requesterID uuid.UUID, requesterName, requesterAvatarURL string, amount int64, reason, status string, reviewerID *uuid.UUID, reviewNote string, createdAt time.Time, reviewedAt pgtype.Timestamptz) *FundRequest {
	fr := &FundRequest{
		ID: id.String(), GuildID: guildID.String(), RequesterID: requesterID.String(),
		RequesterName: requesterName, RequesterAvatarURL: requesterAvatarURL,
		Amount: amount, Reason: reason, Status: status,
		ReviewNote: reviewNote, CreatedAt: createdAt,
	}
	if reviewerID != nil {
		fr.ReviewerID = reviewerID.String()
	}
	if reviewedAt.Valid {
		t := reviewedAt.Time
		fr.ReviewedAt = &t
	}
	return fr
}

func toItemRequest(r db.ListItemRequestsRow) *ItemRequest {
	ir := &ItemRequest{
		ID: r.ID.String(), GuildID: r.GuildID.String(),
		RequesterID: r.RequesterID.String(), RequesterName: r.RequesterName,
		RequesterAvatarURL: r.RequesterAvatarUrl,
		Reason:             r.Reason, Status: r.Status, ReviewNote: r.ReviewNote, CreatedAt: r.CreatedAt,
	}
	if r.BankItemID != nil {
		ir.BankItemID = r.BankItemID.String()
	}
	if r.ReviewerID != nil {
		ir.ReviewerID = r.ReviewerID.String()
	}
	if r.ReviewedAt.Valid {
		t := r.ReviewedAt.Time
		ir.ReviewedAt = &t
	}
	if len(r.Item) > 0 {
		_ = json.Unmarshal(r.Item, &ir.Item)
	}
	return ir
}

func validateDecision(status string) error {
	if status != StatusApproved && status != StatusRejected {
		return fmt.Errorf("%w: status must be '%s' or '%s'", errs.ErrInvalidArgument, StatusApproved, StatusRejected)
	}
	return nil
}

func validateStatusFilter(status string) error {
	switch status {
	case "", StatusPending, StatusApproved, StatusRejected:
		return nil
	}
	return fmt.Errorf("%w: unknown status filter %q", errs.ErrInvalidArgument, status)
}

func checkReviewable(currentStatus string) error {
	if currentStatus != StatusPending {
		return fmt.Errorf("%w: request has already been reviewed", errs.ErrFailedPrecondition)
	}
	return nil
}

func (s *Service) requireRole(ctx context.Context, guildID, userID uuid.UUID, roles ...string) error {
	role, err := s.q.GetGuildMemberRole(ctx, db.GetGuildMemberRoleParams{GuildID: guildID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: not a member of this guild", errs.ErrPermissionDenied)
		}
		return fmt.Errorf("%w: load member role: %v", errs.ErrInternal, err)
	}
	if len(roles) == 0 {
		return nil
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
