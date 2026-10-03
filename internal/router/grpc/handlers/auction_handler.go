package handlers

import (
	"context"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/ids"
	"github.com/kia280/guma/internal/models"
	auctionsvc "github.com/kia280/guma/internal/services/auction"
	"github.com/kia280/guma/internal/services/inventory"
)

// AuctionHandler is a thin gRPC adapter over the auction service.
type AuctionHandler struct {
	gumav1.UnimplementedAuctionServiceServer
	svc    *auctionsvc.Service
	logger zerolog.Logger
}

// NewAuctionService creates a new Auction gRPC handler.
func NewAuctionService(db *database.Pool, az authz.Authorizer, logger zerolog.Logger) *AuctionHandler {
	return &AuctionHandler{
		svc:    auctionsvc.New(db, az, logger),
		logger: logger.With().Str("handler", "auction").Logger(),
	}
}

func (h *AuctionHandler) ListAuctions(ctx context.Context, req *gumav1.ListAuctionsRequest) (*gumav1.ListAuctionsResponse, error) {
	var in struct {
		GuildID uuid.UUID `proto:"guild_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	result, err := h.svc.List(ctx, auctionsvc.ListParams{
		GuildID:  in.GuildID,
		Status:   req.Status,
		Category: req.Category,
		Rarity:   req.Rarity,
		Search:   req.Search,
		PageSize: int(req.PageSize),
		Offset:   auctionsvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.AuctionItem, len(result.Auctions))
	for i, a := range result.Auctions {
		protos[i] = auctionToProto(a)
	}
	return &gumav1.ListAuctionsResponse{
		Auctions:      protos,
		NextPageToken: auctionsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *AuctionHandler) GetAuction(ctx context.Context, req *gumav1.GetAuctionRequest) (*gumav1.GetAuctionResponse, error) {
	var in struct {
		GuildID   uuid.UUID `proto:"guild_id"`
		AuctionID uuid.UUID `proto:"auction_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	a, err := h.svc.Get(ctx, in.GuildID, in.AuctionID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetAuctionResponse{Auction: auctionToProto(a)}, nil
}

func (h *AuctionHandler) CreateAuction(ctx context.Context, req *gumav1.CreateAuctionRequest) (*gumav1.CreateAuctionResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID uuid.UUID      `proto:"guild_id"`
		Source  *itemSourceIDs `proto:"source"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	var item models.Item
	if req.Item != nil {
		item = itemFromProto(req.Item)
	}

	a, err := h.svc.Create(ctx, auctionsvc.CreateParams{
		GuildID:         in.GuildID,
		SellerID:        userID,
		Item:            item,
		StartingBid:     req.StartingBid,
		MinBidIncrement: req.MinBidIncrement,
		DurationHours:   req.DurationHours,
		IsBlind:         req.IsBlind,
		Status:          req.Status,
		Source:          in.Source.ref(),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateAuctionResponse{Auction: auctionToProto(a)}, nil
}

func (h *AuctionHandler) PlaceBid(ctx context.Context, req *gumav1.PlaceBidRequest) (*gumav1.PlaceBidResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID   uuid.UUID `proto:"guild_id"`
		AuctionID uuid.UUID `proto:"auction_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	auctionItem, bid, err := h.svc.PlaceBid(ctx, in.GuildID, in.AuctionID, userID, req.Amount)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.PlaceBidResponse{Bid: bidToProto(bid), Auction: auctionToProto(auctionItem)}, nil
}

func (h *AuctionHandler) GetBidHistory(ctx context.Context, req *gumav1.GetBidHistoryRequest) (*gumav1.GetBidHistoryResponse, error) {
	var in struct {
		GuildID   uuid.UUID `proto:"guild_id"`
		AuctionID uuid.UUID `proto:"auction_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	result, err := h.svc.GetBidHistory(ctx, in.GuildID, in.AuctionID, int(req.PageSize), auctionsvc.ParsePageToken(req.PageToken))
	if err != nil {
		return nil, toStatus(err)
	}

	bids := make([]*gumav1.Bid, len(result.Bids))
	for i, b := range result.Bids {
		bids[i] = bidToProto(b)
	}
	return &gumav1.GetBidHistoryResponse{
		Bids:          bids,
		NextPageToken: auctionsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *AuctionHandler) UpdateAuction(ctx context.Context, req *gumav1.UpdateAuctionRequest) (*gumav1.UpdateAuctionResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID   uuid.UUID `proto:"guild_id"`
		AuctionID uuid.UUID `proto:"auction_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	params := auctionsvc.UpdateParams{
		GuildID:         in.GuildID,
		AuctionID:       in.AuctionID,
		UpdatedBy:       userID,
		StartingBid:     req.StartingBid,
		MinBidIncrement: req.MinBidIncrement,
		IsBlind:         req.IsBlind,
	}
	if req.Item != nil {
		item := itemFromProto(req.Item)
		params.Item = &item
	}
	if req.StartTime != nil {
		if err := req.StartTime.CheckValid(); err != nil {
			return nil, status.Error(codes.InvalidArgument, "start_time is invalid")
		}
		startTime := req.StartTime.AsTime()
		params.StartTime = &startTime
	}
	if req.EndTime != nil {
		if err := req.EndTime.CheckValid(); err != nil {
			return nil, status.Error(codes.InvalidArgument, "end_time is invalid")
		}
		endTime := req.EndTime.AsTime()
		params.EndTime = &endTime
	}

	a, err := h.svc.Update(ctx, params)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateAuctionResponse{Auction: auctionToProto(a)}, nil
}

func (h *AuctionHandler) DeleteAuction(ctx context.Context, req *gumav1.DeleteAuctionRequest) (*gumav1.DeleteAuctionResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID   uuid.UUID `proto:"guild_id"`
		AuctionID uuid.UUID `proto:"auction_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	if err := h.svc.Delete(ctx, in.GuildID, in.AuctionID, userID); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteAuctionResponse{Success: true}, nil
}

func (h *AuctionHandler) CancelAuction(ctx context.Context, req *gumav1.CancelAuctionRequest) (*gumav1.CancelAuctionResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID   uuid.UUID `proto:"guild_id"`
		AuctionID uuid.UUID `proto:"auction_id"`
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	a, err := h.svc.Cancel(ctx, in.GuildID, in.AuctionID, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CancelAuctionResponse{Auction: auctionToProto(a)}, nil
}

// --- proto conversion helpers ---

func auctionToProto(a *auctionsvc.AuctionItem) *gumav1.AuctionItem {
	proto := &gumav1.AuctionItem{
		Id:                     a.ID,
		GuildId:                a.GuildID,
		SellerId:               a.SellerID,
		Item:                   itemToProto(a.Item),
		StartingBid:            a.StartingBid,
		CurrentBid:             a.CurrentBid,
		CurrentBidderId:        a.CurrentBidderID,
		MinBidIncrement:        a.MinBidIncrement,
		StartTime:              timestamppb.New(a.StartTime),
		EndTime:                timestamppb.New(a.EndTime),
		Status:                 a.Status,
		IsBlind:                a.IsBlind,
		SourceType:             a.SourceType,
		CreatedAt:              timestamppb.New(a.CreatedAt),
		UpdatedAt:              timestamppb.New(a.UpdatedAt),
		SellerName:             a.SellerName,
		SellerAvatarUrl:        a.SellerAvatarURL,
		CurrentBidderName:      a.CurrentBidderName,
		CurrentBidderAvatarUrl: a.CurrentBidderAvatarURL,
	}
	if a.CancelledAt != nil {
		proto.CancelledAt = timestamppb.New(*a.CancelledAt)
	}
	return proto
}

func bidToProto(b *auctionsvc.Bid) *gumav1.Bid {
	return &gumav1.Bid{
		Id:              b.ID,
		AuctionId:       b.AuctionID,
		BidderId:        b.BidderID,
		BidderUsername:  b.BidderName,
		BidderAvatarUrl: b.BidderAvatarURL,
		Amount:          b.Amount,
		IsWinning:       b.IsWinning,
		PlacedAt:        timestamppb.New(b.PlacedAt),
	}
}

func itemToProto(item models.Item) *gumav1.Item {
	return &gumav1.Item{
		Id:          item.ID,
		Name:        item.Name,
		Description: item.Description,
		Category:    item.Category,
		Rarity:      item.Rarity,
	}
}

func itemLockToProto(lock *models.ItemLock) *gumav1.ItemLock {
	if lock == nil {
		return nil
	}
	return &gumav1.ItemLock{Type: lock.Type, Id: lock.ID}
}

func itemFromProto(p *gumav1.Item) models.Item {
	return models.Item{
		ID:          p.Id,
		Name:        p.Name,
		Description: p.Description,
		Category:    p.Category,
		Rarity:      p.Rarity,
	}
}

type itemSourceIDs struct {
	BackpackItemID *uuid.UUID `proto:"backpack_item_id"`
	BankItemID     *uuid.UUID `proto:"bank_item_id"`
}

func (s *itemSourceIDs) ref() inventory.Ref {
	if s == nil {
		return inventory.Ref{}
	}
	return inventory.Ref{BackpackItemID: s.BackpackItemID, BankItemID: s.BankItemID}
}
