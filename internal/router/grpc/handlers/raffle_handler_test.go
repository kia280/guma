package handlers

import (
	"context"
	"os"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

func TestRaffleService_UpdateRaffle_Validation(t *testing.T) {
	service := NewRaffleService(nil, zerolog.New(os.Stdout))
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.UpdateRaffleRequest
		wantCode codes.Code
	}{
		{
			name:     "missing ids",
			ctx:      authed,
			req:      &gumav1.UpdateRaffleRequest{DrawDate: "2099-01-01T00:00:00Z"},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing draw date",
			ctx:      authed,
			req:      &gumav1.UpdateRaffleRequest{GuildId: "g", RaffleId: "l"},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "unauthenticated",
			ctx:      context.Background(),
			req:      &gumav1.UpdateRaffleRequest{GuildId: "g", RaffleId: "l", DrawDate: "2099-01-01T00:00:00Z"},
			wantCode: codes.Unauthenticated,
		},
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

func TestRaffleService_UpdateRaffle_FieldValidation(t *testing.T) {
	service := NewRaffleService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const raffleID = "00000000-0000-0000-0000-000000000003"
	blank, negative, negativeCount := " ", int64(-1), int32(-1)

	for name, req := range map[string]*gumav1.UpdateRaffleRequest{
		"blank title":           {GuildId: guildID, RaffleId: raffleID, Title: &blank},
		"negative price":        {GuildId: guildID, RaffleId: raffleID, TicketPrice: &negative},
		"negative max":          {GuildId: guildID, RaffleId: raffleID, MaxTickets: &negativeCount},
		"negative per user max": {GuildId: guildID, RaffleId: raffleID, MaxTicketsPerUser: &negativeCount},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := service.UpdateRaffle(authed, req)
			requireCode(t, err, codes.InvalidArgument)
		})
	}

	title := "Raffle"
	_, err := service.UpdateRaffle(authed, &gumav1.UpdateRaffleRequest{GuildId: guildID, RaffleId: "bad", Title: &title})
	requireCode(t, err, codes.NotFound)
}

func TestCancelAndDeleteRaffle_Validation(t *testing.T) {
	service := NewRaffleService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"

	_, err := service.CancelRaffle(authed, &gumav1.CancelRaffleRequest{GuildId: guildID})
	requireCode(t, err, codes.InvalidArgument)
	_, err = service.CancelRaffle(context.Background(), &gumav1.CancelRaffleRequest{GuildId: guildID, RaffleId: "l"})
	requireCode(t, err, codes.Unauthenticated)
	_, err = service.CancelRaffle(authed, &gumav1.CancelRaffleRequest{GuildId: guildID, RaffleId: "bad"})
	requireCode(t, err, codes.NotFound)

	_, err = service.DeleteRaffle(authed, &gumav1.DeleteRaffleRequest{RaffleId: "l"})
	requireCode(t, err, codes.InvalidArgument)
	_, err = service.DeleteRaffle(context.Background(), &gumav1.DeleteRaffleRequest{GuildId: guildID, RaffleId: "l"})
	requireCode(t, err, codes.Unauthenticated)
	_, err = service.DeleteRaffle(authed, &gumav1.DeleteRaffleRequest{GuildId: guildID, RaffleId: "bad"})
	requireCode(t, err, codes.NotFound)
}
