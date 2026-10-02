package interceptors

import (
	"context"
	"testing"

	validatepb "buf.build/gen/go/bufbuild/protovalidate/protocolbuffers/go/buf/validate"
	"buf.build/go/protovalidate"
	grpcprotovalidate "github.com/grpc-ecosystem/go-grpc-middleware/v2/interceptors/protovalidate"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
)

func newValidator(t *testing.T) protovalidate.Validator {
	t.Helper()
	validator, err := protovalidate.New()
	require.NoError(t, err)
	return validator
}

func chainUnary(interceptors ...grpc.UnaryServerInterceptor) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		next := handler
		for i := len(interceptors) - 1; i >= 0; i-- {
			interceptor, inner := interceptors[i], next
			next = func(ctx context.Context, req interface{}) (interface{}, error) {
				return interceptor(ctx, req, info, inner)
			}
		}
		return next(ctx, req)
	}
}

func requireViolation(t *testing.T, err error, wantField, wantRuleID string) {
	t.Helper()
	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, codes.InvalidArgument, st.Code())

	var violations *validatepb.Violations
	for _, detail := range st.Details() {
		if v, ok := detail.(*validatepb.Violations); ok {
			violations = v
		}
	}
	require.NotNil(t, violations, "expected buf.validate.Violations detail")
	require.Len(t, violations.GetViolations(), 1)

	violation := violations.GetViolations()[0]
	assert.Equal(t, wantRuleID, violation.GetRuleId())
	require.NotEmpty(t, violation.GetField().GetElements())
	assert.Equal(t, wantField, violation.GetField().GetElements()[0].GetFieldName())
}

func TestUnaryValidation(t *testing.T) {
	validator := newValidator(t)
	info := &grpc.UnaryServerInfo{FullMethod: "/guma.v1.GuildService/Method"}
	interceptor := chainUnary(
		ErrorSanitizerInterceptor(),
		grpcprotovalidate.UnaryServerInterceptor(validator),
	)

	tests := []struct {
		name       string
		request    proto.Message
		wantField  string
		wantRuleID string
	}{
		{
			name:       "guild id is not a uuid",
			request:    &gumav1.GetGuildRequest{GuildId: "not-a-uuid"},
			wantField:  "guild_id",
			wantRuleID: "string.uuid",
		},
		{
			name:       "page size above limit",
			request:    &gumav1.ListGuildsRequest{PageSize: 1001},
			wantField:  "page_size",
			wantRuleID: "int32.gte_lte",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handlerCalled := false
			handler := func(ctx context.Context, req interface{}) (interface{}, error) {
				handlerCalled = true
				return "response", nil
			}

			resp, err := interceptor(context.Background(), tt.request, info, handler)

			require.Error(t, err)
			assert.Nil(t, resp)
			assert.False(t, handlerCalled)
			requireViolation(t, err, tt.wantField, tt.wantRuleID)
		})
	}

	t.Run("valid request reaches handler", func(t *testing.T) {
		handlerCalled := false
		handler := func(ctx context.Context, req interface{}) (interface{}, error) {
			handlerCalled = true
			return "response", nil
		}

		resp, err := interceptor(context.Background(), &gumav1.ListGuildsRequest{PageSize: 1000}, info, handler)

		require.NoError(t, err)
		assert.True(t, handlerCalled)
		assert.Equal(t, "response", resp)
	})
}

type recvStream struct {
	grpc.ServerStream
	ctx     context.Context
	request proto.Message
}

func (s *recvStream) Context() context.Context {
	return s.ctx
}

func (s *recvStream) RecvMsg(m interface{}) error {
	proto.Merge(m.(proto.Message), s.request)
	return nil
}

func TestStreamValidation(t *testing.T) {
	validator := newValidator(t)
	logger := zerolog.Nop()
	info := &grpc.StreamServerInfo{FullMethod: "/guma.v1.GuildService/Stream"}

	sanitizer := StreamErrorSanitizerInterceptor(logger)
	validation := grpcprotovalidate.StreamServerInterceptor(validator)
	run := func(request proto.Message) (*gumav1.GetGuildRequest, error) {
		received := &gumav1.GetGuildRequest{}
		stream := &recvStream{ctx: context.Background(), request: request}
		handler := func(srv interface{}, ss grpc.ServerStream) error {
			return ss.RecvMsg(received)
		}
		err := sanitizer(nil, stream, info, func(srv interface{}, ss grpc.ServerStream) error {
			return validation(srv, ss, info, handler)
		})
		return received, err
	}

	t.Run("invalid message is rejected", func(t *testing.T) {
		_, err := run(&gumav1.GetGuildRequest{GuildId: "not-a-uuid"})

		require.Error(t, err)
		requireViolation(t, err, "guild_id", "string.uuid")
	})

	t.Run("valid message is received", func(t *testing.T) {
		received, err := run(&gumav1.GetGuildRequest{GuildId: "123e4567-e89b-12d3-a456-426614174000"})

		require.NoError(t, err)
		assert.Equal(t, "123e4567-e89b-12d3-a456-426614174000", received.GetGuildId())
	})
}

func TestSanitizeErrorPreservesInvalidArgumentDetails(t *testing.T) {
	st, err := status.New(codes.InvalidArgument, "invalid request").WithDetails(&validatepb.Violations{
		Violations: []*validatepb.Violation{{RuleId: proto.String("string.max_len")}},
	})
	require.NoError(t, err)

	sanitized := status.Convert(sanitizeError(st.Err()))

	assert.Equal(t, codes.InvalidArgument, sanitized.Code())
	assert.Equal(t, "invalid request", sanitized.Message())
	require.Len(t, sanitized.Details(), 1)
	assert.Equal(t, "string.max_len", sanitized.Details()[0].(*validatepb.Violations).GetViolations()[0].GetRuleId())
}
