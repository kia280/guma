package interceptors

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/reflect/protoregistry"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/authz"
	"github.com/kia280/guma/internal/authz/authztest"
	"github.com/kia280/guma/internal/session"
)

func TestGuildAuthzInterceptor(t *testing.T) {
	guild, officer, member, outsider := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	checker := authztest.New().
		Grant(guild, officer, authz.View, authz.ManageRaffles).
		Grant(guild, member, authz.View)
	viewMethod := gumav1.AuctionService_ListAuctions_FullMethodName
	viewReq := &gumav1.ListAuctionsRequest{GuildId: guild.String()}
	officerMethod := gumav1.RaffleService_CreateRaffle_FullMethodName
	officerReq := &gumav1.CreateRaffleRequest{GuildId: guild.String()}

	tests := []struct {
		name     string
		checker  authz.Checker
		method   string
		req      any
		userID   uuid.UUID
		wantCode codes.Code
	}{
		{name: "member on a view method", checker: checker, method: viewMethod, req: viewReq, userID: member, wantCode: codes.OK},
		{name: "non-member on a view method", checker: checker, method: viewMethod, req: viewReq, userID: outsider, wantCode: codes.PermissionDenied},
		{name: "officer on an officer method", checker: checker, method: officerMethod, req: officerReq, userID: officer, wantCode: codes.OK},
		{name: "member on an officer method", checker: checker, method: officerMethod, req: officerReq, userID: member, wantCode: codes.PermissionDenied},
		{name: "anonymous", checker: checker, method: viewMethod, req: viewReq, wantCode: codes.Unauthenticated},
		{name: "malformed guild id", checker: checker, method: viewMethod, req: &gumav1.ListAuctionsRequest{GuildId: "nope"}, userID: member, wantCode: codes.InvalidArgument},
		{name: "missing guild id is left to the handler", checker: checker, method: viewMethod, req: &gumav1.ListAuctionsRequest{}, userID: outsider, wantCode: codes.OK},
		{name: "checker failure", checker: &authztest.Fake{CanErr: errors.New("keto down")}, method: viewMethod, req: viewReq, userID: member, wantCode: codes.Internal},
		{name: "exempt method", checker: checker, method: gumav1.GuildService_JoinGuildById_FullMethodName, req: &gumav1.JoinGuildByIdRequest{GuildId: guild.String()}, userID: outsider, wantCode: codes.OK},
		{name: "undeclared method", checker: checker, method: "/guma.v1.NewService/Undeclared", req: viewReq, userID: officer, wantCode: codes.PermissionDenied},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.userID != uuid.Nil {
				ctx = session.WithUserID(ctx, tt.userID)
			}
			called := false
			handler := func(context.Context, any) (any, error) {
				called = true
				return "ok", nil
			}
			_, err := GuildAuthzInterceptor(tt.checker)(ctx, tt.req, &grpc.UnaryServerInfo{FullMethod: tt.method}, handler)
			if got := status.Code(err); got != tt.wantCode {
				t.Fatalf("code = %v, want %v (err %v)", got, tt.wantCode, err)
			}
			if called != (tt.wantCode == codes.OK) {
				t.Fatalf("handler called = %v, want %v", called, tt.wantCode == codes.OK)
			}
		})
	}
}

func TestEveryUnaryMethodDeclaresItsGuildAuthorization(t *testing.T) {
	registered := map[string]bool{}
	protoregistry.GlobalFiles.RangeFilesByPackage("guma.v1", func(fd protoreflect.FileDescriptor) bool {
		for i := 0; i < fd.Services().Len(); i++ {
			svc := fd.Services().Get(i)
			for j := 0; j < svc.Methods().Len(); j++ {
				m := svc.Methods().Get(j)
				if m.IsStreamingClient() || m.IsStreamingServer() {
					continue
				}
				method := "/" + string(svc.FullName()) + "/" + string(m.Name())
				registered[method] = true
				_, declared := MethodPermissions[method]
				exempt := GuildAuthzExemptMethods[method]
				switch {
				case declared && exempt:
					t.Errorf("%s is both exempt and has a declared permission", method)
				case declared && m.Input().Fields().ByName("guild_id") == nil:
					t.Errorf("%s declares a guild permission but its request has no guild_id", method)
				case !declared && !exempt:
					t.Errorf("%s must be added to MethodPermissions or GuildAuthzExemptMethods", method)
				}
			}
		}
		return true
	})
	if len(registered) == 0 {
		t.Fatal("no guma.v1 methods found in the proto registry")
	}
	for method := range MethodPermissions {
		if !registered[method] {
			t.Errorf("MethodPermissions lists unknown method %s", method)
		}
	}
}

func TestMethodPermissionsUseKnownPermissions(t *testing.T) {
	known := map[authz.Permission]bool{}
	for _, p := range authz.Permissions {
		known[p] = true
	}
	for method, p := range MethodPermissions {
		if !known[p] {
			t.Errorf("%s requires unknown permission %q", method, p)
		}
	}
}

type guildRequest string

func (g guildRequest) GetGuildId() string { return string(g) }

func TestGuildAuthzInterceptorEnforcesMethodPermissions(t *testing.T) {
	tests := []struct {
		method   string
		required authz.Permission
		lacking  []authz.Permission
	}{
		{gumav1.GuildService_UploadGuildLogo_FullMethodName, authz.ManageGuild, []authz.Permission{authz.View, authz.ManageRollCalls}},
		{gumav1.GuildService_DeleteGuildLogo_FullMethodName, authz.ManageGuild, []authz.Permission{authz.View}},
		{gumav1.GuildService_GetGuildStats_FullMethodName, authz.ViewStats, []authz.Permission{authz.View, authz.ReviewBankRequests}},
		{gumav1.BankService_DeleteBankItem_FullMethodName, authz.DeleteBankItems, []authz.Permission{authz.View, authz.ReviewBankRequests}},
		{gumav1.MemberService_UpdateMemberRole_FullMethodName, authz.ManageRoles, []authz.Permission{authz.View, authz.ViewMemberContacts, authz.ManageRollCalls}},
		{gumav1.AnnouncementService_CreateAnnouncementDraft_FullMethodName, authz.ManageAnnouncements, []authz.Permission{authz.View}},
		{gumav1.RollCallTemplateService_ListRollCallTemplates_FullMethodName, authz.ManageRollCallTemplates, []authz.Permission{authz.View, authz.ManageRollCalls}},
		{gumav1.RollCallTemplateService_CreateRollCallTemplate_FullMethodName, authz.ManageRollCallTemplates, []authz.Permission{authz.View, authz.ManageRollCalls}},
		{gumav1.RollCallTemplateService_UpdateRollCallTemplate_FullMethodName, authz.ManageRollCallTemplates, []authz.Permission{authz.View, authz.ManageRollCalls}},
		{gumav1.RollCallTemplateService_DeleteRollCallTemplate_FullMethodName, authz.ManageRollCallTemplates, []authz.Permission{authz.View, authz.ManageRollCalls}},
		{gumav1.ItemTemplateService_ListItemTemplates_FullMethodName, authz.ManageRollCallTemplates, []authz.Permission{authz.View, authz.ManageRollCalls}},
		{gumav1.ItemTemplateService_CreateItemTemplate_FullMethodName, authz.ManageRollCallTemplates, []authz.Permission{authz.View, authz.ManageRollCalls}},
		{gumav1.ItemTemplateService_UpdateItemTemplate_FullMethodName, authz.ManageRollCallTemplates, []authz.Permission{authz.View, authz.ManageRollCalls}},
		{gumav1.ItemTemplateService_DeleteItemTemplate_FullMethodName, authz.ManageRollCallTemplates, []authz.Permission{authz.View, authz.ManageRollCalls}},
		{gumav1.MemberService_ListMembers_FullMethodName, authz.View, nil},
		{gumav1.AuctionService_ListAuctions_FullMethodName, authz.View, nil},
		{gumav1.AuctionService_GetAuction_FullMethodName, authz.View, nil},
		{gumav1.AuctionService_GetBidHistory_FullMethodName, authz.View, nil},
		{gumav1.AuctionService_PlaceBid_FullMethodName, authz.View, nil},
	}
	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			if got := MethodPermissions[tt.method]; got != tt.required {
				t.Fatalf("MethodPermissions[%s] = %q, want %q", tt.method, got, tt.required)
			}
			guild, granted, lacking, outsider := uuid.New(), uuid.New(), uuid.New(), uuid.New()
			checker := authztest.New().
				Grant(guild, granted, authz.View, tt.required).
				Grant(guild, lacking, tt.lacking...)
			interceptor := GuildAuthzInterceptor(checker)
			call := func(userID uuid.UUID) codes.Code {
				ctx := session.WithUserID(context.Background(), userID)
				_, err := interceptor(ctx, guildRequest(guild.String()), &grpc.UnaryServerInfo{FullMethod: tt.method},
					func(context.Context, any) (any, error) { return nil, nil })
				return status.Code(err)
			}
			if got := call(granted); got != codes.OK {
				t.Fatalf("caller with %s: code %v, want OK", tt.required, got)
			}
			if len(tt.lacking) > 0 {
				if got := call(lacking); got != codes.PermissionDenied {
					t.Fatalf("caller with only %v: code %v, want PermissionDenied", tt.lacking, got)
				}
			}
			if got := call(outsider); got != codes.PermissionDenied {
				t.Fatalf("non-member: code %v, want PermissionDenied", got)
			}
		})
	}
}
