package wallet

import (
	"context"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"

	"github.com/kia280/guma/internal/services/errs"
)

func TestNonPositiveAmountIsInvalidArgument(t *testing.T) {
	svc := New(nil, zerolog.Nop())
	ctx := context.Background()

	_, _, err := svc.Deposit(ctx, "", "", 0, "")
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)

	_, _, err = svc.Transfer(ctx, "", "", "", -1, "")
	assert.ErrorIs(t, err, errs.ErrInvalidArgument)
}
