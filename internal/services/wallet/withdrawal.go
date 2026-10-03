package wallet

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	db "github.com/kia280/guma/internal/db/sqlc"
	"github.com/kia280/guma/internal/services/errs"
	"github.com/kia280/guma/internal/services/pagination"
)

const (
	WithdrawalPending   = "pending"
	WithdrawalApproved  = "approved"
	WithdrawalRejected  = "rejected"
	WithdrawalCancelled = "cancelled"

	TypeWithdrawalRequest   = "WITHDRAWAL_REQUEST"
	TypeWithdrawalApproved  = "WITHDRAWAL_APPROVED"
	TypeWithdrawalRejected  = "WITHDRAWAL_REJECTED"
	TypeWithdrawalCancelled = "WITHDRAWAL_CANCELLED"

	withdrawalReferenceType = "withdrawal"
)

type WithdrawalRequest struct {
	ID                 string
	GuildID            string
	RequesterID        string
	RequesterName      string
	RequesterAvatarURL string
	Amount             int64
	Note               string
	Status             string
	ReviewerID         string
	ReviewerName       string
	ReviewNote         string
	CreatedAt          time.Time
	ReviewedAt         *time.Time
}

type ListWithdrawalRequestsParams struct {
	ViewerID string
	GuildID  string
	Status   string
	PageSize int
	Offset   int
}

type ListWithdrawalRequestsResult struct {
	Requests   []*WithdrawalRequest
	TotalCount int32
	NextOffset int
}

func (s *Service) RequestWithdrawal(ctx context.Context, userIDStr, guildIDStr string, amount int64, note string) (*WithdrawalRequest, *Transaction, *Wallet, error) {
	userID, guildID, err := parseIDs(userIDStr, guildIDStr)
	if err != nil {
		return nil, nil, nil, err
	}
	note = strings.TrimSpace(note)

	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, nil, nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: userID, GuildID: guildID}); err != nil {
		return nil, nil, nil, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
	}
	balance, err := qtx.DeductWalletIfSufficient(ctx, db.DeductWalletIfSufficientParams{
		Amount: amount, UserID: userID, GuildID: guildID,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, nil, fmt.Errorf("%w: insufficient funds", errs.ErrFailedPrecondition)
		}
		return nil, nil, nil, fmt.Errorf("%w: hold funds: %v", errs.ErrInternal, err)
	}

	requesterName, err := qtx.GetUserDisplayName(ctx, db.GetUserDisplayNameParams{GuildID: guildID, UserID: userID})
	if err != nil {
		return nil, nil, nil, fmt.Errorf("%w: load member name: %v", errs.ErrInternal, err)
	}
	requestID, err := qtx.InsertWithdrawalRequest(ctx, db.InsertWithdrawalRequestParams{
		GuildID: guildID, RequesterID: userID, RequesterName: requesterName, Amount: amount, Note: note,
	})
	if err != nil {
		return nil, nil, nil, fmt.Errorf("%w: create withdrawal request: %v", errs.ErrInternal, err)
	}

	t, err := recordWithdrawalTransaction(ctx, qtx, withdrawalTransaction{
		guildID: guildID, userID: userID, requestID: requestID, actorID: userID,
		txType: TypeWithdrawalRequest, amount: -amount, balance: balance, note: note,
	})
	if err != nil {
		return nil, nil, nil, err
	}
	request, err := loadWithdrawalRequest(ctx, qtx, guildID, requestID)
	if err != nil {
		return nil, nil, nil, err
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, nil, nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}

	s.logger.Info().Str("withdrawal_request_id", request.ID).Str("user_id", userIDStr).Int64("amount", amount).Msg("withdrawal requested")
	w, err := s.GetWallet(ctx, userIDStr, guildIDStr)
	if err != nil {
		return nil, nil, nil, err
	}
	return request, t, w, nil
}

func (s *Service) CancelWithdrawalRequest(ctx context.Context, userIDStr, guildIDStr, requestIDStr string) (*WithdrawalRequest, *Wallet, error) {
	userID, guildID, err := parseIDs(userIDStr, guildIDStr)
	if err != nil {
		return nil, nil, err
	}
	requestID, err := uuid.Parse(requestIDStr)
	if err != nil {
		return nil, nil, fmt.Errorf("%w: withdrawal request", errs.ErrNotFound)
	}

	request, err := s.resolveWithdrawalRequest(ctx, withdrawalResolution{
		guildID: guildID, requestID: requestID, actorID: userID, ownerID: &userID,
		status: WithdrawalCancelled, txType: TypeWithdrawalCancelled, refund: true,
	})
	if err != nil {
		return nil, nil, err
	}

	s.logger.Info().Str("withdrawal_request_id", requestIDStr).Str("user_id", userIDStr).Msg("withdrawal cancelled")
	w, err := s.GetWallet(ctx, userIDStr, guildIDStr)
	if err != nil {
		return nil, nil, err
	}
	return request, w, nil
}

func (s *Service) ReviewWithdrawalRequest(ctx context.Context, reviewerIDStr, guildIDStr, requestIDStr, status, note string) (*WithdrawalRequest, error) {
	reviewerID, guildID, err := parseIDs(reviewerIDStr, guildIDStr)
	if err != nil {
		return nil, err
	}
	requestID, err := uuid.Parse(requestIDStr)
	if err != nil {
		return nil, fmt.Errorf("%w: withdrawal request", errs.ErrNotFound)
	}
	note = strings.TrimSpace(note)

	resolution := withdrawalResolution{
		guildID: guildID, requestID: requestID, actorID: reviewerID, reviewerID: &reviewerID,
		status: status, txType: TypeWithdrawalApproved, note: note,
	}
	if status == WithdrawalRejected {
		resolution.txType = TypeWithdrawalRejected
		resolution.refund = true
	}
	request, err := s.resolveWithdrawalRequest(ctx, resolution)
	if err != nil {
		return nil, err
	}

	s.logger.Info().Str("withdrawal_request_id", requestIDStr).Str("reviewer_id", reviewerIDStr).Str("status", status).Msg("withdrawal reviewed")
	return request, nil
}

func (s *Service) ListMyWithdrawalRequests(ctx context.Context, p ListWithdrawalRequestsParams) (*ListWithdrawalRequestsResult, error) {
	viewerID, guildID, err := parseIDs(p.ViewerID, p.GuildID)
	if err != nil {
		return nil, err
	}
	return s.listWithdrawalRequests(ctx, guildID, &viewerID, p)
}

func (s *Service) ListWithdrawalRequests(ctx context.Context, p ListWithdrawalRequestsParams) (*ListWithdrawalRequestsResult, error) {
	_, guildID, err := parseIDs(p.ViewerID, p.GuildID)
	if err != nil {
		return nil, err
	}
	return s.listWithdrawalRequests(ctx, guildID, nil, p)
}

func (s *Service) listWithdrawalRequests(ctx context.Context, guildID uuid.UUID, requesterID *uuid.UUID, p ListWithdrawalRequestsParams) (*ListWithdrawalRequestsResult, error) {
	pageSize := pagination.StandardSize(p.PageSize)

	rows, err := s.q.ListWithdrawalRequests(ctx, db.ListWithdrawalRequestsParams{
		GuildID: guildID, RequesterID: requesterID, StatusFilter: p.Status,
		PageSize: int32(pageSize), PageOffset: int32(p.Offset),
	})
	if err != nil {
		return nil, fmt.Errorf("%w: list withdrawal requests: %v", errs.ErrInternal, err)
	}
	total, err := s.q.CountWithdrawalRequests(ctx, db.CountWithdrawalRequestsParams{
		GuildID: guildID, RequesterID: requesterID, StatusFilter: p.Status,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: count withdrawal requests: %v", errs.ErrInternal, err)
	}

	requests := make([]*WithdrawalRequest, 0, len(rows))
	for _, r := range rows {
		requests = append(requests, toWithdrawalRequest(r))
	}
	nextOffset := 0
	if len(requests) == pageSize {
		nextOffset = p.Offset + pageSize
	}
	return &ListWithdrawalRequestsResult{Requests: requests, TotalCount: int32(total), NextOffset: nextOffset}, nil
}

type withdrawalResolution struct {
	guildID    uuid.UUID
	requestID  uuid.UUID
	actorID    uuid.UUID
	ownerID    *uuid.UUID
	reviewerID *uuid.UUID
	status     string
	txType     string
	note       string
	refund     bool
}

func (s *Service) resolveWithdrawalRequest(ctx context.Context, r withdrawalResolution) (*WithdrawalRequest, error) {
	pgtx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: begin tx: %v", errs.ErrInternal, err)
	}
	defer pgtx.Rollback(ctx) //nolint:errcheck
	qtx := s.q.WithTx(pgtx)

	pending, err := qtx.LockWithdrawalRequest(ctx, db.LockWithdrawalRequestParams{ID: r.requestID, GuildID: r.guildID})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: withdrawal request", errs.ErrNotFound)
		}
		return nil, fmt.Errorf("%w: load withdrawal request: %v", errs.ErrInternal, err)
	}
	if r.ownerID != nil && pending.RequesterID != *r.ownerID {
		return nil, fmt.Errorf("%w: withdrawal request", errs.ErrNotFound)
	}
	if pending.Status != WithdrawalPending {
		return nil, fmt.Errorf("%w: withdrawal request is no longer pending", errs.ErrFailedPrecondition)
	}

	if err := qtx.EnsureWallet(ctx, db.EnsureWalletParams{UserID: pending.RequesterID, GuildID: r.guildID}); err != nil {
		return nil, fmt.Errorf("%w: ensure wallet: %v", errs.ErrInternal, err)
	}
	var amount, balance int64
	if r.refund {
		amount = pending.Amount
		balance, err = qtx.CreditWallet(ctx, db.CreditWalletParams{Amount: amount, UserID: pending.RequesterID, GuildID: r.guildID})
	} else {
		balance, err = qtx.GetWalletBalanceForUpdate(ctx, db.GetWalletBalanceForUpdateParams{UserID: pending.RequesterID, GuildID: r.guildID})
	}
	if err != nil {
		return nil, fmt.Errorf("%w: settle held funds: %v", errs.ErrInternal, err)
	}

	updated, err := qtx.UpdateWithdrawalRequestStatus(ctx, db.UpdateWithdrawalRequestStatusParams{
		Status: r.status, ReviewerID: r.reviewerID, ReviewNote: r.note, ID: r.requestID, GuildID: r.guildID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: update withdrawal request: %v", errs.ErrInternal, err)
	}
	if updated == 0 {
		return nil, fmt.Errorf("%w: withdrawal request is no longer pending", errs.ErrFailedPrecondition)
	}

	if _, err := recordWithdrawalTransaction(ctx, qtx, withdrawalTransaction{
		guildID: r.guildID, userID: pending.RequesterID, requestID: r.requestID, actorID: r.actorID,
		txType: r.txType, amount: amount, balance: balance, note: r.note,
	}); err != nil {
		return nil, err
	}
	request, err := loadWithdrawalRequest(ctx, qtx, r.guildID, r.requestID)
	if err != nil {
		return nil, err
	}
	if err := pgtx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("%w: commit: %v", errs.ErrInternal, err)
	}
	return request, nil
}

type withdrawalTransaction struct {
	guildID   uuid.UUID
	userID    uuid.UUID
	requestID uuid.UUID
	actorID   uuid.UUID
	txType    string
	amount    int64
	balance   int64
	note      string
}

func recordWithdrawalTransaction(ctx context.Context, qtx *db.Queries, t withdrawalTransaction) (*Transaction, error) {
	id, err := qtx.InsertTransaction(ctx, db.InsertTransactionParams{
		UserID: t.userID, GuildID: t.guildID, Type: t.txType, Amount: t.amount, BalanceAfter: t.balance,
		Description: t.note, ReferenceID: t.requestID.String(), ReferenceType: withdrawalReferenceType,
		ActorID: &t.actorID,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: record transaction: %v", errs.ErrInternal, err)
	}
	return &Transaction{
		ID: id.String(), UserID: t.userID.String(), GuildID: t.guildID.String(), Type: t.txType,
		Amount: t.amount, BalanceAfter: t.balance, Description: t.note,
		ReferenceID: t.requestID.String(), ReferenceType: withdrawalReferenceType,
		CreatedAt: time.Now().UTC(), ActorID: t.actorID.String(),
	}, nil
}

func loadWithdrawalRequest(ctx context.Context, qtx *db.Queries, guildID, requestID uuid.UUID) (*WithdrawalRequest, error) {
	rows, err := qtx.ListWithdrawalRequests(ctx, db.ListWithdrawalRequestsParams{
		GuildID: guildID, RequestID: &requestID, PageSize: 1,
	})
	if err != nil {
		return nil, fmt.Errorf("%w: load withdrawal request: %v", errs.ErrInternal, err)
	}
	if len(rows) == 0 {
		return nil, fmt.Errorf("%w: withdrawal request", errs.ErrNotFound)
	}
	return toWithdrawalRequest(rows[0]), nil
}

func toWithdrawalRequest(r db.ListWithdrawalRequestsRow) *WithdrawalRequest {
	return &WithdrawalRequest{
		ID: r.ID.String(), GuildID: r.GuildID.String(), RequesterID: r.RequesterID.String(),
		RequesterName: r.RequesterName, RequesterAvatarURL: r.RequesterAvatarUrl,
		Amount: r.Amount, Note: r.Note, Status: r.Status,
		ReviewerID: uuidString(r.ReviewerID), ReviewerName: r.ReviewerName, ReviewNote: r.ReviewNote,
		CreatedAt: r.CreatedAt, ReviewedAt: timestampPtr(r.ReviewedAt),
	}
}
