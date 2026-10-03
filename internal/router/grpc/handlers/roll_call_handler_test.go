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

func TestCancelRollCall_Validation(t *testing.T) {
	h := NewRollCallService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const rollCallID = "00000000-0000-0000-0000-000000000003"

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.CancelRollCallRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: &gumav1.CancelRollCallRequest{RollCallId: rollCallID}, wantCode: codes.InvalidArgument},
		{name: "missing roll call", ctx: authed, req: &gumav1.CancelRollCallRequest{GuildId: guildID}, wantCode: codes.InvalidArgument},
		{name: "malformed roll call id", ctx: authed, req: &gumav1.CancelRollCallRequest{GuildId: guildID, RollCallId: "bad"}, wantCode: codes.NotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.CancelRollCall(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestUpdateRollCall_Validation(t *testing.T) {
	h := NewRollCallService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const rollCallID = "00000000-0000-0000-0000-000000000003"
	future := time.Now().UTC().Add(time.Hour)
	valid := func() *gumav1.UpdateRollCallRequest {
		return &gumav1.UpdateRollCallRequest{
			GuildId: guildID, RollCallId: rollCallID, Title: "Raid",
			Datetime:   future.Format(time.RFC3339),
			ExpireTime: future.Add(time.Hour).Format(time.RFC3339),
		}
	}

	tests := []struct {
		name     string
		ctx      context.Context
		req      func() *gumav1.UpdateRollCallRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: func() *gumav1.UpdateRollCallRequest { r := valid(); r.GuildId = ""; return r }, wantCode: codes.InvalidArgument},
		{name: "missing roll call", ctx: authed, req: func() *gumav1.UpdateRollCallRequest { r := valid(); r.RollCallId = ""; return r }, wantCode: codes.InvalidArgument},
		{name: "expire before datetime", ctx: authed, req: func() *gumav1.UpdateRollCallRequest { r := valid(); r.ExpireTime = r.Datetime; return r }, wantCode: codes.InvalidArgument},
		{name: "loot change", ctx: authed, req: func() *gumav1.UpdateRollCallRequest {
			r := valid()
			r.LootList = []*gumav1.Item{{Name: "Sword"}}
			return r
		}, wantCode: codes.InvalidArgument},
		{name: "gold loot change", ctx: authed, req: func() *gumav1.UpdateRollCallRequest {
			r := valid()
			r.Loot = []*gumav1.RollCallLootEntry{{Kind: "gold", Amount: 100}}
			return r
		}, wantCode: codes.InvalidArgument},
		{name: "malformed roll call id", ctx: authed, req: func() *gumav1.UpdateRollCallRequest { r := valid(); r.RollCallId = "bad"; return r }, wantCode: codes.NotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.UpdateRollCall(tt.ctx, tt.req())
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestDistributeRollCallGold_Validation(t *testing.T) {
	h := NewRollCallService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const rollCallID = "00000000-0000-0000-0000-000000000003"
	const requestID = "00000000-0000-0000-0000-000000000004"
	const alice = "00000000-0000-0000-0000-00000000000a"
	const bob = "00000000-0000-0000-0000-00000000000b"
	valid := func() *gumav1.DistributeRollCallGoldRequest {
		return &gumav1.DistributeRollCallGoldRequest{
			GuildId: guildID, RollCallId: rollCallID, RequestId: requestID,
			Payouts: []*gumav1.RollCallGoldPayout{{UserId: alice, Amount: 300}, {UserId: bob, Amount: 200}},
		}
	}
	with := func(mutate func(r *gumav1.DistributeRollCallGoldRequest)) func() *gumav1.DistributeRollCallGoldRequest {
		return func() *gumav1.DistributeRollCallGoldRequest {
			r := valid()
			mutate(r)
			return r
		}
	}

	tests := []struct {
		name     string
		ctx      context.Context
		req      func() *gumav1.DistributeRollCallGoldRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: with(func(r *gumav1.DistributeRollCallGoldRequest) { r.GuildId = "" }), wantCode: codes.InvalidArgument},
		{name: "missing roll call", ctx: authed, req: with(func(r *gumav1.DistributeRollCallGoldRequest) { r.RollCallId = "" }), wantCode: codes.InvalidArgument},
		{name: "missing request id", ctx: authed, req: with(func(r *gumav1.DistributeRollCallGoldRequest) { r.RequestId = "" }), wantCode: codes.InvalidArgument},
		{name: "no payouts", ctx: authed, req: with(func(r *gumav1.DistributeRollCallGoldRequest) { r.Payouts = nil }), wantCode: codes.InvalidArgument},
		{name: "malformed roll call id", ctx: authed, req: with(func(r *gumav1.DistributeRollCallGoldRequest) { r.RollCallId = "bad" }), wantCode: codes.NotFound},
		{name: "malformed request id", ctx: authed, req: with(func(r *gumav1.DistributeRollCallGoldRequest) { r.RequestId = "bad" }), wantCode: codes.InvalidArgument},
		{name: "negative amount", ctx: authed, req: with(func(r *gumav1.DistributeRollCallGoldRequest) { r.Payouts[1].Amount = -1 }), wantCode: codes.InvalidArgument},
		{name: "all zero", ctx: authed, req: with(func(r *gumav1.DistributeRollCallGoldRequest) { r.Payouts[0].Amount = 0; r.Payouts[1].Amount = 0 }), wantCode: codes.InvalidArgument},
		{name: "duplicate recipient", ctx: authed, req: with(func(r *gumav1.DistributeRollCallGoldRequest) { r.Payouts[1].UserId = alice }), wantCode: codes.InvalidArgument},
		{name: "malformed recipient", ctx: authed, req: with(func(r *gumav1.DistributeRollCallGoldRequest) { r.Payouts[0].UserId = "someone" }), wantCode: codes.InvalidArgument},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.DistributeRollCallGold(tt.ctx, tt.req())
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestGetRollCallGold_Validation(t *testing.T) {
	h := NewRollCallService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const rollCallID = "00000000-0000-0000-0000-000000000003"

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.GetRollCallGoldRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: &gumav1.GetRollCallGoldRequest{RollCallId: rollCallID}, wantCode: codes.InvalidArgument},
		{name: "missing roll call", ctx: authed, req: &gumav1.GetRollCallGoldRequest{GuildId: guildID}, wantCode: codes.InvalidArgument},
		{name: "malformed roll call id", ctx: authed, req: &gumav1.GetRollCallGoldRequest{GuildId: guildID, RollCallId: "bad"}, wantCode: codes.NotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.GetRollCallGold(tt.ctx, tt.req)
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

	loot := lootFromProto([]*gumav1.RollCallLootEntry{{Kind: "gold", Amount: 700}, {Kind: "item", Item: &gumav1.Item{Name: "Ring"}}}, []*gumav1.Item{{Name: "Ignored"}})
	require.Len(t, loot, 2)
	assert.Equal(t, int64(700), loot[0].Amount)
	assert.Equal(t, "Ring", loot[1].Item.Name)
}

func TestCompleteRollCall_Validation(t *testing.T) {
	h := NewRollCallService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const rollCallID = "00000000-0000-0000-0000-000000000003"

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.CompleteRollCallRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: &gumav1.CompleteRollCallRequest{RollCallId: rollCallID}, wantCode: codes.InvalidArgument},
		{name: "missing roll call", ctx: authed, req: &gumav1.CompleteRollCallRequest{GuildId: guildID}, wantCode: codes.InvalidArgument},
		{name: "malformed roll call id", ctx: authed, req: &gumav1.CompleteRollCallRequest{GuildId: guildID, RollCallId: "bad"}, wantCode: codes.NotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.CompleteRollCall(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}

func TestUpdateRollCallLoot_Validation(t *testing.T) {
	h := NewRollCallService(nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), "00000000-0000-0000-0000-000000000001")
	const guildID = "00000000-0000-0000-0000-000000000002"
	const rollCallID = "00000000-0000-0000-0000-000000000003"

	tests := []struct {
		name     string
		ctx      context.Context
		req      *gumav1.UpdateRollCallLootRequest
		wantCode codes.Code
	}{
		{name: "missing guild", ctx: authed, req: &gumav1.UpdateRollCallLootRequest{RollCallId: rollCallID}, wantCode: codes.InvalidArgument},
		{name: "missing roll call", ctx: authed, req: &gumav1.UpdateRollCallLootRequest{GuildId: guildID}, wantCode: codes.InvalidArgument},
		{name: "malformed roll call id", ctx: authed, req: &gumav1.UpdateRollCallLootRequest{GuildId: guildID, RollCallId: "bad"}, wantCode: codes.NotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := h.UpdateRollCallLoot(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}
