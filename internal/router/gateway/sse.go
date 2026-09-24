package gateway

import (
	"net/http"
	"time"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
)

const mimeEventStream = "text/event-stream"

type sseMarshaler struct {
	runtime.Marshaler
}

func (m *sseMarshaler) Marshal(v any) ([]byte, error) {
	body, err := m.Marshaler.Marshal(v)
	if err != nil {
		return nil, err
	}
	return append([]byte("data: "), body...), nil
}

func (m *sseMarshaler) ContentType(any) string {
	return mimeEventStream
}

func (m *sseMarshaler) StreamContentType(any) string {
	return mimeEventStream
}

func (m *sseMarshaler) Delimiter() []byte {
	return []byte("\n\n")
}

func acceptsEventStream(r *http.Request) bool {
	for _, v := range r.Header.Values("Accept") {
		if v == mimeEventStream {
			return true
		}
	}
	return false
}

func eventStreamMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if acceptsEventStream(r) {
			_ = http.NewResponseController(w).SetWriteDeadline(time.Time{})
			w.Header().Set("Cache-Control", "no-cache")
			w.Header().Set("X-Accel-Buffering", "no")
		}
		next.ServeHTTP(w, r)
	})
}
