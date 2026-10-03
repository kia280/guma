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

func TestGuildMembershipInterceptor(t *testing.T) {
	guild, member, outsider := uuid.New(), uuid.New(), uuid.New()
	checker := authztest.New().Grant(guild, member, authz.View)
	guildMethod := gumav1.AuctionService_ListAuctions_FullMethodName
	guildReq := &gumav1.ListAuctionsRequest{GuildId: guild.String()}

	tests := []struct {
		name     string
		checker  authz.Checker
		method   string
		req      any
		userID   string
		wantCode codes.Code
	}{
		{name: "member", checker: checker, method: guildMethod, req: guildReq, userID: member.String(), wantCode: codes.OK},
		{name: "non-member", checker: checker, method: guildMethod, req: guildReq, userID: outsider.String(), wantCode: codes.PermissionDenied},
		{name: "anonymous", checker: checker, method: guildMethod, req: guildReq, wantCode: codes.Unauthenticated},
		{name: "malformed guild id", checker: checker, method: guildMethod, req: &gumav1.ListAuctionsRequest{GuildId: "nope"}, userID: member.String(), wantCode: codes.InvalidArgument},
		{name: "missing guild id is left to the handler", checker: checker, method: guildMethod, req: &gumav1.ListAuctionsRequest{}, userID: outsider.String(), wantCode: codes.OK},
		{name: "checker failure", checker: &authztest.Fake{CanErr: errors.New("keto down")}, method: guildMethod, req: guildReq, userID: member.String(), wantCode: codes.Internal},
		{name: "exempt method", checker: checker, method: gumav1.GuildService_JoinGuildById_FullMethodName, req: &gumav1.JoinGuildByIdRequest{GuildId: guild.String()}, userID: outsider.String(), wantCode: codes.OK},
		{name: "unlisted method without guild id", checker: checker, method: "/guma.v1.NewService/Unlisted", req: &gumav1.GetMeRequest{}, userID: member.String(), wantCode: codes.PermissionDenied},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			if tt.userID != "" {
				ctx = session.WithUserID(ctx, tt.userID)
			}
			called := false
			handler := func(context.Context, any) (any, error) {
				called = true
				return "ok", nil
			}
			_, err := GuildMembershipInterceptor(tt.checker)(ctx, tt.req, &grpc.UnaryServerInfo{FullMethod: tt.method}, handler)
			if got := status.Code(err); got != tt.wantCode {
				t.Fatalf("code = %v, want %v (err %v)", got, tt.wantCode, err)
			}
			if called != (tt.wantCode == codes.OK) {
				t.Fatalf("handler called = %v, want %v", called, tt.wantCode == codes.OK)
			}
		})
	}
}

func TestEveryUnaryMethodIsGuildScopedOrExempt(t *testing.T) {
	seen := 0
	protoregistry.GlobalFiles.RangeFilesByPackage("guma.v1", func(fd protoreflect.FileDescriptor) bool {
		for i := 0; i < fd.Services().Len(); i++ {
			svc := fd.Services().Get(i)
			for j := 0; j < svc.Methods().Len(); j++ {
				m := svc.Methods().Get(j)
				if m.IsStreamingClient() || m.IsStreamingServer() {
					continue
				}
				seen++
				method := "/" + string(svc.FullName()) + "/" + string(m.Name())
				if !MembershipExemptMethods[method] && m.Input().Fields().ByName("guild_id") == nil {
					t.Errorf("%s has no guild_id; add it to MembershipExemptMethods or give it a guild_id", method)
				}
			}
		}
		return true
	})
	if seen == 0 {
		t.Fatal("no guma.v1 methods found in the proto registry")
	}
}
