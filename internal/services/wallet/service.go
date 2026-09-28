package wallet

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
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

// Wallet is the domain model for a user's guild wallet.
type Wallet struct {
	UserID       string
	GuildID      string
	Balance      int64
	Currency     string
	CreatedAt    time.Time
	UpdatedAt    time.Time
	LockedInBids int64
	LockedBids   []LockedBid
}

type LockedBid struct {
	AuctionID string
	ItemName  string
	Amount    int64
	EndTime   time.Time
}

// Transaction is the domain model for a wallet transaction.
type Transaction struct {
	ID               string
	UserID           string
	GuildID          string
	Type             string
	Amount           int64
	BalanceAfter     int64
	Description      string
	ReferenceID      string
	ReferenceType    string
	CreatedAt        time.Time
	ActorID          string
	ActorName        string
	CounterpartyID   string
	CounterpartyName string
}

// BackpackItem is the domain model for an item in a user's backpack.
type BackpackItem struct {
	ID                  string
	OwnerID             string
	GuildID             string
	Item                models.Item
	Source              string
	SourceID            string
	Note                string
	AcquiredAt          time.Time
	SourceLabel         string
	DeliveryRequestedAt *time.Time
	OwnerName           string
	Lock                *models.ItemLock
}

// ListTransactionsParams holds the inputs for ListTransactions.
type ListTransactionsParams struct {
	UserID   string
	GuildID  string
	Type     string
	PageSize int
	Offset   int
}

// ListTransactionsResult is returned by ListTransactions.
type ListTransactionsResult struct {
	Transactions []*Transaction
	TotalCount   int32
	NextOffset   int
}

// ListBackpackParams holds the inputs for ListBackpackItems.
type ListBackpackParams struct {
	OwnerID  string
	GuildID  string
	PageSize int
	Offset   int
}

// ListBackpackResult is returned by ListBackpackItems.
type ListBackpackResult struct {
	Items      []*BackpackItem
	TotalCount int32
	NextOffset int
}

// Service handles wallet business logic.
type Service struct {
	pool   *database.Pool
	q      *db.Queries
	logger zerolog.Logger
}

// New creates a new wallet Service.
func New(pool *database.Pool, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{
		pool:   pool,
		q:      q,
		logger: logger.With().Str("service", "wallet").Logger(),
	}
}

// GetWallet fetches or auto-creates a user's wallet for a guild.
func (s *Service) GetWallet(ctx context.Context, userIDStr, guildIDStr string) (*Wallet, error) {
	userID, guildID, err := parseIDs(userIDStr, guildIDStr)
	if err != nil {
		return nil, err
	}

	if err := s.q.EnsureWallet(ctx, db.EnsureWalletParams{UserID: userID, GuildID: guildID}); err != nil {
		return nil, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
	}

	w, err := s.q.GetWallet(ctx, db.GetWalletParams{UserID: userID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: wallet", errs.ErrNotFound)
	}
	bids, err := s.q.ListActiveLeadingBids(ctx, db.ListActiveLeadingBidsParams{GuildID: guildID, CurrentBidderID: &userID})
	if err != nil {
		return nil, fmt.Errorf("%w: list leading bids: %v", errs.ErrInternal, err)
	}
	wallet := &Wallet{
		UserID:     w.UserID.String(),
		GuildID:    w.GuildID.String(),
		Balance:    w.Balance,
		Currency:   w.Currency,
		CreatedAt:  w.CreatedAt,
		UpdatedAt:  w.UpdatedAt,
		LockedBids: make([]LockedBid, 0, len(bids)),
	}
	for _, b := range bids {
		wallet.LockedInBids += b.CurrentBid
		wallet.LockedBids = append(wallet.LockedBids, LockedBid{
			AuctionID: b.ID.String(), ItemName: b.ItemName, Amount: b.CurrentBid, EndTime: b.EndTime,
		})
	}
	return wallet, nil
}

// Deposit adds funds to a wallet (admin or system operation).
func (s *Service) Deposit(ctx context.Context, userIDStr, guildIDStr string, amount int64, note string) (*Transaction, *Wallet, error) {
	if amount <= 0 {
		return nil, nil, fmt.Errorf("%w: amount must be positive", errs.ErrFailedPrecondition)
	}

	w, err := s.GetWallet(ctx, userIDStr, guildIDStr)
	if err != nil {
		return nil, nil, err
	}

	userID, guildID, _ := parseIDs(userIDStr, guildIDStr)
	newBalance := w.Balance + amount

	if err := s.q.UpdateWalletBalance(ctx, db.UpdateWalletBalanceParams{
		Balance: newBalance, UserID: userID, GuildID: guildID,
	}); err != nil {
		return nil, nil, fmt.Errorf("%w: deposit: %v", errs.ErrInternal, err)
	}

	tx, err := s.insertTransaction(ctx, s.q, userID, guildID, "DEPOSIT", amount, newBalance, note, "", "")
	if err != nil {
		return nil, nil, err
	}

	w.Balance = newBalance
	w.UpdatedAt = time.Now().UTC()
	return tx, w, nil
}

// Withdraw removes funds from a wallet.
func (s *Service) Withdraw(ctx context.Context, userIDStr, guildIDStr string, amount int64, note string) (*Transaction, *Wallet, error) {
	if amount <= 0 {
		return nil, nil, fmt.Errorf("%w: amount must be positive", errs.ErrFailedPrecondition)
	}
	userID, guildID, err := parseIDs(userIDStr, guildIDStr)
	if err != nil {
		return nil, nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	balance, err := qtx.GetWalletBalanceForUpdate(ctx, db.GetWalletBalanceForUpdateParams{UserID: userID, GuildID: guildID})
	if err != nil {
		return nil, nil, fmt.Errorf("%w: wallet", errs.ErrNotFound)
	}
	if balance < amount {
		return nil, nil, fmt.Errorf("%w: insufficient funds", errs.ErrFailedPrecondition)
	}

	newBalance := balance - amount
	if err := qtx.UpdateWalletBalance(ctx, db.UpdateWalletBalanceParams{
		Balance: newBalance, UserID: userID, GuildID: guildID,
	}); err != nil {
		return nil, nil, fmt.Errorf("%w: withdraw: %v", errs.ErrInternal, err)
	}

	t, err := s.insertTransaction(ctx, qtx, userID, guildID, "WITHDRAWAL", -amount, newBalance, note, "", "")
	if err != nil {
		return nil, nil, err
	}

	if err := pgtx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}

	return t, &Wallet{
		UserID: userIDStr, GuildID: guildIDStr, Balance: newBalance, Currency: "gold", UpdatedAt: time.Now().UTC(),
	}, nil
}

// Transfer moves funds atomically between two users in the same guild.
func (s *Service) Transfer(ctx context.Context, fromUserIDStr, toUserIDStr, guildIDStr string, amount int64, note string) (*Transaction, *Wallet, error) {
	if amount <= 0 {
		return nil, nil, fmt.Errorf("%w: amount must be positive", errs.ErrFailedPrecondition)
	}
	fromUserID, err := uuid.Parse(fromUserIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: sender", errs.ErrInvalidArgument)
	}
	toUserID, err := uuid.Parse(toUserIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: recipient", errs.ErrInvalidArgument)
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	for _, uid := range []uuid.UUID{fromUserID, toUserID} {
		if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: uid, GuildID: guildID}); err != nil {
			return nil, nil, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
		}
	}

	fromBalance, err := qtx.GetWalletBalanceForUpdate(ctx, db.GetWalletBalanceForUpdateParams{UserID: fromUserID, GuildID: guildID})
	if err != nil {
		return nil, nil, fmt.Errorf("%w: sender wallet", errs.ErrNotFound)
	}
	if fromBalance < amount {
		return nil, nil, fmt.Errorf("%w: insufficient funds", errs.ErrFailedPrecondition)
	}
	toBalance, err := qtx.GetWalletBalanceForUpdate(ctx, db.GetWalletBalanceForUpdateParams{UserID: toUserID, GuildID: guildID})
	if err != nil {
		return nil, nil, fmt.Errorf("%w: recipient wallet", errs.ErrNotFound)
	}

	newFromBalance := fromBalance - amount
	newToBalance := toBalance + amount

	if err := qtx.UpdateWalletBalance(ctx, db.UpdateWalletBalanceParams{Balance: newFromBalance, UserID: fromUserID, GuildID: guildID}); err != nil {
		return nil, nil, fmt.Errorf("%w: deduct: %v", errs.ErrInternal, err)
	}
	if err := qtx.UpdateWalletBalance(ctx, db.UpdateWalletBalanceParams{Balance: newToBalance, UserID: toUserID, GuildID: guildID}); err != nil {
		return nil, nil, fmt.Errorf("%w: credit: %v", errs.ErrInternal, err)
	}

	desc := note
	if desc == "" {
		desc = "Transfer"
	}

	outTx, err := s.insertTransaction(ctx, qtx, fromUserID, guildID, "TRANSFER_OUT", -amount, newFromBalance, desc, "", "")
	if err != nil {
		return nil, nil, err
	}
	_, _ = s.insertTransaction(ctx, qtx, toUserID, guildID, "TRANSFER_IN", amount, newToBalance, desc, "", "")

	if err := pgtx.Commit(ctx); err != nil {
		return nil, nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}

	return outTx, &Wallet{
		UserID: fromUserIDStr, GuildID: guildIDStr, Balance: newFromBalance, Currency: "gold", UpdatedAt: time.Now().UTC(),
	}, nil
}

// ListTransactions returns paginated transactions for a user in a guild.
func (s *Service) ListTransactions(ctx context.Context, p ListTransactionsParams) (*ListTransactionsResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	userID, guildID, err := parseIDs(p.UserID, p.GuildID)
	if err != nil {
		return nil, err
	}

	rows, err := s.q.ListWalletTransactions(ctx, db.ListWalletTransactionsParams{
		UserID:     userID,
		GuildID:    guildID,
		TypeFilter: p.Type,
		PageSize:   int32(pageSize),
		PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list transactions: %v", errs.ErrInternal, err)
	}

	txns := make([]*Transaction, 0, len(rows))
	for _, r := range rows {
		refID := ""
		if r.ReferenceID != nil {
			refID = r.ReferenceID.String()
		}
		txns = append(txns, &Transaction{
			ID: r.ID.String(), UserID: r.UserID.String(), GuildID: r.GuildID.String(),
			Type: r.Type, Amount: r.Amount, BalanceAfter: r.BalanceAfter,
			Description: r.Description, ReferenceID: refID, ReferenceType: r.ReferenceType,
			CreatedAt: r.CreatedAt, ActorID: uuidString(r.ActorID), ActorName: r.ActorName,
			CounterpartyID: uuidString(r.CounterpartyID), CounterpartyName: r.CounterpartyName,
		})
	}

	total, _ := s.q.CountWalletTransactions(ctx, db.CountWalletTransactionsParams{
		UserID: userID, GuildID: guildID, TypeFilter: p.Type,
	})

	nextOffset := 0
	if len(txns) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListTransactionsResult{Transactions: txns, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// ListBackpackItems returns paginated backpack items for a user in a guild.
func (s *Service) ListBackpackItems(ctx context.Context, p ListBackpackParams) (*ListBackpackResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	ownerID, guildID, err := parseIDs(p.OwnerID, p.GuildID)
	if err != nil {
		return nil, err
	}

	rows, err := s.q.ListBackpackItems(ctx, db.ListBackpackItemsParams{
		OwnerID: ownerID, GuildID: guildID,
		PageSize: int32(pageSize), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list backpack: %v", errs.ErrInternal, err)
	}

	items := make([]*BackpackItem, 0, len(rows))
	for _, r := range rows {
		item := toBackpackItem(r.ID, r.OwnerID, r.GuildID, r.Item, r.Source, r.SourceID, r.Note, r.AcquiredAt)
		item.SourceLabel = r.SourceLabel
		item.DeliveryRequestedAt = timestampPtr(r.DeliveryRequestedAt)
		item.Lock = models.NewItemLock(r.LockedByType, r.LockedByID)
		items = append(items, item)
	}

	total, _ := s.q.CountBackpackItems(ctx, db.CountBackpackItemsParams{OwnerID: ownerID, GuildID: guildID})

	nextOffset := 0
	if len(items) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListBackpackResult{Items: items, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

func (s *Service) TransferBackpackItem(ctx context.Context, fromUserIDStr, guildIDStr, itemIDStr, toUserIDStr, note string) (*BackpackItem, error) {
	fromUserID, guildID, err := parseIDs(fromUserIDStr, guildIDStr)
	if err != nil {
		return nil, err
	}
	itemID, err := uuid.Parse(itemIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: backpack item", errs.ErrNotFound)
	}
	toUserID, err := uuid.Parse(toUserIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: recipient", errs.ErrInvalidArgument)
	}
	if toUserID == fromUserID {
		return nil, fmt.Errorf("%w: cannot transfer an item to yourself", errs.ErrInvalidArgument)
	}
	note = strings.TrimSpace(note)
	if len([]rune(note)) > maxTransferNoteLength {
		return nil, fmt.Errorf("%w: note is too long", errs.ErrInvalidArgument)
	}
	if _, err := s.q.GetGuildMemberRole(ctx, db.GetGuildMemberRoleParams{GuildID: guildID, UserID: toUserID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: recipient is not a guild member", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: load recipient: %v", errs.ErrInternal, err)
	}

	row, err := s.q.TransferBackpackItem(ctx, db.TransferBackpackItemParams{
		ToUserID: toUserID, FromUserID: &fromUserID, Note: note, ID: itemID, GuildID: guildID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: backpack item", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: transfer item: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("backpack_item_id", itemIDStr).Str("from", fromUserIDStr).Str("to", toUserIDStr).Msg("backpack item transferred")
	return toBackpackItem(row.ID, row.OwnerID, row.GuildID, row.Item, row.Source, row.SourceID, row.Note, row.AcquiredAt), nil
}

const maxTransferNoteLength = 200

// --- helpers ---

func parseIDs(userIDStr, guildIDStr string) (uuid.UUID, uuid.UUID, error) {
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	return userID, guildID, nil
}

func uuidString(id *uuid.UUID) string {
	if id == nil {
		return ""
	}
	return id.String()
}

func toBackpackItem(id, ownerID, guildID uuid.UUID, itemJSON []byte, source string, sourceID *uuid.UUID, note string, acquiredAt time.Time) *BackpackItem {
	bi := &BackpackItem{
		ID: id.String(), OwnerID: ownerID.String(), GuildID: guildID.String(),
		Source: source, Note: note, AcquiredAt: acquiredAt,
	}
	if sourceID != nil {
		bi.SourceID = sourceID.String()
	}
	if len(itemJSON) > 0 {
		_ = json.Unmarshal(itemJSON, &bi.Item)
	}
	return bi
}

func (s *Service) insertTransaction(ctx context.Context, q *db.Queries, userID, guildID uuid.UUID, txType string, amount, balanceAfter int64, desc, refID, refType string) (*Transaction, error) {
	t := &Transaction{
		UserID: userID.String(), GuildID: guildID.String(), Type: txType,
		Amount: amount, BalanceAfter: balanceAfter, Description: desc,
		ReferenceID: refID, ReferenceType: refType, CreatedAt: time.Now().UTC(),
	}
	id, err := q.InsertTransaction(ctx, db.InsertTransactionParams{
		UserID: userID, GuildID: guildID, Type: txType, Amount: amount, BalanceAfter: balanceAfter,
		Description: desc, ReferenceID: refID, ReferenceType: refType,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: record transaction: %v", errs.ErrInternal, err)
	}
	t.ID = id.String()
	return t, nil
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
