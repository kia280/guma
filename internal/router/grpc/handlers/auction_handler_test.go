package handlers

import (
	"context"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

func requireCode(t *testing.T, err error, want codes.Code) {
	t.Helper()
	require.Error(t, err)
	st, ok := status.FromError(err)
	require.True(t, ok)
	assert.Equal(t, want, st.Code())
}

func TestUpdateAuction_Validation(t *testing.T) {
	h := NewAuctionService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const auctionID = "00000000-0000-0000-0000-000000000003"
	zero, positive := int64(0), int64(100)
	end := time.Now().Add(time.Hour)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.UpdateAuctionRequest
		wantCode codes.Code
	}{
		{name: "missing ids", ctx: authed, req: &gumav1.UpdateAuctionRequest{}, wantCode: codes.InvalidArgument},
		{name: "unauthenticated", ctx: context.Background(), req: &gumav1.UpdateAuctionRequest{GuildId: guildID, AuctionId: auctionID}, wantCode: codes.Unauthenticated},
		{name: "blank item name", ctx: authed, req: &gumav1.UpdateAuctionRequest{GuildId: guildID, AuctionId: auctionID, Item: &gumav1.Item{Name: " "}}, wantCode: codes.InvalidArgument},
		{name: "zero starting bid", ctx: authed, req: &gumav1.UpdateAuctionRequest{GuildId: guildID, AuctionId: auctionID, StartingBid: &zero}, wantCode: codes.InvalidArgument},
		{name: "zero increment", ctx: authed, req: &gumav1.UpdateAuctionRequest{GuildId: guildID, AuctionId: auctionID, MinBidIncrement: &zero}, wantCode: codes.InvalidArgument},
		{
			name: "end before start",
			ctx:  authed,
			req: &gumav1.UpdateAuctionRequest{
				GuildId: guildID, AuctionId: auctionID,
				StartTime: timestamppb.New(end), EndTime: timestamppb.New(end.Add(-time.Minute)),
			},
			wantCode: codes.InvalidArgument,
		},
		{name: "malformed auction id", ctx: authed, req: &gumav1.UpdateAuctionRequest{GuildId: guildID, AuctionId: "bad", StartingBid: &positive}, wantCode: codes.NotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.UpdateAuction(tt.ctx, tt.req)
			requireCode(t, err, tt.wantCode)
		})
	}
}

func TestCancelAndDeleteAuction_Validation(t *testing.T) {
	h := NewAuctionService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"

	_, err := h.CancelAuction(authed, &gumav1.CancelAuctionRequest{GuildId: guildID})
	requireCode(t, err, codes.InvalidArgument)
	_, err = h.CancelAuction(context.Background(), &gumav1.CancelAuctionRequest{GuildId: guildID, AuctionId: "a"})
	requireCode(t, err, codes.Unauthenticated)
	_, err = h.CancelAuction(authed, &gumav1.CancelAuctionRequest{GuildId: guildID, AuctionId: "bad"})
	requireCode(t, err, codes.NotFound)

	_, err = h.DeleteAuction(authed, &gumav1.DeleteAuctionRequest{AuctionId: "a"})
	requireCode(t, err, codes.InvalidArgument)
	_, err = h.DeleteAuction(context.Background(), &gumav1.DeleteAuctionRequest{GuildId: guildID, AuctionId: "a"})
	requireCode(t, err, codes.Unauthenticated)
	_, err = h.DeleteAuction(authed, &gumav1.DeleteAuctionRequest{GuildId: guildID, AuctionId: "bad"})
	requireCode(t, err, codes.NotFound)
}
