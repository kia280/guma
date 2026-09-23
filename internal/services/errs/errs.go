package errs

import "errors"

// Sentinel errors returned by service layer methods.
// Handlers map these to the appropriate gRPC status codes.
var (
	ErrNotFound           = errors.New("not found")
	ErrPermissionDenied   = errors.New("permission denied")
	ErrUnauthenticated    = errors.New("unauthenticated")
	ErrFailedPrecondition = errors.New("failed precondition")
	ErrAlreadyExists      = errors.New("already exists")
	ErrInternal           = errors.New("internal error")
	ErrInvalidArgument    = errors.New("invalid argument")
)
