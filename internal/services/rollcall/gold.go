package rollcall

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	LootKindItem = "item"
	LootKindGold = "gold"

	maxGoldAmount int64 = 100_000_000_000_000

	goldTransactionType         = "ROLL_CALL_GOLD"
	goldTransactionRefType      = "roll_call"
	goldPayoutActivityKind      = "roll_call_gold_payout"
	goldRetractedActivityKind   = "roll_call_gold_retracted"
	goldDistributionRefType     = "roll_call_gold_distribution"
	goldDistributionConflictMsg = "the roll call gold pot has changed; reload and try again"
)

// LootEntry is one entry of a roll call's loot: an item or an amount of gold.
type LootEntry struct {
	Kind   string
	Item   models.Item
	Amount int64
}

// GoldPot tracks the gold a roll call deposited into the guild vault and how much of it has been paid out.
type GoldPot struct {
	Total       int64
	Distributed int64
	Retracted   int64
	Completed   bool
}

// Remaining is the gold still available to distribute.
func (p GoldPot) Remaining() int64 {
	if p.Completed {
		return 0
	}
	return p.undistributed()
}

func (p GoldPot) Kept() int64 {
	if !p.Completed {
		return 0
	}
	return p.undistributed()
}

func (p GoldPot) undistributed() int64 {
	return p.Total - p.Distributed - p.Retracted
}

// GoldPayout is the gold paid to one attendee.
type GoldPayout struct {
	UserID string
	Amount int64
}

// GoldSummary is returned by GetGold.
type GoldSummary struct {
	Pot        *GoldPot
	Recipients []GoldPayout
}

// DistributeGoldParams holds the inputs for DistributeGold.
type DistributeGoldParams struct {
	GuildID    uuid.UUID
	RollCallID uuid.UUID
	ActorID    uuid.UUID
	RequestID  uuid.UUID
	Payouts    []GoldPayoutRequest
}

type GoldPayoutRequest struct {
	UserID uuid.UUID
	Amount int64
}

// DistributeGoldResult is returned by DistributeGold.
type DistributeGoldResult struct {
	DistributionID string
	Pot            GoldPot
	Payouts        []GoldPayout
	Replayed       bool
}

type storedLootEntry struct {
	Kind string `json:"kind,omitempty"`
	models.Item
	Amount int64 `json:"amount,omitempty"`
}

type preparedLoot struct {
	items  []models.Item
	gold   int64
	stored []storedLootEntry
}

type goldPayoutLine struct {
	userID uuid.UUID
	amount int64
}

func prepareLoot(entries []LootEntry) *preparedLoot {
	prepared := &preparedLoot{items: []models.Item{}, stored: make([]storedLootEntry, 0, len(entries))}
	for _, entry := range entries {
		switch normalizeLootKind(entry.Kind) {
		case LootKindItem:
			items := prepareBankLoot([]models.Item{entry.Item})
			prepared.items = append(prepared.items, items[0])
			prepared.stored = append(prepared.stored, storedLootEntry{Kind: LootKindItem, Item: items[0]})
		case LootKindGold:
			prepared.gold = entry.Amount
			prepared.stored = append(prepared.stored, storedLootEntry{
				Kind: LootKindGold, Item: models.Item{ID: uuid.NewString()}, Amount: entry.Amount,
			})
		}
	}
	return prepared
}

func normalizeLootKind(kind string) string {
	kind = strings.ToLower(strings.TrimSpace(kind))
	if kind == "" {
		return LootKindItem
	}
	return kind
}

func decodeLoot(raw []byte) []LootEntry {
	var stored []storedLootEntry
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &stored)
	}
	entries := make([]LootEntry, 0, len(stored))
	for _, s := range stored {
		switch normalizeLootKind(s.Kind) {
		case LootKindItem:
			entries = append(entries, LootEntry{Kind: LootKindItem, Item: s.Item})
		case LootKindGold:
			entries = append(entries, LootEntry{Kind: LootKindGold, Item: models.Item{ID: s.ID}, Amount: s.Amount})
		}
	}
	return entries
}

func storeLoot(entries []LootEntry, items []models.Item) []storedLootEntry {
	stored := make([]storedLootEntry, 0, len(items)+1)
	for _, item := range items {
		stored = append(stored, storedLootEntry{Kind: LootKindItem, Item: item})
	}
	for i, e := range entries {
		if e.Kind != LootKindGold {
			continue
		}
		gold := storedLootEntry{Kind: LootKindGold, Item: models.Item{ID: e.Item.ID}, Amount: e.Amount}
		at := min(i, len(stored))
		stored = append(stored[:at], append([]storedLootEntry{gold}, stored[at:]...)...)
	}
	return stored
}

func lootItems(entries []LootEntry) []models.Item {
	items := make([]models.Item, 0, len(entries))
	for _, e := range entries {
		if e.Kind == LootKindItem {
			items = append(items, e.Item)
		}
	}
	return items
}

func normalizeGoldPayouts(payouts []GoldPayoutRequest) ([]goldPayoutLine, int64, error) {
	lines := make([]goldPayoutLine, 0, len(payouts))
	seen := make(map[uuid.UUID]bool, len(payouts))
	var total int64
	for _, p := range payouts {
		userID := p.UserID
		if seen[userID] {
			return nil, 0, fmt.Errorf("%w: each attendee can appear only once", errs.ErrInvalidArgument)
		}
		seen[userID] = true
		if total > maxGoldAmount-p.Amount {
			return nil, 0, fmt.Errorf("%w: gold amount is too large", errs.ErrInvalidArgument)
		}
		if p.Amount == 0 {
			continue
		}
		total += p.Amount
		lines = append(lines, goldPayoutLine{userID: userID, amount: p.Amount})
	}
	sort.Slice(lines, func(i, j int) bool { return bytes.Compare(lines[i].userID[:], lines[j].userID[:]) < 0 })
	return lines, total, nil
}

func checkGoldPotCapacity(pot GoldPot, isCancelled bool, total int64) error {
	if isCancelled || pot.Retracted > 0 {
		return fmt.Errorf("%w: the roll call was cancelled, so its gold can no longer be distributed", errs.ErrFailedPrecondition)
	}
	if pot.Completed {
		return fmt.Errorf("%w: the roll call was completed, so its remaining gold stays in the guild bank", errs.ErrFailedPrecondition)
	}
	if total > pot.Remaining() {
		return fmt.Errorf("%w: only %d of the roll call gold is left to distribute", errs.ErrFailedPrecondition, pot.Remaining())
	}
	return nil
}

// GetGold returns the gold pot of a roll call and how much each attendee has received.
func (s *Service) GetGold(ctx context.Context, guildID, rollCallID uuid.UUID) (*GoldSummary, error) {
	if exists, err := s.q.RollCallExists(ctx, db.RollCallExistsParams{ID: rollCallID, GuildID: guildID}); err != nil || !exists {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	summary := &GoldSummary{Recipients: []GoldPayout{}}
	pot, err := s.q.GetRollCallGoldPot(ctx, db.GetRollCallGoldPotParams{RollCallID: rollCallID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return summary, nil
		}
		return nil, fmt.Errorf("%w: load gold pot: %v", errs.ErrInternal, err)
	}
	summary.Pot = &GoldPot{Total: pot.Total, Distributed: pot.Distributed, Retracted: pot.Retracted, Completed: pot.IsCompleted}
	rows, err := s.q.ListRollCallGoldRecipients(ctx, db.ListRollCallGoldRecipientsParams{RollCallID: rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: list gold recipients: %v", errs.ErrInternal, err)
	}
	for _, r := range rows {
		summary.Recipients = append(summary.Recipients, GoldPayout{UserID: r.UserID.String(), Amount: r.Amount})
	}
	return summary, nil
}

// DistributeGold pays gold from a roll call's pot into attendees' wallets in one transaction.
func (s *Service) DistributeGold(ctx context.Context, p DistributeGoldParams) (*DistributeGoldResult, error) {
	guildID := p.GuildID
	rollCallID := p.RollCallID
	actorID := p.ActorID
	requestID := p.RequestID
	lines, total, err := normalizeGoldPayouts(p.Payouts)
	if err != nil {
		return nil, err
	}
	rollCall, err := s.q.GetRollCall(ctx, db.GetRollCallParams{ID: rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: roll call", errs.ErrNotFound)
	}
	actorName, _ := s.q.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: actorID})

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	locked, err := qtx.LockRollCallGoldPot(ctx, db.LockRollCallGoldPotParams{RollCallID: rollCallID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: this roll call has no gold loot", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: lock gold pot: %v", errs.ErrInternal, err)
	}
	pot := GoldPot{Total: locked.Total, Distributed: locked.Distributed, Retracted: locked.Retracted, Completed: locked.IsCompleted}

	previous, err := qtx.GetRollCallGoldDistributionByRequest(ctx, db.GetRollCallGoldDistributionByRequestParams{RollCallID: rollCallID, RequestID: requestID})
	if err == nil {
		payouts, err := qtx.ListRollCallGoldDistributionPayouts(ctx, previous.ID)
		if err != nil {
			return nil, fmt.Errorf("%w: load previous distribution: %v", errs.ErrInternal, err)
		}
		result := &DistributeGoldResult{DistributionID: previous.ID.String(), Pot: pot, Payouts: []GoldPayout{}, Replayed: true}
		for _, r := range payouts {
			result.Payouts = append(result.Payouts, GoldPayout{UserID: r.UserID.String(), Amount: r.Amount})
		}
		return result, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("%w: load previous distribution: %v", errs.ErrInternal, err)
	}

	if err := checkGoldPotCapacity(pot, rollCall.IsCancelled, total); err != nil {
		return nil, err
	}
	userIDs := make([]uuid.UUID, len(lines))
	for i, l := range lines {
		userIDs[i] = l.userID
	}
	attendees, err := qtx.CountRollCallAttendeesAmong(ctx, db.CountRollCallAttendeesAmongParams{RollCallID: rollCallID, UserIds: userIDs})
	if err != nil {
		return nil, fmt.Errorf("%w: load attendance: %v", errs.ErrInternal, err)
	}
	if attendees != int64(len(lines)) {
		return nil, fmt.Errorf("%w: gold can only be paid to attendees of this roll call", errs.ErrFailedPrecondition)
	}

	if _, err := qtx.DeductGuildBankIfSufficient(ctx, db.DeductGuildBankIfSufficientParams{GuildID: guildID, Amount: total}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: the guild vault does not have enough funds for this payout", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: debit guild vault: %v", errs.ErrInternal, err)
	}
	updated, err := qtx.AddRollCallGoldPotDistributed(ctx, db.AddRollCallGoldPotDistributedParams{Amount: total, RollCallID: rollCallID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: %s", errs.ErrFailedPrecondition, goldDistributionConflictMsg)
		}
		return nil, fmt.Errorf("%w: update gold pot: %v", errs.ErrInternal, err)
	}
	distribution, err := qtx.InsertRollCallGoldDistribution(ctx, db.InsertRollCallGoldDistributionParams{
		RollCallID: rollCallID, GuildID: guildID, ActorID: &actorID, RequestID: requestID, Total: total,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: record distribution: %v", errs.ErrInternal, err)
	}

	result := &DistributeGoldResult{
		DistributionID: distribution.ID.String(),
		Pot:            GoldPot{Total: updated.Total, Distributed: updated.Distributed, Retracted: updated.Retracted},
		Payouts:        make([]GoldPayout, 0, len(lines)),
	}
	for _, l := range lines {
		if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: l.userID, GuildID: guildID}); err != nil {
			return nil, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
		}
		balance, err := qtx.CreditWallet(ctx, db.CreditWalletParams{UserID: l.userID, GuildID: guildID, Amount: l.amount})
		if err != nil {
			return nil, fmt.Errorf("%w: credit wallet: %v", errs.ErrInternal, err)
		}
		txID, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
			UserID: l.userID, GuildID: guildID, Amount: l.amount, BalanceAfter: balance,
			Type: goldTransactionType, Description: rollCall.Title,
			ReferenceID: rollCallID.String(), ReferenceType: goldTransactionRefType,
		})
		if err != nil {
			return nil, fmt.Errorf("%w: record transaction: %v", errs.ErrInternal, err)
		}
		if err := qtx.InsertRollCallGoldPayout(ctx, db.InsertRollCallGoldPayoutParams{
			DistributionID: distribution.ID, UserID: l.userID, Amount: l.amount, TransactionID: &txID,
		}); err != nil {
			return nil, fmt.Errorf("%w: record payout: %v", errs.ErrInternal, err)
		}
		result.Payouts = append(result.Payouts, GoldPayout{UserID: l.userID.String(), Amount: l.amount})
	}
	if err := qtx.InsertRollCallGoldBankActivity(ctx, db.InsertRollCallGoldBankActivityParams{
		GuildID: guildID, UserID: actorID, Username: actorName, Amount: -total, Note: rollCall.Title,
		Kind: goldPayoutActivityKind, RollCallID: rollCallID,
		ReferenceType: goldDistributionRefType, ReferenceID: &distribution.ID,
	}); err != nil {
		return nil, fmt.Errorf("%w: record vault activity: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("roll_call_id", p.RollCallID.String()).Str("guild_id", p.GuildID.String()).Str("actor_id", p.ActorID.String()).
		Int64("total", total).Int("recipients", len(lines)).Msg("roll call gold distributed")
	return result, nil
}

func (s *Service) depositGoldLoot(ctx context.Context, qtx *db.Queries, guildID, rollCallID uuid.UUID, gold int64) error {
	if gold <= 0 {
		return nil
	}
	if err := qtx.EnsureGuildBank(ctx, guildID); err != nil {
		return fmt.Errorf("%w: ensure guild vault: %v", errs.ErrInternal, err)
	}
	if err := qtx.CreditGuildBank(ctx, db.CreditGuildBankParams{GuildID: guildID, Amount: gold}); err != nil {
		return fmt.Errorf("%w: credit guild vault: %v", errs.ErrInternal, err)
	}
	if err := qtx.InsertRollCallGoldPot(ctx, db.InsertRollCallGoldPotParams{RollCallID: rollCallID, GuildID: guildID, Total: gold}); err != nil {
		return fmt.Errorf("%w: create gold pot: %v", errs.ErrInternal, err)
	}
	return nil
}

func (s *Service) retractGoldLoot(ctx context.Context, qtx *db.Queries, guildID, rollCallID, actorID uuid.UUID, title string) (*GoldPot, error) {
	locked, err := qtx.LockRollCallGoldPot(ctx, db.LockRollCallGoldPotParams{RollCallID: rollCallID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("%w: lock gold pot: %v", errs.ErrInternal, err)
	}
	pot := GoldPot{Total: locked.Total, Distributed: locked.Distributed, Retracted: locked.Retracted, Completed: locked.IsCompleted}
	remaining := pot.Remaining()
	if remaining <= 0 {
		return &pot, nil
	}
	if _, err := qtx.DeductGuildBankIfSufficient(ctx, db.DeductGuildBankIfSufficientParams{GuildID: guildID, Amount: remaining}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: the guild vault no longer holds the undistributed roll call gold", errs.ErrFailedPrecondition)
		}
		return nil, fmt.Errorf("%w: debit guild vault: %v", errs.ErrInternal, err)
	}
	updated, err := qtx.RetractRollCallGoldPot(ctx, db.RetractRollCallGoldPotParams{RollCallID: rollCallID, GuildID: guildID})
	if err != nil {
		return nil, fmt.Errorf("%w: retract gold pot: %v", errs.ErrInternal, err)
	}
	actorName, _ := qtx.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: actorID})
	if err := qtx.InsertRollCallGoldBankActivity(ctx, db.InsertRollCallGoldBankActivityParams{
		GuildID: guildID, UserID: actorID, Username: actorName, Amount: -remaining, Note: title,
		Kind: goldRetractedActivityKind, RollCallID: rollCallID,
	}); err != nil {
		return nil, fmt.Errorf("%w: record vault activity: %v", errs.ErrInternal, err)
	}
	return &GoldPot{Total: updated.Total, Distributed: updated.Distributed, Retracted: updated.Retracted}, nil
}

func (s *Service) loadGoldPot(ctx context.Context, guildID, rollCallID uuid.UUID) (*GoldPot, error) {
	pot, err := s.q.GetRollCallGoldPot(ctx, db.GetRollCallGoldPotParams{RollCallID: rollCallID, GuildID: guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("%w: load gold pot: %v", errs.ErrInternal, err)
	}
	return &GoldPot{Total: pot.Total, Distributed: pot.Distributed, Retracted: pot.Retracted, Completed: pot.IsCompleted}, nil
}

func (s *Service) attachGoldPots(ctx context.Context, guildID uuid.UUID, rollCalls []*RollCall) error {
	ids := make([]uuid.UUID, 0, len(rollCalls))
	for _, c := range rollCalls {
		if c.hasGoldLoot() {
			ids = append(ids, uuid.MustParse(c.ID))
		}
	}
	if len(ids) == 0 {
		return nil
	}
	rows, err := s.q.ListRollCallGoldPots(ctx, db.ListRollCallGoldPotsParams{GuildID: guildID, RollCallIds: ids})
	if err != nil {
		return fmt.Errorf("%w: load gold pots: %v", errs.ErrInternal, err)
	}
	pots := make(map[string]*GoldPot, len(rows))
	for _, r := range rows {
		pots[r.RollCallID.String()] = &GoldPot{Total: r.Total, Distributed: r.Distributed, Retracted: r.Retracted, Completed: r.IsCompleted}
	}
	for _, c := range rollCalls {
		c.GoldPot = pots[c.ID]
	}
	return nil
}

func (c *RollCall) hasGoldLoot() bool {
	for _, e := range c.Loot {
		if e.Kind == LootKindGold {
			return true
		}
	}
	return false
}
