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
	checkinsvc "github.com/kia280/guma/internal/services/checkin"
	"github.com/kia280/guma/internal/session"
)

// CheckInHandler is a thin gRPC adapter over the check-in service.
type CheckInHandler struct {
	gumav1.UnimplementedCheckInServiceServer
	svc    *checkinsvc.Service
	logger zerolog.Logger
}

// NewCheckInService creates a new CheckIn gRPC handler.
func NewCheckInService(db *database.Pool, logger zerolog.Logger) *CheckInHandler {
	return &CheckInHandler{
		svc:    checkinsvc.New(db, logger),
		logger: logger.With().Str("handler", "checkin").Logger(),
	}
}

func (h *CheckInHandler) ListCheckIns(ctx context.Context, req *gumav1.ListCheckInsRequest) (*gumav1.ListCheckInsResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	result, err := h.svc.List(ctx, checkinsvc.ListParams{
		GuildID:  req.GuildId,
		Status:   req.Status,
		PageSize: int(req.PageSize),
		Offset:   checkinsvc.ParsePageToken(req.PageToken),
	})
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.CheckIn, len(result.CheckIns))
	for i, c := range result.CheckIns {
		protos[i] = checkinToProto(c)
	}
	return &gumav1.ListCheckInsResponse{
		Checkins:      protos,
		NextPageToken: checkinsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

func (h *CheckInHandler) GetCheckIn(ctx context.Context, req *gumav1.GetCheckInRequest) (*gumav1.GetCheckInResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and check_in_id are required")
	}
	c, err := h.svc.Get(ctx, req.GuildId, req.CheckinId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetCheckInResponse{Checkin: checkinToProto(c)}, nil
}

func (h *CheckInHandler) CreateCheckIn(ctx context.Context, req *gumav1.CreateCheckInRequest) (*gumav1.CreateCheckInResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	c, err := h.svc.Create(ctx, checkinsvc.CreateParams{
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
	return &gumav1.CreateCheckInResponse{Checkin: checkinToProto(c)}, nil
}

func (h *CheckInHandler) UpdateCheckIn(ctx context.Context, req *gumav1.UpdateCheckInRequest) (*gumav1.UpdateCheckInResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and check_in_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	c, err := h.svc.Update(ctx, checkinsvc.UpdateParams{
		GuildID:     req.GuildId,
		CheckInID:   req.CheckinId,
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
	return &gumav1.UpdateCheckInResponse{Checkin: checkinToProto(c)}, nil
}

func (h *CheckInHandler) DeleteCheckIn(ctx context.Context, req *gumav1.DeleteCheckInRequest) (*gumav1.DeleteCheckInResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and check_in_id are required")
	}
	if err := h.svc.Delete(ctx, req.GuildId, req.CheckinId); err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DeleteCheckInResponse{Success: true}, nil
}

func (h *CheckInHandler) CompleteCheckIn(ctx context.Context, req *gumav1.CompleteCheckInRequest) (*gumav1.CompleteCheckInResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and check_in_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	c, err := h.svc.Complete(ctx, req.GuildId, req.CheckinId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CompleteCheckInResponse{Checkin: checkinToProto(c)}, nil
}

func (h *CheckInHandler) UpdateCheckInLoot(ctx context.Context, req *gumav1.UpdateCheckInLootRequest) (*gumav1.UpdateCheckInLootResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and check_in_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	lootList := make([]models.Item, len(req.LootList))
	for i, item := range req.LootList {
		lootList[i] = itemFromProto(item)
	}

	c, err := h.svc.UpdateLoot(ctx, checkinsvc.UpdateLootParams{
		GuildID:   req.GuildId,
		CheckInID: req.CheckinId,
		UpdatedBy: userID,
		LootList:  lootList,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateCheckInLootResponse{Checkin: checkinToProto(c)}, nil
}

func (h *CheckInHandler) CancelCheckIn(ctx context.Context, req *gumav1.CancelCheckInRequest) (*gumav1.CancelCheckInResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and check_in_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	c, err := h.svc.Cancel(ctx, req.GuildId, req.CheckinId, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.CancelCheckInResponse{Checkin: checkinToProto(c)}, nil
}

func (h *CheckInHandler) AssignLoot(ctx context.Context, req *gumav1.AssignLootRequest) (*gumav1.AssignLootResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" || req.ItemId == "" || req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id, checkin_id, item_id and user_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	backpackItemID, err := h.svc.AssignLoot(ctx, req.GuildId, req.CheckinId, req.ItemId, userID, req.UserId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.AssignLootResponse{BackpackItemId: backpackItemID}, nil
}

func (h *CheckInHandler) GetCheckInGold(ctx context.Context, req *gumav1.GetCheckInGoldRequest) (*gumav1.GetCheckInGoldResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and checkin_id are required")
	}
	if session.UserIDFromContext(ctx) == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	summary, err := h.svc.GetGold(ctx, req.GuildId, req.CheckinId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetCheckInGoldResponse{
		Pot:        goldPotToProto(summary.Pot),
		Recipients: goldPayoutsToProto(summary.Recipients),
	}, nil
}

func (h *CheckInHandler) DistributeCheckInGold(ctx context.Context, req *gumav1.DistributeCheckInGoldRequest) (*gumav1.DistributeCheckInGoldResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" || req.RequestId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id, checkin_id and request_id are required")
	}
	if len(req.Payouts) == 0 {
		return nil, status.Error(codes.InvalidArgument, "payouts are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	payouts := make([]checkinsvc.GoldPayout, len(req.Payouts))
	for i, p := range req.Payouts {
		payouts[i] = checkinsvc.GoldPayout{UserID: p.UserId, Amount: p.Amount}
	}
	result, err := h.svc.DistributeGold(ctx, checkinsvc.DistributeGoldParams{
		GuildID:   req.GuildId,
		CheckInID: req.CheckinId,
		ActorID:   userID,
		RequestID: req.RequestId,
		Payouts:   payouts,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.DistributeCheckInGoldResponse{
		DistributionId: result.DistributionID,
		Pot:            goldPotToProto(&result.Pot),
		Payouts:        goldPayoutsToProto(result.Payouts),
		Replayed:       result.Replayed,
	}, nil
}

func (h *CheckInHandler) SubmitAttendance(ctx context.Context, req *gumav1.SubmitAttendanceRequest) (*gumav1.SubmitAttendanceResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and check_in_id are required")
	}
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	attendee, err := h.svc.SubmitAttendance(ctx, req.GuildId, req.CheckinId, userID, req.Notes)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.SubmitAttendanceResponse{Attendee: checkinAttendeeToProto(attendee)}, nil
}

func (h *CheckInHandler) ListAttendees(ctx context.Context, req *gumav1.ListAttendeesRequest) (*gumav1.ListAttendeesResponse, error) {
	if req.GuildId == "" || req.CheckinId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id and check_in_id are required")
	}
	result, err := h.svc.ListAttendees(ctx, req.GuildId, req.CheckinId, int(req.PageSize), checkinsvc.ParsePageToken(req.PageToken))
	if err != nil {
		return nil, toStatus(err)
	}

	protos := make([]*gumav1.CheckInAttendee, len(result.Attendees))
	for i, a := range result.Attendees {
		protos[i] = checkinAttendeeToProto(a)
	}
	return &gumav1.ListAttendeesResponse{
		Attendees:     protos,
		NextPageToken: checkinsvc.NextPageToken(result.NextOffset),
		TotalCount:    result.TotalCount,
	}, nil
}

// --- proto conversion helpers ---

func checkinToProto(c *checkinsvc.CheckIn) *gumav1.CheckIn {
	lootList := make([]*gumav1.Item, len(c.LootList))
	for i, item := range c.LootList {
		lootList[i] = itemToProto(item)
	}
	proto := &gumav1.CheckIn{
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

func lootToProto(entries []checkinsvc.LootEntry) []*gumav1.CheckInLootEntry {
	protos := make([]*gumav1.CheckInLootEntry, len(entries))
	for i, e := range entries {
		protos[i] = &gumav1.CheckInLootEntry{Kind: e.Kind, Item: itemToProto(e.Item), Amount: e.Amount}
	}
	return protos
}

func lootFromProto(entries []*gumav1.CheckInLootEntry, legacy []*gumav1.Item) []checkinsvc.LootEntry {
	if len(entries) == 0 {
		loot := make([]checkinsvc.LootEntry, len(legacy))
		for i, item := range legacy {
			loot[i] = checkinsvc.LootEntry{Kind: checkinsvc.LootKindItem, Item: itemFromProto(item)}
		}
		return loot
	}
	loot := make([]checkinsvc.LootEntry, len(entries))
	for i, e := range entries {
		loot[i] = checkinsvc.LootEntry{Kind: e.Kind, Amount: e.Amount}
		if e.Item != nil {
			loot[i].Item = itemFromProto(e.Item)
		}
	}
	return loot
}

func goldPotToProto(pot *checkinsvc.GoldPot) *gumav1.CheckInGoldPot {
	if pot == nil {
		return nil
	}
	return &gumav1.CheckInGoldPot{
		Total:       pot.Total,
		Distributed: pot.Distributed,
		Retracted:   pot.Retracted,
		Remaining:   pot.Remaining(),
	}
}

func goldPayoutsToProto(payouts []checkinsvc.GoldPayout) []*gumav1.CheckInGoldPayout {
	protos := make([]*gumav1.CheckInGoldPayout, len(payouts))
	for i, p := range payouts {
		protos[i] = &gumav1.CheckInGoldPayout{UserId: p.UserID, Amount: p.Amount}
	}
	return protos
}

func checkinAttendeeToProto(a *checkinsvc.CheckInAttendee) *gumav1.CheckInAttendee {
	return &gumav1.CheckInAttendee{
		Id:          a.ID,
		CheckinId:   a.CheckInID,
		UserId:      a.UserID,
		DisplayName: a.DisplayName,
		AvatarUrl:   a.AvatarURL,
		AttendedAt:  timestamppb.New(a.AttendedAt),
		Notes:       a.Notes,
	}
}
