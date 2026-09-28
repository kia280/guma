package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	lotterysvc "github.com/kia280/guma/internal/services/lottery"
	"github.com/kia280/guma/internal/session"
)

// LotteryHandler is a thin gRPC adapter over the lottery service.
type LotteryHandler struct {
	gumav1.UnimplementedLotteryServiceServer
	svc    *lotterysvc.Service
	logger zerolog.Logger
}

// NewLotteryService creates a new Lottery gRPC handler.
func NewLotteryService(db *database.Pool, logger zerolog.Logger) *LotteryHandler {
	return &LotteryHandler{
		svc:    lotterysvc.New(db, logger),
		logger: logger.With().Str("handler", "lottery").Logger(),
	}
}

func (h *LotteryHandler) ListLotteries(ctx context.Context, req *gumav1.ListLotteriesRequest) (*gumav1.ListLotteriesResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	result, err := h.svc.List(ctx, lotterysvc.ListParams{
		GuildID:  req.GuildId,
		Status:   req.Status,
		PageSize: int(req.PageSize),
		Offset:   lotterysvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.Lottery, len(result.Lotteries))
	for i, l := range result.Lotteries {
		protos[i] = lotteryToProto(l)
	}
	return &gumav1.ListLotteriesResponse{
		Lotteries:     protos,
		NextPageToken: lotterysvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *LotteryHandler) GetLottery(ctx context.Context, req *gumav1.GetLotteryRequest) (*gumav1.GetLotteryResponse, error) {
	if req.GuildId == "" || req.LotteryId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and lottery_id are required")
	}
	l, err := h.svc.Get(ctx, req.GuildId, req.LotteryId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetLotteryResponse{Lottery: lotteryToProto(l)}, nil
}

func (h *LotteryHandler) CreateLottery(ctx context.Context, req *gumav1.CreateLotteryRequest) (*gumav1.CreateLotteryResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	prizes := prizesFromProto(req.Prizes)

	l, err := h.svc.Create(ctx, lotterysvc.CreateParams{
		GuildID:           req.GuildId,
		CreatedBy:         userID,
		Title:             req.Title,
		Description:       req.Description,
		TicketPrice:       req.TicketPrice,
		MaxTickets:        req.MaxTickets,
		MaxTicketsPerUser: req.MaxTicketsPerUser,
		DrawDate:          req.DrawDate,
		Prizes:            prizes,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateLotteryResponse{Lottery: lotteryToProto(l)}, nil
}

func (h *LotteryHandler) PurchaseTickets(ctx context.Context, req *gumav1.PurchaseTicketsRequest) (*gumav1.PurchaseTicketsResponse, error) {
	if req.GuildId == "" || req.LotteryId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and lottery_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	tickets, totalCost, err := h.svc.PurchaseTickets(ctx, req.GuildId, req.LotteryId, userID, req.Quantity)
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.LotteryTicket, len(tickets))
	for i, t := range tickets {
		protos[i] = lotteryTicketToProto(t)
	}
	return &gumav1.PurchaseTicketsResponse{Tickets: protos, TotalCost: totalCost}, nil
}

func (h *LotteryHandler) GetLotteryWinners(ctx context.Context, req *gumav1.GetLotteryWinnersRequest) (*gumav1.GetLotteryWinnersResponse, error) {
	if req.GuildId == "" || req.LotteryId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and lottery_id are required")
	}
	winners, err := h.svc.GetWinners(ctx, req.GuildId, req.LotteryId)
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.LotteryWinner, len(winners))
	for i, w := range winners {
		protos[i] = lotteryWinnerToProto(w)
	}
	return &gumav1.GetLotteryWinnersResponse{Winners: protos}, nil
}

func (h *LotteryHandler) UpdateLottery(ctx context.Context, req *gumav1.UpdateLotteryRequest) (*gumav1.UpdateLotteryResponse, error) {
	if req.GuildId == "" || req.LotteryId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and lottery_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	l, err := h.svc.Update(ctx, lotterysvc.UpdateParams{
		GuildID:           req.GuildId,
		LotteryID:         req.LotteryId,
		UpdatedBy:         userID,
		Title:             req.Title,
		Description:       req.Description,
		DrawDate:          req.DrawDate,
		TicketPrice:       req.TicketPrice,
		MaxTickets:        req.MaxTickets,
		MaxTicketsPerUser: req.MaxTicketsPerUser,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateLotteryResponse{Lottery: lotteryToProto(l)}, nil
}

func (h *LotteryHandler) CancelLottery(ctx context.Context, req *gumav1.CancelLotteryRequest) (*gumav1.CancelLotteryResponse, error) {
	if req.GuildId == "" || req.LotteryId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and lottery_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	l, err := h.svc.Cancel(ctx, req.GuildId, req.LotteryId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CancelLotteryResponse{Lottery: lotteryToProto(l)}, nil
}

func (h *LotteryHandler) DeleteLottery(ctx context.Context, req *gumav1.DeleteLotteryRequest) (*gumav1.DeleteLotteryResponse, error) {
	if req.GuildId == "" || req.LotteryId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and lottery_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	if err := h.svc.Delete(ctx, req.GuildId, req.LotteryId, userID); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteLotteryResponse{Success: true}, nil
}

func (h *LotteryHandler) DrawLottery(ctx context.Context, req *gumav1.DrawLotteryRequest) (*gumav1.DrawLotteryResponse, error) {
	if req.GuildId == "" || req.LotteryId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and lottery_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	l, winners, err := h.svc.Draw(ctx, req.GuildId, req.LotteryId, userID)
	if err != nil {
		return nil, toStatus(err)
	}

	winnerProtos := make([]*gumav1.LotteryWinner, len(winners))
	for i, w := range winners {
		winnerProtos[i] = lotteryWinnerToProto(w)
	}
	return &gumav1.DrawLotteryResponse{Lottery: lotteryToProto(l), Winners: winnerProtos}, nil
}

func (h *LotteryHandler) ListMyTickets(ctx context.Context, req *gumav1.ListMyTicketsRequest) (*gumav1.ListMyTicketsResponse, error) {
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	result, err := h.svc.ListMyTickets(ctx, userID, req.GuildId, int(req.PageSize), lotterysvc.ParsePageToken(req.PageToken))
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.LotteryTicket, len(result.Tickets))
	for i, t := range result.Tickets {
		protos[i] = lotteryTicketToProto(t)
	}
	return &gumav1.ListMyTicketsResponse{
		Tickets:       protos,
		NextPageToken: lotterysvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

// --- proto conversion helpers ---

func lotteryToProto(l *lotterysvc.Lottery) *gumav1.Lottery {
	prizes := make([]*gumav1.LotteryPrize, len(l.Prizes))
	for i, p := range l.Prizes {
		prizes[i] = lotteryPrizeToProto(p)
	}
	winners := make([]*gumav1.LotteryWinner, len(l.Winners))
	for i, w := range l.Winners {
		winners[i] = lotteryWinnerToProto(w)
	}
	proto := &gumav1.Lottery{
		Id:                l.ID,
		GuildId:           l.GuildID,
		CreatedBy:         l.CreatedBy,
		Title:             l.Title,
		Description:       l.Description,
		TicketPrice:       l.TicketPrice,
		TicketsSold:       l.TicketsSold,
		MaxTickets:        l.MaxTickets,
		MaxTicketsPerUser: l.MaxTicketsPerUser,
		Status:            l.Status,
		DrawDate:          l.DrawDate,
		Prizes:            prizes,
		Winners:           winners,
		CreatedAt:         timestamppb.New(l.CreatedAt),
		UpdatedAt:         timestamppb.New(l.UpdatedAt),
	}
	if l.CancelledAt != nil {
		proto.CancelledAt = timestamppb.New(*l.CancelledAt)
	}
	return proto
}

func lotteryPrizeToProto(p lotterysvc.LotteryPrize) *gumav1.LotteryPrize {
	proto := &gumav1.LotteryPrize{
		Rank:        p.Rank,
		Description: p.Description,
		Amount:      p.Amount,
	}
	if p.Item != nil {
		proto.Item = itemToProto(*p.Item)
	}
	return proto
}

func lotteryTicketToProto(t *lotterysvc.LotteryTicket) *gumav1.LotteryTicket {
	return &gumav1.LotteryTicket{
		Id:           t.ID,
		LotteryId:    t.LotteryID,
		UserId:       t.UserID,
		TicketNumber: t.TicketNumber,
		PurchasedAt:  timestamppb.New(t.PurchasedAt),
	}
}

func lotteryWinnerToProto(w *lotterysvc.LotteryWinner) *gumav1.LotteryWinner {
	return &gumav1.LotteryWinner{
		Id:               w.ID,
		LotteryId:        w.LotteryID,
		UserId:           w.UserID,
		Username:         w.Username,
		AvatarUrl:        w.AvatarURL,
		Rank:             w.Rank,
		PrizeAmount:      w.PrizeAmount,
		PrizeDescription: w.PrizeDescription,
		TicketNumber:     w.TicketNumber,
	}
}

func prizesFromProto(protos []*gumav1.LotteryPrize) []lotterysvc.LotteryPrize {
	prizes := make([]lotterysvc.LotteryPrize, len(protos))
	for i, p := range protos {
		prize := lotterysvc.LotteryPrize{
			Rank:        p.Rank,
			Description: p.Description,
			Amount:      p.Amount,
		}
		if p.Item != nil {
			item := itemFromProto(p.Item)
			prize.Item = &item
		}
		prize.Source = sourceRefFromProto(p.Source)
		prizes[i] = prize
	}
	return prizes
}
