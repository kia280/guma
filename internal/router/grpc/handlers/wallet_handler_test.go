package handlers

import (
	"context"
	"testing"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

func TestWalletHandler_RejectsMalformedIDs(t *testing.T) {
	h := NewWalletService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), testUserID)
	const guildID = "00000000-0000-0000-0000-000000000002"
	const memberID = "00000000-0000-0000-0000-000000000003"

	tests := []struct {
		name string
		call func() error
	}{
		{name: "balance trend guild", call: func() error {
			_, err := h.GetBalanceTrend(authed, &gumav1.GetBalanceTrendRequest{GuildId: "not-a-uuid"})
			return err
		}},
		{name: "get wallet guild", call: func() error {
			_, err := h.GetWallet(authed, &gumav1.GetWalletRequest{GuildId: "bad"})
			return err
		}},
		{name: "list transactions guild", call: func() error {
			_, err := h.ListTransactions(authed, &gumav1.ListTransactionsRequest{GuildId: "bad"})
			return err
		}},
		{name: "transfer funds recipient", call: func() error {
			_, err := h.TransferFunds(authed, &gumav1.TransferFundsRequest{GuildId: guildID, ToUserId: "bad"})
			return err
		}},
		{name: "cancel withdrawal request id", call: func() error {
			_, err := h.CancelWithdrawalRequest(authed, &gumav1.CancelWithdrawalRequestRequest{GuildId: guildID, RequestId: "bad"})
			return err
		}},
		{name: "review withdrawal request id", call: func() error {
			_, err := h.ReviewWithdrawalRequest(authed, &gumav1.ReviewWithdrawalRequestRequest{GuildId: guildID, RequestId: "bad"})
			return err
		}},
		{name: "withdraw backpack item id", call: func() error {
			_, err := h.WithdrawBackpackItem(authed, &gumav1.WithdrawBackpackItemRequest{GuildId: guildID, ItemId: "bad"})
			return err
		}},
		{name: "cancel backpack withdrawal item id", call: func() error {
			_, err := h.CancelBackpackWithdrawal(authed, &gumav1.CancelBackpackWithdrawalRequest{GuildId: guildID, ItemId: "bad"})
			return err
		}},
		{name: "confirm delivery item id", call: func() error {
			_, err := h.ConfirmBackpackDelivery(authed, &gumav1.ConfirmBackpackDeliveryRequest{GuildId: guildID, ItemId: "bad"})
			return err
		}},
		{name: "transfer backpack item recipient", call: func() error {
			_, err := h.TransferBackpackItem(authed, &gumav1.TransferBackpackItemRequest{GuildId: guildID, ItemId: memberID, ToUserId: "bad"})
			return err
		}},
		{name: "list pending deliveries guild", call: func() error {
			_, err := h.ListPendingDeliveries(authed, &gumav1.ListPendingDeliveriesRequest{GuildId: "bad"})
			return err
		}},
		{name: "get member assets member", call: func() error {
			_, err := h.GetMemberAssets(authed, &gumav1.GetMemberAssetsRequest{GuildId: guildID, UserId: "bad"})
			return err
		}},
		{name: "admin transfer funds source", call: func() error {
			_, err := h.AdminTransferFunds(authed, &gumav1.AdminTransferFundsRequest{GuildId: guildID, UserId: "bad", ToGuildBank: true})
			return err
		}},
		{name: "admin transfer funds recipient", call: func() error {
			_, err := h.AdminTransferFunds(authed, &gumav1.AdminTransferFundsRequest{GuildId: guildID, UserId: memberID, ToUserId: "bad"})
			return err
		}},
		{name: "admin transfer items item id", call: func() error {
			_, err := h.AdminTransferBackpackItems(authed, &gumav1.AdminTransferBackpackItemsRequest{
				GuildId: guildID, UserId: memberID, ItemIds: []string{memberID, "bad"}, ToGuildBank: true,
			})
			return err
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requireCode(t, tt.call(), codes.InvalidArgument)
		})
	}
}

func TestWalletHandler_RequiresAuthenticatedUser(t *testing.T) {
	h := NewWalletService(nil, nil, zerolog.Nop())
	_, err := h.TransferFunds(context.Background(), &gumav1.TransferFundsRequest{})
	requireCode(t, err, codes.Unauthenticated)
}
