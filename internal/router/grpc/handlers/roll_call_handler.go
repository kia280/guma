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
	rollcallsvc "github.com/kia280/guma/internal/services/rollcall"
	"github.com/kia280/guma/internal/session"
)

// RollCallHandler is a thin gRPC adapter over the roll call service.
type RollCallHandler struct {
	gumav1.UnimplementedRollCallServiceServer
	svc    *rollcallsvc.Service
	logger zerolog.Logger
}

// NewRollCallService creates a new roll call gRPC handler.
func NewRollCallService(db *database.Pool, logger zerolog.Logger) *RollCallHandler {
	return &RollCallHandler{
		svc:    rollcallsvc.New(db, logger),
		logger: logger.With().Str("handler", "roll_call").Logger(),
	}
}

func (h *RollCallHandler) ListRollCalls(ctx context.Context, req *gumav1.ListRollCallsRequest) (*gumav1.ListRollCallsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	result, err := h.svc.List(ctx, rollcallsvc.ListParams{
		GuildID:  req.GuildId,
		Status:   req.Status,
		PageSize: int(req.PageSize),
		Offset:   rollcallsvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.RollCall, len(result.RollCalls))
	for i, c := range result.RollCalls {
		protos[i] = rollCallToProto(c)
	}
	return &gumav1.ListRollCallsResponse{
		RollCalls:     protos,
		NextPageToken: rollcallsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *RollCallHandler) GetRollCall(ctx context.Context, req *gumav1.GetRollCallRequest) (*gumav1.GetRollCallResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and roll_call_id are required")
	}
	c, err := h.svc.Get(ctx, req.GuildId, req.RollCallId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetRollCallResponse{RollCall: rollCallToProto(c)}, nil
}

func (h *RollCallHandler) CreateRollCall(ctx context.Context, req *gumav1.CreateRollCallRequest) (*gumav1.CreateRollCallResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	c, err := h.svc.Create(ctx, rollcallsvc.CreateParams{
		GuildID:     req.GuildId,
		CreatedBy:   userID,
		Title:       req.Title,
		Description: req.Description,
		Datetime:    req.Datetime,
		ExpireTime:  req.ExpireTime,
		ImageURL:    req.ImageUrl,
		Loot:        lootFromProto(req.Loot, req.LootList),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CreateRollCallResponse{RollCall: rollCallToProto(c)}, nil
}

func (h *RollCallHandler) UpdateRollCall(ctx context.Context, req *gumav1.UpdateRollCallRequest) (*gumav1.UpdateRollCallResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and roll_call_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	c, err := h.svc.Update(ctx, rollcallsvc.UpdateParams{
		GuildID:     req.GuildId,
		RollCallID:  req.RollCallId,
		UpdatedBy:   userID,
		Title:       req.Title,
		Description: req.Description,
		Datetime:    req.Datetime,
		ExpireTime:  req.ExpireTime,
		ImageURL:    req.ImageUrl,
		Loot:        lootFromProto(req.Loot, req.LootList),
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateRollCallResponse{RollCall: rollCallToProto(c)}, nil
}

func (h *RollCallHandler) DeleteRollCall(ctx context.Context, req *gumav1.DeleteRollCallRequest) (*gumav1.DeleteRollCallResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and roll_call_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	if err := h.svc.Delete(ctx, req.GuildId, req.RollCallId, userID); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteRollCallResponse{Success: true}, nil
}

func (h *RollCallHandler) CompleteRollCall(ctx context.Context, req *gumav1.CompleteRollCallRequest) (*gumav1.CompleteRollCallResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and roll_call_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	c, err := h.svc.Complete(ctx, req.GuildId, req.RollCallId, userID, req.KeepLeftoversInBank)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CompleteRollCallResponse{RollCall: rollCallToProto(c)}, nil
}

func (h *RollCallHandler) UpdateRollCallLoot(ctx context.Context, req *gumav1.UpdateRollCallLootRequest) (*gumav1.UpdateRollCallLootResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and roll_call_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	lootList := make([]models.Item, len(req.LootList))
	for i, item := range req.LootList {
		lootList[i] = itemFromProto(item)
	}

	c, err := h.svc.UpdateLoot(ctx, rollcallsvc.UpdateLootParams{
		GuildID:    req.GuildId,
		RollCallID: req.RollCallId,
		UpdatedBy:  userID,
		LootList:   lootList,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateRollCallLootResponse{RollCall: rollCallToProto(c)}, nil
}

func (h *RollCallHandler) CancelRollCall(ctx context.Context, req *gumav1.CancelRollCallRequest) (*gumav1.CancelRollCallResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and roll_call_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	c, err := h.svc.Cancel(ctx, req.GuildId, req.RollCallId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CancelRollCallResponse{RollCall: rollCallToProto(c)}, nil
}

func (h *RollCallHandler) AssignLoot(ctx context.Context, req *gumav1.AssignLootRequest) (*gumav1.AssignLootResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" || req.ItemId == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id, roll_call_id, item_id and user_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	backpackItemID, err := h.svc.AssignLoot(ctx, req.GuildId, req.RollCallId, req.ItemId, userID, req.UserId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.AssignLootResponse{BackpackItemId: backpackItemID}, nil
}

func (h *RollCallHandler) GetRollCallGold(ctx context.Context, req *gumav1.GetRollCallGoldRequest) (*gumav1.GetRollCallGoldResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and roll_call_id are required")
	}
	if session.UserIDFromContext(ctx) == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	summary, err := h.svc.GetGold(ctx, req.GuildId, req.RollCallId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetRollCallGoldResponse{
		Pot:        goldPotToProto(summary.Pot),
		Recipients: goldPayoutsToProto(summary.Recipients),
	}, nil
}

func (h *RollCallHandler) DistributeRollCallGold(ctx context.Context, req *gumav1.DistributeRollCallGoldRequest) (*gumav1.DistributeRollCallGoldResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" || req.RequestId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id, roll_call_id and request_id are required")
	}
	if len(req.Payouts) == 0 {
		return nil, status.Error(codes.InvalidArgument, "payouts are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	payouts := make([]rollcallsvc.GoldPayout, len(req.Payouts))
	for i, p := range req.Payouts {
		payouts[i] = rollcallsvc.GoldPayout{UserID: p.UserId, Amount: p.Amount}
	}
	result, err := h.svc.DistributeGold(ctx, rollcallsvc.DistributeGoldParams{
		GuildID:    req.GuildId,
		RollCallID: req.RollCallId,
		ActorID:    userID,
		RequestID:  req.RequestId,
		Payouts:    payouts,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DistributeRollCallGoldResponse{
		DistributionId: result.DistributionID,
		Pot:            goldPotToProto(&result.Pot),
		Payouts:        goldPayoutsToProto(result.Payouts),
		Replayed:       result.Replayed,
	}, nil
}

func (h *RollCallHandler) CheckIn(ctx context.Context, req *gumav1.CheckInRequest) (*gumav1.CheckInResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and roll_call_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	attendee, err := h.svc.CheckIn(ctx, req.GuildId, req.RollCallId, userID, req.Notes)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CheckInResponse{Attendee: attendeeToProto(attendee)}, nil
}

func (h *RollCallHandler) ListAttendees(ctx context.Context, req *gumav1.ListAttendeesRequest) (*gumav1.ListAttendeesResponse, error) {
	if req.GuildId == "" || req.RollCallId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and roll_call_id are required")
	}
	result, err := h.svc.ListAttendees(ctx, req.GuildId, req.RollCallId, int(req.PageSize), rollcallsvc.ParsePageToken(req.PageToken))
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.RollCallAttendee, len(result.Attendees))
	for i, a := range result.Attendees {
		protos[i] = attendeeToProto(a)
	}
	return &gumav1.ListAttendeesResponse{
		Attendees:     protos,
		NextPageToken: rollcallsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

// --- proto conversion helpers ---

func rollCallToProto(c *rollcallsvc.RollCall) *gumav1.RollCall {
	lootList := make([]*gumav1.Item, len(c.LootList))
	for i, item := range c.LootList {
		lootList[i] = itemToProto(item)
	}
	proto := &gumav1.RollCall{
		Id:              c.ID,
		GuildId:         c.GuildID,
		CreatedBy:       c.CreatedBy,
		Title:           c.Title,
		Description:     c.Description,
		Datetime:        c.Datetime,
		ExpireTime:      c.ExpireTime,
		ImageUrl:        c.ImageURL,
		LootList:        lootList,
		AttendanceCount: c.AttendanceCount,
		IsExpired:       c.IsExpired,
		IsCancelled:     c.IsCancelled,
		CreatedAt:       timestamppb.New(c.CreatedAt),
		UpdatedAt:       timestamppb.New(c.UpdatedAt),
		Loot:            lootToProto(c.Loot),
		GoldPot:         goldPotToProto(c.GoldPot),
		IsCompleted:     c.IsCompleted,
	}
	if c.CompletedAt != nil {
		proto.CompletedAt = timestamppb.New(*c.CompletedAt)
	}
	return proto
}

func lootToProto(entries []rollcallsvc.LootEntry) []*gumav1.RollCallLootEntry {
	protos := make([]*gumav1.RollCallLootEntry, len(entries))
	for i, e := range entries {
		protos[i] = &gumav1.RollCallLootEntry{Kind: e.Kind, Item: itemToProto(e.Item), Amount: e.Amount}
	}
	return protos
}

func lootFromProto(entries []*gumav1.RollCallLootEntry, legacy []*gumav1.Item) []rollcallsvc.LootEntry {
	if len(entries) == 0 {
		loot := make([]rollcallsvc.LootEntry, len(legacy))
		for i, item := range legacy {
			loot[i] = rollcallsvc.LootEntry{Kind: rollcallsvc.LootKindItem, Item: itemFromProto(item)}
		}
		return loot
	}
	loot := make([]rollcallsvc.LootEntry, len(entries))
	for i, e := range entries {
		loot[i] = rollcallsvc.LootEntry{Kind: e.Kind, Amount: e.Amount}
		if e.Item != nil {
			loot[i].Item = itemFromProto(e.Item)
		}
	}
	return loot
}

func goldPotToProto(pot *rollcallsvc.GoldPot) *gumav1.RollCallGoldPot {
	if pot == nil {
		return nil
	}
	return &gumav1.RollCallGoldPot{
		Total:       pot.Total,
		Distributed: pot.Distributed,
		Retracted:   pot.Retracted,
		Remaining:   pot.Remaining(),
		Kept:        pot.Kept(),
	}
}

func goldPayoutsToProto(payouts []rollcallsvc.GoldPayout) []*gumav1.RollCallGoldPayout {
	protos := make([]*gumav1.RollCallGoldPayout, len(payouts))
	for i, p := range payouts {
		protos[i] = &gumav1.RollCallGoldPayout{UserId: p.UserID, Amount: p.Amount}
	}
	return protos
}

func attendeeToProto(a *rollcallsvc.Attendee) *gumav1.RollCallAttendee {
	return &gumav1.RollCallAttendee{
		Id:          a.ID,
		RollCallId:  a.RollCallID,
		UserId:      a.UserID,
		DisplayName: a.DisplayName,
		AvatarUrl:   a.AvatarURL,
		CheckedInAt: timestamppb.New(a.CheckedInAt),
		Notes:       a.Notes,
	}
}
