package ids

import (
	"errors"
	"testing"

	"github.com/google/uuid"

	"github.com/kia280/guma/internal/services/errs"
)

const validID = "11111111-1111-1111-1111-111111111111"

func TestParse(t *testing.T) {
	id, err := Parse("guild_id", validID)
	if err != nil || id != uuid.MustParse(validID) {
		t.Fatalf("Parse(valid) = %s, %v", id, err)
	}

	_, err = Parse("guild_id", "nope")
	if !errors.Is(err, errs.ErrInvalidArgument) {
		t.Fatalf("expected ErrInvalidArgument, got %v", err)
	}
	if want := "invalid argument: guild_id must be a UUID"; err.Error() != want {
		t.Fatalf("error = %q, want %q", err.Error(), want)
	}
}

func TestParseOptional(t *testing.T) {
	id, err := ParseOptional("roll_call_id", "")
	if err != nil || id != nil {
		t.Fatalf("ParseOptional(empty) = %v, %v", id, err)
	}
	id, err = ParseOptional("roll_call_id", validID)
	if err != nil || id == nil || *id != uuid.MustParse(validID) {
		t.Fatalf("ParseOptional(valid) = %v, %v", id, err)
	}
	if _, err := ParseOptional("roll_call_id", "nope"); !errors.Is(err, errs.ErrInvalidArgument) {
		t.Fatalf("expected ErrInvalidArgument, got %v", err)
	}
}
