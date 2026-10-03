package handlers

import (
	"context"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/database"
	"github.com/kia280/guma/internal/ids"
	rafflesvc "github.com/kia280/guma/internal/services/raffle"
)

// RaffleHandler is a thin gRPC adapter over the raffle service.
type RaffleHandler struct {
	gumav1.UnimplementedRaffleServiceServer
	svc    *rafflesvc.Service
	logger zerolog.Logger
}

// NewRaffleService creates a new Raffle gRPC handler.
func NewRaffleService(db *database.Pool, az authz.Authorizer, logger zerolog.Logger) *RaffleHandler {
	return &RaffleHandler{
		svc:    rafflesvc.New(db, az, logger),
		logger: logger.With().Str("handler", "raffle").Logger(),
	}
}

func (h *RaffleHandler) ListRaffles(ctx context.Context, req *gumav1.ListRafflesRequest) (*gumav1.ListRafflesResponse, error) {
	var in struct{ GuildID uuid.UUID }
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	result, err := h.svc.List(ctx, rafflesvc.ListParams{
		GuildID:  in.GuildID,
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
	var in struct {
		GuildID  uuid.UUID
		RaffleID uuid.UUID
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	l, err := h.svc.Get(ctx, in.GuildID, in.RaffleID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetRaffleResponse{Raffle: raffleToProto(l)}, nil
}

func (h *RaffleHandler) CreateRaffle(ctx context.Context, req *gumav1.CreateRaffleRequest) (*gumav1.CreateRaffleResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID uuid.UUID
		Prizes  []struct{ Source *itemSourceIDs }
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	l, err := h.svc.Create(ctx, rafflesvc.CreateParams{
		GuildID:           in.GuildID,
		CreatedBy:         userID,
		Title:             req.Title,
		Description:       req.Description,
		TicketPrice:       req.TicketPrice,
		MaxTickets:        req.MaxTickets,
		MaxTicketsPerUser: req.MaxTicketsPerUser,
		DrawDate:          req.DrawDate,
		Prizes:            prizesFromProto(req.Prizes, in.Prizes),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateRaffleResponse{Raffle: raffleToProto(l)}, nil
}

func (h *RaffleHandler) PurchaseTickets(ctx context.Context, req *gumav1.PurchaseTicketsRequest) (*gumav1.PurchaseTicketsResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID  uuid.UUID
		RaffleID uuid.UUID
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	tickets, totalCost, err := h.svc.PurchaseTickets(ctx, in.GuildID, in.RaffleID, userID, req.Quantity)
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
	var in struct {
		GuildID  uuid.UUID
		RaffleID uuid.UUID
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}
	winners, err := h.svc.GetWinners(ctx, in.GuildID, in.RaffleID)
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID  uuid.UUID
		RaffleID uuid.UUID
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	l, err := h.svc.Update(ctx, rafflesvc.UpdateParams{
		GuildID:           in.GuildID,
		RaffleID:          in.RaffleID,
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID  uuid.UUID
		RaffleID uuid.UUID
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	l, err := h.svc.Cancel(ctx, in.GuildID, in.RaffleID, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CancelRaffleResponse{Raffle: raffleToProto(l)}, nil
}

func (h *RaffleHandler) DeleteRaffle(ctx context.Context, req *gumav1.DeleteRaffleRequest) (*gumav1.DeleteRaffleResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID  uuid.UUID
		RaffleID uuid.UUID
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	if err := h.svc.Delete(ctx, in.GuildID, in.RaffleID, userID); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteRaffleResponse{Success: true}, nil
}

func (h *RaffleHandler) DrawRaffle(ctx context.Context, req *gumav1.DrawRaffleRequest) (*gumav1.DrawRaffleResponse, error) {
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct {
		GuildID  uuid.UUID
		RaffleID uuid.UUID
	}
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	l, winners, err := h.svc.Draw(ctx, in.GuildID, in.RaffleID, userID)
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
	userID, err := callerID(ctx)
	if err != nil {
		return nil, err
	}
	var in struct{ GuildID *uuid.UUID }
	if err := ids.Bind(req, &in); err != nil {
		return nil, toStatus(err)
	}

	result, err := h.svc.ListMyTickets(ctx, userID, in.GuildID, int(req.PageSize), rafflesvc.ParsePageToken(req.PageToken))
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

func prizesFromProto(protos []*gumav1.RafflePrize, parsed []struct{ Source *itemSourceIDs }) []rafflesvc.RafflePrize {
	prizes := make([]rafflesvc.RafflePrize, len(protos))
	for i, p := range protos {
		prize := rafflesvc.RafflePrize{
			Rank:        p.Rank,
			Description: p.Description,
			Amount:      p.Amount,
			Source:      parsed[i].Source.ref(),
		}
		if p.Item != nil {
			item := itemFromProto(p.Item)
			prize.Item = &item
		}
		prizes[i] = prize
	}
	return prizes
}
