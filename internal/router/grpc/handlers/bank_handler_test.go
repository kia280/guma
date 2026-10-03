package handlers

import (
	"context"
	"testing"

	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"

	gumav1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/session"
)

func TestBankHandler_RejectsMalformedIDs(t *testing.T) {
	h := NewBankService(nil, nil, zerolog.Nop())
	authed := session.WithUserID(context.Background(), testUserID)
	const guildID = "00000000-0000-0000-0000-000000000002"

	tests := []struct {
		name string
		call func() error
	}{
		{name: "get bank guild", call: func() error {
			_, err := h.GetBank(authed, &gumav1.GetBankRequest{GuildId: "bad"})
			return err
		}},
		{name: "review fund request id", call: func() error {
			_, err := h.ReviewFundRequest(authed, &gumav1.ReviewFundRequestRequest{GuildId: guildID, RequestId: "bad"})
			return err
		}},
		{name: "delete bank item id", call: func() error {
			_, err := h.DeleteBankItem(authed, &gumav1.DeleteBankItemRequest{GuildId: guildID, BankItemId: "bad"})
			return err
		}},
		{name: "list bank items roll call filter", call: func() error {
			_, err := h.ListBankItems(authed, &gumav1.ListBankItemsRequest{GuildId: guildID, RollCallId: "bad"})
			return err
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			requireCode(t, tt.call(), codes.InvalidArgument)
		})
	}
}

func TestBankHandler_RequiresAuthenticatedUser(t *testing.T) {
	h := NewBankService(nil, nil, zerolog.Nop())
	_, err := h.DeleteBankItem(context.Background(), &gumav1.DeleteBankItemRequest{})
	requireCode(t, err, codes.Unauthenticated)
}
