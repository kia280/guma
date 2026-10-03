package handlers

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

func TestRaffleService_UpdateRaffle_Validation(t *testing.T) {
	service := NewRaffleService(nil, nil, zerolog.New(os.Stdout))
	authed := session.WithUserID(context.Background(), uuid.MustParse("00000000-0000-0000-0000-000000000001"))

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.UpdateRaffleRequest
		wantCode codes.Code
	}{
		{
			name: "draw date in the past",
			ctx:  authed,
			req: &gumav1.UpdateRaffleRequest{
				GuildId:  "00000000-0000-0000-0000-000000000002",
				RaffleId: "00000000-0000-0000-0000-000000000003",
				DrawDate: "2000-01-01T00:00:00Z",
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "malformed draw date",
			ctx:  authed,
			req: &gumav1.UpdateRaffleRequest{
				GuildId:  "00000000-0000-0000-0000-000000000002",
				RaffleId: "00000000-0000-0000-0000-000000000003",
				DrawDate: "tomorrow",
			},
			wantCode: codes.InvalidArgument,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.UpdateRaffle(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestRaffleService_UpdateRaffle_MalformedRaffleID(t *testing.T) {
	service := NewRaffleService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), uuid.MustParse("00000000-0000-0000-0000-000000000001"))
	const guildID = "00000000-0000-0000-0000-000000000002"

	title := "Raffle"
	_, err := service.UpdateRaffle(authed, &gumav1.UpdateRaffleRequest{GuildId: guildID, RaffleId: "bad", Title: &title})
	requireCode(t, err, codes.NotFound)
}

func TestCancelAndDeleteRaffle_Validation(t *testing.T) {
	service := NewRaffleService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), uuid.MustParse("00000000-0000-0000-0000-000000000001"))
	const guildID = "00000000-0000-0000-0000-000000000002"

	_, err := service.CancelRaffle(authed, &gumav1.CancelRaffleRequest{GuildId: guildID, RaffleId: "bad"})
	requireCode(t, err, codes.NotFound)

	_, err = service.DeleteRaffle(authed, &gumav1.DeleteRaffleRequest{GuildId: guildID, RaffleId: "bad"})
	requireCode(t, err, codes.NotFound)
}
