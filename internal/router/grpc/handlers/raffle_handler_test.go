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
	requireCode(t, err, codes.InvalidArgument)
}

func TestCancelAndDeleteRaffle_Validation(t *testing.T) {
	service := NewRaffleService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), uuid.MustParse("00000000-0000-0000-0000-000000000001"))
	const guildID = "00000000-0000-0000-0000-000000000002"

	_, err := service.CancelRaffle(authed, &gumav1.CancelRaffleRequest{GuildId: guildID, RaffleId: "bad"})
	requireCode(t, err, codes.InvalidArgument)

	_, err = service.DeleteRaffle(authed, &gumav1.DeleteRaffleRequest{GuildId: guildID, RaffleId: "bad"})
	requireCode(t, err, codes.InvalidArgument)
}

func TestRaffleHandler_MalformedIDs(t *testing.T) {
	service := NewRaffleService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), testUserID)
	const guildID = "00000000-0000-0000-0000-000000000002"
	const raffleID = "00000000-0000-0000-0000-000000000003"

	calls := map[string]func() error{
		"list bad guild": func() error {
			_, err := service.ListRaffles(authed, &gumav1.ListRafflesRequest{GuildId: "bad"})
			return err
		},
		"get bad raffle": func() error {
			_, err := service.GetRaffle(authed, &gumav1.GetRaffleRequest{GuildId: guildID, RaffleId: "bad"})
			return err
		},
		"get bad guild": func() error {
			_, err := service.GetRaffle(authed, &gumav1.GetRaffleRequest{GuildId: "bad", RaffleId: raffleID})
			return err
		},
		"create bad guild": func() error {
			_, err := service.CreateRaffle(authed, &gumav1.CreateRaffleRequest{GuildId: "bad"})
			return err
		},
		"create bad prize source": func() error {
			_, err := service.CreateRaffle(authed, &gumav1.CreateRaffleRequest{
				GuildId: guildID,
				Prizes:  []*gumav1.RafflePrize{{Rank: 1, Source: &gumav1.ItemSourceRef{BackpackItemId: "bad"}}},
			})
			return err
		},
		"purchase bad raffle": func() error {
			_, err := service.PurchaseTickets(authed, &gumav1.PurchaseTicketsRequest{GuildId: guildID, RaffleId: "bad", Quantity: 1})
			return err
		},
		"winners bad raffle": func() error {
			_, err := service.GetRaffleWinners(authed, &gumav1.GetRaffleWinnersRequest{GuildId: guildID, RaffleId: "bad"})
			return err
		},
		"draw bad raffle": func() error {
			_, err := service.DrawRaffle(authed, &gumav1.DrawRaffleRequest{GuildId: guildID, RaffleId: "bad"})
			return err
		},
		"my tickets bad guild filter": func() error {
			_, err := service.ListMyTickets(authed, &gumav1.ListMyTicketsRequest{GuildId: "bad"})
			return err
		},
	}
	for name, call := range calls {
		t.Run(name, func(t *testing.T) {
			requireCode(t, call(), codes.InvalidArgument)
		})
	}
}
