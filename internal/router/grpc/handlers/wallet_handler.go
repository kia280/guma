package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/session"
	walletsvc "github.com/kia280/guma/internal/services/wallet"
)

// WalletHandler is a thin gRPC adapter over the wallet service.
type WalletHandler struct {
	gumav1.UnimplementedWalletServiceServer
	svc    *walletsvc.Service
	logger zerolog.Logger
}

// NewWalletService creates a new Wallet gRPC handler.
func NewWalletService(db *database.Pool, logger zerolog.Logger) *WalletHandler {
	return &WalletHandler{
		svc:    walletsvc.New(db, logger),
		logger: logger.With().Str("handler", "wallet").Logger(),
	}
}

func (h *WalletHandler) GetWallet(ctx context.Context, req *gumav1.GetWalletRequest) (*gumav1.GetWalletResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	w, err := h.svc.GetWallet(ctx, userID, req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetWalletResponse{Wallet: walletToProto(w)}, nil
}

func (h *WalletHandler) DepositFunds(ctx context.Context, req *gumav1.DepositFundsRequest) (*gumav1.TransactionResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	tx, _, err := h.svc.Deposit(ctx, userID, req.GuildId, req.Amount, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.TransactionResponse{Transaction: transactionToProto(tx)}, nil
}

func (h *WalletHandler) WithdrawFunds(ctx context.Context, req *gumav1.WithdrawFundsRequest) (*gumav1.TransactionResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	tx, _, err := h.svc.Withdraw(ctx, userID, req.GuildId, req.Amount, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.TransactionResponse{Transaction: transactionToProto(tx)}, nil
}

func (h *WalletHandler) TransferFunds(ctx context.Context, req *gumav1.TransferFundsRequest) (*gumav1.TransactionResponse, error) {
	if req.GuildId == "" || req.ToUserId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and to_user_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	tx, _, err := h.svc.Transfer(ctx, userID, req.ToUserId, req.GuildId, req.Amount, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.TransactionResponse{Transaction: transactionToProto(tx)}, nil
}

func (h *WalletHandler) ListTransactions(ctx context.Context, req *gumav1.ListTransactionsRequest) (*gumav1.ListTransactionsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	result, err := h.svc.ListTransactions(ctx, walletsvc.ListTransactionsParams{
		UserID:   userID,
		GuildID:  req.GuildId,
		Type:     req.Type,
		PageSize: int(req.PageSize),
		Offset:   walletsvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	txs := make([]*gumav1.Transaction, len(result.Transactions))
	for i, t := range result.Transactions {
		txs[i] = transactionToProto(t)
	}
	return &gumav1.ListTransactionsResponse{
		Transactions:  txs,
		NextPageToken: walletsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *WalletHandler) GetBalanceTrend(ctx context.Context, req *gumav1.GetBalanceTrendRequest) (*gumav1.GetBalanceTrendResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	points, err := h.svc.GetBalanceTrend(ctx, userID, req.GuildId, req.Days)
	if err != nil {
		return nil, toStatus(err)
	}

	proto := make([]*gumav1.BalancePoint, len(points))
	for i, p := range points {
		proto[i] = &gumav1.BalancePoint{Date: p.Date, Balance: p.Balance}
	}
	return &gumav1.GetBalanceTrendResponse{Points: proto}, nil
}

func (h *WalletHandler) ListBackpackItems(ctx context.Context, req *gumav1.ListBackpackItemsRequest) (*gumav1.ListBackpackItemsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	result, err := h.svc.ListBackpackItems(ctx, walletsvc.ListBackpackParams{
		OwnerID:  userID,
		GuildID:  req.GuildId,
		PageSize: int(req.PageSize),
		Offset:   walletsvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	items := make([]*gumav1.BackpackItem, len(result.Items))
	for i, bi := range result.Items {
		items[i] = backpackItemToProto(bi)
	}
	return &gumav1.ListBackpackItemsResponse{
		Items:         items,
		NextPageToken: walletsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *WalletHandler) WithdrawBackpackItem(ctx context.Context, req *gumav1.WithdrawBackpackItemRequest) (*gumav1.WithdrawBackpackItemResponse, error) {
	if req.GuildId == "" || req.ItemId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and item_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	bi, err := h.svc.WithdrawBackpackItem(ctx, userID, req.GuildId, req.ItemId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.WithdrawBackpackItemResponse{Item: backpackItemToProto(bi)}, nil
}

// --- proto conversion helpers ---

func walletToProto(w *walletsvc.Wallet) *gumav1.Wallet {
	return &gumav1.Wallet{
		UserId:    w.UserID,
		GuildId:   w.GuildID,
		Balance:   w.Balance,
		Currency:  w.Currency,
		CreatedAt: timestamppb.New(w.CreatedAt),
		UpdatedAt: timestamppb.New(w.UpdatedAt),
	}
}

func transactionToProto(t *walletsvc.Transaction) *gumav1.Transaction {
	return &gumav1.Transaction{
		Id:            t.ID,
		UserId:        t.UserID,
		GuildId:       t.GuildID,
		Type:          t.Type,
		Amount:        t.Amount,
		BalanceAfter:  t.BalanceAfter,
		Description:   t.Description,
		ReferenceId:   t.ReferenceID,
		ReferenceType: t.ReferenceType,
		CreatedAt:     timestamppb.New(t.CreatedAt),
	}
}

func backpackItemToProto(bi *walletsvc.BackpackItem) *gumav1.BackpackItem {
	return &gumav1.BackpackItem{
		Id:         bi.ID,
		OwnerId:    bi.OwnerID,
		GuildId:    bi.GuildID,
		Item:       itemToProto(bi.Item),
		Source:     bi.Source,
		SourceId:   bi.SourceID,
		Note:       bi.Note,
		AcquiredAt: timestamppb.New(bi.AcquiredAt),
	}
}
