'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Guild, PaginatedResponse, QueryOptions } from '@/types/api';
import { api } from '@/lib/api';

// Guild queries
export const useGuilds = (options?: QueryOptions) => {
  return useQuery({
    queryKey: ['guilds', options],
    queryFn: async () => {
      const response = await api.get<PaginatedResponse<Guild>>('/guilds', {
        params: options,
      });
      return response.data.data;
    },
  });
};

export const useGuild = (guildId: string) => {
  return useQuery({
    queryKey: ['guild', guildId],
    queryFn: async () => {
      const response = await api.get<Guild>(`/guilds/${guildId}`);
      return response.data.data;
    },
    enabled: !!guildId,
  });
};

// Guild mutations
export const useCreateGuild = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) => {
      const response = await api.post<Guild>('/guilds', data);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
    },
  });
};

export const useJoinGuild = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (guildId: string) => {
      const response = await api.post(`/guilds/${guildId}/join`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
};

export const useLeaveGuild = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (guildId: string) => {
      const response = await api.post(`/guilds/${guildId}/leave`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
};

export const useUpdateGuild = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ 
      guildId, 
      data 
    }: { 
      guildId: string; 
      data: Partial<Guild> 
    }) => {
      const response = await api.patch<Guild>(`/guilds/${guildId}`, data);
      return response.data.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
      queryClient.invalidateQueries({ queryKey: ['guild', data.id] });
    },
  });
};

export const useDeleteGuild = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (guildId: string) => {
      const response = await api.delete(`/guilds/${guildId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guilds'] });
    },
  });
};
