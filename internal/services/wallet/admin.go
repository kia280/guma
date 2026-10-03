package wallet

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/models"
	"github.com/kia280/guma/internal/services/errs"
)

const (
	TypeAdminTransferOut = "ADMIN_TRANSFER_OUT"
	TypeAdminTransferIn  = "ADMIN_TRANSFER_IN"

	contributionKindAdminTransfer = "admin_transfer"
)

var assetAdminRoles = []string{"owner", "admin"}

type MemberAssetSummary struct {
	UserID    string
	Balance   int64
	ItemCount int32
}

type MemberAssets struct {
	UserID  string
	Balance int64
	Items   []*BackpackItem
}

type AssetDestination struct {
	UserID    string
	GuildBank bool
}

type AdminTransferFundsParams struct {
	AdminID     string
	GuildID     string
	FromUserID  string
	Destination AssetDestination
	Amount      int64
	Note        string
}

type AdminTransferItemsParams struct {
	AdminID     string
	GuildID     string
	FromUserID  string
	ItemIDs     []string
	Destination AssetDestination
	Note        string
}

type adminTransfer struct {
	adminID uuid.UUID
	guildID uuid.UUID
	fromID  uuid.UUID
	toID    uuid.UUID
	toBank  bool
	note    string
}

func (s *Service) ListMemberAssets(ctx context.Context, adminIDStr, guildIDStr string) ([]MemberAssetSummary, error) {
	adminID, guildID, err := parseIDs(adminIDStr, guildIDStr)
	if err != nil {
		return nil, err
	}
	if err := s.requireAssetAdmin(ctx, guildID, adminID); err != nil {
		return nil, err
	}
	rows, err := s.q.ListMemberAssets(ctx, guildID)
	if err != nil {
		return nil, fmt.Errorf("%w: list member assets: %v", errs.ErrInternal, err)
	}
	summaries := make([]MemberAssetSummary, 0, len(rows))
	for _, r := range rows {
		summaries = append(summaries, MemberAssetSummary{UserID: r.UserID.String(), Balance: r.Balance, ItemCount: r.ItemCount})
	}
	return summaries, nil
}

func (s *Service) GetMemberAssets(ctx context.Context, adminIDStr, guildIDStr, memberIDStr string) (*MemberAssets, error) {
	adminID, guildID, err := parseIDs(adminIDStr, guildIDStr)
	if err != nil {
		return nil, err
	}
	memberID, err := uuid.Parse(memberIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: member", errs.ErrNotFound)
	}
	if err := s.requireAssetAdmin(ctx, guildID, adminID); err != nil {
		return nil, err
	}
	if err := s.requireMember(ctx, s.q, guildID, memberID, errs.ErrNotFound); err != nil {
		return nil, err
	}

	var balance int64
	w, err := s.q.GetWallet(ctx, db.GetWalletParams{UserID: memberID, GuildID: guildID})
	switch {
	case err == nil:
		balance = w.Balance
	case !errors.Is(err, pgx.ErrNoRows):
		return nil, fmt.Errorf("%w: load wallet: %v", errs.ErrInternal, err)
	}

	rows, err := s.q.ListAllBackpackItems(ctx, db.ListAllBackpackItemsParams{OwnerID: memberID, GuildID: guildID})
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
	return &MemberAssets{UserID: memberIDStr, Balance: balance, Items: items}, nil
}

func (s *Service) AdminTransferFunds(ctx context.Context, p AdminTransferFundsParams) (*Transaction, int64, error) {
	t, err := s.prepareAdminTransfer(ctx, p.AdminID, p.GuildID, p.FromUserID, p.Destination, p.Note)
	if err != nil {
		return nil, 0, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, 0, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	if err := s.requireMember(ctx, qtx, t.guildID, t.fromID, errs.ErrNotFound); err != nil {
		return nil, 0, err
	}
	wallets := []uuid.UUID{t.fromID}
	if !t.toBank {
		wallets = append(wallets, t.toID)
	}
	slices.SortFunc(wallets, func(a, b uuid.UUID) int { return strings.Compare(a.String(), b.String()) })
	for _, uid := range wallets {
		if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: uid, GuildID: t.guildID}); err != nil {
			return nil, 0, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
		}
		if _, err := qtx.GetWalletBalanceForUpdate(ctx, db.GetWalletBalanceForUpdateParams{UserID: uid, GuildID: t.guildID}); err != nil {
			return nil, 0, fmt.Errorf("%w: lock wallet: %v", errs.ErrInternal, err)
		}
	}

	fromBalance, err := qtx.DeductWalletIfSufficient(ctx, db.DeductWalletIfSufficientParams{
		Amount: p.Amount, UserID: t.fromID, GuildID: t.guildID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, 0, fmt.Errorf("%w: insufficient funds", errs.ErrFailedPrecondition)
		}
		return nil, 0, fmt.Errorf("%w: deduct: %v", errs.ErrInternal, err)
	}

	out := db.InsertTransactionParams{
		UserID: t.fromID, GuildID: t.guildID, Type: TypeAdminTransferOut,
		Amount: -p.Amount, BalanceAfter: fromBalance, Description: t.note, ActorID: &t.adminID,
	}
	if t.toBank {
		out.ReferenceType = "bank"
		if err := s.creditBankFromMember(ctx, qtx, t, p.Amount); err != nil {
			return nil, 0, err
		}
	} else {
		out.CounterpartyID = &t.toID
		toBalance, err := qtx.CreditWallet(ctx, db.CreditWalletParams{Amount: p.Amount, UserID: t.toID, GuildID: t.guildID})
		if err != nil {
			return nil, 0, fmt.Errorf("%w: credit: %v", errs.ErrInternal, err)
		}
		if _, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
			UserID: t.toID, GuildID: t.guildID, Type: TypeAdminTransferIn,
			Amount: p.Amount, BalanceAfter: toBalance, Description: t.note,
			ActorID: &t.adminID, CounterpartyID: &t.fromID,
		}); err != nil {
			return nil, 0, fmt.Errorf("%w: record transaction: %v", errs.ErrInternal, err)
		}
	}

	outID, err := qtx.InsertTransaction(ctx, out)
	if err != nil {
		return nil, 0, fmt.Errorf("%w: record transaction: %v", errs.ErrInternal, err)
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, 0, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}

	s.logger.Info().Str("admin_id", p.AdminID).Str("from", p.FromUserID).Str("to", p.Destination.UserID).
		Bool("to_bank", t.toBank).Int64("amount", p.Amount).Msg("admin transferred funds")

	tx := &Transaction{
		ID: outID.String(), UserID: t.fromID.String(), GuildID: t.guildID.String(), Type: TypeAdminTransferOut,
		Amount: -p.Amount, BalanceAfter: fromBalance, Description: t.note, ReferenceType: out.ReferenceType,
		ActorID: t.adminID.String(),
	}
	if !t.toBank {
		tx.CounterpartyID = t.toID.String()
	}
	return tx, fromBalance, nil
}

func (s *Service) AdminTransferBackpackItems(ctx context.Context, p AdminTransferItemsParams) ([]string, error) {
	itemIDs, err := parseItemIDList(p.ItemIDs)
	if err != nil {
		return nil, err
	}
	t, err := s.prepareAdminTransfer(ctx, p.AdminID, p.GuildID, p.FromUserID, p.Destination, p.Note)
	if err != nil {
		return nil, err
	}

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	if err := s.requireMember(ctx, qtx, t.guildID, t.fromID, errs.ErrNotFound); err != nil {
		return nil, err
	}
	if err := qtx.SetActingAdmin(ctx, t.adminID.String()); err != nil {
		return nil, fmt.Errorf("%w: set acting admin: %v", errs.ErrInternal, err)
	}

	fromName := ""
	if t.toBank {
		if fromName, err = qtx.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: t.guildID, UserID: t.fromID}); err != nil {
			return nil, fmt.Errorf("%w: load member name: %v", errs.ErrInternal, err)
		}
	}

	moved := make([]string, 0, len(itemIDs))
	for _, itemID := range itemIDs {
		if t.toBank {
			err = moveItemToBank(ctx, qtx, t, itemID, fromName)
		} else {
			_, err = qtx.AdminMoveBackpackItem(ctx, db.AdminMoveBackpackItemParams{
				ToUserID: t.toID, FromUserID: &t.fromID, Note: t.note, ID: itemID, GuildID: t.guildID,
			})
		}
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, fmt.Errorf("%w: item %s is not in the member's backpack or is locked or awaiting delivery", errs.ErrFailedPrecondition, itemID)
			}
			return nil, fmt.Errorf("%w: move item: %v", errs.ErrInternal, err)
		}
		moved = append(moved, itemID.String())
	}

	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	s.logger.Info().Str("admin_id", p.AdminID).Str("from", p.FromUserID).Str("to", p.Destination.UserID).
		Bool("to_bank", t.toBank).Strs("item_ids", moved).Msg("admin transferred backpack items")
	return moved, nil
}

func moveItemToBank(ctx context.Context, qtx *db.Queries, t adminTransfer, itemID uuid.UUID, donorName string) error {
	itemJSON, err := qtx.DeleteBackpackItemReturningItem(ctx, db.DeleteBackpackItemReturningItemParams{
		ID: itemID, OwnerID: t.fromID, GuildID: t.guildID,
	})
	if err != nil {
		return err
	}
	var item models.Item
	if err := json.Unmarshal(itemJSON, &item); err != nil {
		return fmt.Errorf("decode item: %w", err)
	}
	_, err = qtx.InsertBankItem(ctx, db.InsertBankItemParams{
		ID: itemID, GuildID: t.guildID, DonorID: t.fromID, DonorName: donorName, Item: itemJSON, Note: t.note,
	})
	return err
}

func (s *Service) creditBankFromMember(ctx context.Context, qtx *db.Queries, t adminTransfer, amount int64) error {
	fromName, err := qtx.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: t.guildID, UserID: t.fromID})
	if err != nil {
		return fmt.Errorf("%w: load member name: %v", errs.ErrInternal, err)
	}
	if err := qtx.EnsureGuildBank(ctx, t.guildID); err != nil {
		return fmt.Errorf("%w: ensure bank: %v", errs.ErrInternal, err)
	}
	if err := qtx.CreditGuildBank(ctx, db.CreditGuildBankParams{Amount: amount, GuildID: t.guildID}); err != nil {
		return fmt.Errorf("%w: credit bank: %v", errs.ErrInternal, err)
	}
	if err := qtx.InsertBankProceeds(ctx, db.InsertBankProceedsParams{
		GuildID: t.guildID, UserID: t.fromID, Username: fromName, Amount: amount, Note: t.note,
		Kind: contributionKindAdminTransfer, ReferenceType: "admin", ReferenceID: t.adminID,
	}); err != nil {
		return fmt.Errorf("%w: record contribution: %v", errs.ErrInternal, err)
	}
	return nil
}

func (s *Service) prepareAdminTransfer(ctx context.Context, adminIDStr, guildIDStr, fromIDStr string, dest AssetDestination, note string) (adminTransfer, error) {
	var t adminTransfer
	adminID, guildID, err := parseIDs(adminIDStr, guildIDStr)
	if err != nil {
		return t, err
	}
	fromID, err := uuid.Parse(fromIDStr)
	if err != nil {
		return t, fmt.Errorf("%w: member", errs.ErrNotFound)
	}
	note = strings.TrimSpace(note)
	t = adminTransfer{adminID: adminID, guildID: guildID, fromID: fromID, toBank: dest.GuildBank, note: note}

	if !dest.GuildBank {
		if t.toID, err = uuid.Parse(dest.UserID); err != nil {
			return t, fmt.Errorf("%w: recipient", errs.ErrInvalidArgument)
		}
		if t.toID == fromID {
			return t, fmt.Errorf("%w: source and destination must differ", errs.ErrInvalidArgument)
		}
	}

	if err := s.requireAssetAdmin(ctx, guildID, adminID); err != nil {
		return t, err
	}
	if !t.toBank {
		if err := s.requireMember(ctx, s.q, guildID, t.toID, errs.ErrFailedPrecondition); err != nil {
			return t, err
		}
	}
	return t, nil
}

func (s *Service) requireAssetAdmin(ctx context.Context, guildID, userID uuid.UUID) error {
	role, err := s.q.GetGuildMemberRole(ctx, db.GetGuildMemberRoleParams{GuildID: guildID, UserID: userID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: not a member of this guild", errs.ErrPermissionDenied)
		}
		return fmt.Errorf("%w: load member role: %v", errs.ErrInternal, err)
	}
	if !slices.Contains(assetAdminRoles, role) {
		return fmt.Errorf("%w: only owners and admins can manage member assets", errs.ErrPermissionDenied)
	}
	return nil
}

func (s *Service) requireMember(ctx context.Context, q *db.Queries, guildID, userID uuid.UUID, missing error) error {
	if _, err := q.GetGuildMemberRole(ctx, db.GetGuildMemberRoleParams{GuildID: guildID, UserID: userID}); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("%w: user is not a guild member", missing)
		}
		return fmt.Errorf("%w: load member: %v", errs.ErrInternal, err)
	}
	return nil
}

func parseItemIDList(raw []string) ([]uuid.UUID, error) {
	ids := make([]uuid.UUID, 0, len(raw))
	for _, s := range raw {
		id, err := uuid.Parse(s)
		if err != nil {
			return nil, fmt.Errorf("%w: item %q", errs.ErrInvalidArgument, s)
		}
		if !slices.Contains(ids, id) {
			ids = append(ids, id)
		}
	}
	return ids, nil
}
