package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	walletsvc "github.com/kia280/guma/internal/services/wallet"
	"github.com/kia280/guma/internal/session"
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

func (h *WalletHandler) TransferBackpackItem(ctx context.Context, req *gumav1.TransferBackpackItemRequest) (*gumav1.TransferBackpackItemResponse, error) {
	if req.GuildId == "" || req.ItemId == "" || req.ToUserId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id, item_id and to_user_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	bi, err := h.svc.TransferBackpackItem(ctx, userID, req.GuildId, req.ItemId, req.ToUserId, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.TransferBackpackItemResponse{Item: backpackItemToProto(bi)}, nil
}

// --- proto conversion helpers ---

func walletToProto(w *walletsvc.Wallet) *gumav1.Wallet {
	lockedBids := make([]*gumav1.LockedBid, len(w.LockedBids))
	for i, b := range w.LockedBids {
		lockedBids[i] = &gumav1.LockedBid{
			AuctionId: b.AuctionID,
			ItemName:  b.ItemName,
			Amount:    b.Amount,
			EndTime:   timestamppb.New(b.EndTime),
		}
	}
	return &gumav1.Wallet{
		UserId:       w.UserID,
		GuildId:      w.GuildID,
		Balance:      w.Balance,
		Currency:     w.Currency,
		CreatedAt:    timestamppb.New(w.CreatedAt),
		UpdatedAt:    timestamppb.New(w.UpdatedAt),
		LockedInBids: w.LockedInBids,
		LockedBids:   lockedBids,
	}
}

func transactionToProto(t *walletsvc.Transaction) *gumav1.Transaction {
	return &gumav1.Transaction{
		Id:               t.ID,
		UserId:           t.UserID,
		GuildId:          t.GuildID,
		Type:             t.Type,
		Amount:           t.Amount,
		BalanceAfter:     t.BalanceAfter,
		Description:      t.Description,
		ReferenceId:      t.ReferenceID,
		ReferenceType:    t.ReferenceType,
		CreatedAt:        timestamppb.New(t.CreatedAt),
		ActorId:          t.ActorID,
		ActorName:        t.ActorName,
		CounterpartyId:   t.CounterpartyID,
		CounterpartyName: t.CounterpartyName,
	}
}

func backpackItemToProto(bi *walletsvc.BackpackItem) *gumav1.BackpackItem {
	p := &gumav1.BackpackItem{
		Id:          bi.ID,
		OwnerId:     bi.OwnerID,
		GuildId:     bi.GuildID,
		Item:        itemToProto(bi.Item),
		Source:      bi.Source,
		SourceId:    bi.SourceID,
		Note:        bi.Note,
		AcquiredAt:  timestamppb.New(bi.AcquiredAt),
		SourceLabel: bi.SourceLabel,
		OwnerName:   bi.OwnerName,
		Lock:        itemLockToProto(bi.Lock),
	}
	if bi.DeliveryRequestedAt != nil {
		p.DeliveryRequestedAt = timestamppb.New(*bi.DeliveryRequestedAt)
	}
	return p
}

func (h *WalletHandler) CancelBackpackWithdrawal(ctx context.Context, req *gumav1.CancelBackpackWithdrawalRequest) (*gumav1.CancelBackpackWithdrawalResponse, error) {
	if req.GuildId == "" || req.ItemId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and item_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	bi, err := h.svc.CancelBackpackWithdrawal(ctx, userID, req.GuildId, req.ItemId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CancelBackpackWithdrawalResponse{Item: backpackItemToProto(bi)}, nil
}

func (h *WalletHandler) ListPendingDeliveries(ctx context.Context, req *gumav1.ListPendingDeliveriesRequest) (*gumav1.ListPendingDeliveriesResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	items, err := h.svc.ListPendingDeliveries(ctx, userID, req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	protos := make([]*gumav1.BackpackItem, len(items))
	for i, bi := range items {
		protos[i] = backpackItemToProto(bi)
	}
	return &gumav1.ListPendingDeliveriesResponse{Items: protos}, nil
}

func (h *WalletHandler) ConfirmBackpackDelivery(ctx context.Context, req *gumav1.ConfirmBackpackDeliveryRequest) (*gumav1.ConfirmBackpackDeliveryResponse, error) {
	if req.GuildId == "" || req.ItemId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and item_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	bi, err := h.svc.ConfirmBackpackDelivery(ctx, userID, req.GuildId, req.ItemId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.ConfirmBackpackDeliveryResponse{Item: backpackItemToProto(bi)}, nil
}

func (h *WalletHandler) ListMemberAssets(ctx context.Context, req *gumav1.ListMemberAssetsRequest) (*gumav1.ListMemberAssetsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	summaries, err := h.svc.ListMemberAssets(ctx, userID, req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	members := make([]*gumav1.MemberAssetSummary, len(summaries))
	for i, m := range summaries {
		members[i] = &gumav1.MemberAssetSummary{UserId: m.UserID, Balance: m.Balance, ItemCount: m.ItemCount}
	}
	return &gumav1.ListMemberAssetsResponse{Members: members}, nil
}

func (h *WalletHandler) GetMemberAssets(ctx context.Context, req *gumav1.GetMemberAssetsRequest) (*gumav1.GetMemberAssetsResponse, error) {
	if req.GuildId == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and user_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	assets, err := h.svc.GetMemberAssets(ctx, userID, req.GuildId, req.UserId)
	if err != nil {
		return nil, toStatus(err)
	}
	items := make([]*gumav1.BackpackItem, len(assets.Items))
	for i, bi := range assets.Items {
		items[i] = backpackItemToProto(bi)
	}
	return &gumav1.GetMemberAssetsResponse{UserId: assets.UserID, Balance: assets.Balance, Items: items}, nil
}

func (h *WalletHandler) AdminTransferFunds(ctx context.Context, req *gumav1.AdminTransferFundsRequest) (*gumav1.AdminTransferFundsResponse, error) {
	if req.GuildId == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and user_id are required")
	}
	if req.ToUserId == "" && !req.ToGuildBank {
		return nil, status.Error(codes.InvalidArgument, "to_user_id or to_guild_bank is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	tx, balance, err := h.svc.AdminTransferFunds(ctx, walletsvc.AdminTransferFundsParams{
		AdminID:     userID,
		GuildID:     req.GuildId,
		FromUserID:  req.UserId,
		Destination: walletsvc.AssetDestination{UserID: req.ToUserId, GuildBank: req.ToGuildBank},
		Amount:      req.Amount,
		Note:        req.Note,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.AdminTransferFundsResponse{Transaction: transactionToProto(tx), Balance: balance}, nil
}

func (h *WalletHandler) AdminTransferBackpackItems(ctx context.Context, req *gumav1.AdminTransferBackpackItemsRequest) (*gumav1.AdminTransferBackpackItemsResponse, error) {
	if req.GuildId == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and user_id are required")
	}
	if req.ToUserId == "" && !req.ToGuildBank {
		return nil, status.Error(codes.InvalidArgument, "to_user_id or to_guild_bank is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	moved, err := h.svc.AdminTransferBackpackItems(ctx, walletsvc.AdminTransferItemsParams{
		AdminID:     userID,
		GuildID:     req.GuildId,
		FromUserID:  req.UserId,
		ItemIDs:     req.ItemIds,
		Destination: walletsvc.AssetDestination{UserID: req.ToUserId, GuildBank: req.ToGuildBank},
		Note:        req.Note,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.AdminTransferBackpackItemsResponse{ItemIds: moved}, nil
}
