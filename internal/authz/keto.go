package authz

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	rts "github.com/ory/keto/proto/ory/keto/relation_tuples/v1alpha2"
	"go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/status"
)

const (
	GuildNamespace = "Guild"
	UserNamespace  = "User"

	listPageSize    = 500
	writeAttempts   = 4
	writeRetryDelay = 25 * time.Millisecond
)

var roleRelations = map[Role]string{
	RoleOwner:     "owners",
	RoleAdmin:     "admins",
	RoleModerator: "moderators",
	RoleMember:    "members",
}

func relationRole(relation string) (Role, bool) {
	for role, rel := range roleRelations {
		if rel == relation {
			return role, true
		}
	}
	return "", false
}

type MemberRole struct {
	GuildID uuid.UUID
	UserID  uuid.UUID
	Role    Role
}

type TupleStore interface {
	SetMemberRole(ctx context.Context, guildID, userID uuid.UUID, role Role) error
	ListMemberRoles(ctx context.Context, fn func(MemberRole) error) error
}

type Keto struct {
	conns []*grpc.ClientConn
	check rts.CheckServiceClient
	read  rts.ReadServiceClient
	write rts.WriteServiceClient
}

func DialKeto(readAddr, writeAddr string) (*Keto, error) {
	if readAddr == "" || writeAddr == "" {
		return nil, errors.New("keto read and write addresses are required")
	}
	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
		grpc.WithStatsHandler(otelgrpc.NewClientHandler()),
	}
	readConn, err := grpc.NewClient(readAddr, opts...)
	if err != nil {
		return nil, fmt.Errorf("dial keto read api: %w", err)
	}
	writeConn, err := grpc.NewClient(writeAddr, opts...)
	if err != nil {
		readConn.Close() //nolint:errcheck
		return nil, fmt.Errorf("dial keto write api: %w", err)
	}
	return &Keto{
		conns: []*grpc.ClientConn{readConn, writeConn},
		check: rts.NewCheckServiceClient(readConn),
		read:  rts.NewReadServiceClient(readConn),
		write: rts.NewWriteServiceClient(writeConn),
	}, nil
}

func (k *Keto) Close() error {
	var errList []error
	for _, conn := range k.conns {
		errList = append(errList, conn.Close())
	}
	return errors.Join(errList...)
}

func (k *Keto) Can(ctx context.Context, guildID, userID uuid.UUID, p Permission) (bool, error) {
	resp, err := k.check.Check(ctx, &rts.CheckRequest{
		Tuple: &rts.RelationTuple{
			Namespace: GuildNamespace,
			Object:    guildID.String(),
			Relation:  string(p),
			Subject:   userSubject(userID),
		},
	})
	if err != nil {
		return false, fmt.Errorf("keto check: %w", err)
	}
	return resp.GetAllowed(), nil
}

func (k *Keto) SetMemberRole(ctx context.Context, guildID, userID uuid.UUID, role Role) error {
	var err error
	for attempt := 1; ; attempt++ {
		err = k.setMemberRole(ctx, guildID, userID, role)
		if attempt == writeAttempts || !retryable(err) {
			return err
		}
		select {
		case <-ctx.Done():
			return err
		case <-time.After(time.Duration(attempt) * writeRetryDelay):
		}
	}
}

func retryable(err error) bool {
	switch status.Code(err) {
	case codes.Aborted, codes.Unavailable:
		return true
	}
	return false
}

func (k *Keto) setMemberRole(ctx context.Context, guildID, userID uuid.UUID, role Role) error {
	want := ""
	if role != "" {
		rel, ok := roleRelations[role]
		if !ok {
			return fmt.Errorf("unknown role %q", role)
		}
		want = rel
	}

	namespace, guild := GuildNamespace, guildID.String()
	subject := userSubject(userID)
	var deltas []*rts.RelationTupleDelta
	present := false
	err := k.list(ctx, &rts.RelationQuery{Namespace: &namespace, Object: &guild, Subject: subject}, func(t *rts.RelationTuple) error {
		if _, isRole := relationRole(t.GetRelation()); !isRole {
			return nil
		}
		if t.GetRelation() == want {
			present = true
			return nil
		}
		deltas = append(deltas, &rts.RelationTupleDelta{Action: rts.RelationTupleDelta_ACTION_DELETE, RelationTuple: t})
		return nil
	})
	if err != nil {
		return err
	}
	if want != "" && !present {
		deltas = append(deltas, &rts.RelationTupleDelta{
			Action:        rts.RelationTupleDelta_ACTION_INSERT,
			RelationTuple: &rts.RelationTuple{Namespace: GuildNamespace, Object: guild, Relation: want, Subject: subject},
		})
	}
	if len(deltas) == 0 {
		return nil
	}
	if _, err := k.write.TransactRelationTuples(ctx, &rts.TransactRelationTuplesRequest{RelationTupleDeltas: deltas}); err != nil {
		return fmt.Errorf("keto write tuples: %w", err)
	}
	return nil
}

func (k *Keto) ListMemberRoles(ctx context.Context, fn func(MemberRole) error) error {
	namespace := GuildNamespace
	return k.list(ctx, &rts.RelationQuery{Namespace: &namespace}, func(t *rts.RelationTuple) error {
		role, ok := relationRole(t.GetRelation())
		if !ok {
			return nil
		}
		guildID, err := uuid.Parse(t.GetObject())
		if err != nil {
			return nil
		}
		set := t.GetSubject().GetSet()
		if set == nil || set.GetNamespace() != UserNamespace {
			return nil
		}
		userID, err := uuid.Parse(set.GetObject())
		if err != nil {
			return nil
		}
		return fn(MemberRole{GuildID: guildID, UserID: userID, Role: role})
	})
}

func (k *Keto) list(ctx context.Context, q *rts.RelationQuery, fn func(*rts.RelationTuple) error) error {
	token := ""
	for {
		resp, err := k.read.ListRelationTuples(ctx, &rts.ListRelationTuplesRequest{
			RelationQuery: q,
			PageSize:      listPageSize,
			PageToken:     token,
		})
		if err != nil {
			return fmt.Errorf("keto list tuples: %w", err)
		}
		for _, t := range resp.GetRelationTuples() {
			if err := fn(t); err != nil {
				return err
			}
		}
		token = resp.GetNextPageToken()
		if token == "" {
			return nil
		}
	}
}

func userSubject(userID uuid.UUID) *rts.Subject {
	return rts.NewSubjectSet(UserNamespace, userID.String(), "")
}
