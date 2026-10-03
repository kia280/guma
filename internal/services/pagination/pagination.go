package pagination

const (
	DefaultSize = 20
	MaxSize     = 100
)

type integer interface {
	~int | ~int32
}

func Size[T integer](requested, defaultSize, maxSize T) T {
	if requested <= 0 {
		return defaultSize
	}
	return min(requested, maxSize)
}

func StandardSize[T integer](requested T) T {
	return Size(requested, DefaultSize, MaxSize)
}
