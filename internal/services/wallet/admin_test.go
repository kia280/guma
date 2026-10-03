package wallet

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

func TestUniqueIDs(t *testing.T) {
	a := uuid.MustParse("00000000-0000-0000-0000-00000000000a")
	b := uuid.MustParse("00000000-0000-0000-0000-00000000000b")

	tests := []struct {
		name string
		in   []uuid.UUID
		want []uuid.UUID
	}{
		{name: "empty", in: nil, want: []uuid.UUID{}},
		{name: "distinct", in: []uuid.UUID{a, b}, want: []uuid.UUID{a, b}},
		{name: "duplicates keep first order", in: []uuid.UUID{b, a, b, a}, want: []uuid.UUID{b, a}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, uniqueIDs(tt.in))
		})
	}
}
