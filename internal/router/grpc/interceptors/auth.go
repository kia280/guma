package interceptors

import (
	"context"
	"strings"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/kia280/guma/internal/session"
)

var publicMethodPrefixes = []string{
	"/grpc.health.v1.Health/",
	"/grpc.reflection.",
}

func AuthInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		if isPublicMethod(info.FullMethod) {
			return handler(ctx, req)
		}
		ctx, err := authenticate(ctx)
		if err != nil {
			return nil, err
		}
		return handler(ctx, req)
	}
}

func StreamAuthInterceptor() grpc.StreamServerInterceptor {
	return func(srv interface{}, ss grpc.ServerStream, info *grpc.StreamServerInfo, handler grpc.StreamHandler) error {
		if isPublicMethod(info.FullMethod) {
			return handler(srv, ss)
		}
		ctx, err := authenticate(ss.Context())
		if err != nil {
			return err
		}
		return handler(srv, &authenticatedStream{ServerStream: ss, ctx: ctx})
	}
}

type authenticatedStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s *authenticatedStream) Context() context.Context {
	return s.ctx
}

func authenticate(ctx context.Context) (context.Context, error) {
	userID, ok := session.UserIDFromIncomingContext(ctx)
	if !ok {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	return session.WithUserID(ctx, userID), nil
}

func isPublicMethod(fullMethod string) bool {
	for _, prefix := range publicMethodPrefixes {
		if strings.HasPrefix(fullMethod, prefix) {
			return true
		}
	}
	return false
}
