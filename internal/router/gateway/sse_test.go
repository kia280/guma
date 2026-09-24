package gateway

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/protobuf/encoding/protojson"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
)

func TestSSEMarshalerFramesEvents(t *testing.T) {
	m := &sseMarshaler{Marshaler: &runtime.JSONPb{MarshalOptions: protojson.MarshalOptions{UseProtoNames: true}}}

	body, err := m.Marshal(map[string]any{"result": &gumav1.WatchUserEventsResponse{
		Event: &gumav1.WatchUserEventsResponse_WalletUpdated{WalletUpdated: &gumav1.WalletUpdated{GuildId: "g1", Balance: 42}},
	}})
	require.NoError(t, err)

	frame := string(body) + string(m.Delimiter())
	assert.True(t, strings.HasPrefix(frame, "data: {"), frame)
	assert.True(t, strings.HasSuffix(frame, "}\n\n"), frame)
	assert.Equal(t, 1, strings.Count(strings.TrimSuffix(frame, "\n\n"), "\n")+1, "event data must be a single line")
	assert.Contains(t, frame, `"wallet_updated"`)
	assert.Equal(t, mimeEventStream, m.StreamContentType(nil))
}

func TestEventStreamMiddlewareSetsStreamingHeaders(t *testing.T) {
	handler := eventStreamMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

	sse := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/me/events", nil)
	req.Header.Set("Accept", mimeEventStream)
	handler.ServeHTTP(sse, req)
	assert.Equal(t, "no-cache", sse.Header().Get("Cache-Control"))
	assert.Equal(t, "no", sse.Header().Get("X-Accel-Buffering"))

	plain := httptest.NewRecorder()
	handler.ServeHTTP(plain, httptest.NewRequest(http.MethodGet, "/v1/me", nil))
	assert.Empty(t, plain.Header().Get("X-Accel-Buffering"))
}
