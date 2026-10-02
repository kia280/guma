import { Namespace, Context } from "@ory/keto-namespace-types"

class User implements Namespace {}

class Guild implements Namespace {
  related: {
    owners: User[]
    admins: User[]
    moderators: User[]
    members: User[]
  }

  permits = {
    is_owner: (ctx: Context): boolean => this.related.owners.includes(ctx.subject),
    is_admin: (ctx: Context): boolean =>
      this.related.admins.includes(ctx.subject) || this.permits.is_owner(ctx),
    is_moderator: (ctx: Context): boolean =>
      this.related.moderators.includes(ctx.subject) || this.permits.is_admin(ctx),
    is_member: (ctx: Context): boolean =>
      this.related.members.includes(ctx.subject) || this.permits.is_moderator(ctx),

    view: (ctx: Context): boolean => this.permits.is_member(ctx),

    view_member_contacts: (ctx: Context): boolean => this.permits.is_moderator(ctx),
    manage_roll_calls: (ctx: Context): boolean => this.permits.is_moderator(ctx),
    manage_roll_call_templates: (ctx: Context): boolean => this.permits.is_moderator(ctx),
    review_bank_requests: (ctx: Context): boolean => this.permits.is_moderator(ctx),
    manage_announcements: (ctx: Context): boolean => this.permits.is_moderator(ctx),
    review_withdrawals: (ctx: Context): boolean => this.permits.is_moderator(ctx),
    deliver_items: (ctx: Context): boolean => this.permits.is_moderator(ctx),

    manage_guild: (ctx: Context): boolean => this.permits.is_admin(ctx),
    view_stats: (ctx: Context): boolean => this.permits.is_admin(ctx),
    manage_roles: (ctx: Context): boolean => this.permits.is_admin(ctx),
    delete_roll_calls: (ctx: Context): boolean => this.permits.is_admin(ctx),
    manage_raffles: (ctx: Context): boolean => this.permits.is_admin(ctx),
    manage_auctions: (ctx: Context): boolean => this.permits.is_admin(ctx),
    delete_bank_items: (ctx: Context): boolean => this.permits.is_admin(ctx),
    manage_member_assets: (ctx: Context): boolean => this.permits.is_admin(ctx),

    delete_guild: (ctx: Context): boolean => this.permits.is_owner(ctx),
    manage_admins: (ctx: Context): boolean => this.permits.is_owner(ctx),
  }
}
