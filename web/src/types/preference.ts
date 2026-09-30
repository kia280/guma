export interface NotificationPreferences {
  emailNotifications: boolean;
  auctionAlerts: boolean;
  raffleAlerts: boolean;
  eventReminders: boolean;
  rollCallReminders: boolean;
}

export type NotificationPreferenceKey = keyof NotificationPreferences;

export type NotificationPreferencesPatch = Partial<NotificationPreferences>;

export interface UserPreferences {
  notifications: NotificationPreferences;
  updatedAt?: string;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  emailNotifications: true,
  auctionAlerts: true,
  raffleAlerts: true,
  eventReminders: false,
  rollCallReminders: true,
};
