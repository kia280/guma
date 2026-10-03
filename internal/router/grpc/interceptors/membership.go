package interceptors

import (
	"context"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	healthpb "google.golang.org/grpc/health/grpc_health_v1"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/session"
)

var MembershipExemptMethods = map[string]bool{
	healthpb.Health_Check_FullMethodName: true,
	healthpb.Health_List_FullMethodName:  true,

	gumav1.GumaService_GetAppConfig_FullMethodName:          true,
	gumav1.GumaService_GetUserPreferences_FullMethodName:    true,
	gumav1.GumaService_UpdateUserPreferences_FullMethodName: true,

	gumav1.GuildService_CreateGuild_FullMethodName:     true,
	gumav1.GuildService_GetCurrentGuild_FullMethodName: true,
	gumav1.GuildService_ListGuilds_FullMethodName:      true,
	gumav1.GuildService_GetGuild_FullMethodName:        true,
	gumav1.GuildService_GetGuildLogo_FullMethodName:    true,
	gumav1.GuildService_JoinGuildById_FullMethodName:   true,

	gumav1.MemberService_JoinGuild_FullMethodName:          true,
	gumav1.MemberService_ValidateInviteCode_FullMethodName: true,

	gumav1.NotificationService_GetUnreadNotificationCount_FullMethodName: true,
	gumav1.NotificationService_ListNotifications_FullMethodName:          true,
	gumav1.NotificationService_MarkAllNotificationsRead_FullMethodName:   true,
	gumav1.NotificationService_MarkNotificationRead_FullMethodName:       true,

	gumav1.PreferenceService_GetMyPreferences_FullMethodName:    true,
	gumav1.PreferenceService_UpdateMyPreferences_FullMethodName: true,

	gumav1.UserService_GetMe_FullMethodName:        true,
	gumav1.UserService_GetUser_FullMethodName:      true,
	gumav1.UserService_GetUserStats_FullMethodName: true,
	gumav1.UserService_UpdateMe_FullMethodName:     true,
}

type guildScoped interface {
	GetGuildId() string
}

func GuildMembershipInterceptor(checker authz.Checker) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		if MembershipExemptMethods[info.FullMethod] {
			return handler(ctx, req)
		}
		scoped, ok := req.(guildScoped)
		if !ok {
			return nil, status.Errorf(codes.PermissionDenied, "%s is neither guild scoped nor exempt from membership checks", info.FullMethod)
		}
		if scoped.GetGuildId() == "" {
			return handler(ctx, req)
		}
		guildID, err := uuid.Parse(scoped.GetGuildId())
		if err != nil {
			return nil, status.Error(codes.InvalidArgument, "guild_id must be a UUID")
		}
		userID, err := uuid.Parse(session.UserIDFromContext(ctx))
		if err != nil {
			return nil, status.Error(codes.Unauthenticated, "user not authenticated")
		}
		member, err := authz.Allowed(ctx, checker, guildID, userID, authz.View)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "check guild membership: %v", err)
		}
		if !member {
			return nil, status.Error(codes.PermissionDenied, "not a member of this guild")
		}
		return handler(ctx, req)
	}
}
