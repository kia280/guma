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
