'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// UI State Store
interface UIState {
  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  
  // Notifications
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  
  // Modals
  modals: Record<string, boolean>;
  openModal: (modalId: string) => void;
  closeModal: (modalId: string) => void;
  toggleModal: (modalId: string) => void;
  
  // Loading states
  loadingStates: Record<string, boolean>;
  setLoading: (key: string, loading: boolean) => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  autoClose?: boolean;
  duration?: number;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      // Theme
      theme: 'system',
      setTheme: (theme) => set({ theme }),
      
      // Sidebar
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      
      // Notifications
      notifications: [],
      addNotification: (notification) => {
        const id = Math.random().toString(36).substr(2, 9);
        const newNotification: Notification = {
          ...notification,
          id,
          timestamp: Date.now(),
          autoClose: notification.autoClose ?? true,
          duration: notification.duration ?? 5000,
        };
        
        set((state) => ({
          notifications: [...state.notifications, newNotification],
        }));
        
        // Auto remove notification
        if (newNotification.autoClose) {
          setTimeout(() => {
            get().removeNotification(id);
          }, newNotification.duration);
        }
      },
      removeNotification: (id) =>
        set((state) => ({
          notifications: state.notifications.filter((n) => n.id !== id),
        })),
      clearNotifications: () => set({ notifications: [] }),
      
      // Modals
      modals: {},
      openModal: (modalId) =>
        set((state) => ({
          modals: { ...state.modals, [modalId]: true },
        })),
      closeModal: (modalId) =>
        set((state) => ({
          modals: { ...state.modals, [modalId]: false },
        })),
      toggleModal: (modalId) =>
        set((state) => ({
          modals: { ...state.modals, [modalId]: !state.modals[modalId] },
        })),
      
      // Loading states
      loadingStates: {},
      setLoading: (key, loading) =>
        set((state) => ({
          loadingStates: { ...state.loadingStates, [key]: loading },
        })),
    }),
    {
      name: 'ui-store',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
);

// Guild State Store
interface GuildState {
  selectedGuildId: string | null;
  setSelectedGuildId: (guildId: string | null) => void;
  
  guildFilters: {
    search: string;
    sortBy: 'name' | 'memberCount' | 'createdAt';
    sortOrder: 'asc' | 'desc';
    features: string[];
  };
  setGuildFilters: (filters: Partial<GuildState['guildFilters']>) => void;
  resetGuildFilters: () => void;
}

export const useGuildStore = create<GuildState>()(
  persist(
    (set) => ({
      selectedGuildId: null,
      setSelectedGuildId: (selectedGuildId) => set({ selectedGuildId }),
      
      guildFilters: {
        search: '',
        sortBy: 'name',
        sortOrder: 'asc',
        features: [],
      },
      setGuildFilters: (filters) =>
        set((state) => ({
          guildFilters: { ...state.guildFilters, ...filters },
        })),
      resetGuildFilters: () =>
        set({
          guildFilters: {
            search: '',
            sortBy: 'name',
            sortOrder: 'asc',
            features: [],
          },
        }),
    }),
    {
      name: 'guild-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Application State Store
interface AppState {
  // Connection status
  isOnline: boolean;
  setOnline: (online: boolean) => void;
  
  // Feature flags
  features: Record<string, boolean>;
  setFeature: (feature: string, enabled: boolean) => void;
  
  // User preferences
  preferences: {
    language: string;
    timezone: string;
    dateFormat: string;
    notifications: {
      email: boolean;
      push: boolean;
      desktop: boolean;
    };
  };
  setPreferences: (preferences: Partial<AppState['preferences']>) => void;
  
  // Cache timestamps
  cacheTimestamps: Record<string, number>;
  setCacheTimestamp: (key: string, timestamp: number) => void;
  isCacheValid: (key: string, maxAge: number) => boolean;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Connection status
      isOnline: true,
      setOnline: (isOnline) => set({ isOnline }),
      
      // Feature flags
      features: {},
      setFeature: (feature, enabled) =>
        set((state) => ({
          features: { ...state.features, [feature]: enabled },
        })),
      
      // User preferences
      preferences: {
        language: 'en',
        timezone: 'UTC',
        dateFormat: 'MM/dd/yyyy',
        notifications: {
          email: true,
          push: true,
          desktop: true,
        },
      },
      setPreferences: (preferences) =>
        set((state) => ({
          preferences: { ...state.preferences, ...preferences },
        })),
      
      // Cache timestamps
      cacheTimestamps: {},
      setCacheTimestamp: (key, timestamp) =>
        set((state) => ({
          cacheTimestamps: { ...state.cacheTimestamps, [key]: timestamp },
        })),
      isCacheValid: (key, maxAge) => {
        const timestamp = get().cacheTimestamps[key];
        if (!timestamp) return false;
        return Date.now() - timestamp < maxAge;
      },
    }),
    {
      name: 'app-store',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// Utility hooks for common UI patterns
export const useNotifications = () => {
  const { notifications, addNotification, removeNotification, clearNotifications } = useUIStore();
  
  return {
    notifications,
    showNotification: addNotification,
    hideNotification: removeNotification,
    clearNotifications,
    
    // Convenience methods
    showSuccess: (title: string, message: string) =>
      addNotification({ title, message, type: 'success' }),
    showError: (title: string, message: string) =>
      addNotification({ title, message, type: 'error' }),
    showWarning: (title: string, message: string) =>
      addNotification({ title, message, type: 'warning' }),
    showInfo: (title: string, message: string) =>
      addNotification({ title, message, type: 'info' }),
  };
};

export const useModal = (modalId: string) => {
  const { modals, openModal, closeModal, toggleModal } = useUIStore();
  
  return {
    isOpen: modals[modalId] || false,
    open: () => openModal(modalId),
    close: () => closeModal(modalId),
    toggle: () => toggleModal(modalId),
  };
};

export const useLoading = (key: string) => {
  const { loadingStates, setLoading } = useUIStore();
  
  return {
    isLoading: loadingStates[key] || false,
    setLoading: (loading: boolean) => setLoading(key, loading),
  };
};
