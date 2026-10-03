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

var GuildAuthzExemptMethods = map[string]bool{
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

func GuildAuthzInterceptor(checker authz.Checker) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		if GuildAuthzExemptMethods[info.FullMethod] {
			return handler(ctx, req)
		}
		permission, declared := MethodPermissions[info.FullMethod]
		scoped, ok := req.(guildScoped)
		if !declared || !ok {
			return nil, status.Errorf(codes.PermissionDenied, "%s has no declared guild permission", info.FullMethod)
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
		allowed, err := authz.Allowed(ctx, checker, guildID, userID, permission)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "check guild permission %s: %v", permission, err)
		}
		if !allowed {
			return nil, status.Errorf(codes.PermissionDenied, "requires guild permission %s", permission)
		}
		return handler(ctx, req)
	}
}
