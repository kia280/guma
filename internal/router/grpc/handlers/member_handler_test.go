package handlers

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	"github.com/kia280/guma/internal/session"

	memberv1 "github.com/kia280/guma/gen/proto/guma/v1"
)

func TestNewMemberService(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	assert.NotNil(t, service)
	assert.NotNil(t, service.logger)
}

func TestMemberService_InviteMember(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.InviteMemberRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name: "successful member invitation",
			ctx:  session.WithUserID(context.Background(), testUserID),
			req: &memberv1.InviteMemberRequest{
				GuildId: "guild-123",
				Email:   "test@example.com",
				Role:    "member",
				Message: "Welcome!",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.InviteMember(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Invitation)
				assert.Equal(t, tt.req.GuildId, resp.Invitation.GuildId)
			}
		})
	}
}

func TestMemberService_JoinGuild(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.JoinGuildRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:    "successful guild join",
			ctx:     session.WithUserID(context.Background(), testUserID),
			req:     &memberv1.JoinGuildRequest{InviteCode: "ABC123"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.JoinGuild(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Member)
			}
		})
	}
}

func TestMemberService_UpdateMember(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.UpdateMemberRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name: "successful member update",
			ctx:  session.WithUserID(context.Background(), testUserID),
			req: &memberv1.UpdateMemberRequest{
				GuildId:     "guild-123",
				MemberId:    "member-456",
				DisplayName: "Updated Name",
				Role:        "admin",
				Profile:     map[string]string{"bio": "test bio"},
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.UpdateMember(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Member)
			}
		})
	}
}

func TestMemberService_RemoveMember(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.RemoveMemberRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name: "successful member removal",
			ctx:  session.WithUserID(context.Background(), testUserID),
			req: &memberv1.RemoveMemberRequest{
				GuildId:  "guild-123",
				MemberId: "member-456",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.RemoveMember(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.True(t, resp.Success)
			}
		})
	}
}

func TestMemberService_ListMembers(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.ListMembersRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:     "malformed guild_id",
			ctx:      session.WithUserID(context.Background(), uuid.MustParse("00000000-0000-0000-0000-000000000002")),
			req:      &memberv1.ListMembersRequest{GuildId: "guild-123"},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
		{
			name: "malformed page token",
			ctx:  session.WithUserID(context.Background(), uuid.MustParse("00000000-0000-0000-0000-000000000002")),
			req: &memberv1.ListMembersRequest{
				GuildId:   "00000000-0000-0000-0000-000000000001",
				PageSize:  10,
				PageToken: "next",
				Role:      "admin",
			},
			wantErr:  true,
			wantCode: codes.InvalidArgument,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.ListMembers(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Members)
			}
		})
	}
}

func TestMemberService_GetMember(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.GetMemberRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name: "successful member retrieval",
			ctx:  session.WithUserID(context.Background(), testUserID),
			req: &memberv1.GetMemberRequest{
				GuildId:  "guild-123",
				MemberId: "member-456",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.GetMember(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Member)
			}
		})
	}
}

func TestMemberService_GenerateInviteCode(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.GenerateInviteCodeRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:    "successful invite code generation",
			ctx:     session.WithUserID(context.Background(), testUserID),
			req:     &memberv1.GenerateInviteCodeRequest{GuildId: "guild-123"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.GenerateInviteCode(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Invitation)
				assert.NotEmpty(t, resp.Invitation.Code)
			}
		})
	}
}

func TestMemberService_ValidateInviteCode(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.ValidateInviteCodeRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:    "successful invite code validation",
			ctx:     context.Background(),
			req:     &memberv1.ValidateInviteCodeRequest{Code: "ABC123"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.ValidateInviteCode(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.True(t, resp.Valid)
				assert.NotEmpty(t, resp.GuildId)
			}
		})
	}
}

func TestMemberService_ListInvites(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.ListInvitesRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name:    "successful invite listing",
			ctx:     session.WithUserID(context.Background(), testUserID),
			req:     &memberv1.ListInvitesRequest{GuildId: "guild-123"},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.ListInvites(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.NotNil(t, resp.Invitations)
			}
		})
	}
}

func TestMemberService_RevokeInvite(t *testing.T) {
	logger := zerolog.New(os.Stdout)
	service := NewMemberService(nil, nil, logger)

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.RevokeInviteRequest
		wantErr  bool
		wantCode codes.Code
	}{
		{
			name: "successful invite revocation",
			ctx:  session.WithUserID(context.Background(), testUserID),
			req: &memberv1.RevokeInviteRequest{
				GuildId:  "guild-123",
				InviteId: "invite-789",
			},
			wantErr: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, err := service.RevokeInvite(tt.ctx, tt.req)

			if tt.wantErr {
				require.Error(t, err)
				st, ok := status.FromError(err)
				require.True(t, ok)
				assert.Equal(t, tt.wantCode, st.Code())
			} else {
				require.NoError(t, err)
				require.NotNil(t, resp)
				assert.True(t, resp.Success)
			}
		})
	}
}

func TestMemberService_UpdateMemberRole(t *testing.T) {
	service := NewMemberService(nil, nil, zerolog.Nop())
	const guildID = "00000000-0000-0000-0000-000000000001"
	const actorID = "00000000-0000-0000-0000-000000000002"
	const targetID = "00000000-0000-0000-0000-000000000003"
	authed := session.WithUserID(context.Background(), uuid.MustParse(actorID))

	tests := []struct {
		name     string
		ctx      context.Context
		req      *memberv1.UpdateMemberRoleRequest
		wantCode codes.Code
	}{
		{
			name:     "malformed target",
			ctx:      authed,
			req:      &memberv1.UpdateMemberRoleRequest{GuildId: guildID, UserId: "nope", Role: "admin"},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "malformed guild",
			ctx:      authed,
			req:      &memberv1.UpdateMemberRoleRequest{GuildId: "nope", UserId: targetID, Role: "admin"},
			wantCode: codes.InvalidArgument,
		},
		{
			name:     "unauthenticated",
			ctx:      context.Background(),
			req:      &memberv1.UpdateMemberRoleRequest{GuildId: guildID, UserId: targetID, Role: "admin"},
			wantCode: codes.Unauthenticated,
		},
		{
			name:     "own role",
			ctx:      authed,
			req:      &memberv1.UpdateMemberRoleRequest{GuildId: guildID, UserId: actorID, Role: "member"},
			wantCode: codes.PermissionDenied,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := service.UpdateMemberRole(tt.ctx, tt.req)
			require.Error(t, err)
			st, ok := status.FromError(err)
			require.True(t, ok)
			assert.Equal(t, tt.wantCode, st.Code())
		})
	}
}
