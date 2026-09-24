package lottery

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestIsDue(t *testing.T) {
	now := time.Date(2026, 9, 24, 12, 0, 0, 0, time.UTC)

	tests := []struct {
		name     string
		drawDate string
		want     bool
	}{
		{name: "past", drawDate: "2026-09-24T11:59:59Z", want: true},
		{name: "exactly now", drawDate: "2026-09-24T12:00:00Z", want: true},
		{name: "future", drawDate: "2026-09-24T12:00:01Z", want: false},
		{name: "fractional seconds", drawDate: "2026-09-24T11:00:00.500Z", want: true},
		{name: "empty", drawDate: "", want: false},
		{name: "malformed", drawDate: "soon", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isDue(tt.drawDate, now))
		})
	}
}
