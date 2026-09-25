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
	"github.com/kia280/guma/internal/models"
	checkinsvc "github.com/kia280/guma/internal/services/checkin"
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

	lootList := itemsFromProto(req.LootList)

	c, err := h.svc.Create(ctx, checkinsvc.CreateParams{
		GuildID:     req.GuildId,
		CreatedBy:   userID,
		Title:       req.Title,
		Description: req.Description,
		Datetime:    req.Datetime,
		ExpireTime:  req.ExpireTime,
		ImageURL:    req.ImageUrl,
		LootList:    lootList,
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

	lootList := itemsFromProto(req.LootList)

	c, err := h.svc.Update(ctx, checkinsvc.UpdateParams{
		GuildID:     req.GuildId,
		CheckInID:   req.CheckinId,
		Title:       req.Title,
		Description: req.Description,
		Datetime:    req.Datetime,
		ExpireTime:  req.ExpireTime,
		ImageURL:    req.ImageUrl,
		LootList:    lootList,
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
	return &gumav1.CheckIn{
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
		CreatedAt:       timestamppb.New(c.CreatedAt),
		UpdatedAt:       timestamppb.New(c.UpdatedAt),
	}
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

func itemsFromProto(protos []*gumav1.Item) []models.Item {
	items := make([]models.Item, len(protos))
	for i, p := range protos {
		items[i] = itemFromProto(p)
	}
	return items
}
