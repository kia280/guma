package handlers

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	memberv1 "github.com/kia280/guma/gen/proto/guma/v1"
	"github.com/kia280/guma/internal/database"
	membersvc "github.com/kia280/guma/internal/services/member"
	"github.com/kia280/guma/internal/session"
)

// MemberService implements the MemberService gRPC service
type MemberService struct {
	memberv1.UnimplementedMemberServiceServer
	svc    *membersvc.Service
	logger zerolog.Logger
}

// NewMemberService creates a new Member handler
func NewMemberService(db *database.Pool, logger zerolog.Logger) *MemberService {
	return &MemberService{
		svc:    membersvc.New(db, logger),
		logger: logger.With().Str("service", "member").Logger(),
	}
}

// InviteMember creates an invitation for a new member
func (s *MemberService) InviteMember(ctx context.Context, req *memberv1.InviteMemberRequest) (*memberv1.InviteMemberResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	if req.Email == "" {
		return nil, status.Error(codes.InvalidArgument, "email is required")
	}

	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Str("email", req.Email).
		Msg("inviting member")

	// TODO: Implement invitation creation logic
	// TODO: Check user permissions
	// TODO: Send invitation email

	invitation := &memberv1.Invitation{
		Id:        "mock-invitation-id",
		GuildId:   req.GuildId,
		Code:      "MOCK123",
		CreatedBy: userID,
		Role:      req.Role,
		MaxUses:   1,
		UseCount:  0,
		CreatedAt: timestamppb.Now(),
		Revoked:   false,
	}

	return &memberv1.InviteMemberResponse{
		Invitation: invitation,
	}, nil
}

// JoinGuild allows a user to join a guild using an invite code
func (s *MemberService) JoinGuild(ctx context.Context, req *memberv1.JoinGuildRequest) (*memberv1.JoinGuildResponse, error) {
	if req.InviteCode == "" {
		return nil, status.Error(codes.InvalidArgument, "invite_code is required")
	}

	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("invite_code", req.InviteCode).
		Msg("joining guild")

	// TODO: Validate invite code
	// TODO: Check if already a member
	// TODO: Create member record

	member := &memberv1.Member{
		Id:          uuid.NewString(),
		UserId:      userID,
		GuildId:     "mock-guild-id",
		DisplayName: "User",
		Role:        "member",
		Profile:     map[string]string{},
		JoinedAt:    timestamppb.Now(),
		LastActive:  timestamppb.Now(),
	}

	return &memberv1.JoinGuildResponse{
		Member: member,
	}, nil
}

// UpdateMember updates a member's information
func (s *MemberService) UpdateMember(ctx context.Context, req *memberv1.UpdateMemberRequest) (*memberv1.UpdateMemberResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	if req.MemberId == "" {
		return nil, status.Error(codes.InvalidArgument, "member_id is required")
	}

	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Str("member_id", req.MemberId).
		Msg("updating member")

	// TODO: Implement member update logic
	// TODO: Check user permissions

	member := &memberv1.Member{
		Id:          req.MemberId,
		UserId:      userID,
		GuildId:     req.GuildId,
		DisplayName: req.DisplayName,
		Role:        req.Role,
		Profile:     req.Profile,
		JoinedAt:    timestamppb.Now(),
		LastActive:  timestamppb.Now(),
	}

	return &memberv1.UpdateMemberResponse{
		Member: member,
	}, nil
}

// RemoveMember removes a member from a guild
func (s *MemberService) RemoveMember(ctx context.Context, req *memberv1.RemoveMemberRequest) (*memberv1.RemoveMemberResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	if req.MemberId == "" {
		return nil, status.Error(codes.InvalidArgument, "member_id is required")
	}

	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Str("member_id", req.MemberId).
		Msg("removing member")

	// TODO: Implement member removal logic
	// TODO: Check user permissions

	return &memberv1.RemoveMemberResponse{
		Success: true,
	}, nil
}

// ListMembers lists members of a guild
func (s *MemberService) ListMembers(ctx context.Context, req *memberv1.ListMembersRequest) (*memberv1.ListMembersResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	result, err := s.svc.List(ctx, membersvc.ListParams{
		GuildID:   req.GuildId,
		CallerID:  userID,
		Role:      req.Role,
		PageSize:  req.PageSize,
		PageToken: req.PageToken,
	})
	if err != nil {
		return nil, toStatus(err)
	}

	members := make([]*memberv1.Member, 0, len(result.Members))
	for _, m := range result.Members {
		members = append(members, toMemberProto(m))
	}

	return &memberv1.ListMembersResponse{
		Members:       members,
		NextPageToken: result.NextPageToken,
		TotalCount:    result.TotalCount,
	}, nil
}

func toMemberProto(m *membersvc.Member) *memberv1.Member {
	return &memberv1.Member{
		Id:              m.ID,
		UserId:          m.UserID,
		GuildId:         m.GuildID,
		DisplayName:     m.DisplayName,
		DiscordUsername: m.DiscordUsername,
		AvatarUrl:       m.AvatarURL,
		Role:            m.Role,
		Profile:         m.Profile,
		JoinedAt:        timestamppb.New(m.JoinedAt),
		LastActive:      timestamppb.New(m.LastActive),
	}
}

// GetMember retrieves a specific member
func (s *MemberService) GetMember(ctx context.Context, req *memberv1.GetMemberRequest) (*memberv1.GetMemberResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	if req.MemberId == "" {
		return nil, status.Error(codes.InvalidArgument, "member_id is required")
	}

	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Str("member_id", req.MemberId).
		Msg("getting member")

	// TODO: Implement member retrieval from database

	member := &memberv1.Member{
		Id:          req.MemberId,
		UserId:      userID,
		GuildId:     req.GuildId,
		DisplayName: "User",
		Role:        "member",
		Profile:     map[string]string{},
		JoinedAt:    timestamppb.Now(),
		LastActive:  timestamppb.Now(),
	}

	return &memberv1.GetMemberResponse{
		Member: member,
	}, nil
}

// GenerateInviteCode generates a new invite code
func (s *MemberService) GenerateInviteCode(ctx context.Context, req *memberv1.GenerateInviteCodeRequest) (*memberv1.GenerateInviteCodeResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Msg("generating invite code")

	code := strings.ToUpper(strings.ReplaceAll(uuid.NewString(), "-", ""))
	if len(code) > 8 {
		code = code[:8]
	}

	expiresAt := req.ExpiresAt
	if expiresAt == nil {
		expiresAt = timestamppb.New(time.Now().Add(48 * time.Hour))
	}

	invitation := &memberv1.Invitation{
		Id:        uuid.NewString(),
		GuildId:   req.GuildId,
		Code:      code,
		CreatedBy: userID,
		Role:      req.Role,
		MaxUses:   req.MaxUses,
		UseCount:  0,
		CreatedAt: timestamppb.Now(),
		ExpiresAt: expiresAt,
		Revoked:   false,
	}

	return &memberv1.GenerateInviteCodeResponse{
		Invitation: invitation,
	}, nil
}

// ValidateInviteCode validates an invite code
func (s *MemberService) ValidateInviteCode(ctx context.Context, req *memberv1.ValidateInviteCodeRequest) (*memberv1.ValidateInviteCodeResponse, error) {
	if req.Code == "" {
		return nil, status.Error(codes.InvalidArgument, "code is required")
	}

	code := strings.ToUpper(req.Code)

	s.logger.Info().Str("code", code).Msg("validating invite code")

	// TODO: Implement invite code validation

	return &memberv1.ValidateInviteCodeResponse{
		Valid:     true,
		GuildId:   "mock-guild-id",
		GuildName: "Mock Guild",
	}, nil
}

// ListInvites lists all invitations for a guild
func (s *MemberService) ListInvites(ctx context.Context, req *memberv1.ListInvitesRequest) (*memberv1.ListInvitesResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Msg("listing invites")

	// TODO: Implement invite listing from database

	invitations := []*memberv1.Invitation{}

	return &memberv1.ListInvitesResponse{
		Invitations:   invitations,
		NextPageToken: "",
	}, nil
}

// RevokeInvite revokes an invitation
func (s *MemberService) RevokeInvite(ctx context.Context, req *memberv1.RevokeInviteRequest) (*memberv1.RevokeInviteResponse, error) {
	if req.GuildId == "" {
		return nil, status.Error(codes.InvalidArgument, "guild_id is required")
	}

	if req.InviteId == "" {
		return nil, status.Error(codes.InvalidArgument, "invite_id is required")
	}

	userID := session.UserIDFromContext(ctx)
	if userID == "" {
		return nil, status.Error(codes.Unauthenticated, "user not authenticated")
	}

	s.logger.Info().
		Str("user_id", userID).
		Str("guild_id", req.GuildId).
		Str("invite_id", req.InviteId).
		Msg("revoking invite")

	// TODO: Implement invite revocation
	// TODO: Check user permissions

	return &memberv1.RevokeInviteResponse{
		Success: true,
	}, nil
}
