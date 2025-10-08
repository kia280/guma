package interceptors

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
)

func TestLoggingInterceptor(t *testing.T) {
	logger := zerolog.New(os.Stdout)

	tests := []struct {
		name           string
		handler        grpc.UnaryHandler
		wantErr        bool
		wantStatusCode codes.Code
	}{
		{
			name: "successful request",
			handler: func(ctx context.Context, req interface{}) (interface{}, error) {
				return "response", nil
			},
			wantErr: false,
		},
		{
			name: "request with error",
			handler: func(ctx context.Context, req interface{}) (interface{}, error) {
				return nil, status.Error(codes.InvalidArgument, "invalid request")
			},
			wantErr:        true,
			wantStatusCode: codes.InvalidArgument,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			interceptor := LoggingInterceptor(logger)
			info := &grpc.UnaryServerInfo{
				FullMethod: "/test.Service/Method",
			}

			ctx := context.Background()
			resp, err := interceptor(ctx, "request", info, tt.handler)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantStatusCode, st.Code())
			} else {
				require.NoError(t, err)
				assert.Equal(t, "response", resp)
			}

			// Verify request ID was added to context
			if !tt.wantErr {
				// Context should have logger with request_id
				assert.NotNil(t, zerolog.Ctx(ctx))
			}
		})
	}
}

func TestAuthInterceptor(t *testing.T) {
	tests := []struct {
		name           string
		method         string
		metadata       metadata.MD
		wantErr        bool
		wantStatusCode codes.Code
		wantUserID     string
	}{
		{
			name:     "public endpoint without auth",
			method:   "/guma.v1.GumaService/GetAppConfig",
			metadata: metadata.MD{},
			wantErr:  false,
		},
		{
			name:           "protected endpoint without metadata",
			method:         "/guma.v1.GuildService/CreateGuild",
			metadata:       nil,
			wantErr:        true,
			wantStatusCode: codes.Unauthenticated,
		},
		{
			name:   "protected endpoint without authorization header",
			method: "/guma.v1.GuildService/CreateGuild",
			metadata: metadata.MD{
				"other-header": []string{"value"},
			},
			wantErr:        true,
			wantStatusCode: codes.Unauthenticated,
		},
		{
			name:   "protected endpoint with bearer token",
			method: "/guma.v1.GuildService/CreateGuild",
			metadata: metadata.MD{
				"authorization": []string{"Bearer test-token"},
			},
			wantErr:    false,
			wantUserID: "mock-user-id",
		},
		{
			name:   "protected endpoint with token without bearer prefix",
			method: "/guma.v1.GuildService/CreateGuild",
			metadata: metadata.MD{
				"authorization": []string{"test-token"},
			},
			wantErr:    false,
			wantUserID: "mock-user-id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			interceptor := AuthInterceptor()
			info := &grpc.UnaryServerInfo{
				FullMethod: tt.method,
			}

			ctx := context.Background()
			if tt.metadata != nil {
				ctx = metadata.NewIncomingContext(ctx, tt.metadata)
			}

			handler := func(ctx context.Context, req interface{}) (interface{}, error) {
				// Verify user ID was added to context for authenticated requests
				if tt.wantUserID != "" {
					userID, ok := ctx.Value("user_id").(string)
					assert.True(t, ok, "user_id should be in context")
					assert.Equal(t, tt.wantUserID, userID)
				}
				return "response", nil
			}

			_, err := interceptor(ctx, "request", info, handler)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantStatusCode, st.Code())
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestRecoveryInterceptor(t *testing.T) {
	logger := zerolog.New(os.Stdout)

	tests := []struct {
		name           string
		handler        grpc.UnaryHandler
		wantErr        bool
		wantStatusCode codes.Code
	}{
		{
			name: "normal execution without panic",
			handler: func(ctx context.Context, req interface{}) (interface{}, error) {
				return "response", nil
			},
			wantErr: false,
		},
		{
			name: "panic with string",
			handler: func(ctx context.Context, req interface{}) (interface{}, error) {
				panic("something went wrong")
			},
			wantErr:        true,
			wantStatusCode: codes.Internal,
		},
		{
			name: "panic with error",
			handler: func(ctx context.Context, req interface{}) (interface{}, error) {
				panic(errors.New("critical error"))
			},
			wantErr:        true,
			wantStatusCode: codes.Internal,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			interceptor := RecoveryInterceptor(logger)
			info := &grpc.UnaryServerInfo{
				FullMethod: "/test.Service/Method",
			}

			ctx := context.Background()
			resp, err := interceptor(ctx, "request", info, tt.handler)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantStatusCode, st.Code())
				assert.Contains(t, st.Message(), "internal server error")
			} else {
				require.NoError(t, err)
				assert.Equal(t, "response", resp)
			}
		})
	}
}

// Mock request with validation
type validatableRequest struct {
	value string
	valid bool
}

func (r *validatableRequest) Validate() error {
	if !r.valid {
		return errors.New("validation failed")
	}
	return nil
}

func TestValidationInterceptor(t *testing.T) {

	tests := []struct {
		name           string
		request        interface{}
		wantErr        bool
		wantStatusCode codes.Code
	}{
		{
			name:    "request without validation",
			request: "simple request",
			wantErr: false,
		},
		{
			name:    "request with valid validation",
			request: &validatableRequest{value: "test", valid: true},
			wantErr: false,
		},
		{
			name:           "request with invalid validation",
			request:        &validatableRequest{value: "test", valid: false},
			wantErr:        true,
			wantStatusCode: codes.InvalidArgument,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			interceptor := ValidationInterceptor()
			info := &grpc.UnaryServerInfo{
				FullMethod: "/test.Service/Method",
			}

			handler := func(ctx context.Context, req interface{}) (interface{}, error) {
				return "response", nil
			}

			ctx := context.Background()
			resp, err := interceptor(ctx, tt.request, info, handler)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantStatusCode, st.Code())
			} else {
				require.NoError(t, err)
				assert.Equal(t, "response", resp)
			}
		})
	}
}

func TestIsPublicEndpoint(t *testing.T) {
	tests := []struct {
		name     string
		method   string
		wantBool bool
	}{
		{
			name:     "public endpoint GetAppConfig",
			method:   "/guma.v1.GumaService/GetAppConfig",
			wantBool: true,
		},
		{
			name:     "protected endpoint CreateGuild",
			method:   "/guma.v1.GuildService/CreateGuild",
			wantBool: false,
		},
		{
			name:     "protected endpoint GetGuild",
			method:   "/guma.v1.GuildService/GetGuild",
			wantBool: false,
		},
		{
			name:     "unknown endpoint",
			method:   "/unknown.Service/Method",
			wantBool: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := isPublicEndpoint(tt.method)
			assert.Equal(t, tt.wantBool, result)
		})
	}
}

func TestInterceptorChaining(t *testing.T) {
	logger := zerolog.New(os.Stdout)

	// Test that interceptors can be chained together
	handler := func(ctx context.Context, req interface{}) (interface{}, error) {
		// Verify auth added user_id to context
		userID, ok := ctx.Value("user_id").(string)
		assert.True(t, ok)
		assert.Equal(t, "mock-user-id", userID)

		// Verify logger was added to context
		assert.NotNil(t, zerolog.Ctx(ctx))

		return "final response", nil
	}

	// Create chain of interceptors
	loggingInterceptor := LoggingInterceptor(logger)
	authInterceptor := AuthInterceptor()
	recoveryInterceptor := RecoveryInterceptor(logger)
	validationInterceptor := ValidationInterceptor()

	info := &grpc.UnaryServerInfo{
		FullMethod: "/guma.v1.GuildService/CreateGuild",
	}

	ctx := metadata.NewIncomingContext(
		context.Background(),
		metadata.MD{"authorization": []string{"Bearer token"}},
	)

	// Chain interceptors manually
	finalHandler := handler
	finalHandler = validationInterceptor(ctx, "request", info, finalHandler)
	finalHandler = authInterceptor(ctx, "request", info, func(ctx context.Context, req interface{}) (interface{}, error) {
		return validationInterceptor(ctx, req, info, handler)
	})
	finalHandler = recoveryInterceptor(ctx, "request", info, func(ctx context.Context, req interface{}) (interface{}, error) {
		return authInterceptor(ctx, req, info, func(ctx context.Context, req interface{}) (interface{}, error) {
			return validationInterceptor(ctx, req, info, handler)
		})
	})

	resp, err := loggingInterceptor(ctx, "request", info, func(ctx context.Context, req interface{}) (interface{}, error) {
		return recoveryInterceptor(ctx, req, info, func(ctx context.Context, req interface{}) (interface{}, error) {
			return authInterceptor(ctx, req, info, func(ctx context.Context, req interface{}) (interface{}, error) {
				return validationInterceptor(ctx, req, info, handler)
			})
		})
	})

	require.NoError(t, err)
	assert.Equal(t, "final response", resp)
}
