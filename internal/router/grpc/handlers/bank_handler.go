package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/models"
	banksvc "github.com/kia280/guma/internal/services/bank"
	"github.com/kia280/guma/internal/session"
)

// BankHandler is a thin gRPC adapter over the bank service.
type BankHandler struct {
	gumav1.UnimplementedBankServiceServer
	svc    *banksvc.Service
	logger zerolog.Logger
}

// NewBankService creates a new Bank gRPC handler.
func NewBankService(db *database.Pool, logger zerolog.Logger) *BankHandler {
	return &BankHandler{
		svc:    banksvc.New(db, logger),
		logger: logger.With().Str("handler", "bank").Logger(),
	}
}

func (h *BankHandler) GetBank(ctx context.Context, req *gumav1.GetBankRequest) (*gumav1.GetBankResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	if session.UserIDFromContext(ctx) == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	bank, err := h.svc.GetBank(ctx, req.GuildId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetBankResponse{Bank: bankToProto(bank)}, nil
}

func (h *BankHandler) ContributeFunds(ctx context.Context, req *gumav1.ContributeFundsRequest) (*gumav1.ContributeFundsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	contribution, updatedBank, err := h.svc.ContributeFunds(ctx, req.GuildId, userID, req.Amount, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.ContributeFundsResponse{
		Contribution: bankContributionToProto(contribution),
		UpdatedBank:  bankToProto(updatedBank),
	}, nil
}

func (h *BankHandler) RequestFunds(ctx context.Context, req *gumav1.RequestFundsRequest) (*gumav1.RequestFundsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	fr, err := h.svc.RequestFunds(ctx, req.GuildId, userID, req.Amount, req.Reason)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.RequestFundsResponse{FundRequest: fundRequestToProto(fr)}, nil
}

func (h *BankHandler) ReviewFundRequest(ctx context.Context, req *gumav1.ReviewFundRequestRequest) (*gumav1.ReviewFundRequestResponse, error) {
	if req.GuildId == "" || req.RequestId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and request_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	fr, err := h.svc.ReviewFundRequest(ctx, req.GuildId, req.RequestId, userID, req.Status, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.ReviewFundRequestResponse{FundRequest: fundRequestToProto(fr)}, nil
}

func (h *BankHandler) ListFundRequests(ctx context.Context, req *gumav1.ListFundRequestsRequest) (*gumav1.ListFundRequestsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	result, err := h.svc.ListFundRequests(ctx, banksvc.ListFundRequestsParams{
		GuildID:  req.GuildId,
		UserID:   userID,
		Status:   req.Status,
		PageSize: int(req.PageSize),
		Offset:   banksvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.FundRequest, len(result.Requests))
	for i, r := range result.Requests {
		protos[i] = fundRequestToProto(r)
	}
	return &gumav1.ListFundRequestsResponse{
		Requests:      protos,
		NextPageToken: banksvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *BankHandler) ListContributions(ctx context.Context, req *gumav1.ListContributionsRequest) (*gumav1.ListContributionsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	if session.UserIDFromContext(ctx) == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	result, err := h.svc.ListContributions(ctx, banksvc.ListContributionsParams{
		GuildID:  req.GuildId,
		PageSize: int(req.PageSize),
		Offset:   banksvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.BankContribution, len(result.Contributions))
	for i, c := range result.Contributions {
		protos[i] = bankContributionToProto(c)
	}
	return &gumav1.ListContributionsResponse{
		Contributions: protos,
		NextPageToken: banksvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *BankHandler) DonateItem(ctx context.Context, req *gumav1.DonateItemRequest) (*gumav1.DonateItemResponse, error) {
	if req.GuildId == "" || req.BackpackItemId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and backpack_item_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	bi, err := h.svc.DonateItem(ctx, req.GuildId, userID, req.BackpackItemId, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DonateItemResponse{BankItem: bankItemToProto(bi)}, nil
}

func (h *BankHandler) ListBankItems(ctx context.Context, req *gumav1.ListBankItemsRequest) (*gumav1.ListBankItemsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	result, err := h.svc.ListBankItems(ctx, banksvc.ListBankItemsParams{
		GuildID:    req.GuildId,
		ViewerID:   userID,
		RollCallID: req.RollCallId,
		Category:   req.Category,
		Rarity:     req.Rarity,
		PageSize:   int(req.PageSize),
		Offset:     banksvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.BankItem, len(result.Items))
	for i, bi := range result.Items {
		protos[i] = bankItemToProto(bi)
	}
	return &gumav1.ListBankItemsResponse{
		Items:         protos,
		NextPageToken: banksvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *BankHandler) DeleteBankItem(ctx context.Context, req *gumav1.DeleteBankItemRequest) (*gumav1.DeleteBankItemResponse, error) {
	if req.GuildId == "" || req.BankItemId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and bank_item_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	if err := h.svc.DeleteBankItem(ctx, req.GuildId, userID, req.BankItemId); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteBankItemResponse{Success: true}, nil
}

func (h *BankHandler) RequestItem(ctx context.Context, req *gumav1.RequestItemRequest) (*gumav1.RequestItemResponse, error) {
	if req.GuildId == "" || req.BankItemId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and bank_item_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	ir, err := h.svc.RequestItem(ctx, req.GuildId, userID, req.BankItemId, req.Reason)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.RequestItemResponse{ItemRequest: itemRequestToProto(ir)}, nil
}

func (h *BankHandler) ReviewItemRequest(ctx context.Context, req *gumav1.ReviewItemRequestRequest) (*gumav1.ReviewItemRequestResponse, error) {
	if req.GuildId == "" || req.RequestId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and request_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	ir, err := h.svc.ReviewItemRequest(ctx, req.GuildId, req.RequestId, userID, req.Status, req.Note)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.ReviewItemRequestResponse{ItemRequest: itemRequestToProto(ir)}, nil
}

func (h *BankHandler) ListItemRequests(ctx context.Context, req *gumav1.ListItemRequestsRequest) (*gumav1.ListItemRequestsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	result, err := h.svc.ListItemRequests(ctx, banksvc.ListItemRequestsParams{
		GuildID:  req.GuildId,
		UserID:   userID,
		Status:   req.Status,
		PageSize: int(req.PageSize),
		Offset:   banksvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.ItemRequest, len(result.Requests))
	for i, r := range result.Requests {
		protos[i] = itemRequestToProto(r)
	}
	return &gumav1.ListItemRequestsResponse{
		Requests:      protos,
		NextPageToken: banksvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

// --- proto conversion helpers ---

func bankToProto(b *banksvc.GuildBank) *gumav1.GuildBank {
	contributors := make([]*gumav1.TopContributor, len(b.TopContributors))
	for i, tc := range b.TopContributors {
		contributors[i] = &gumav1.TopContributor{
			UserId:           tc.UserID,
			Username:         tc.Username,
			AvatarUrl:        tc.AvatarURL,
			TotalContributed: tc.TotalContributed,
		}
	}
	return &gumav1.GuildBank{
		Id:              b.ID,
		GuildId:         b.GuildID,
		Balance:         b.Balance,
		Currency:        b.Currency,
		TopContributors: contributors,
		CreatedAt:       timestamppb.New(b.CreatedAt),
		UpdatedAt:       timestamppb.New(b.UpdatedAt),
	}
}

func bankContributionToProto(c *banksvc.BankContribution) *gumav1.BankContribution {
	return &gumav1.BankContribution{
		Id:            c.ID,
		GuildId:       c.GuildID,
		UserId:        c.UserID,
		Username:      c.Username,
		AvatarUrl:     c.AvatarURL,
		Amount:        c.Amount,
		Note:          c.Note,
		CreatedAt:     timestamppb.New(c.CreatedAt),
		Kind:          c.Kind,
		Items:         protoItems(c.Items),
		RollCallId:    c.RollCallID,
		ReferenceType: c.ReferenceType,
		ReferenceId:   c.ReferenceID,
	}
}

func protoItems(items []models.Item) []*gumav1.Item {
	protos := make([]*gumav1.Item, len(items))
	for i, item := range items {
		protos[i] = itemToProto(item)
	}
	return protos
}

func fundRequestToProto(fr *banksvc.FundRequest) *gumav1.FundRequest {
	proto := &gumav1.FundRequest{
		Id:                 fr.ID,
		GuildId:            fr.GuildID,
		RequesterId:        fr.RequesterID,
		RequesterName:      fr.RequesterName,
		RequesterAvatarUrl: fr.RequesterAvatarURL,
		Amount:             fr.Amount,
		Reason:             fr.Reason,
		Status:             fr.Status,
		ReviewerId:         fr.ReviewerID,
		ReviewNote:         fr.ReviewNote,
		CreatedAt:          timestamppb.New(fr.CreatedAt),
	}
	if fr.ReviewedAt != nil {
		proto.ReviewedAt = timestamppb.New(*fr.ReviewedAt)
	}
	return proto
}

func bankItemToProto(bi *banksvc.BankItem) *gumav1.BankItem {
	return &gumav1.BankItem{
		Id:                  bi.ID,
		GuildId:             bi.GuildID,
		DonorId:             bi.DonorID,
		DonorName:           bi.DonorName,
		Item:                itemToProto(bi.Item),
		Quantity:            bi.Quantity,
		Note:                bi.Note,
		DonatedAt:           timestamppb.New(bi.DonatedAt),
		RollCallId:          bi.RollCallID,
		RollCallTitle:       bi.RollCallTitle,
		PendingRequestCount: bi.PendingRequestCount,
		RequestedByMe:       bi.RequestedByMe,
		Lock:                itemLockToProto(bi.Lock),
	}
}

func itemRequestToProto(ir *banksvc.ItemRequest) *gumav1.ItemRequest {
	proto := &gumav1.ItemRequest{
		Id:                 ir.ID,
		GuildId:            ir.GuildID,
		BankItemId:         ir.BankItemID,
		RequesterId:        ir.RequesterID,
		RequesterName:      ir.RequesterName,
		RequesterAvatarUrl: ir.RequesterAvatarURL,
		Reason:             ir.Reason,
		Status:             ir.Status,
		ReviewerId:         ir.ReviewerID,
		ReviewNote:         ir.ReviewNote,
		Item:               itemToProto(ir.Item),
		CreatedAt:          timestamppb.New(ir.CreatedAt),
	}
	if ir.ReviewedAt != nil {
		proto.ReviewedAt = timestamppb.New(*ir.ReviewedAt)
	}
	return proto
}

func (h *BankHandler) GetItemHistory(ctx context.Context, req *gumav1.GetItemHistoryRequest) (*gumav1.GetItemHistoryResponse, error) {
	if req.GuildId == "" || req.ItemId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and item_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	events, err := h.svc.GetItemHistory(ctx, req.GuildId, userID, req.ItemId)
	if err != nil {
		return nil, toStatus(err)
	}
	protos := make([]*gumav1.ItemHistoryEvent, len(events))
	for i, e := range events {
		protos[i] = &gumav1.ItemHistoryEvent{
			Id:             e.ID,
			Kind:           e.Kind,
			Source:         e.Source,
			ActorId:        e.ActorID,
			ActorName:      e.ActorName,
			SubjectId:      e.SubjectID,
			SubjectName:    e.SubjectName,
			ReferenceId:    e.ReferenceID,
			ReferenceLabel: e.ReferenceLabel,
			CreatedAt:      timestamppb.New(e.CreatedAt),
		}
	}
	return &gumav1.GetItemHistoryResponse{Events: protos}, nil
}
