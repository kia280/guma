package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	rafflesvc "github.com/kia280/guma/internal/services/raffle"
	"github.com/kia280/guma/internal/session"
)

// RaffleHandler is a thin gRPC adapter over the raffle service.
type RaffleHandler struct {
	gumav1.UnimplementedRaffleServiceServer
	svc    *rafflesvc.Service
	logger zerolog.Logger
}

// NewRaffleService creates a new Raffle gRPC handler.
func NewRaffleService(db *database.Pool, logger zerolog.Logger) *RaffleHandler {
	return &RaffleHandler{
		svc:    rafflesvc.New(db, logger),
		logger: logger.With().Str("handler", "raffle").Logger(),
	}
}

func (h *RaffleHandler) ListRaffles(ctx context.Context, req *gumav1.ListRafflesRequest) (*gumav1.ListRafflesResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	result, err := h.svc.List(ctx, rafflesvc.ListParams{
		GuildID:  req.GuildId,
		Status:   req.Status,
		PageSize: int(req.PageSize),
		Offset:   rafflesvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.Raffle, len(result.Raffles))
	for i, l := range result.Raffles {
		protos[i] = raffleToProto(l)
	}
	return &gumav1.ListRafflesResponse{
		Raffles:       protos,
		NextPageToken: rafflesvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *RaffleHandler) GetRaffle(ctx context.Context, req *gumav1.GetRaffleRequest) (*gumav1.GetRaffleResponse, error) {
	if req.GuildId == "" || req.RaffleId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and raffle_id are required")
	}
	l, err := h.svc.Get(ctx, req.GuildId, req.RaffleId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetRaffleResponse{Raffle: raffleToProto(l)}, nil
}

func (h *RaffleHandler) CreateRaffle(ctx context.Context, req *gumav1.CreateRaffleRequest) (*gumav1.CreateRaffleResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)

	prizes := prizesFromProto(req.Prizes)

	l, err := h.svc.Create(ctx, rafflesvc.CreateParams{
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
	return &gumav1.CreateRaffleResponse{Raffle: raffleToProto(l)}, nil
}

func (h *RaffleHandler) PurchaseTickets(ctx context.Context, req *gumav1.PurchaseTicketsRequest) (*gumav1.PurchaseTicketsResponse, error) {
	if req.GuildId == "" || req.RaffleId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and raffle_id are required")
	}
	userID := session.UserIDFromContext(ctx)

	tickets, totalCost, err := h.svc.PurchaseTickets(ctx, req.GuildId, req.RaffleId, userID, req.Quantity)
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.RaffleTicket, len(tickets))
	for i, t := range tickets {
		protos[i] = raffleTicketToProto(t)
	}
	return &gumav1.PurchaseTicketsResponse{Tickets: protos, TotalCost: totalCost}, nil
}

func (h *RaffleHandler) GetRaffleWinners(ctx context.Context, req *gumav1.GetRaffleWinnersRequest) (*gumav1.GetRaffleWinnersResponse, error) {
	if req.GuildId == "" || req.RaffleId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and raffle_id are required")
	}
	winners, err := h.svc.GetWinners(ctx, req.GuildId, req.RaffleId)
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.RaffleWinner, len(winners))
	for i, w := range winners {
		protos[i] = raffleWinnerToProto(w)
	}
	return &gumav1.GetRaffleWinnersResponse{Winners: protos}, nil
}

func (h *RaffleHandler) UpdateRaffle(ctx context.Context, req *gumav1.UpdateRaffleRequest) (*gumav1.UpdateRaffleResponse, error) {
	if req.GuildId == "" || req.RaffleId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and raffle_id are required")
	}
	userID := session.UserIDFromContext(ctx)

	l, err := h.svc.Update(ctx, rafflesvc.UpdateParams{
		GuildID:           req.GuildId,
		RaffleID:          req.RaffleId,
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
	return &gumav1.UpdateRaffleResponse{Raffle: raffleToProto(l)}, nil
}

func (h *RaffleHandler) CancelRaffle(ctx context.Context, req *gumav1.CancelRaffleRequest) (*gumav1.CancelRaffleResponse, error) {
	if req.GuildId == "" || req.RaffleId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and raffle_id are required")
	}
	userID := session.UserIDFromContext(ctx)

	l, err := h.svc.Cancel(ctx, req.GuildId, req.RaffleId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CancelRaffleResponse{Raffle: raffleToProto(l)}, nil
}

func (h *RaffleHandler) DeleteRaffle(ctx context.Context, req *gumav1.DeleteRaffleRequest) (*gumav1.DeleteRaffleResponse, error) {
	if req.GuildId == "" || req.RaffleId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and raffle_id are required")
	}
	userID := session.UserIDFromContext(ctx)

	if err := h.svc.Delete(ctx, req.GuildId, req.RaffleId, userID); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteRaffleResponse{Success: true}, nil
}

func (h *RaffleHandler) DrawRaffle(ctx context.Context, req *gumav1.DrawRaffleRequest) (*gumav1.DrawRaffleResponse, error) {
	if req.GuildId == "" || req.RaffleId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and raffle_id are required")
	}
	userID := session.UserIDFromContext(ctx)

	l, winners, err := h.svc.Draw(ctx, req.GuildId, req.RaffleId, userID)
	if err != nil {
		return nil, toStatus(err)
	}

	winnerProtos := make([]*gumav1.RaffleWinner, len(winners))
	for i, w := range winners {
		winnerProtos[i] = raffleWinnerToProto(w)
	}
	return &gumav1.DrawRaffleResponse{Raffle: raffleToProto(l), Winners: winnerProtos}, nil
}

func (h *RaffleHandler) ListMyTickets(ctx context.Context, req *gumav1.ListMyTicketsRequest) (*gumav1.ListMyTicketsResponse, error) {
	userID := session.UserIDFromContext(ctx)

	result, err := h.svc.ListMyTickets(ctx, userID, req.GuildId, int(req.PageSize), rafflesvc.ParsePageToken(req.PageToken))
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.RaffleTicket, len(result.Tickets))
	for i, t := range result.Tickets {
		protos[i] = raffleTicketToProto(t)
	}
	return &gumav1.ListMyTicketsResponse{
		Tickets:       protos,
		NextPageToken: rafflesvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

// --- proto conversion helpers ---

func raffleToProto(l *rafflesvc.Raffle) *gumav1.Raffle {
	prizes := make([]*gumav1.RafflePrize, len(l.Prizes))
	for i, p := range l.Prizes {
		prizes[i] = rafflePrizeToProto(p)
	}
	winners := make([]*gumav1.RaffleWinner, len(l.Winners))
	for i, w := range l.Winners {
		winners[i] = raffleWinnerToProto(w)
	}
	proto := &gumav1.Raffle{
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

func rafflePrizeToProto(p rafflesvc.RafflePrize) *gumav1.RafflePrize {
	proto := &gumav1.RafflePrize{
		Rank:        p.Rank,
		Description: p.Description,
		Amount:      p.Amount,
	}
	if p.Item != nil {
		proto.Item = itemToProto(*p.Item)
	}
	return proto
}

func raffleTicketToProto(t *rafflesvc.RaffleTicket) *gumav1.RaffleTicket {
	return &gumav1.RaffleTicket{
		Id:           t.ID,
		RaffleId:     t.RaffleID,
		UserId:       t.UserID,
		TicketNumber: t.TicketNumber,
		PurchasedAt:  timestamppb.New(t.PurchasedAt),
	}
}

func raffleWinnerToProto(w *rafflesvc.RaffleWinner) *gumav1.RaffleWinner {
	return &gumav1.RaffleWinner{
		Id:               w.ID,
		RaffleId:         w.RaffleID,
		UserId:           w.UserID,
		Username:         w.Username,
		AvatarUrl:        w.AvatarURL,
		Rank:             w.Rank,
		PrizeAmount:      w.PrizeAmount,
		PrizeDescription: w.PrizeDescription,
		TicketNumber:     w.TicketNumber,
	}
}

func prizesFromProto(protos []*gumav1.RafflePrize) []rafflesvc.RafflePrize {
	prizes := make([]rafflesvc.RafflePrize, len(protos))
	for i, p := range protos {
		prize := rafflesvc.RafflePrize{
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
