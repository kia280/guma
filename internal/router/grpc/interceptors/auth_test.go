package interceptors

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	"github.com/kia280/guma/internal/session"
)

func TestAuthInterceptor(t *testing.T) {
	tests := []struct {
		name       string
		method     string
		ctx        context.Context
		wantCode   codes.Code
		wantUserID string
	}{
		{
			name:     "rejects unauthenticated call",
			method:   "/guma.v1.GuildService/ListGuilds",
			ctx:      context.Background(),
			wantCode: codes.Unauthenticated,
		},
		{
			name:       "accepts user from context",
			method:     "/guma.v1.GuildService/ListGuilds",
			ctx:        session.WithUserID(context.Background(), "user-1"),
			wantCode:   codes.OK,
			wantUserID: "user-1",
		},
		{
			name:       "accepts user from metadata",
			method:     "/guma.v1.GuildService/ListGuilds",
			ctx:        metadata.NewIncomingContext(context.Background(), metadata.Pairs(session.UserIDMetadataKey, "user-2")),
			wantCode:   codes.OK,
			wantUserID: "user-2",
		},
		{
			name:     "allows health check without user",
			method:   "/grpc.health.v1.Health/Check",
			ctx:      context.Background(),
			wantCode: codes.OK,
		},
		{
			name:     "allows reflection without user",
			method:   "/grpc.reflection.v1.ServerReflection/ServerReflectionInfo",
			ctx:      context.Background(),
			wantCode: codes.OK,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			called := false
			var gotUserID string
			handler := func(ctx context.Context, req interface{}) (interface{}, error) {
				called = true
				gotUserID = session.UserIDFromContext(ctx)
				return "response", nil
			}

			resp, err := AuthInterceptor()(tt.ctx, "request", &grpc.UnaryServerInfo{FullMethod: tt.method}, handler)

			assert.Equal(t, tt.wantCode, status.Code(err))
			if tt.wantCode != codes.OK {
				assert.False(t, called)
				assert.Nil(t, resp)
				return
			}
			require.True(t, called)
			assert.Equal(t, "response", resp)
			assert.Equal(t, tt.wantUserID, gotUserID)
		})
	}
}

type contextStream struct {
	grpc.ServerStream
	ctx context.Context
}

func (s *contextStream) Context() context.Context {
	return s.ctx
}

func TestStreamAuthInterceptor(t *testing.T) {
	info := &grpc.StreamServerInfo{FullMethod: "/guma.v1.StreamService/WatchUserEvents"}

	t.Run("rejects unauthenticated stream", func(t *testing.T) {
		called := false
		handler := func(srv interface{}, ss grpc.ServerStream) error {
			called = true
			return nil
		}

		err := StreamAuthInterceptor()(nil, &contextStream{ctx: context.Background()}, info, handler)

		assert.Equal(t, codes.Unauthenticated, status.Code(err))
		assert.False(t, called)
	})

	t.Run("exposes user on stream context", func(t *testing.T) {
		ctx := metadata.NewIncomingContext(context.Background(), metadata.Pairs(session.UserIDMetadataKey, "user-1"))
		var gotUserID string
		handler := func(srv interface{}, ss grpc.ServerStream) error {
			gotUserID = session.UserIDFromContext(ss.Context())
			return nil
		}

		err := StreamAuthInterceptor()(nil, &contextStream{ctx: ctx}, info, handler)

		require.NoError(t, err)
		assert.Equal(t, "user-1", gotUserID)
	})

	t.Run("allows public stream without user", func(t *testing.T) {
		called := false
		handler := func(srv interface{}, ss grpc.ServerStream) error {
			called = true
			return nil
		}

		err := StreamAuthInterceptor()(nil, &contextStream{ctx: context.Background()}, &grpc.StreamServerInfo{FullMethod: "/grpc.health.v1.Health/Watch"}, handler)

		require.NoError(t, err)
		assert.True(t, called)
	})
}
