package handlers

import (
	"context"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/kia280/guma/internal/session"
)

func callerID(ctx context.Context) (uuid.UUID, error) {
	id, ok := session.UserID(ctx)
	if !ok {
		return uuid.Nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}
	return id, nil
}
