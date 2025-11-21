package services

import (
	"context"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
)

// mockDependencyChecker is a mock implementation of DependencyChecker
type mockDependencyChecker struct {
	databaseHealthy bool
	redisHealthy   bool
}

func (m *mockDependencyChecker) CheckDatabase(ctx context.Context) bool {
	return m.databaseHealthy
}

func (m *mockDependencyChecker) CheckRedis(ctx context.Context) bool {
	return m.redisHealthy
}

// testHealthService wraps health.Service with a mock dependency checker for testing
type testHealthService struct {
	checker         *mockDependencyChecker
	startupComplete bool
}

func (t *testHealthService) CheckReadiness(ctx context.Context) (*gumav1.CheckResponse, error) {
	db := t.checker.CheckDatabase(ctx)
	redis := t.checker.CheckRedis(ctx)

	status := gumav1.StatusCode_STATUS_CODE_SERVING
	if !db || !redis || !t.startupComplete {
		status = gumav1.StatusCode_STATUS_CODE_NOT_READY
	}

	return &gumav1.CheckResponse{
		Status:          status,
		Database:        db,
		Redis:           redis,
		StartupComplete: t.startupComplete,
		Timestamp:       time.Now().UnixNano(),
	}, nil
}

func (t *testHealthService) CheckLiveness(ctx context.Context) (*gumav1.CheckResponse, error) {
	return &gumav1.CheckResponse{
		Status:          gumav1.StatusCode_STATUS_CODE_SERVING,
		Database:        false,
		Redis:           false,
		StartupComplete: t.startupComplete,
		Timestamp:       time.Now().UnixNano(),
	}, nil
}

func (t *testHealthService) MarkStartupComplete() {
	t.startupComplete = true
}

func (t *testHealthService) MarkStartupFailed() {
	t.startupComplete = false
}

func (t *testHealthService) IsStartupComplete() bool {
	return t.startupComplete
}

func TestCheckReady_AllHealthy(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	mockChecker := &mockDependencyChecker{
		databaseHealthy: true,
		redisHealthy:   true,
	}
	svc := &testHealthService{
		checker:         mockChecker,
		startupComplete: true,
	}
	handler := NewHealthServiceHandler(svc, logger)

	resp, err := handler.CheckReady(context.Background(), &gumav1.CheckReadyRequest{})

	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, gumav1.StatusCode_STATUS_CODE_SERVING, resp.Status)
	assert.True(t, resp.Database)
	assert.True(t, resp.Redis)
	assert.True(t, resp.StartupComplete)
}

func TestCheckReady_DatabaseDown(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	mockChecker := &mockDependencyChecker{
		databaseHealthy: false,
		redisHealthy:   true,
	}
	svc := &testHealthService{
		checker:         mockChecker,
		startupComplete: true,
	}
	handler := NewHealthServiceHandler(svc, logger)

	resp, err := handler.CheckReady(context.Background(), &gumav1.CheckReadyRequest{})

	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, gumav1.StatusCode_STATUS_CODE_NOT_READY, resp.Status)
	assert.False(t, resp.Database)
	assert.True(t, resp.Redis)
	assert.True(t, resp.StartupComplete)
}

func TestCheckReady_StartupNotComplete(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	mockChecker := &mockDependencyChecker{
		databaseHealthy: true,
		redisHealthy:   true,
	}
	svc := &testHealthService{
		checker:         mockChecker,
		startupComplete: false,
	}
	handler := NewHealthServiceHandler(svc, logger)

	resp, err := handler.CheckReady(context.Background(), &gumav1.CheckReadyRequest{})

	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, gumav1.StatusCode_STATUS_CODE_NOT_READY, resp.Status)
	assert.True(t, resp.Database)
	assert.True(t, resp.Redis)
	assert.False(t, resp.StartupComplete)
}

func TestCheckReady_AllUnhealthy(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	mockChecker := &mockDependencyChecker{
		databaseHealthy: false,
		redisHealthy:   false,
	}
	svc := &testHealthService{
		checker:         mockChecker,
		startupComplete: false,
	}
	handler := NewHealthServiceHandler(svc, logger)

	resp, err := handler.CheckReady(context.Background(), &gumav1.CheckReadyRequest{})

	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, gumav1.StatusCode_STATUS_CODE_NOT_READY, resp.Status)
	assert.False(t, resp.Database)
	assert.False(t, resp.Redis)
	assert.False(t, resp.StartupComplete)
}

func TestCheckLive_Responsive(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	mockChecker := &mockDependencyChecker{
		databaseHealthy: false,
		redisHealthy:   false,
	}
	svc := &testHealthService{
		checker:         mockChecker,
		startupComplete: true,
	}
	handler := NewHealthServiceHandler(svc, logger)

	resp, err := handler.CheckLive(context.Background(), &gumav1.CheckLiveRequest{})

	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, gumav1.StatusCode_STATUS_CODE_SERVING, resp.Status)
	// Liveness doesn't check dependencies
	assert.False(t, resp.Database)
	assert.False(t, resp.Redis)
	assert.True(t, resp.StartupComplete)
}

func TestCheckLive_DuringStartup(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	mockChecker := &mockDependencyChecker{
		databaseHealthy: false,
		redisHealthy:   false,
	}
	svc := &testHealthService{
		checker:         mockChecker,
		startupComplete: false,
	}
	handler := NewHealthServiceHandler(svc, logger)

	resp, err := handler.CheckLive(context.Background(), &gumav1.CheckLiveRequest{})

	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, gumav1.StatusCode_STATUS_CODE_SERVING, resp.Status)
	assert.False(t, resp.StartupComplete)
}

func TestCheckReadyReturnsCorrectHTTPStatus(t *testing.T) {
	tests := []struct {
		name              string
		databaseHealthy   bool
		redisHealthy      bool
		startupComplete   bool
		expectedHTTPCode  int
	}{
		{
			name:             "All healthy returns 200",
			databaseHealthy:  true,
			redisHealthy:    true,
			startupComplete: true,
			expectedHTTPCode: http.StatusOK,
		},
		{
			name:             "Database down returns 503",
			databaseHealthy:  false,
			redisHealthy:    true,
			startupComplete: true,
			expectedHTTPCode: http.StatusServiceUnavailable,
		},
		{
			name:             "Not ready returns 503",
			databaseHealthy:  true,
			redisHealthy:    true,
			startupComplete: false,
			expectedHTTPCode: http.StatusServiceUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockChecker := &mockDependencyChecker{
				databaseHealthy: tt.databaseHealthy,
				redisHealthy:   tt.redisHealthy,
			}
			svc := &testHealthService{
				checker:         mockChecker,
				startupComplete: tt.startupComplete,
			}

			healthStatus, _ := svc.CheckReadiness(context.Background())
			httpStatus := getReadyHTTPStatus(healthStatus)

			assert.Equal(t, tt.expectedHTTPCode, httpStatus)
		})
	}
}

func TestCheckLiveAlwaysReturns200(t *testing.T) {
	// Liveness probe should always return 200 if the handler is reachable
	httpStatus := getLiveHTTPStatus()
	assert.Equal(t, http.StatusOK, httpStatus)
}

func TestGetReadyHTTPStatus(t *testing.T) {
	tests := []struct {
		name           string
		response       *gumav1.CheckResponse
		expectedStatus int
	}{
		{
			name: "serving returns 200",
			response: &gumav1.CheckResponse{
				Status: gumav1.StatusCode_STATUS_CODE_SERVING,
			},
			expectedStatus: http.StatusOK,
		},
		{
			name: "not ready returns 503",
			response: &gumav1.CheckResponse{
				Status: gumav1.StatusCode_STATUS_CODE_NOT_READY,
			},
			expectedStatus: http.StatusServiceUnavailable,
		},
		{
			name: "unknown returns 503",
			response: &gumav1.CheckResponse{
				Status: gumav1.StatusCode_STATUS_CODE_UNKNOWN,
			},
			expectedStatus: http.StatusServiceUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status := getReadyHTTPStatus(tt.response)
			assert.Equal(t, tt.expectedStatus, status)
		})
	}
}

func TestNewHealthServiceHandler(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	mockChecker := &mockDependencyChecker{}
	svc := &testHealthService{
		checker: mockChecker,
	}
	handler := NewHealthServiceHandler(svc, logger)

	assert.NotNil(t, handler)
	assert.NotNil(t, handler.logger)
}

func TestCheckReadyWithContextCancellation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	mockChecker := &mockDependencyChecker{
		databaseHealthy: true,
		redisHealthy:   true,
	}
	svc := &testHealthService{
		checker:         mockChecker,
		startupComplete: true,
	}
	handler := NewHealthServiceHandler(svc, logger)

	// Create a cancelled context
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	resp, err := handler.CheckReady(ctx, &gumav1.CheckReadyRequest{})

	// Should still work as the check completes before context is fully propagated
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, gumav1.StatusCode_STATUS_CODE_SERVING, resp.Status)
}

func TestCheckLiveWithContextCancellation(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	mockChecker := &mockDependencyChecker{}
	svc := &testHealthService{
		checker:         mockChecker,
		startupComplete: true,
	}
	handler := NewHealthServiceHandler(svc, logger)

	// Create a cancelled context
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	resp, err := handler.CheckLive(ctx, &gumav1.CheckLiveRequest{})

	// Should still work as the check completes before context is fully propagated
	require.NoError(t, err)
	assert.NotNil(t, resp)
	assert.Equal(t, gumav1.StatusCode_STATUS_CODE_SERVING, resp.Status)
}
