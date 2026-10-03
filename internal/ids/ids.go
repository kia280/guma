package ids

import (
	"fmt"

	"github.com/google/uuid"

	"github.com/kia280/guma/internal/services/errs"
)

func Parse(field, raw string) (uuid.UUID, error) {
	id, err := uuid.Parse(raw)
	if err != nil {
		return uuid.Nil, fmt.Errorf("%w: %s must be a UUID", errs.ErrInvalidArgument, field)
	}
	return id, nil
}

func ParseOptional(field, raw string) (*uuid.UUID, error) {
	if raw == "" {
		return nil, nil
	}
	id, err := Parse(field, raw)
	if err != nil {
		return nil, err
	}
	return &id, nil
}
