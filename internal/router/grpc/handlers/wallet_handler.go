package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/ids"
	walletsvc "github.com/kia280/guma/internal/services/wallet"
)

// WalletHandler is a thin gRPC adapter over the wallet service.
type WalletHandler struct {
	gumav1.UnimplementedWalletServiceServer
	svc    *walletsvc.Service
	logger zerolog.Logger
}

// NewWalletService creates a new Wallet gRPC handler.
func NewWalletService(db *database.Pool, az authz.Authorizer, logger zerolog.Logger) *WalletHandler {
	return &WalletHandler{
		svc:    walletsvc.New(db, az, logger),
		logger: logger.With().Str("handler", "wallet").Logger(),
	}
}

func (h *WalletHandler) GetWallet(ctx context.Context, req *gumav1.GetWalletRequest) (*gumav1.GetWalletResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}

	w, err := h.svc.GetWallet(ctx, userID, guildID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetWalletResponse{Wallet: walletToProto(w)}, nil
}

func (h *WalletHandler) DepositFunds(ctx context.Context, req *gumav1.DepositFundsRequest) (*gumav1.TransactionResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}

	tx, _, err := h.svc.Deposit(ctx, userID, guildID, req.Amount, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.TransactionResponse{Transaction: transactionToProto(tx)}, nil
}

func (h *WalletHandler) WithdrawFunds(ctx context.Context, req *gumav1.WithdrawFundsRequest) (*gumav1.TransactionResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}

	request, tx, w, err := h.svc.RequestWithdrawal(ctx, userID, guildID, req.Amount, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.TransactionResponse{
		Transaction:       transactionToProto(tx),
		UpdatedWallet:     walletToProto(w),
		WithdrawalRequest: withdrawalRequestToProto(request),
	}, nil
}

func (h *WalletHandler) ListMyWithdrawalRequests(ctx context.Context, req *gumav1.ListMyWithdrawalRequestsRequest) (*gumav1.ListMyWithdrawalRequestsResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	offset, err := walletsvc.ParsePageToken(req.PageToken)
	if err != nil {
		return nil, toStatus(err)
	}
	result, err := h.svc.ListMyWithdrawalRequests(ctx, walletsvc.ListWithdrawalRequestsParams{
		ViewerID: userID,
		GuildID:  guildID,
		Status:   req.Status,
		PageSize: int(req.PageSize),
		Offset:   offset,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.ListMyWithdrawalRequestsResponse{
		Requests:      withdrawalRequestsToProto(result.Requests),
		NextPageToken: walletsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *WalletHandler) CancelWithdrawalRequest(ctx context.Context, req *gumav1.CancelWithdrawalRequestRequest) (*gumav1.CancelWithdrawalRequestResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	requestID := p.Parse("request_id", req.RequestId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}

	request, w, err := h.svc.CancelWithdrawalRequest(ctx, userID, guildID, requestID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CancelWithdrawalRequestResponse{
		WithdrawalRequest: withdrawalRequestToProto(request),
		UpdatedWallet:     walletToProto(w),
	}, nil
}

func (h *WalletHandler) ListWithdrawalRequests(ctx context.Context, req *gumav1.ListWithdrawalRequestsRequest) (*gumav1.ListWithdrawalRequestsResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	offset, err := walletsvc.ParsePageToken(req.PageToken)
	if err != nil {
		return nil, toStatus(err)
	}
	result, err := h.svc.ListWithdrawalRequests(ctx, walletsvc.ListWithdrawalRequestsParams{
		ViewerID: userID,
		GuildID:  guildID,
		Status:   req.Status,
		PageSize: int(req.PageSize),
		Offset:   offset,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.ListWithdrawalRequestsResponse{
		Requests:      withdrawalRequestsToProto(result.Requests),
		NextPageToken: walletsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *WalletHandler) ReviewWithdrawalRequest(ctx context.Context, req *gumav1.ReviewWithdrawalRequestRequest) (*gumav1.ReviewWithdrawalRequestResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	requestID := p.Parse("request_id", req.RequestId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}

	request, err := h.svc.ReviewWithdrawalRequest(ctx, userID, guildID, requestID, req.Status, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.ReviewWithdrawalRequestResponse{WithdrawalRequest: withdrawalRequestToProto(request)}, nil
}

func (h *WalletHandler) TransferFunds(ctx context.Context, req *gumav1.TransferFundsRequest) (*gumav1.TransactionResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	toUserID := p.Parse("to_user_id", req.ToUserId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}

	tx, _, err := h.svc.Transfer(ctx, userID, toUserID, guildID, req.Amount, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.TransactionResponse{Transaction: transactionToProto(tx)}, nil
}

func (h *WalletHandler) ListTransactions(ctx context.Context, req *gumav1.ListTransactionsRequest) (*gumav1.ListTransactionsResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	offset, err := walletsvc.ParsePageToken(req.PageToken)
	if err != nil {
		return nil, toStatus(err)
	}
	result, err := h.svc.ListTransactions(ctx, walletsvc.ListTransactionsParams{
		UserID:   userID,
		GuildID:  guildID,
		Type:     req.Type,
		PageSize: int(req.PageSize),
		Offset:   offset,
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}

	points, err := h.svc.GetBalanceTrend(ctx, userID, guildID, req.Days)
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	offset, err := walletsvc.ParsePageToken(req.PageToken)
	if err != nil {
		return nil, toStatus(err)
	}
	result, err := h.svc.ListBackpackItems(ctx, walletsvc.ListBackpackParams{
		OwnerID:  userID,
		GuildID:  guildID,
		PageSize: int(req.PageSize),
		Offset:   offset,
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	itemID := p.Parse("item_id", req.ItemId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}

	bi, err := h.svc.WithdrawBackpackItem(ctx, userID, guildID, itemID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.WithdrawBackpackItemResponse{Item: backpackItemToProto(bi)}, nil
}

func (h *WalletHandler) TransferBackpackItem(ctx context.Context, req *gumav1.TransferBackpackItemRequest) (*gumav1.TransferBackpackItemResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	itemID := p.Parse("item_id", req.ItemId)
	toUserID := p.Parse("to_user_id", req.ToUserId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}

	bi, err := h.svc.TransferBackpackItem(ctx, userID, guildID, itemID, toUserID, req.Note)
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
		UserId:             w.UserID,
		GuildId:            w.GuildID,
		Balance:            w.Balance,
		Currency:           w.Currency,
		CreatedAt:          timestamppb.New(w.CreatedAt),
		UpdatedAt:          timestamppb.New(w.UpdatedAt),
		LockedInBids:       w.LockedInBids,
		LockedBids:         lockedBids,
		PendingWithdrawals: w.PendingWithdrawals,
	}
}

func withdrawalRequestToProto(r *walletsvc.WithdrawalRequest) *gumav1.WithdrawalRequest {
	p := &gumav1.WithdrawalRequest{
		Id:                 r.ID,
		GuildId:            r.GuildID,
		RequesterId:        r.RequesterID,
		RequesterName:      r.RequesterName,
		RequesterAvatarUrl: r.RequesterAvatarURL,
		Amount:             r.Amount,
		Note:               r.Note,
		Status:             r.Status,
		ReviewerId:         r.ReviewerID,
		ReviewerName:       r.ReviewerName,
		ReviewNote:         r.ReviewNote,
		CreatedAt:          timestamppb.New(r.CreatedAt),
	}
	if r.ReviewedAt != nil {
		p.ReviewedAt = timestamppb.New(*r.ReviewedAt)
	}
	return p
}

func withdrawalRequestsToProto(requests []*walletsvc.WithdrawalRequest) []*gumav1.WithdrawalRequest {
	protos := make([]*gumav1.WithdrawalRequest, len(requests))
	for i, r := range requests {
		protos[i] = withdrawalRequestToProto(r)
	}
	return protos
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	itemID := p.Parse("item_id", req.ItemId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}

	bi, err := h.svc.CancelBackpackWithdrawal(ctx, userID, guildID, itemID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CancelBackpackWithdrawalResponse{Item: backpackItemToProto(bi)}, nil
}

func (h *WalletHandler) ListPendingDeliveries(ctx context.Context, req *gumav1.ListPendingDeliveriesRequest) (*gumav1.ListPendingDeliveriesResponse, error) {
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	items, err := h.svc.ListPendingDeliveries(ctx, guildID)
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	itemID := p.Parse("item_id", req.ItemId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}

	bi, err := h.svc.ConfirmBackpackDelivery(ctx, userID, guildID, itemID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.ConfirmBackpackDeliveryResponse{Item: backpackItemToProto(bi)}, nil
}

func (h *WalletHandler) ListMemberAssets(ctx context.Context, req *gumav1.ListMemberAssetsRequest) (*gumav1.ListMemberAssetsResponse, error) {
	guildID, err := ids.Parse("guild_id", req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	summaries, err := h.svc.ListMemberAssets(ctx, guildID)
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
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	memberID := p.Parse("user_id", req.UserId)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}
	assets, err := h.svc.GetMemberAssets(ctx, guildID, memberID)
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	fromUserID := p.Parse("user_id", req.UserId)
	destination := parseAssetDestination(&p, req.ToUserId, req.ToGuildBank)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}

	tx, balance, err := h.svc.AdminTransferFunds(ctx, walletsvc.AdminTransferFundsParams{
		AdminID:     userID,
		GuildID:     guildID,
		FromUserID:  fromUserID,
		Destination: destination,
		Amount:      req.Amount,
		Note:        req.Note,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.AdminTransferFundsResponse{Transaction: transactionToProto(tx), Balance: balance}, nil
}

func (h *WalletHandler) AdminTransferBackpackItems(ctx context.Context, req *gumav1.AdminTransferBackpackItemsRequest) (*gumav1.AdminTransferBackpackItemsResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var p ids.Parser
	guildID := p.Parse("guild_id", req.GuildId)
	fromUserID := p.Parse("user_id", req.UserId)
	itemIDs := p.List("item_ids", req.ItemIds)
	destination := parseAssetDestination(&p, req.ToUserId, req.ToGuildBank)
	if err := p.Err(); err != nil {
		return nil, toStatus(err)
	}

	moved, err := h.svc.AdminTransferBackpackItems(ctx, walletsvc.AdminTransferItemsParams{
		AdminID:     userID,
		GuildID:     guildID,
		FromUserID:  fromUserID,
		ItemIDs:     itemIDs,
		Destination: destination,
		Note:        req.Note,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.AdminTransferBackpackItemsResponse{ItemIds: moved}, nil
}

func parseAssetDestination(p *ids.Parser, toUserID string, toGuildBank bool) walletsvc.AssetDestination {
	if toGuildBank {
		return walletsvc.AssetDestination{GuildBank: true}
	}
	return walletsvc.AssetDestination{UserID: p.Parse("to_user_id", toUserID)}
}
