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

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

func TestCancelCheckIn_Validation(t *testing.T) {
	h := NewCheckInService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const checkinID = "00000000-0000-0000-0000-000000000003"

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.CancelCheckInRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: &gumav1.CancelCheckInRequest{CheckinId: checkinID}, wantCode: codes.InvalidArgument},
		{name: "missing checkin", ctx: authed, req: &gumav1.CancelCheckInRequest{GuildId: guildID}, wantCode: codes.InvalidArgument},
		{name: "unauthenticated", ctx: context.Background(), req: &gumav1.CancelCheckInRequest{GuildId: guildID, CheckinId: checkinID}, wantCode: codes.Unauthenticated},
		{name: "malformed checkin id", ctx: authed, req: &gumav1.CancelCheckInRequest{GuildId: guildID, CheckinId: "bad"}, wantCode: codes.NotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.CancelCheckIn(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestUpdateCheckIn_Validation(t *testing.T) {
	h := NewCheckInService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const checkinID = "00000000-0000-0000-0000-000000000003"
	future := time.Now().UTC().Add(time.Hour)
	valid := func() *gumav1.UpdateCheckInRequest {
		return &gumav1.UpdateCheckInRequest{
			GuildId: guildID, CheckinId: checkinID, Title: "Raid",
			Datetime:   future.Format(time.RFC3339),
			ExpireTime: future.Add(time.Hour).Format(time.RFC3339),
		}
	}

	tests := []struct {
		name     string
		ctx      context.Context
		req      func() *gumav1.UpdateCheckInRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: func() *gumav1.UpdateCheckInRequest { r := valid(); r.GuildId = ""; return r }, wantCode: codes.InvalidArgument},
		{name: "missing checkin", ctx: authed, req: func() *gumav1.UpdateCheckInRequest { r := valid(); r.CheckinId = ""; return r }, wantCode: codes.InvalidArgument},
		{name: "unauthenticated", ctx: context.Background(), req: valid, wantCode: codes.Unauthenticated},
		{name: "expire before datetime", ctx: authed, req: func() *gumav1.UpdateCheckInRequest { r := valid(); r.ExpireTime = r.Datetime; return r }, wantCode: codes.InvalidArgument},
		{name: "loot change", ctx: authed, req: func() *gumav1.UpdateCheckInRequest {
			r := valid()
			r.LootList = []*gumav1.Item{{Name: "Sword"}}
			return r
		}, wantCode: codes.InvalidArgument},
		{name: "gold loot change", ctx: authed, req: func() *gumav1.UpdateCheckInRequest {
			r := valid()
			r.Loot = []*gumav1.CheckInLootEntry{{Kind: "gold", Amount: 100}}
			return r
		}, wantCode: codes.InvalidArgument},
		{name: "malformed checkin id", ctx: authed, req: func() *gumav1.UpdateCheckInRequest { r := valid(); r.CheckinId = "bad"; return r }, wantCode: codes.NotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.UpdateCheckIn(tt.ctx, tt.req())
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestDistributeCheckInGold_Validation(t *testing.T) {
	h := NewCheckInService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const checkinID = "00000000-0000-0000-0000-000000000003"
	const requestID = "00000000-0000-0000-0000-000000000004"
	const alice = "00000000-0000-0000-0000-00000000000a"
	const bob = "00000000-0000-0000-0000-00000000000b"
	valid := func() *gumav1.DistributeCheckInGoldRequest {
		return &gumav1.DistributeCheckInGoldRequest{
			GuildId: guildID, CheckinId: checkinID, RequestId: requestID,
			Payouts: []*gumav1.CheckInGoldPayout{{UserId: alice, Amount: 300}, {UserId: bob, Amount: 200}},
		}
	}
	with := func(mutate func(r *gumav1.DistributeCheckInGoldRequest)) func() *gumav1.DistributeCheckInGoldRequest {
		return func() *gumav1.DistributeCheckInGoldRequest {
			r := valid()
			mutate(r)
			return r
		}
	}

	tests := []struct {
		name     string
		ctx      context.Context
		req      func() *gumav1.DistributeCheckInGoldRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: with(func(r *gumav1.DistributeCheckInGoldRequest) { r.GuildId = "" }), wantCode: codes.InvalidArgument},
		{name: "missing checkin", ctx: authed, req: with(func(r *gumav1.DistributeCheckInGoldRequest) { r.CheckinId = "" }), wantCode: codes.InvalidArgument},
		{name: "missing request id", ctx: authed, req: with(func(r *gumav1.DistributeCheckInGoldRequest) { r.RequestId = "" }), wantCode: codes.InvalidArgument},
		{name: "no payouts", ctx: authed, req: with(func(r *gumav1.DistributeCheckInGoldRequest) { r.Payouts = nil }), wantCode: codes.InvalidArgument},
		{name: "unauthenticated", ctx: context.Background(), req: valid, wantCode: codes.Unauthenticated},
		{name: "malformed checkin id", ctx: authed, req: with(func(r *gumav1.DistributeCheckInGoldRequest) { r.CheckinId = "bad" }), wantCode: codes.NotFound},
		{name: "malformed request id", ctx: authed, req: with(func(r *gumav1.DistributeCheckInGoldRequest) { r.RequestId = "bad" }), wantCode: codes.InvalidArgument},
		{name: "negative amount", ctx: authed, req: with(func(r *gumav1.DistributeCheckInGoldRequest) { r.Payouts[1].Amount = -1 }), wantCode: codes.InvalidArgument},
		{name: "all zero", ctx: authed, req: with(func(r *gumav1.DistributeCheckInGoldRequest) { r.Payouts[0].Amount = 0; r.Payouts[1].Amount = 0 }), wantCode: codes.InvalidArgument},
		{name: "duplicate recipient", ctx: authed, req: with(func(r *gumav1.DistributeCheckInGoldRequest) { r.Payouts[1].UserId = alice }), wantCode: codes.InvalidArgument},
		{name: "malformed recipient", ctx: authed, req: with(func(r *gumav1.DistributeCheckInGoldRequest) { r.Payouts[0].UserId = "someone" }), wantCode: codes.InvalidArgument},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.DistributeCheckInGold(tt.ctx, tt.req())
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestGetCheckInGold_Validation(t *testing.T) {
	h := NewCheckInService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const checkinID = "00000000-0000-0000-0000-000000000003"

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.GetCheckInGoldRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: &gumav1.GetCheckInGoldRequest{CheckinId: checkinID}, wantCode: codes.InvalidArgument},
		{name: "missing checkin", ctx: authed, req: &gumav1.GetCheckInGoldRequest{GuildId: guildID}, wantCode: codes.InvalidArgument},
		{name: "unauthenticated", ctx: context.Background(), req: &gumav1.GetCheckInGoldRequest{GuildId: guildID, CheckinId: checkinID}, wantCode: codes.Unauthenticated},
		{name: "malformed checkin id", ctx: authed, req: &gumav1.GetCheckInGoldRequest{GuildId: guildID, CheckinId: "bad"}, wantCode: codes.NotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.GetCheckInGold(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestLootFromProto(t *testing.T) {
	legacy := lootFromProto(nil, []*gumav1.Item{{Name: "Sword"}})
	require.Len(t, legacy, 1)
	assert.Equal(t, "item", legacy[0].Kind)
	assert.Equal(t, "Sword", legacy[0].Item.Name)

	loot := lootFromProto([]*gumav1.CheckInLootEntry{{Kind: "gold", Amount: 700}, {Kind: "item", Item: &gumav1.Item{Name: "Ring"}}}, []*gumav1.Item{{Name: "Ignored"}})
	require.Len(t, loot, 2)
	assert.Equal(t, int64(700), loot[0].Amount)
	assert.Equal(t, "Ring", loot[1].Item.Name)
}
