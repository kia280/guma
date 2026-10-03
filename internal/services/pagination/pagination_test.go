package pagination

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestSize(t *testing.T) {
	assert.Equal(t, 50, Size(0, 50, 500))
	assert.Equal(t, 50, Size(-1, 50, 500))
	assert.Equal(t, 120, Size(120, 50, 500))
	assert.Equal(t, int32(500), Size(int32(501), 50, 500))
}

func TestStandardSize(t *testing.T) {
	assert.Equal(t, DefaultSize, StandardSize(0))
	assert.Equal(t, 40, StandardSize(40))
	assert.Equal(t, int32(MaxSize), StandardSize(int32(MaxSize+1)))
}
