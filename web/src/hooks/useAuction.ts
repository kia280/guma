import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AuctionItem, PlaceBidRequest, CreateAuctionRequest } from '@/types/auction';
import { api } from '@/lib/api';

// Query keys
export const auctionKeys = {
  all: ['auctions'] as const,
  lists: () => [...auctionKeys.all, 'list'] as const,
  list: (filters: Record<string, any>) => [...auctionKeys.lists(), filters] as const,
  details: () => [...auctionKeys.all, 'detail'] as const,
  detail: (id: string) => [...auctionKeys.details(), id] as const,
} as const;

// Fetch auction items
export const useAuctionItems = (filters?: {
  status?: string;
  category?: string;
  rarity?: string;
  search?: string;
  guildId?: string;
}) => {
  return useQuery({
    queryKey: auctionKeys.list(filters || {}),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters?.category && filters.category !== 'all') params.append('category', filters.category);
      if (filters?.rarity && filters.rarity !== 'all') params.append('rarity', filters.rarity);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.guildId) params.append('guildId', filters.guildId);

      const response = await api.get<AuctionItem[]>(`/auctions?${params}`);
      return response.data;
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute for active auctions
  });
};

// Fetch single auction item
export const useAuctionItem = (id: string) => {
  return useQuery({
    queryKey: auctionKeys.detail(id),
    queryFn: async () => {
      const response = await api.get<AuctionItem>(`/auctions/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

// Place a bid on an auction item
export const usePlaceBid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bidData: PlaceBidRequest) => {
      const response = await api.post(`/auctions/${bidData.auctionItemId}/bids`, {
        amount: bidData.amount,
      });
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch auction lists
      queryClient.invalidateQueries({ queryKey: auctionKeys.lists() });
      // Update the specific auction item
      queryClient.invalidateQueries({ queryKey: auctionKeys.detail(variables.auctionItemId) });
    },
  });
};

// Create a new auction
export const useCreateAuction = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (auctionData: CreateAuctionRequest) => {
      const response = await api.post('/auctions', auctionData);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch auction lists
      queryClient.invalidateQueries({ queryKey: auctionKeys.lists() });
    },
  });
};

// Get user's bid history
export const useUserBids = (userId?: string) => {
  return useQuery({
    queryKey: ['userBids', userId],
    queryFn: async () => {
      const response = await api.get(`/users/${userId}/bids`);
      return response.data;
    },
    enabled: !!userId,
  });
};

// Get user's auction items (items they're selling)
export const useUserAuctions = (userId?: string) => {
  return useQuery({
    queryKey: ['userAuctions', userId],
    queryFn: async () => {
      const response = await api.get(`/users/${userId}/auctions`);
      return response.data;
    },
    enabled: !!userId,
  });
};
