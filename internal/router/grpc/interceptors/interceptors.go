package interceptors

import (
	"context"
	"runtime/debug"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

// LoggingInterceptor logs gRPC requests and responses
func LoggingInterceptor(logger zerolog.Logger) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		start := time.Now()
		requestID := uuid.New().String()

		// Add request ID to context
		ctx = logger.With().Str("request_id", requestID).Logger().WithContext(ctx)

		// Add request ID to response metadata
		if err := grpc.SetHeader(ctx, metadata.Pairs("x-request-id", requestID)); err != nil {
			logger.Warn().Err(err).Msg("failed to set request ID header")
		}

		// Handle request
		resp, err := handler(ctx, req)

		// Log result
		duration := time.Since(start)
		logEvent := zerolog.Ctx(ctx).Info()

		if err != nil {
			st := status.Convert(err)
			logEvent = zerolog.Ctx(ctx).Error().
				Err(err).
				Str("grpc_code", st.Code().String())
		}

		logEvent.
			Str("method", info.FullMethod).
			Dur("duration_ms", duration).
			Msg("gRPC request completed")

		return resp, err
	}
}

// AuthInterceptor validates authentication tokens
func AuthInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		// Skip auth for public endpoints
		if isPublicEndpoint(info.FullMethod) {
			return handler(ctx, req)
		}

		// Extract token from metadata
		md, ok := metadata.FromIncomingContext(ctx)
		if !ok {
			return nil, status.Error(codes.Unauthenticated, "missing metadata")
		}

		tokens := md.Get("authorization")
		if len(tokens) == 0 {
			return nil, status.Error(codes.Unauthenticated, "missing authorization token")
		}

		// Extract bearer token
		token := tokens[0]
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}

		// TODO: Validate token with Ory Kratos or JWT validation
		// For now, we'll extract a mock user ID
		userID := "mock-user-id"

		// Add user ID to context
		ctx = context.WithValue(ctx, "user_id", userID)

		return handler(ctx, req)
	}
}

// RecoveryInterceptor recovers from panics and returns proper gRPC errors
func RecoveryInterceptor(logger zerolog.Logger) grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (resp interface{}, err error) {
		defer func() {
			if r := recover(); r != nil {
				logger.Error().
					Interface("panic", r).
					Str("method", info.FullMethod).
					Bytes("stack", debug.Stack()).
					Msg("panic recovered in gRPC handler")

				err = status.Error(codes.Internal, "internal server error")
			}
		}()

		return handler(ctx, req)
	}
}

// ValidationInterceptor validates request messages
func ValidationInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
		// Check if request implements validator interface
		if v, ok := req.(interface{ Validate() error }); ok {
			if err := v.Validate(); err != nil {
				return nil, status.Error(codes.InvalidArgument, err.Error())
			}
		}

		return handler(ctx, req)
	}
}

// isPublicEndpoint checks if an endpoint is public (doesn't require authentication)
func isPublicEndpoint(method string) bool {
	publicEndpoints := map[string]bool{
		"/guma.v1.GumaService/GetAppConfig": true,
		// Add other public endpoints here
	}

	return publicEndpoints[method]
}
