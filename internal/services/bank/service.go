package bank

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
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
	Goal            int64
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

// BankContribution is the domain model for a bank contribution.
type BankContribution struct {
	ID        string
	GuildID   string
	UserID    string
	Username  string
	Amount    int64
	Note      string
	CreatedAt time.Time
}

// FundRequest is the domain model for a fund request.
type FundRequest struct {
	ID            string
	GuildID       string
	RequesterID   string
	RequesterName string
	Amount        int64
	Reason        string
	Status        string
	ReviewerID    string
	ReviewNote    string
	CreatedAt     time.Time
	ReviewedAt    *time.Time
}

// BankItem is the domain model for an item in the guild bank.
type BankItem struct {
	ID        string
	GuildID   string
	DonorID   string
	DonorName string
	Item      models.Item
	Quantity  int32
	Note      string
	DonatedAt time.Time
}

// ItemRequest is the domain model for an item request.
type ItemRequest struct {
	ID            string
	GuildID       string
	BankItemID    string
	RequesterID   string
	RequesterName string
	Reason        string
	Status        string
	ReviewerID    string
	ReviewNote    string
	CreatedAt     time.Time
	ReviewedAt    *time.Time
}

// ListFundRequestsParams holds inputs for ListFundRequests.
type ListFundRequestsParams struct {
	GuildID  string
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
	GuildID  string
	Category string
	Rarity   string
	PageSize int
	Offset   int
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
		Balance: row.Balance, Currency: row.Currency, Goal: row.Goal,
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

	username, _ := s.q.GetUserDisplayName(ctx, userID)

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
	}

	bank, _ := s.GetBank(ctx, guildIDStr)
	return contrib, bank, nil
}

// RequestFunds inserts a pending fund request.
func (s *Service) RequestFunds(ctx context.Context, guildIDStr, userIDStr string, amount int64, reason string) (*FundRequest, error) {
	if amount <= 0 {
		return nil, fmt.Errorf("%w: amount must be positive", errs.ErrInvalidArgument)
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}

	requesterName, _ := s.q.GetUserDisplayName(ctx, userID)

	r, err := s.q.InsertFundRequest(ctx, db.InsertFundRequestParams{
		GuildID: guildID, RequesterID: userID, RequesterName: requesterName,
		Amount: amount, Reason: reason,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: create fund request: %v", errs.ErrInternal, err)
	}
	return toFundRequest(r.ID, r.GuildID, r.RequesterID, r.RequesterName, r.Amount, r.Reason, r.Status, r.ReviewerID, r.ReviewNote, r.CreatedAt, r.ReviewedAt), nil
}

// ReviewFundRequest approves or rejects a fund request.
func (s *Service) ReviewFundRequest(ctx context.Context, guildIDStr, requestIDStr, reviewerIDStr, status, note string) (*FundRequest, error) {
	if status != "approved" && status != "rejected" {
		return nil, fmt.Errorf("%w: status must be 'approved' or 'rejected'", errs.ErrInvalidArgument)
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
	if err := s.requireRole(ctx, guildID, reviewerID, "owner", "admin", "moderator"); err != nil {
		return nil, err
	}

	if status == "approved" {
		pending, err := s.q.GetPendingFundRequest(ctx, db.GetPendingFundRequestParams{ID: requestID, GuildID: guildID})
		if err != nil {
			return nil, fmt.Errorf("%w: fund request", errs.ErrNotFound)
		}

		pgtx, err := s.pool.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
		}
		defer pgtx.Rollback(ctx) //nolint:errcheck
		qtx := s.q.WithTx(pgtx)

		if _, err := qtx.DeductGuildBankIfSufficient(ctx, db.DeductGuildBankIfSufficientParams{
			Amount: pending.Amount, GuildID: guildID,
		}); err != nil {
			return nil, fmt.Errorf("%w: insufficient bank balance", errs.ErrFailedPrecondition)
		}

		_ = qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: pending.RequesterID, GuildID: guildID})
		newBalance, err := qtx.CreditWallet(ctx, db.CreditWalletParams{
			Amount: pending.Amount, UserID: pending.RequesterID, GuildID: guildID,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: credit wallet: %v", errs.ErrInternal, err)
		}

		_, _ = qtx.InsertTransaction(ctx, db.InsertTransactionParams{
			UserID: pending.RequesterID, GuildID: guildID, Type: "FUND_REQUEST_APPROVED",
			Amount: pending.Amount, BalanceAfter: newBalance,
			Description: note, ReferenceID: requestIDStr, ReferenceType: "fund_request",
		})

		r, err := qtx.UpdateFundRequestStatus(ctx, db.UpdateFundRequestStatusParams{
			Status: status, ReviewerID: &reviewerID, ReviewNote: note,
			ID: requestID, GuildID: guildID,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: fund request", errs.ErrNotFound)
		}

		if err := pgtx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
		}
		return toFundRequest(r.ID, r.GuildID, r.RequesterID, r.RequesterName, r.Amount, r.Reason, r.Status, r.ReviewerID, r.ReviewNote, r.CreatedAt, r.ReviewedAt), nil
	}

	r, err := s.q.UpdateFundRequestStatus(ctx, db.UpdateFundRequestStatusParams{
		Status: status, ReviewerID: &reviewerID, ReviewNote: note,
		ID: requestID, GuildID: guildID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: fund request", errs.ErrNotFound)
	}
	return toFundRequest(r.ID, r.GuildID, r.RequesterID, r.RequesterName, r.Amount, r.Reason, r.Status, r.ReviewerID, r.ReviewNote, r.CreatedAt, r.ReviewedAt), nil
}

// ListFundRequests returns paginated fund requests.
func (s *Service) ListFundRequests(ctx context.Context, p ListFundRequestsParams) (*ListFundRequestsResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
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
		requests = append(requests, toFundRequest(r.ID, r.GuildID, r.RequesterID, r.RequesterName, r.Amount, r.Reason, r.Status, r.ReviewerID, r.ReviewNote, r.CreatedAt, r.ReviewedAt))
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
		contribs = append(contribs, &BankContribution{
			ID: r.ID.String(), GuildID: r.GuildID.String(), UserID: r.UserID.String(),
			Username: r.Username, Amount: r.Amount, Note: r.Note, CreatedAt: r.CreatedAt,
		})
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

	donorName, _ := s.q.GetUserDisplayName(ctx, userID)

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
		GuildID: guildID, DonorID: userID, DonorName: donorName, Item: itemJSON, Note: note,
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

	rows, err := s.q.ListBankItems(ctx, db.ListBankItemsParams{
		GuildID: guildID, CategoryFilter: p.Category, RarityFilter: p.Rarity,
		PageSize: int32(pageSize), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list bank items: %v", errs.ErrInternal, err)
	}

	items := make([]*BankItem, 0, len(rows))
	for _, r := range rows {
		bi := &BankItem{
			ID: r.ID.String(), GuildID: r.GuildID.String(), DonorID: r.DonorID.String(),
			DonorName: r.DonorName, Quantity: r.Quantity,
			Note: r.Note, DonatedAt: r.DonatedAt,
		}
		if len(r.Item) > 0 {
			_ = json.Unmarshal(r.Item, &bi.Item)
		}
		items = append(items, bi)
	}

	total, _ := s.q.CountBankItems(ctx, db.CountBankItemsParams{
		GuildID: guildID, CategoryFilter: p.Category, RarityFilter: p.Rarity,
	})

	nextOffset := 0
	if len(items) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListBankItemsResult{Items: items, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// RequestItem inserts a pending item request.
func (s *Service) RequestItem(ctx context.Context, guildIDStr, userIDStr, bankItemIDStr, reason string) (*ItemRequest, error) {
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

	exists, err := s.q.BankItemExists(ctx, db.BankItemExistsParams{ID: bankItemID, GuildID: guildID})
	if err != nil || !exists {
		return nil, fmt.Errorf("%w: bank item", errs.ErrNotFound)
	}

	requesterName, _ := s.q.GetUserDisplayName(ctx, userID)

	r, err := s.q.InsertItemRequest(ctx, db.InsertItemRequestParams{
		GuildID: guildID, BankItemID: bankItemID, RequesterID: userID,
		RequesterName: requesterName, Reason: reason,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: create item request: %v", errs.ErrInternal, err)
	}
	return toItemRequest(r.ID, r.GuildID, r.BankItemID, r.RequesterID, r.RequesterName, r.Reason, r.Status, r.ReviewerID, r.ReviewNote, r.CreatedAt, r.ReviewedAt), nil
}

// ReviewItemRequest approves or rejects an item request.
func (s *Service) ReviewItemRequest(ctx context.Context, guildIDStr, requestIDStr, reviewerIDStr, status, note string) (*ItemRequest, error) {
	if status != "approved" && status != "rejected" {
		return nil, fmt.Errorf("%w: status must be 'approved' or 'rejected'", errs.ErrInvalidArgument)
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
	if err := s.requireRole(ctx, guildID, reviewerID, "owner", "admin", "moderator"); err != nil {
		return nil, err
	}

	if status == "approved" {
		pending, err := s.q.GetPendingItemRequest(ctx, db.GetPendingItemRequestParams{ID: requestID, GuildID: guildID})
		if err != nil {
			return nil, fmt.Errorf("%w: item request", errs.ErrNotFound)
		}

		pgtx, err := s.pool.Begin(ctx)
		if err != nil {
			return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
		}
		defer pgtx.Rollback(ctx) //nolint:errcheck
		qtx := s.q.WithTx(pgtx)

		itemJSON, err := qtx.DeleteBankItemReturningItem(ctx, db.DeleteBankItemReturningItemParams{
			ID: pending.BankItemID, GuildID: guildID,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: bank item already removed", errs.ErrNotFound)
		}

		if err := qtx.InsertBackpackItemFromRequest(ctx, db.InsertBackpackItemFromRequestParams{
			OwnerID: pending.RequesterID, GuildID: guildID, Item: itemJSON, SourceID: &requestID,
		}); err != nil {
			return nil, fmt.Errorf("%w: add to backpack: %v", errs.ErrInternal, err)
		}

		r, err := qtx.UpdateItemRequestStatus(ctx, db.UpdateItemRequestStatusParams{
			Status: status, ReviewerID: &reviewerID, ReviewNote: note,
			ID: requestID, GuildID: guildID,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: item request", errs.ErrNotFound)
		}

		if err := pgtx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
		}
		return toItemRequest(r.ID, r.GuildID, r.BankItemID, r.RequesterID, r.RequesterName, r.Reason, r.Status, r.ReviewerID, r.ReviewNote, r.CreatedAt, r.ReviewedAt), nil
	}

	r, err := s.q.UpdateItemRequestStatus(ctx, db.UpdateItemRequestStatusParams{
		Status: status, ReviewerID: &reviewerID, ReviewNote: note,
		ID: requestID, GuildID: guildID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: item request", errs.ErrNotFound)
	}
	return toItemRequest(r.ID, r.GuildID, r.BankItemID, r.RequesterID, r.RequesterName, r.Reason, r.Status, r.ReviewerID, r.ReviewNote, r.CreatedAt, r.ReviewedAt), nil
}

// --- helpers ---

func toFundRequest(id, guildID, requesterID uuid.UUID, requesterName string, amount int64, reason, status string, reviewerID *uuid.UUID, reviewNote string, createdAt time.Time, reviewedAt pgtype.Timestamptz) *FundRequest {
	fr := &FundRequest{
		ID: id.String(), GuildID: guildID.String(), RequesterID: requesterID.String(),
		RequesterName: requesterName, Amount: amount, Reason: reason, Status: status,
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

func toItemRequest(id, guildID, bankItemID, requesterID uuid.UUID, requesterName, reason, status string, reviewerID *uuid.UUID, reviewNote string, createdAt time.Time, reviewedAt pgtype.Timestamptz) *ItemRequest {
	ir := &ItemRequest{
		ID: id.String(), GuildID: guildID.String(), BankItemID: bankItemID.String(),
		RequesterID: requesterID.String(), RequesterName: requesterName,
		Reason: reason, Status: status, ReviewNote: reviewNote, CreatedAt: createdAt,
	}
	if reviewerID != nil {
		ir.ReviewerID = reviewerID.String()
	}
	if reviewedAt.Valid {
		t := reviewedAt.Time
		ir.ReviewedAt = &t
	}
	return ir
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
