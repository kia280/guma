package handlers

import (
	"context"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	usersvc "github.com/kia280/guma/internal/services/user"
	"github.com/kia280/guma/internal/session"
)

// UserHandler is a thin gRPC adapter over the user service.
type UserHandler struct {
	gumav1.UnimplementedUserServiceServer
	svc    *usersvc.Service
	logger zerolog.Logger
}

// NewUserService creates a new User gRPC handler. kratosPublicURL is used
// by the service's GetMe to refresh the profile from Kratos.
func NewUserService(db *database.Pool, kratosPublicURL string, logger zerolog.Logger, opts ...usersvc.Option) *UserHandler {
	return &UserHandler{
		svc:    usersvc.New(db, kratosPublicURL, logger, opts...),
		logger: logger.With().Str("handler", "user").Logger(),
	}
}

func (h *UserHandler) GetMe(ctx context.Context, _ *gumav1.GetMeRequest) (*gumav1.GetMeResponse, error) {
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	cookie := session.CookieFromContext(ctx)
	h.logger.Info().
		Str("user_id", userID).
		Str("cookie", cookie).
		Msg("GetMe called")
	u, err := h.svc.GetMe(ctx, userID, cookie)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetMeResponse{User: userToProto(u)}, nil
}

func (h *UserHandler) UpdateMe(ctx context.Context, req *gumav1.UpdateMeRequest) (*gumav1.UpdateMeResponse, error) {
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	u, err := h.svc.UpdateMe(ctx, userID, usersvc.UpdateParams{
		DisplayName: req.DisplayName,
		Username:    req.Username,
		Bio:         req.Bio,
		AvatarURL:   req.AvatarUrl,
	})
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.UpdateMeResponse{User: userToProto(u)}, nil
}

func (h *UserHandler) GetUser(ctx context.Context, req *gumav1.GetUserRequest) (*gumav1.GetUserResponse, error) {
	if req.UserId == "" {
		return nil, status.Error(codes.InvalidArgument, "user_id is required")
	}

	u, err := h.svc.GetUser(ctx, req.UserId)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetUserResponse{User: userToProto(u)}, nil
}

func (h *UserHandler) GetUserStats(ctx context.Context, _ *gumav1.GetUserStatsRequest) (*gumav1.GetUserStatsResponse, error) {
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	st, err := h.svc.GetStats(ctx, userID)
	if err != nil {
		return nil, toStatus(err)
	}
	return &gumav1.GetUserStatsResponse{
		Stats: &gumav1.UserStats{
			GuildsJoined:      st.GuildsJoined,
			EventsAttended:    st.EventsAttended,
			AuctionsWon:       st.AuctionsWon,
			LotteriesWon:      st.LotteriesWon,
			TotalEarned:       st.TotalEarned,
			TotalSpent:        st.TotalSpent,
			CheckinsCompleted: st.CheckinsCompleted,
		},
	}, nil
}

func (h *UserHandler) GetBalanceTrend(ctx context.Context, req *gumav1.GetBalanceTrendRequest) (*gumav1.GetBalanceTrendResponse, error) {
	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	points, err := h.svc.GetBalanceTrend(ctx, userID, req.Days)
	if err != nil {
		return nil, toStatus(err)
	}

	proto := make([]*gumav1.BalancePoint, len(points))
	for i, p := range points {
		proto[i] = &gumav1.BalancePoint{Date: p.Date, Balance: p.Balance}
	}
	return &gumav1.GetBalanceTrendResponse{Points: proto}, nil
}

// --- proto conversion helpers ---

func userToProto(u *usersvc.User) *gumav1.User {
	return &gumav1.User{
		Id:               u.ID,
		Email:            u.Email,
		Username:         u.Username,
		DisplayName:      u.DisplayName,
		Bio:              u.Bio,
		AvatarUrl:        u.AvatarURL,
		GuildIds:         u.GuildIDs,
		CurrentGuildId:   u.CurrentGuildID,
		CurrentGuildRole: u.CurrentGuildRole,
		Balance:          u.Balance,
		CreatedAt:        timestamppb.New(u.CreatedAt),
		UpdatedAt:        timestamppb.New(u.UpdatedAt),
	}
}
