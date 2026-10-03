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

func ParseList(field string, raws []string) ([]uuid.UUID, error) {
	parsed := make([]uuid.UUID, len(raws))
	for i, raw := range raws {
		id, err := Parse(field, raw)
		if err != nil {
			return nil, err
		}
		parsed[i] = id
	}
	return parsed, nil
}

type Parser struct {
	err error
}

func (p *Parser) Parse(field, raw string) uuid.UUID {
	id, err := Parse(field, raw)
	p.record(err)
	return id
}

func (p *Parser) Optional(field, raw string) *uuid.UUID {
	id, err := ParseOptional(field, raw)
	p.record(err)
	return id
}

func (p *Parser) List(field string, raws []string) []uuid.UUID {
	parsed, err := ParseList(field, raws)
	p.record(err)
	return parsed
}

func (p *Parser) Err() error {
	return p.err
}

func (p *Parser) record(err error) {
	if p.err == nil && err != nil {
		p.err = err
	}
}
