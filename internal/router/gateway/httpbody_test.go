package gateway

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/genproto/googleapis/api/httpbody"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
)

var testLogoBytes = []byte("\x89PNG\r\n\x1a\nlogo")

type logoGuildServer struct {
	gumav1.UnimplementedGuildServiceServer
}

func (logoGuildServer) GetGuildLogo(ctx context.Context, _ *gumav1.GetGuildLogoRequest) (*httpbody.HttpBody, error) {
	_ = grpc.SetHeader(ctx, metadata.Pairs("cache-control", "private, max-age=31536000, immutable"))
	return &httpbody.HttpBody{ContentType: "image/png", Data: testLogoBytes}, nil
}

func (logoGuildServer) GetGuild(context.Context, *gumav1.GetGuildRequest) (*gumav1.GetGuildResponse, error) {
	return &gumav1.GetGuildResponse{Guild: &gumav1.Guild{Id: "g1", Name: "Guild"}}, nil
}

func startGuildGateway(t *testing.T) *httptest.Server {
	t.Helper()

	lis, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	grpcServer := grpc.NewServer()
	gumav1.RegisterGuildServiceServer(grpcServer, logoGuildServer{})
	go func() { _ = grpcServer.Serve(lis) }()
	t.Cleanup(grpcServer.Stop)

	mux := newServeMux(zerolog.Nop())
	require.NoError(t, gumav1.RegisterGuildServiceHandlerFromEndpoint(
		context.Background(), mux, lis.Addr().String(),
		[]grpc.DialOption{grpc.WithTransportCredentials(insecure.NewCredentials())},
	))

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestGatewayServesGuildLogoAsRawImage(t *testing.T) {
	srv := startGuildGateway(t)

	resp, err := http.Get(srv.URL + "/v1/guilds/g1/logo?v=1")
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "image/png", resp.Header.Get("Content-Type"))
	assert.Equal(t, "private, max-age=31536000, immutable", resp.Header.Get("Cache-Control"))
	assert.Equal(t, testLogoBytes, body)
}

func TestGatewayKeepsJSONForRegularResponses(t *testing.T) {
	srv := startGuildGateway(t)

	resp, err := http.Get(srv.URL + "/v1/guilds/g1")
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)

	assert.Equal(t, http.StatusOK, resp.StatusCode)
	assert.Equal(t, "application/json", resp.Header.Get("Content-Type"))
	assert.JSONEq(t, `{"guild":{"id":"g1","name":"Guild"}}`, string(body))
}
