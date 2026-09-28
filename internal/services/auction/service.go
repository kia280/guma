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

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/services/inventory"
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
	CreatedAt              time.Time
	UpdatedAt              time.Time
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
	logger zerolog.Logger
}

// New creates a new auction Service.
func New(pool *database.Pool, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{
		pool:   pool,
		q:      q,
		logger: logger.With().Str("service", "auction").Logger(),
	}
}

// List returns paginated auctions for a guild with optional filters.
func (s *Service) List(ctx context.Context, p ListParams) (*ListResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
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

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	if p.Source.BankItemID != "" {
		if err := s.requireRole(ctx, guildID, sellerID, "owner", "admin"); err != nil {
			return nil, err
		}
	}
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
	minRequired := info.CurrentBid + info.MinBidIncrement
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

	// Refund previous bidder
	if info.CurrentBidderID != nil && *info.CurrentBidderID != bidderID {
		prevID := *info.CurrentBidderID
		if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: prevID, GuildID: guildID}); err == nil {
			if prevBalance, err := qtx.GetWalletBalanceForUpdate(ctx, db.GetWalletBalanceForUpdateParams{UserID: prevID, GuildID: guildID}); err == nil {
				newPrevBalance := prevBalance + info.CurrentBid
				_ = qtx.UpdateWalletBalance(ctx, db.UpdateWalletBalanceParams{Balance: newPrevBalance, UserID: prevID, GuildID: guildID})
				_, _ = qtx.InsertTransaction(ctx, db.InsertTransactionParams{
					UserID: prevID, GuildID: guildID, Type: "AUCTION_BID",
					Amount: info.CurrentBid, BalanceAfter: newPrevBalance,
					Description: "Outbid refund", ReferenceID: auctionIDStr, ReferenceType: "auction",
				})
			}
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
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
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

// Cancel cancels an auction. Requires owner or admin role.
func (s *Service) Cancel(ctx context.Context, guildIDStr, auctionIDStr, userIDStr string) (*AuctionItem, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}
	auctionID, err := uuid.Parse(auctionIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}

	if err := s.requireRole(ctx, guildID, userID, "owner", "admin"); err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	info, err := qtx.LockAuctionForCancel(ctx, db.LockAuctionForCancelParams{ID: auctionID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: auction", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: load auction: %v", errs.ErrInternal, err)
	}
	if info.Status == "ENDED" || info.Status == "CANCELLED" {
		return nil, fmt.Errorf("%w: auction already finished", errs.ErrFailedPrecondition)
	}

	if info.CurrentBidderID != nil && info.CurrentBid > 0 {
		refundee := *info.CurrentBidderID
		if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: refundee, GuildID: guildID}); err != nil {
			return nil, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
		}
		newBal, err := qtx.CreditWallet(ctx, db.CreditWalletParams{Amount: info.CurrentBid, UserID: refundee, GuildID: guildID})
		if err != nil {
			return nil, fmt.Errorf("%w: refund bidder: %v", errs.ErrInternal, err)
		}
		if _, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
			UserID: refundee, GuildID: guildID, Type: "AUCTION_BID",
			Amount: info.CurrentBid, BalanceAfter: newBal,
			Description: "Auction cancelled refund", ReferenceID: auctionIDStr, ReferenceType: "auction",
		}); err != nil {
			return nil, fmt.Errorf("%w: record refund: %v", errs.ErrInternal, err)
		}
	}

	if err := inventory.Release(ctx, qtx, info.SourceType.String, info.SourceItemID, auctionHolder(auctionID)); err != nil {
		return nil, err
	}

	if err := qtx.UpdateAuctionStatus(ctx, db.UpdateAuctionStatusParams{
		Status: "CANCELLED", ID: auctionID,
	}); err != nil {
		return nil, fmt.Errorf("%w: cancel auction: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	return s.Get(ctx, guildIDStr, auctionIDStr)
}

// --- helpers ---

func toAuctionItem(a db.Auction) *AuctionItem {
	out := &AuctionItem{
		ID: a.ID.String(), GuildID: a.GuildID.String(), SellerID: a.SellerID.String(),
		StartingBid: a.StartingBid, CurrentBid: a.CurrentBid,
		MinBidIncrement: a.MinBidIncrement, StartTime: a.StartTime, EndTime: a.EndTime,
		Status: a.Status, IsBlind: a.IsBlind, CreatedAt: a.CreatedAt, UpdatedAt: a.UpdatedAt,
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
