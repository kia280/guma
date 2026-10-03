package auction

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/services/inventory"
	"github.com/kia280/guma/internal/services/pagination"
)

// AuctionItem is the domain model for an auction.
type AuctionItem struct {
	ID                     string
	GuildID                string
	SellerID               string
	SellerName             string
	SellerAvatarURL        string
	Item                   models.Item
	StartingBid            int64
	CurrentBid             int64
	CurrentBidderID        string
	CurrentBidderName      string
	CurrentBidderAvatarURL string
	MinBidIncrement        int64
	StartTime              time.Time
	EndTime                time.Time
	Status                 string
	IsBlind                bool
	SourceType             string
	CreatedAt              time.Time
	UpdatedAt              time.Time
	CancelledAt            *time.Time
}

// Bid is the domain model for a bid.
type Bid struct {
	ID              string
	AuctionID       string
	BidderID        string
	BidderName      string
	BidderAvatarURL string
	Amount          int64
	IsWinning       bool
	PlacedAt        time.Time
}

// ListParams holds the inputs for List.
type ListParams struct {
	GuildID  string
	Status   string
	Category string
	Rarity   string
	Search   string
	PageSize int
	Offset   int
}

// ListResult is returned by List.
type ListResult struct {
	Auctions   []*AuctionItem
	TotalCount int32
	NextOffset int
}

// CreateParams holds the inputs for Create.
type CreateParams struct {
	GuildID         string
	SellerID        string
	Item            models.Item
	StartingBid     int64
	MinBidIncrement int64
	DurationHours   int32
	IsBlind         bool
	Status          string
	Source          inventory.Ref
}

type UpdateParams struct {
	GuildID         string
	AuctionID       string
	UpdatedBy       string
	Item            *models.Item
	StartingBid     *int64
	MinBidIncrement *int64
	IsBlind         *bool
	StartTime       *time.Time
	EndTime         *time.Time
}

// BidHistoryResult is returned by GetBidHistory.
type BidHistoryResult struct {
	Bids       []*Bid
	TotalCount int32
	NextOffset int
}

// Service handles auction business logic.
type Service struct {
	pool   *database.Pool
	q      *db.Queries
	az     authz.Checker
	logger zerolog.Logger
}

// New creates a new auction Service.
func New(pool *database.Pool, az authz.Checker, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{
		pool:   pool,
		q:      q,
		az:     az,
		logger: logger.With().Str("service", "auction").Logger(),
	}
}

// List returns paginated auctions for a guild with optional filters.
func (s *Service) List(ctx context.Context, p ListParams) (*ListResult, error) {
	pageSize := pagination.StandardSize(p.PageSize)
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	search := "%" + p.Search + "%"

	rows, err := s.q.ListAuctions(ctx, db.ListAuctionsParams{
		GuildID:        guildID,
		StatusFilter:   p.Status,
		CategoryFilter: p.Category,
		RarityFilter:   p.Rarity,
		Search:         search,
		PageSize:       int32(pageSize),
		PageOffset:     int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list auctions: %v", errs.ErrInternal, err)
	}

	auctions := make([]*AuctionItem, 0, len(rows))
	for _, r := range rows {
		auctions = append(auctions, withParticipants(toAuctionItem(r.Auction), r.SellerName, r.SellerAvatarUrl, r.CurrentBidderName, r.CurrentBidderAvatarUrl))
	}

	total, _ := s.q.CountAuctions(ctx, db.CountAuctionsParams{
		GuildID: guildID, StatusFilter: p.Status, CategoryFilter: p.Category, RarityFilter: p.Rarity, Search: search,
	})

	nextOffset := 0
	if len(auctions) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListResult{Auctions: auctions, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// Get fetches a single auction by ID.
func (s *Service) Get(ctx context.Context, guildIDStr, auctionIDStr string) (*AuctionItem, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}
	auctionID, err := uuid.Parse(auctionIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}
	row, err := s.q.GetAuction(ctx, db.GetAuctionParams{ID: auctionID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}
	return withParticipants(toAuctionItem(row.Auction), row.SellerName, row.SellerAvatarUrl, row.CurrentBidderName, row.CurrentBidderAvatarUrl), nil
}

const defaultMinBidIncrement = 100

// Create inserts a new auction.
func (s *Service) Create(ctx context.Context, p CreateParams) (*AuctionItem, error) {
	if p.MinBidIncrement <= 0 {
		p.MinBidIncrement = defaultMinBidIncrement
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	sellerID, err := uuid.Parse(p.SellerID)
	if err != nil {
		return nil, fmt.Errorf("%w: seller", errs.ErrInvalidArgument)
	}
	if err := authz.Require(ctx, s.az, guildID, sellerID, createPermission(p.Source)); err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	auctionID := uuid.New()
	locked, err := inventory.Lock(ctx, qtx, guildID, sellerID, p.Source,
		inventory.Holder{Type: inventory.HolderAuction, ID: auctionID}, "Listed in an auction")
	if err != nil {
		return nil, err
	}
	var sourceType string
	var sourceItemID *uuid.UUID
	if locked != nil {
		p.Item = locked.Item
		sourceType, sourceItemID = locked.SourceType, &locked.ItemID
	}
	if p.Item.Name == "" {
		return nil, fmt.Errorf("%w: item name is required", errs.ErrInvalidArgument)
	}

	itemJSON, err := json.Marshal(p.Item)
	if err != nil {
		return nil, fmt.Errorf("%w: marshal item: %v", errs.ErrInternal, err)
	}

	status := p.Status
	if status != "UPCOMING" && status != "ACTIVE" {
		status = "UPCOMING"
	}

	startTime := time.Now().UTC()
	if status == "UPCOMING" {
		startTime = startTime.Add(24 * time.Hour)
	}
	endTime := startTime.Add(time.Duration(p.DurationHours) * time.Hour)

	row, err := qtx.CreateAuction(ctx, db.CreateAuctionParams{
		ID: auctionID, GuildID: guildID, SellerID: sellerID, Item: itemJSON,
		StartingBid: p.StartingBid, MinBidIncrement: p.MinBidIncrement,
		StartTime: startTime, EndTime: endTime, Status: status, IsBlind: p.IsBlind,
		SourceType: sourceType, SourceItemID: sourceItemID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: create auction: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("auction_id", row.ID.String()).Str("guild_id", p.GuildID).Msg("auction created")
	return s.Get(ctx, p.GuildID, row.ID.String())
}

// PlaceBid places a bid on an active auction, handling wallet escrow atomically.
func (s *Service) PlaceBid(ctx context.Context, guildIDStr, auctionIDStr, bidderIDStr string, amount int64) (*AuctionItem, *Bid, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}
	auctionID, err := uuid.Parse(auctionIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}
	bidderID, err := uuid.Parse(bidderIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: bidder", errs.ErrInvalidArgument)
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	info, err := qtx.GetAuctionForUpdate(ctx, db.GetAuctionForUpdateParams{ID: auctionID, GuildID: guildID})
	if err != nil {
		return nil, nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}

	if info.Status != "ACTIVE" {
		return nil, nil, fmt.Errorf("%w: auction is not active", errs.ErrFailedPrecondition)
	}
	if time.Now().UTC().After(info.EndTime) {
		return nil, nil, fmt.Errorf("%w: auction has ended", errs.ErrFailedPrecondition)
	}
	minRequired := minimumBid(info.StartingBid, info.CurrentBid, info.MinBidIncrement, info.CurrentBidderID != nil)
	if amount < minRequired {
		return nil, nil, fmt.Errorf("%w: bid must be at least %d", errs.ErrFailedPrecondition, minRequired)
	}

	// Deduct from bidder wallet
	if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: bidderID, GuildID: guildID}); err != nil {
		return nil, nil, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
	}
	bidderBalance, err := qtx.GetWalletBalanceForUpdate(ctx, db.GetWalletBalanceForUpdateParams{UserID: bidderID, GuildID: guildID})
	if err != nil {
		return nil, nil, fmt.Errorf("%w: bidder wallet", errs.ErrNotFound)
	}
	isRaisingOwnBid := info.CurrentBidderID != nil && *info.CurrentBidderID == bidderID
	charge, description := amount, "Auction bid placed"
	if isRaisingOwnBid {
		charge, description = amount-info.CurrentBid, "Auction bid raised"
	}
	if bidderBalance < charge {
		return nil, nil, fmt.Errorf("%w: insufficient funds", errs.ErrFailedPrecondition)
	}
	newBidderBalance := bidderBalance - charge
	if err := qtx.UpdateWalletBalance(ctx, db.UpdateWalletBalanceParams{
		Balance: newBidderBalance, UserID: bidderID, GuildID: guildID,
	}); err != nil {
		return nil, nil, fmt.Errorf("%w: deduct bid amount: %v", errs.ErrInternal, err)
	}
	if _, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
		UserID: bidderID, GuildID: guildID, Type: "AUCTION_BID",
		Amount: -charge, BalanceAfter: newBidderBalance,
		Description: description, ReferenceID: auctionIDStr, ReferenceType: "auction",
	}); err != nil {
		return nil, nil, fmt.Errorf("%w: record bid transaction: %v", errs.ErrInternal, err)
	}

	if info.CurrentBidderID != nil && *info.CurrentBidderID != bidderID && info.CurrentBid > 0 {
		if err := refundBid(ctx, qtx, guildID, *info.CurrentBidderID, info.CurrentBid, auctionIDStr, "Outbid refund"); err != nil {
			return nil, nil, err
		}
	}

	if err := qtx.MarkAllBidsNotWinning(ctx, auctionID); err != nil {
		return nil, nil, fmt.Errorf("%w: update bids: %v", errs.ErrInternal, err)
	}

	bidRow, err := qtx.InsertBid(ctx, db.InsertBidParams{AuctionID: auctionID, BidderID: bidderID, Amount: amount})
	if err != nil {
		return nil, nil, fmt.Errorf("%w: insert bid: %v", errs.ErrInternal, err)
	}

	if err := qtx.UpdateAuctionBid(ctx, db.UpdateAuctionBidParams{
		CurrentBid: amount, CurrentBidderID: &bidderID, ID: auctionID,
	}); err != nil {
		return nil, nil, fmt.Errorf("%w: update auction: %v", errs.ErrInternal, err)
	}

	if err := pgtx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}

	a, err := s.Get(ctx, guildIDStr, auctionIDStr)
	if err != nil {
		return nil, nil, err
	}
	bid := &Bid{
		ID: bidRow.ID.String(), AuctionID: auctionIDStr, BidderID: bidderIDStr,
		BidderName: a.CurrentBidderName, BidderAvatarURL: a.CurrentBidderAvatarURL,
		Amount: amount, IsWinning: true, PlacedAt: bidRow.PlacedAt,
	}
	return a, bid, nil
}

// GetBidHistory returns paginated bid history for an auction.
func (s *Service) GetBidHistory(ctx context.Context, guildIDStr, auctionIDStr string, pageSize, offset int) (*BidHistoryResult, error) {
	pageSize = pagination.StandardSize(pageSize)
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}
	auctionID, err := uuid.Parse(auctionIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}

	exists, err := s.q.AuctionExists(ctx, db.AuctionExistsParams{ID: auctionID, GuildID: guildID})
	if err != nil || !exists {
		return nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}

	rows, err := s.q.ListBids(ctx, db.ListBidsParams{
		AuctionID: auctionID, PageSize: int32(pageSize), PageOffset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: get bid history: %v", errs.ErrInternal, err)
	}

	bids := make([]*Bid, 0, len(rows))
	for _, r := range rows {
		bids = append(bids, &Bid{
			ID: r.ID.String(), AuctionID: r.AuctionID.String(), BidderID: r.BidderID.String(),
			BidderName: r.BidderName, BidderAvatarURL: r.BidderAvatarUrl, Amount: r.Amount, IsWinning: r.IsWinning, PlacedAt: r.PlacedAt,
		})
	}

	total, _ := s.q.CountBids(ctx, auctionID)

	nextOffset := 0
	if len(bids) == pageSize {
		nextOffset = offset + pageSize
	}
	return &BidHistoryResult{Bids: bids, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

func (s *Service) Update(ctx context.Context, p UpdateParams) (*AuctionItem, error) {
	guildID, auctionID, userID, err := parseIDs(p.GuildID, p.AuctionID, p.UpdatedBy)
	if err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	current, err := lockAuction(ctx, qtx, guildID, auctionID)
	if err != nil {
		return nil, err
	}
	if err := authz.Require(ctx, s.az, guildID, userID, managePermission(current, userID)); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	if err := checkEditable(current.Status, current.EndTime, now); err != nil {
		return nil, err
	}
	next, err := applyUpdate(toAuctionItem(current), current.SourceType.String, p, now)
	if err != nil {
		return nil, err
	}
	itemJSON, err := json.Marshal(next.Item)
	if err != nil {
		return nil, fmt.Errorf("%w: marshal item: %v", errs.ErrInternal, err)
	}
	_, err = qtx.UpdateAuctionDetails(ctx, db.UpdateAuctionDetailsParams{
		Item: itemJSON, StartingBid: next.StartingBid, MinBidIncrement: next.MinBidIncrement,
		IsBlind: next.IsBlind, StartTime: next.StartTime, EndTime: next.EndTime,
		ID: auctionID, GuildID: guildID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: auction is no longer open", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: update auction: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("auction_id", p.AuctionID).Str("guild_id", p.GuildID).Str("user_id", p.UpdatedBy).Msg("auction updated")
	return s.Get(ctx, p.GuildID, p.AuctionID)
}

// Cancel cancels an open auction, refunds the escrowed highest bid and returns
// the listed item to where it came from.
func (s *Service) Cancel(ctx context.Context, guildIDStr, auctionIDStr, userIDStr string) (*AuctionItem, error) {
	guildID, auctionID, userID, err := parseIDs(guildIDStr, auctionIDStr, userIDStr)
	if err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	current, err := lockAuction(ctx, qtx, guildID, auctionID)
	if err != nil {
		return nil, err
	}
	if err := authz.Require(ctx, s.az, guildID, userID, cancelPermission(current, userID)); err != nil {
		return nil, err
	}
	if err := checkCancellable(current.Status, current.EndTime, time.Now().UTC()); err != nil {
		return nil, err
	}

	if current.CurrentBidderID != nil && current.CurrentBid > 0 {
		if err := refundBid(ctx, qtx, guildID, *current.CurrentBidderID, current.CurrentBid, auctionIDStr, "Auction cancelled refund"); err != nil {
			return nil, err
		}
	}
	if err := qtx.MarkAllBidsNotWinning(ctx, auctionID); err != nil {
		return nil, fmt.Errorf("%w: update bids: %v", errs.ErrInternal, err)
	}
	if err := inventory.Release(ctx, qtx, current.SourceType.String, current.SourceItemID, auctionHolder(auctionID)); err != nil {
		return nil, err
	}
	if err := qtx.MarkAuctionCancelled(ctx, auctionID); err != nil {
		return nil, fmt.Errorf("%w: cancel auction: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("auction_id", auctionIDStr).Str("guild_id", guildIDStr).Str("user_id", userIDStr).
		Int64("refunded", current.CurrentBid).Msg("auction cancelled")
	return s.Get(ctx, guildIDStr, auctionIDStr)
}

// Delete permanently removes a cancelled auction and its bid history.
func (s *Service) Delete(ctx context.Context, guildIDStr, auctionIDStr, userIDStr string) error {
	guildID, auctionID, userID, err := parseIDs(guildIDStr, auctionIDStr, userIDStr)
	if err != nil {
		return err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	current, err := lockAuction(ctx, qtx, guildID, auctionID)
	if err != nil {
		return err
	}
	if err := authz.Require(ctx, s.az, guildID, userID, managePermission(current, userID)); err != nil {
		return err
	}
	if err := checkDeletable(current.Status); err != nil {
		return err
	}
	n, err := qtx.DeleteCancelledAuction(ctx, db.DeleteCancelledAuctionParams{ID: auctionID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: delete auction: %v", errs.ErrInternal, err)
	}
	if n == 0 {
		return fmt.Errorf("%w: only cancelled auctions can be deleted", errs.ErrFailedPrecondition)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("auction_id", auctionIDStr).Str("guild_id", guildIDStr).Str("user_id", userIDStr).Msg("auction deleted")
	return nil
}

// --- helpers ---

func toAuctionItem(a db.Auction) *AuctionItem {
	out := &AuctionItem{
		ID: a.ID.String(), GuildID: a.GuildID.String(), SellerID: a.SellerID.String(),
		StartingBid: a.StartingBid, CurrentBid: a.CurrentBid,
		MinBidIncrement: a.MinBidIncrement, StartTime: a.StartTime, EndTime: a.EndTime,
		Status: a.Status, IsBlind: a.IsBlind, SourceType: a.SourceType.String,
		CreatedAt: a.CreatedAt, UpdatedAt: a.UpdatedAt,
	}
	if a.CancelledAt.Valid {
		cancelledAt := a.CancelledAt.Time
		out.CancelledAt = &cancelledAt
	}
	if a.CurrentBidderID != nil {
		out.CurrentBidderID = a.CurrentBidderID.String()
	}
	if len(a.Item) > 0 {
		_ = json.Unmarshal(a.Item, &out.Item)
	}
	return out
}

func withParticipants(a *AuctionItem, sellerName, sellerAvatarURL, bidderName, bidderAvatarURL string) *AuctionItem {
	a.SellerName, a.SellerAvatarURL = sellerName, sellerAvatarURL
	if a.CurrentBidderID != "" {
		a.CurrentBidderName, a.CurrentBidderAvatarURL = bidderName, bidderAvatarURL
	}
	return a
}

func lockAuction(ctx context.Context, qtx *db.Queries, guildID, auctionID uuid.UUID) (db.Auction, error) {
	a, err := qtx.LockAuction(ctx, db.LockAuctionParams{ID: auctionID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.Auction{}, fmt.Errorf("%w: auction", errs.ErrNotFound)
		}
		return db.Auction{}, fmt.Errorf("%w: load auction: %v", errs.ErrInternal, err)
	}
	return a, nil
}

func refundBid(ctx context.Context, qtx *db.Queries, guildID, bidderID uuid.UUID, amount int64, auctionID, description string) error {
	if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: bidderID, GuildID: guildID}); err != nil {
		return fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
	}
	balance, err := qtx.CreditWallet(ctx, db.CreditWalletParams{Amount: amount, UserID: bidderID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: refund bid: %v", errs.ErrInternal, err)
	}
	if _, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
		UserID: bidderID, GuildID: guildID, Type: "AUCTION_BID",
		Amount: amount, BalanceAfter: balance,
		Description: description, ReferenceID: auctionID, ReferenceType: "auction",
	}); err != nil {
		return fmt.Errorf("%w: record refund: %v", errs.ErrInternal, err)
	}
	return nil
}

func parseIDs(guildIDStr, auctionIDStr, userIDStr string) (uuid.UUID, uuid.UUID, uuid.UUID, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}
	auctionID, err := uuid.Parse(auctionIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	return guildID, auctionID, userID, nil
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
