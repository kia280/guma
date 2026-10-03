package gateway

import (
	"bufio"
	"context"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/events"
	"github.com/kia280/guma/internal/router/grpc/handlers"
	"github.com/kia280/guma/internal/router/grpc/interceptors"
	"github.com/kia280/guma/internal/session"
)

type sseFrame struct {
	Result *struct {
		WalletUpdated *struct {
			GuildID string `json:"guild_id"`
			Balance string `json:"balance"`
		} `json:"wallet_updated"`
		Heartbeat *struct{} `json:"heartbeat"`
	} `json:"result"`
}

func startStreamGateway(t *testing.T, broker *events.Broker, userID uuid.UUID, writeTimeout time.Duration) *httptest.Server {
	t.Helper()

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	grpcServer := grpc.NewServer(grpc.StreamInterceptor(interceptors.StreamAuthInterceptor()))
	gumav1.RegisterStreamServiceServer(grpcServer, handlers.NewStreamService(broker, func(context.Context, uuid.UUID) ([]string, error) { return nil, nil }, zerolog.Nop()))
	go func() { _ = grpcServer.Serve(lis) }()
	t.Cleanup(grpcServer.Stop)

	mux := newServeMux(zerolog.Nop())
	require.NoError(t, gumav1.RegisterStreamServiceHandlerFromEndpoint(
		context.Background(), mux, lis.Addr().String(),
		[]grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())},
	))

	authenticated := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mux.ServeHTTP(w, r.WithContext(session.WithUserID(r.Context(), userID)))
	})
	srv := httptest.NewUnstartedServer(eventStreamMiddleware(authenticated))
	srv.Config.WriteTimeout = writeTimeout
	srv.Start()
	t.Cleanup(srv.Close)
	return srv
}

func readFrame(t *testing.T, r *bufio.Reader) sseFrame {
	t.Helper()
	line, err := r.ReadString('\n')
	require.NoError(t, err)
	require.True(t, strings.HasPrefix(line, "data: "), "unexpected line %q", line)
	blank, err := r.ReadString('\n')
	require.NoError(t, err)
	require.Equal(t, "\n", blank)

	var f sseFrame
	require.NoError(t, json.Unmarshal([]byte(strings.TrimPrefix(line, "data: ")), &f))
	require.NotNil(t, f.Result, "frame without result: %q", line)
	return f
}

func TestWatchUserEventsOverServerSentEvents(t *testing.T) {
	broker := events.NewBroker()
	writeTimeout := 300 * time.Millisecond
	alice := uuid.MustParse("00000000-0000-0000-0000-00000000a11c")
	srv := startStreamGateway(t, broker, alice, writeTimeout)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, srv.URL+"/v1/me/events", nil)
	require.NoError(t, err)
	req.Header.Set("Accept", mimeEventStream)

	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, mimeEventStream, resp.Header.Get("Content-Type"))
	assert.Equal(t, "no", resp.Header.Get("X-Accel-Buffering"))

	body := bufio.NewReader(resp.Body)
	assert.NotNil(t, readFrame(t, body).Result.Heartbeat)

	time.Sleep(2 * writeTimeout)
	broker.Publish("bob", events.Event{OccurredAt: time.Now(), WalletUpdated: &events.WalletUpdated{GuildID: "g1", Balance: 1}})
	broker.Publish(alice.String(), events.Event{OccurredAt: time.Now(), WalletUpdated: &events.WalletUpdated{GuildID: "g1", Balance: 1234}})

	update := readFrame(t, body).Result.WalletUpdated
	require.NotNil(t, update)
	assert.Equal(t, "g1", update.GuildID)
	assert.Equal(t, "1234", update.Balance)
}
