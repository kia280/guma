import { mockAdminAnnouncements, mockAuctionItems, mockRaffles, mockRollCalls } from '@/lib/guma/mock/data';

const toParams = (items: { id: string }[]) => items.map(({ id }) => ({ id }));

export const demoStaticParams = {
  rollCalls: () => toParams(mockRollCalls),
  auctions: () => toParams(mockAuctionItems),
  raffles: () => toParams(mockRaffles),
  announcements: () => toParams(mockAdminAnnouncements),
};
