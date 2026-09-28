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

func TestLotteryService_UpdateLottery_Validation(t *testing.T) {
	service := NewLotteryService(nil, zerolog.New(os.Stdout))
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.UpdateLotteryRequest
		wantCode codes.Code
	}{
		{
			name:     "missing ids",
			ctx:      authed,
			req:      &gumav1.UpdateLotteryRequest{DrawDate: "2099-01-01T00:00:00Z"},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "missing draw date",
			ctx:      authed,
			req:      &gumav1.UpdateLotteryRequest{GuildId: "g", LotteryId: "l"},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "unauthenticated",
			ctx:      context.Background(),
			req:      &gumav1.UpdateLotteryRequest{GuildId: "g", LotteryId: "l", DrawDate: "2099-01-01T00:00:00Z"},
			wantCode: codes.Unauthenticated,
		},
		{
			name: "draw date in the past",
			ctx:  authed,
			req: &gumav1.UpdateLotteryRequest{
				GuildId:   "00000000-0000-0000-0000-000000000002",
				LotteryId: "00000000-0000-0000-0000-000000000003",
				DrawDate:  "2000-01-01T00:00:00Z",
			},
			wantCode: codes.InvalidArgument,
		},
		{
			name: "malformed draw date",
			ctx:  authed,
			req: &gumav1.UpdateLotteryRequest{
				GuildId:   "00000000-0000-0000-0000-000000000002",
				LotteryId: "00000000-0000-0000-0000-000000000003",
				DrawDate:  "tomorrow",
			},
			wantCode: codes.InvalidArgument,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.UpdateLottery(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestLotteryService_UpdateLottery_FieldValidation(t *testing.T) {
	service := NewLotteryService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const lotteryID = "00000000-0000-0000-0000-000000000003"
	blank, negative, negativeCount := " ", int64(-1), int32(-1)

	for name, req := range map[string]*gumav1.UpdateLotteryRequest{
		"blank title":           {GuildId: guildID, LotteryId: lotteryID, Title: &blank},
		"negative price":        {GuildId: guildID, LotteryId: lotteryID, TicketPrice: &negative},
		"negative max":          {GuildId: guildID, LotteryId: lotteryID, MaxTickets: &negativeCount},
		"negative per user max": {GuildId: guildID, LotteryId: lotteryID, MaxTicketsPerUser: &negativeCount},
	} {
		t.Run(name, func(t *testing.T) {
			_, err := service.UpdateLottery(authed, req)
			requireCode(t, err, codes.InvalidArgument)
		})
	}

	title := "Raffle"
	_, err := service.UpdateLottery(authed, &gumav1.UpdateLotteryRequest{GuildId: guildID, LotteryId: "bad", Title: &title})
	requireCode(t, err, codes.NotFound)
}

func TestCancelAndDeleteLottery_Validation(t *testing.T) {
	service := NewLotteryService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"

	_, err := service.CancelLottery(authed, &gumav1.CancelLotteryRequest{GuildId: guildID})
	requireCode(t, err, codes.InvalidArgument)
	_, err = service.CancelLottery(context.Background(), &gumav1.CancelLotteryRequest{GuildId: guildID, LotteryId: "l"})
	requireCode(t, err, codes.Unauthenticated)
	_, err = service.CancelLottery(authed, &gumav1.CancelLotteryRequest{GuildId: guildID, LotteryId: "bad"})
	requireCode(t, err, codes.NotFound)

	_, err = service.DeleteLottery(authed, &gumav1.DeleteLotteryRequest{LotteryId: "l"})
	requireCode(t, err, codes.InvalidArgument)
	_, err = service.DeleteLottery(context.Background(), &gumav1.DeleteLotteryRequest{GuildId: guildID, LotteryId: "l"})
	requireCode(t, err, codes.Unauthenticated)
	_, err = service.DeleteLottery(authed, &gumav1.DeleteLotteryRequest{GuildId: guildID, LotteryId: "bad"})
	requireCode(t, err, codes.NotFound)
}
