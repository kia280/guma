package raffle

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/rs/zerolog"

	"github.com/kia280/guma/internal/database"
	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/services/inventory"
)

// RafflePrize is a prize tier in a raffle.
type RafflePrize struct {
	Rank         int32
	Description  string
	Amount       int64
	Item         *models.Item
	Source       inventory.Ref `json:"-"`
	SourceType   string        `json:",omitempty"`
	SourceItemID *uuid.UUID    `json:",omitempty"`
}

// Raffle is the domain model for a raffle.
type Raffle struct {
	ID                string
	GuildID           string
	CreatedBy         string
	Title             string
	Description       string
	TicketPrice       int64
	TicketsSold       int32
	MaxTickets        int32
	MaxTicketsPerUser int32
	Status            string
	DrawDate          string
	Prizes            []RafflePrize
	Winners           []*RaffleWinner
	CreatedAt         time.Time
	UpdatedAt         time.Time
	CancelledAt       *time.Time
}

// RaffleTicket is the domain model for a raffle ticket.
type RaffleTicket struct {
	ID           string
	RaffleID     string
	UserID       string
	TicketNumber string
	PurchasedAt  time.Time
}

// RaffleWinner is the domain model for a raffle winner.
type RaffleWinner struct {
	ID               string
	RaffleID         string
	UserID           string
	Username         string
	AvatarURL        string
	Rank             int32
	PrizeAmount      int64
	PrizeDescription string
	TicketNumber     string
}

// ListParams holds the inputs for List.
type ListParams struct {
	GuildID  string
	Status   string
	PageSize int
	Offset   int
}

// ListResult is returned by List.
type ListResult struct {
	Raffles    []*Raffle
	TotalCount int32
	NextOffset int
}

// CreateParams holds the inputs for Create.
type CreateParams struct {
	GuildID           string
	CreatedBy         string
	Title             string
	Description       string
	TicketPrice       int64
	MaxTickets        int32
	MaxTicketsPerUser int32
	DrawDate          string
	Prizes            []RafflePrize
}

type UpdateParams struct {
	GuildID           string
	RaffleID          string
	UpdatedBy         string
	Title             *string
	Description       *string
	DrawDate          string
	TicketPrice       *int64
	MaxTickets        *int32
	MaxTicketsPerUser *int32
}

// ListTicketsResult is returned by ListMyTickets.
type ListTicketsResult struct {
	Tickets    []*RaffleTicket
	TotalCount int32
	NextOffset int
}

// raffleRow is the common subset of fields from raffle queries.
type raffleRow struct {
	ID                uuid.UUID
	GuildID           uuid.UUID
	CreatedBy         uuid.UUID
	Title             string
	Description       string
	TicketPrice       int64
	TicketsSold       int32
	MaxTickets        int32
	MaxTicketsPerUser int32
	Status            string
	DrawDate          string
	Prizes            []byte
	CreatedAt         time.Time
	UpdatedAt         time.Time
	CancelledAt       pgtype.Timestamptz
}

// Service handles raffle business logic.
type Service struct {
	pool   *database.Pool
	q      *db.Queries
	logger zerolog.Logger
}

// New creates a new raffle Service.
func New(pool *database.Pool, logger zerolog.Logger) *Service {
	var q *db.Queries
	if pool != nil {
		q = db.New(pool.Pool)
	}
	return &Service{
		pool:   pool,
		q:      q,
		logger: logger.With().Str("service", "raffle").Logger(),
	}
}

// List returns paginated raffles for a guild.
func (s *Service) List(ctx context.Context, p ListParams) (*ListResult, error) {
	pageSize := p.PageSize
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}

	rows, err := s.q.ListRaffles(ctx, db.ListRafflesParams{
		GuildID: guildID, StatusFilter: p.Status,
		PageSize: int32(pageSize), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list raffles: %v", errs.ErrInternal, err)
	}

	raffles := make([]*Raffle, 0, len(rows))
	for _, r := range rows {
		l := toRaffle(raffleRow(r))
		if s.drawIfDue(ctx, guildID, r.ID, r.Status, r.DrawDate) {
			if fresh, err := s.q.GetRaffle(ctx, db.GetRaffleParams{ID: r.ID, GuildID: guildID}); err == nil {
				l = toRaffle(raffleRow(fresh))
			}
		}
		l.Winners, _ = s.getWinners(ctx, r.ID)
		raffles = append(raffles, l)
	}

	total, _ := s.q.CountRaffles(ctx, db.CountRafflesParams{GuildID: guildID, StatusFilter: p.Status})

	nextOffset := 0
	if len(raffles) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListResult{Raffles: raffles, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// Get fetches a single raffle by ID.
func (s *Service) Get(ctx context.Context, guildIDStr, raffleIDStr string) (*Raffle, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	raffleID, err := uuid.Parse(raffleIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	r, err := s.q.GetRaffle(ctx, db.GetRaffleParams{ID: raffleID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	if s.drawIfDue(ctx, guildID, raffleID, r.Status, r.DrawDate) {
		if r, err = s.q.GetRaffle(ctx, db.GetRaffleParams{ID: raffleID, GuildID: guildID}); err != nil {
			return nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
		}
	}
	l := toRaffle(raffleRow(r))
	l.Winners, _ = s.getWinners(ctx, raffleID)
	return l, nil
}

// Create inserts a new raffle. Requires admin role.
func (s *Service) Create(ctx context.Context, p CreateParams) (*Raffle, error) {
	guildID, err := uuid.Parse(p.GuildID)
	if err != nil {
		return nil, fmt.Errorf("%w: guild", errs.ErrInvalidArgument)
	}
	createdBy, err := uuid.Parse(p.CreatedBy)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, createdBy, "owner", "admin"); err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	raffleID := uuid.New()
	for i := range p.Prizes {
		prize := &p.Prizes[i]
		locked, err := inventory.Lock(ctx, qtx, guildID, createdBy, prize.Source, raffleHolder(raffleID), "Offered as a raffle prize")
		if err != nil {
			return nil, err
		}
		if locked == nil {
			continue
		}
		item := locked.Item
		prize.Item = &item
		prize.Amount = 0
		prize.SourceType = locked.SourceType
		prize.SourceItemID = &locked.ItemID
		if prize.Description == "" {
			prize.Description = item.Name
		}
	}

	prizesJSON, err := json.Marshal(p.Prizes)
	if err != nil {
		return nil, fmt.Errorf("%w: encode prizes: %v", errs.ErrInternal, err)
	}

	r, err := qtx.CreateRaffle(ctx, db.CreateRaffleParams{
		ID: raffleID, GuildID: guildID, CreatedBy: createdBy,
		Title: p.Title, Description: p.Description,
		TicketPrice: p.TicketPrice, MaxTickets: p.MaxTickets, MaxTicketsPerUser: p.MaxTicketsPerUser,
		DrawDate: p.DrawDate, Prizes: prizesJSON,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: create raffle: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	l := toRaffle(raffleRow(r))
	s.logger.Info().Str("raffle_id", l.ID).Str("guild_id", p.GuildID).Msg("raffle created")
	return l, nil
}

// PurchaseTickets deducts cost from wallet and issues tickets.
func (s *Service) PurchaseTickets(ctx context.Context, guildIDStr, raffleIDStr, userIDStr string, quantity int32) ([]*RaffleTicket, int64, error) {
	if quantity <= 0 {
		return nil, 0, fmt.Errorf("%w: quantity must be positive", errs.ErrFailedPrecondition)
	}
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, 0, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	raffleID, err := uuid.Parse(raffleIDStr)
	if err != nil {
		return nil, 0, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, 0, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	info, err := qtx.LockRaffleForPurchase(ctx, db.LockRaffleForPurchaseParams{ID: raffleID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, 0, fmt.Errorf("%w: raffle", errs.ErrNotFound)
		}
		return nil, 0, fmt.Errorf("%w: load raffle: %v", errs.ErrInternal, err)
	}
	if err := checkOpen(info.Status, info.DrawDate, time.Now()); err != nil {
		return nil, 0, err
	}
	if info.MaxTickets > 0 && info.TicketsSold+quantity > info.MaxTickets {
		return nil, 0, fmt.Errorf("%w: not enough tickets available", errs.ErrFailedPrecondition)
	}

	if info.MaxTicketsPerUser > 0 {
		n, err := qtx.CountUserTicketsForRaffle(ctx, db.CountUserTicketsForRaffleParams{RaffleID: raffleID, UserID: userID})
		if err != nil {
			return nil, 0, fmt.Errorf("%w: count tickets: %v", errs.ErrInternal, err)
		}
		if int32(n)+quantity > info.MaxTicketsPerUser {
			return nil, 0, fmt.Errorf("%w: ticket limit per user exceeded", errs.ErrFailedPrecondition)
		}
	}

	totalCost := info.TicketPrice * int64(quantity)

	if err := qtx.EnsureWalletDefault(ctx, db.EnsureWalletDefaultParams{UserID: userID, GuildID: guildID}); err != nil {
		return nil, 0, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
	}
	balance, err := qtx.GetWalletBalanceForUpdate(ctx, db.GetWalletBalanceForUpdateParams{UserID: userID, GuildID: guildID})
	if err != nil {
		return nil, 0, fmt.Errorf("%w: wallet", errs.ErrNotFound)
	}
	if balance < totalCost {
		return nil, 0, fmt.Errorf("%w: insufficient funds", errs.ErrFailedPrecondition)
	}
	newBalance := balance - totalCost
	if err := qtx.UpdateWalletBalance(ctx, db.UpdateWalletBalanceParams{Balance: newBalance, UserID: userID, GuildID: guildID}); err != nil {
		return nil, 0, fmt.Errorf("%w: deduct: %v", errs.ErrInternal, err)
	}
	if _, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
		UserID: userID, GuildID: guildID, Type: "RAFFLE_TICKET",
		Amount: -totalCost, BalanceAfter: newBalance,
		Description: "Raffle ticket purchase", ReferenceID: raffleIDStr, ReferenceType: "raffle",
	}); err != nil {
		return nil, 0, fmt.Errorf("%w: record transaction: %v", errs.ErrInternal, err)
	}

	tickets := make([]*RaffleTicket, 0, quantity)
	for i := int32(0); i < quantity; i++ {
		ticketNum := fmt.Sprintf("%s-%06d", raffleIDStr[:8], rand.Intn(1000000))
		tr, err := qtx.InsertRaffleTicket(ctx, db.InsertRaffleTicketParams{
			RaffleID: raffleID, UserID: userID, TicketNumber: ticketNum,
		})
		if err != nil {
			return nil, 0, fmt.Errorf("%w: insert ticket: %v", errs.ErrInternal, err)
		}
		tickets = append(tickets, &RaffleTicket{
			ID: tr.ID.String(), RaffleID: raffleIDStr, UserID: userIDStr,
			TicketNumber: ticketNum, PurchasedAt: tr.PurchasedAt,
		})
	}

	if err := qtx.IncrementTicketsSold(ctx, db.IncrementTicketsSoldParams{N: quantity, ID: raffleID}); err != nil {
		return nil, 0, fmt.Errorf("%w: update tickets_sold: %v", errs.ErrInternal, err)
	}

	if err := pgtx.Commit(ctx); err != nil {
		return nil, 0, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	return tickets, totalCost, nil
}

// GetWinners returns the winners for a raffle.
func (s *Service) GetWinners(ctx context.Context, guildIDStr, raffleIDStr string) ([]*RaffleWinner, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	raffleID, err := uuid.Parse(raffleIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	exists, err := s.q.RaffleExists(ctx, db.RaffleExistsParams{ID: raffleID, GuildID: guildID})
	if err != nil || !exists {
		return nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	l, err := s.Get(ctx, guildIDStr, raffleIDStr)
	if err != nil {
		return nil, err
	}
	return l.Winners, nil
}

// Draw randomly selects winners and distributes prizes.
func (s *Service) Draw(ctx context.Context, guildIDStr, raffleIDStr, callerIDStr string) (*Raffle, []*RaffleWinner, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	raffleID, err := uuid.Parse(raffleIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	callerID, err := uuid.Parse(callerIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	if err := s.requireRole(ctx, guildID, callerID, "owner", "admin"); err != nil {
		return nil, nil, err
	}

	winners, err := s.draw(ctx, guildID, raffleID, false)
	if err != nil {
		return nil, nil, err
	}

	l, err := s.Get(ctx, guildIDStr, raffleIDStr)
	if err != nil {
		return nil, nil, err
	}
	s.logger.Info().Str("raffle_id", raffleIDStr).Int("winners", len(winners)).Msg("raffle drawn")
	return l, winners, nil
}

func (s *Service) draw(ctx context.Context, guildID, raffleID uuid.UUID, allowEmpty bool) ([]*RaffleWinner, error) {
	raffleIDStr := raffleID.String()

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	info, err := qtx.GetRaffleForDraw(ctx, db.GetRaffleForDrawParams{ID: raffleID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	switch info.Status {
	case statusEnded:
		return nil, fmt.Errorf("%w: raffle already drawn", errs.ErrFailedPrecondition)
	case statusCancelled:
		return nil, fmt.Errorf("%w: raffle is cancelled", errs.ErrFailedPrecondition)
	}

	var prizeList []RafflePrize
	if len(info.Prizes) > 0 {
		_ = json.Unmarshal(info.Prizes, &prizeList)
	}

	allTickets, err := qtx.ListAllRaffleTickets(ctx, raffleID)
	if err != nil {
		return nil, fmt.Errorf("%w: fetch tickets: %v", errs.ErrInternal, err)
	}
	if len(allTickets) == 0 {
		if !allowEmpty {
			return nil, fmt.Errorf("%w: no tickets sold", errs.ErrFailedPrecondition)
		}
		if err := releaseUnawardedPrizes(ctx, qtx, raffleID, prizeList, 0); err != nil {
			return nil, err
		}
		if err := qtx.EndRaffle(ctx, raffleID); err != nil {
			return nil, fmt.Errorf("%w: end raffle: %v", errs.ErrInternal, err)
		}
		if err := pgtx.Commit(ctx); err != nil {
			return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
		}
		return nil, nil
	}

	rand.Shuffle(len(allTickets), func(i, j int) { allTickets[i], allTickets[j] = allTickets[j], allTickets[i] })

	numPrizes := len(prizeList)
	if numPrizes == 0 {
		numPrizes = 1
	}

	var winners []*RaffleWinner
	usedUsers := map[uuid.UUID]bool{}
	prizeIdx := 0

	for _, t := range allTickets {
		if prizeIdx >= numPrizes {
			break
		}
		if usedUsers[t.UserID] {
			continue
		}
		usedUsers[t.UserID] = true

		prize := RafflePrize{}
		if prizeIdx < len(prizeList) {
			prize = prizeList[prizeIdx]
		}

		winnerInfo, _ := qtx.GetUserUsernameAndAvatar(ctx, db.GetUserUsernameAndAvatarParams{GuildID: guildID, UserID: t.UserID})

		winnerID, err := qtx.InsertRaffleWinner(ctx, db.InsertRaffleWinnerParams{
			RaffleID: raffleID, UserID: t.UserID,
			Rank: int32(prizeIdx + 1), PrizeAmount: prize.Amount,
			PrizeDescription: prize.Description, TicketNumber: t.TicketNumber,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: insert winner: %v", errs.ErrInternal, err)
		}

		if err := awardPrize(ctx, qtx, guildID, raffleID, t.UserID, prize); err != nil {
			return nil, err
		}

		winners = append(winners, &RaffleWinner{
			ID: winnerID.String(), RaffleID: raffleIDStr, UserID: t.UserID.String(),
			Username: winnerInfo.Username, AvatarURL: winnerInfo.AvatarUrl,
			Rank: int32(prizeIdx + 1), PrizeAmount: prize.Amount,
			PrizeDescription: prize.Description, TicketNumber: t.TicketNumber,
		})
		prizeIdx++
	}

	if err := releaseUnawardedPrizes(ctx, qtx, raffleID, prizeList, prizeIdx); err != nil {
		return nil, err
	}
	if err := creditTicketRevenue(ctx, qtx, guildID, raffleID, info, int64(len(allTickets))); err != nil {
		return nil, err
	}

	if err := qtx.EndRaffle(ctx, raffleID); err != nil {
		return nil, fmt.Errorf("%w: end raffle: %v", errs.ErrInternal, err)
	}

	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	return winners, nil
}

func awardPrize(ctx context.Context, qtx *db.Queries, guildID, raffleID, winnerID uuid.UUID, prize RafflePrize) error {
	if prize.Amount > 0 {
		if err := qtx.EnsureWalletDefault(ctx, db.EnsureWalletDefaultParams{UserID: winnerID, GuildID: guildID}); err != nil {
			return fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
		}
		balance, err := qtx.CreditWallet(ctx, db.CreditWalletParams{Amount: prize.Amount, UserID: winnerID, GuildID: guildID})
		if err != nil {
			return fmt.Errorf("%w: credit prize: %v", errs.ErrInternal, err)
		}
		if _, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
			UserID: winnerID, GuildID: guildID, Type: "RAFFLE_WIN",
			Amount: prize.Amount, BalanceAfter: balance,
			Description: "Raffle prize", ReferenceID: raffleID.String(), ReferenceType: "raffle",
		}); err != nil {
			return fmt.Errorf("%w: record prize: %v", errs.ErrInternal, err)
		}
	}

	itemJSON, err := inventory.Consume(ctx, qtx, prize.SourceType, prize.SourceItemID, raffleHolder(raffleID))
	if err != nil {
		return err
	}
	itemID := prize.SourceItemID
	if itemJSON == nil {
		itemID = nil
		item, ok := prizeItem(prize)
		if !ok {
			return nil
		}
		if itemJSON, err = json.Marshal(item); err != nil {
			return fmt.Errorf("%w: encode prize item: %v", errs.ErrInternal, err)
		}
	}
	if _, err := qtx.InsertBackpackItem(ctx, db.InsertBackpackItemParams{
		ID: itemID, OwnerID: winnerID, GuildID: guildID, Item: itemJSON,
		Source: "raffle", SourceID: &raffleID,
	}); err != nil {
		return fmt.Errorf("%w: deliver prize item: %v", errs.ErrInternal, err)
	}
	return nil
}

func prizeItem(prize RafflePrize) (models.Item, bool) {
	if prize.Item != nil && prize.Item.Name != "" {
		return *prize.Item, true
	}
	if prize.Amount == 0 && strings.TrimSpace(prize.Description) != "" {
		return models.Item{Name: strings.TrimSpace(prize.Description), Category: "misc", Rarity: "common"}, true
	}
	return models.Item{}, false
}

func creditTicketRevenue(ctx context.Context, qtx *db.Queries, guildID, raffleID uuid.UUID, info db.GetRaffleForDrawRow, tickets int64) error {
	revenue := info.TicketPrice * tickets
	if revenue <= 0 {
		return nil
	}
	if err := qtx.EnsureGuildBank(ctx, guildID); err != nil {
		return fmt.Errorf("%w: ensure guild bank: %v", errs.ErrInternal, err)
	}
	if err := qtx.CreditGuildBank(ctx, db.CreditGuildBankParams{Amount: revenue, GuildID: guildID}); err != nil {
		return fmt.Errorf("%w: credit ticket revenue: %v", errs.ErrInternal, err)
	}
	creatorName, _ := qtx.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: info.CreatedBy})
	if err := qtx.InsertBankProceeds(ctx, db.InsertBankProceedsParams{
		GuildID: guildID, UserID: info.CreatedBy, Username: creatorName,
		Amount: revenue, Note: info.Title, Kind: "raffle_revenue",
		ReferenceType: "raffle", ReferenceID: raffleID,
	}); err != nil {
		return fmt.Errorf("%w: record ticket revenue: %v", errs.ErrInternal, err)
	}
	return nil
}

func releaseUnawardedPrizes(ctx context.Context, qtx *db.Queries, raffleID uuid.UUID, prizes []RafflePrize, awarded int) error {
	for i := awarded; i < len(prizes); i++ {
		if err := inventory.Release(ctx, qtx, prizes[i].SourceType, prizes[i].SourceItemID, raffleHolder(raffleID)); err != nil {
			return err
		}
	}
	return nil
}

func raffleHolder(id uuid.UUID) inventory.Holder {
	return inventory.Holder{Type: inventory.HolderRaffle, ID: id}
}

func (s *Service) drawIfDue(ctx context.Context, guildID, raffleID uuid.UUID, status, drawDate string) bool {
	if !isOpenStatus(status) || !isDue(drawDate, time.Now()) {
		return false
	}
	return s.drawScheduled(ctx, guildID, raffleID)
}

const dueRaffleBatchSize = 100

func (s *Service) DrawDueRaffles(ctx context.Context) (int, error) {
	rows, err := s.q.ListDueRaffles(ctx, dueRaffleBatchSize)
	if err != nil {
		return 0, fmt.Errorf("list due raffles: %w", err)
	}
	drawn := 0
	for _, r := range rows {
		if ctx.Err() != nil {
			return drawn, ctx.Err()
		}
		if s.drawScheduled(ctx, r.GuildID, r.ID) {
			drawn++
		}
	}
	return drawn, nil
}

func (s *Service) drawScheduled(ctx context.Context, guildID, raffleID uuid.UUID) bool {
	winners, err := s.draw(ctx, guildID, raffleID, true)
	if errors.Is(err, errs.ErrFailedPrecondition) {
		return true
	}
	if err != nil {
		s.logger.Error().Err(err).Str("raffle_id", raffleID.String()).Msg("scheduled raffle draw failed")
		return false
	}
	s.logger.Info().Str("raffle_id", raffleID.String()).Int("winners", len(winners)).Msg("scheduled raffle drawn")
	return true
}

func isDue(drawDate string, now time.Time) bool {
	at, err := time.Parse(time.RFC3339, drawDate)
	return err == nil && !now.Before(at)
}

func (s *Service) Update(ctx context.Context, p UpdateParams) (*Raffle, error) {
	now := time.Now()
	if err := validateUpdate(p, now); err != nil {
		return nil, err
	}
	guildID, raffleID, callerID, err := parseIDs(p.GuildID, p.RaffleID, p.UpdatedBy)
	if err != nil {
		return nil, err
	}
	if err := s.requireRole(ctx, guildID, callerID, "owner", "admin"); err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	current, err := lockRaffle(ctx, qtx, guildID, raffleID)
	if err != nil {
		return nil, err
	}
	if err := checkEditable(current.Status, current.DrawDate, now); err != nil {
		return nil, err
	}
	params, err := applyUpdate(current, p)
	if err != nil {
		return nil, err
	}
	params.ID, params.GuildID = raffleID, guildID

	r, err := qtx.UpdateRaffle(ctx, params)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: raffle is no longer open", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: update raffle: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	l := toRaffle(raffleRow(r))
	l.Winners = []*RaffleWinner{}
	s.logger.Info().Str("raffle_id", l.ID).Str("guild_id", l.GuildID).Str("user_id", p.UpdatedBy).Msg("raffle updated")
	return l, nil
}

// Cancel cancels an undrawn raffle, refunds every ticket to its buyer and
// returns item prizes to where they came from.
func (s *Service) Cancel(ctx context.Context, guildIDStr, raffleIDStr, callerIDStr string) (*Raffle, error) {
	guildID, raffleID, callerID, err := parseIDs(guildIDStr, raffleIDStr, callerIDStr)
	if err != nil {
		return nil, err
	}
	if err := s.requireRole(ctx, guildID, callerID, "owner", "admin"); err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	current, err := lockRaffle(ctx, qtx, guildID, raffleID)
	if err != nil {
		return nil, err
	}
	if err := checkCancellable(current.Status, current.DrawDate, time.Now()); err != nil {
		return nil, err
	}

	holders, err := qtx.ListRaffleTicketHolders(ctx, raffleID)
	if err != nil {
		return nil, fmt.Errorf("%w: list ticket holders: %v", errs.ErrInternal, err)
	}
	var refunded int64
	for _, h := range holders {
		amount := current.TicketPrice * int64(h.Tickets)
		if err := refundTickets(ctx, qtx, guildID, raffleID, h.UserID, amount); err != nil {
			return nil, err
		}
		refunded += amount
	}

	var prizes []RafflePrize
	if len(current.Prizes) > 0 {
		if err := json.Unmarshal(current.Prizes, &prizes); err != nil {
			return nil, fmt.Errorf("%w: decode prizes: %v", errs.ErrInternal, err)
		}
	}
	if err := releaseUnawardedPrizes(ctx, qtx, raffleID, prizes, 0); err != nil {
		return nil, err
	}
	if err := qtx.MarkRaffleCancelled(ctx, raffleID); err != nil {
		return nil, fmt.Errorf("%w: cancel raffle: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("raffle_id", raffleIDStr).Str("guild_id", guildIDStr).Str("user_id", callerIDStr).
		Int("ticket_holders", len(holders)).Int64("refunded", refunded).Msg("raffle cancelled")
	return s.Get(ctx, guildIDStr, raffleIDStr)
}

// Delete permanently removes a cancelled raffle together with its tickets.
func (s *Service) Delete(ctx context.Context, guildIDStr, raffleIDStr, callerIDStr string) error {
	guildID, raffleID, callerID, err := parseIDs(guildIDStr, raffleIDStr, callerIDStr)
	if err != nil {
		return err
	}
	if err := s.requireRole(ctx, guildID, callerID, "owner", "admin"); err != nil {
		return err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	current, err := lockRaffle(ctx, qtx, guildID, raffleID)
	if err != nil {
		return err
	}
	if err := checkDeletable(current.Status); err != nil {
		return err
	}
	n, err := qtx.DeleteCancelledRaffle(ctx, db.DeleteCancelledRaffleParams{ID: raffleID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: delete raffle: %v", errs.ErrInternal, err)
	}
	if n == 0 {
		return fmt.Errorf("%w: only cancelled raffles can be deleted", errs.ErrFailedPrecondition)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("raffle_id", raffleIDStr).Str("guild_id", guildIDStr).Str("user_id", callerIDStr).Msg("raffle deleted")
	return nil
}

func refundTickets(ctx context.Context, qtx *db.Queries, guildID, raffleID, userID uuid.UUID, amount int64) error {
	if amount <= 0 {
		return nil
	}
	if err := qtx.EnsureWalletDefault(ctx, db.EnsureWalletDefaultParams{UserID: userID, GuildID: guildID}); err != nil {
		return fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
	}
	balance, err := qtx.CreditWallet(ctx, db.CreditWalletParams{Amount: amount, UserID: userID, GuildID: guildID})
	if err != nil {
		return fmt.Errorf("%w: refund tickets: %v", errs.ErrInternal, err)
	}
	if _, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
		UserID: userID, GuildID: guildID, Type: "RAFFLE_TICKET",
		Amount: amount, BalanceAfter: balance,
		Description: "Raffle cancelled refund", ReferenceID: raffleID.String(), ReferenceType: "raffle",
	}); err != nil {
		return fmt.Errorf("%w: record refund: %v", errs.ErrInternal, err)
	}
	return nil
}

func lockRaffle(ctx context.Context, qtx *db.Queries, guildID, raffleID uuid.UUID) (db.LockRaffleRow, error) {
	l, err := qtx.LockRaffle(ctx, db.LockRaffleParams{ID: raffleID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return db.LockRaffleRow{}, fmt.Errorf("%w: raffle", errs.ErrNotFound)
		}
		return db.LockRaffleRow{}, fmt.Errorf("%w: load raffle: %v", errs.ErrInternal, err)
	}
	return l, nil
}

func parseIDs(guildIDStr, raffleIDStr, userIDStr string) (uuid.UUID, uuid.UUID, uuid.UUID, error) {
	guildID, err := uuid.Parse(guildIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	raffleID, err := uuid.Parse(raffleIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("%w: raffle", errs.ErrNotFound)
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return uuid.Nil, uuid.Nil, uuid.Nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}
	return guildID, raffleID, userID, nil
}

// ListMyTickets returns tickets owned by a user across all guilds (or filtered by guild).
func (s *Service) ListMyTickets(ctx context.Context, userIDStr, guildIDStr string, pageSize, offset int) (*ListTicketsResult, error) {
	if pageSize <= 0 || pageSize > 100 {
		pageSize = 20
	}
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: user", errs.ErrInvalidArgument)
	}

	rows, err := s.q.ListUserTickets(ctx, db.ListUserTicketsParams{
		UserID: userID, GuildFilter: guildIDStr,
		PageSize: int32(pageSize), PageOffset: int32(offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list tickets: %v", errs.ErrInternal, err)
	}

	tickets := make([]*RaffleTicket, 0, len(rows))
	for _, r := range rows {
		tickets = append(tickets, &RaffleTicket{
			ID: r.ID.String(), RaffleID: r.RaffleID.String(), UserID: r.UserID.String(),
			TicketNumber: r.TicketNumber, PurchasedAt: r.PurchasedAt,
		})
	}

	total, _ := s.q.CountUserTickets(ctx, db.CountUserTicketsParams{UserID: userID, GuildFilter: guildIDStr})

	nextOffset := 0
	if len(tickets) == pageSize {
		nextOffset = offset + pageSize
	}
	return &ListTicketsResult{Tickets: tickets, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

// --- helpers ---

func toRaffle(r raffleRow) *Raffle {
	l := &Raffle{
		ID: r.ID.String(), GuildID: r.GuildID.String(), CreatedBy: r.CreatedBy.String(),
		Title: r.Title, Description: r.Description,
		TicketPrice: r.TicketPrice, TicketsSold: r.TicketsSold,
		MaxTickets: r.MaxTickets, MaxTicketsPerUser: r.MaxTicketsPerUser,
		Status: r.Status, DrawDate: r.DrawDate,
		CreatedAt: r.CreatedAt, UpdatedAt: r.UpdatedAt,
		Prizes: []RafflePrize{},
	}
	if r.CancelledAt.Valid {
		cancelledAt := r.CancelledAt.Time
		l.CancelledAt = &cancelledAt
	}
	if len(r.Prizes) > 0 {
		_ = json.Unmarshal(r.Prizes, &l.Prizes)
	}
	if l.Prizes == nil {
		l.Prizes = []RafflePrize{}
	}
	return l
}

func (s *Service) getWinners(ctx context.Context, raffleID uuid.UUID) ([]*RaffleWinner, error) {
	rows, err := s.q.ListRaffleWinners(ctx, raffleID)
	if err != nil {
		return nil, err
	}
	winners := make([]*RaffleWinner, 0, len(rows))
	for _, r := range rows {
		winners = append(winners, &RaffleWinner{
			ID: r.ID.String(), RaffleID: r.RaffleID.String(), UserID: r.UserID.String(),
			Username: r.Username, AvatarURL: r.AvatarUrl,
			Rank: r.Rank, PrizeAmount: r.PrizeAmount,
			PrizeDescription: r.PrizeDescription, TicketNumber: r.TicketNumber,
		})
	}
	return winners, nil
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
