package authz

import (
	"errors"
	"fmt"
	"testing"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func TestRetryable(t *testing.T) {
	tests := []struct {
		err  error
		want bool
	}{
		{fmt.Errorf("keto write tuples: %w", status.Error(codes.Aborted, "serialize")), true},
		{fmt.Errorf("keto list tuples: %w", status.Error(codes.Unavailable, "down")), true},
		{fmt.Errorf("keto write tuples: %w", status.Error(codes.InvalidArgument, "bad")), false},
		{errors.New("unknown role"), false},
		{nil, false},
	}
	for _, tt := range tests {
		if got := retryable(tt.err); got != tt.want {
			t.Errorf("retryable(%v) = %v, want %v", tt.err, got, tt.want)
		}
	}
}

func TestRelationRoleRoundTrip(t *testing.T) {
	for _, r := range Roles {
		got, ok := relationRole(roleRelations[r])
		if !ok || got != r {
			t.Errorf("relationRole(%q) = %q, %v", roleRelations[r], got, ok)
		}
	}
	if _, ok := relationRole("viewers"); ok {
		t.Error("relationRole accepted a non-role relation")
	}
}
