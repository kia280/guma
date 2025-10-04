'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Plugin, PluginComponent } from '@/types/api';
import { api } from '@/lib/api';

// Plugin context type
interface PluginContextType {
  plugins: Plugin[];
  enabledPlugins: Plugin[];
  pluginComponents: PluginComponent[];
  isLoading: boolean;
  enablePlugin: (pluginId: string) => Promise<void>;
  disablePlugin: (pluginId: string) => Promise<void>;
  getPluginComponent: (name: string) => PluginComponent | undefined;
  hasPlugin: (pluginId: string) => boolean;
}

// Create context
const PluginContext = createContext<PluginContextType | undefined>(undefined);

// Plugin provider props
interface PluginProviderProps {
  children: ReactNode;
}

// Plugin provider component
export function PluginProvider({ children }: PluginProviderProps) {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [pluginComponents, setPluginComponents] = useState<PluginComponent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get enabled plugins
  const enabledPlugins = plugins.filter(plugin => plugin.isEnabled);

  // Load plugins on mount
  useEffect(() => {
    loadPlugins();
  }, []);

  // Load plugins from API
  const loadPlugins = async () => {
    try {
      setIsLoading(true);
      const response = await api.get<Plugin[]>('/plugins');
      if (response.data.success) {
        setPlugins(response.data.data);
        await loadPluginComponents(response.data.data.filter(p => p.isEnabled));
      }
    } catch (error) {
      console.error('Failed to load plugins:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Load plugin components dynamically
  const loadPluginComponents = async (enabledPlugins: Plugin[]) => {
    const components: PluginComponent[] = [];
    
    for (const plugin of enabledPlugins) {
      try {
        // Dynamic import of plugin components
        // This would be implemented based on your plugin architecture
        const pluginModule = await import(`@/plugins/${plugin.name}/frontend`);
        if (pluginModule.pluginComponents) {
          components.push(...pluginModule.pluginComponents);
        }
      } catch (error) {
        console.warn(`Failed to load components for plugin ${plugin.name}:`, error);
      }
    }
    
    setPluginComponents(components);
  };

  // Enable plugin
  const enablePlugin = async (pluginId: string): Promise<void> => {
    try {
      await api.post(`/plugins/${pluginId}/enable`);
      setPlugins(prev => 
        prev.map(plugin => 
          plugin.id === pluginId 
            ? { ...plugin, isEnabled: true }
            : plugin
        )
      );
      // Reload components
      await loadPluginComponents(plugins.filter(p => p.isEnabled || p.id === pluginId));
    } catch (error) {
      console.error('Failed to enable plugin:', error);
      throw error;
    }
  };

  // Disable plugin
  const disablePlugin = async (pluginId: string): Promise<void> => {
    try {
      await api.post(`/plugins/${pluginId}/disable`);
      setPlugins(prev => 
        prev.map(plugin => 
          plugin.id === pluginId 
            ? { ...plugin, isEnabled: false }
            : plugin
        )
      );
      // Reload components
      await loadPluginComponents(plugins.filter(p => p.isEnabled && p.id !== pluginId));
    } catch (error) {
      console.error('Failed to disable plugin:', error);
      throw error;
    }
  };

  // Get plugin component by name
  const getPluginComponent = (name: string): PluginComponent | undefined => {
    return pluginComponents.find(component => component.name === name);
  };

  // Check if plugin exists and is enabled
  const hasPlugin = (pluginId: string): boolean => {
    const plugin = plugins.find(p => p.id === pluginId);
    return plugin ? plugin.isEnabled : false;
  };

  const value: PluginContextType = {
    plugins,
    enabledPlugins,
    pluginComponents,
    isLoading,
    enablePlugin,
    disablePlugin,
    getPluginComponent,
    hasPlugin,
  };

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}

// Custom hook to use plugin context
export function usePlugins(): PluginContextType {
  const context = useContext(PluginContext);
  if (context === undefined) {
    throw new Error('usePlugins must be used within a PluginProvider');
  }
  return context;
}

// Plugin route component
interface PluginRouteProps {
  pluginName: string;
  componentName: string;
  fallback?: ReactNode;
}

export function PluginRoute({ pluginName, componentName, fallback }: PluginRouteProps) {
  const { getPluginComponent } = usePlugins();
  
  const component = getPluginComponent(`${pluginName}.${componentName}`);
  
  if (!component) {
    return fallback || <div>Plugin component not found</div>;
  }
  
  // This would render the actual plugin component
  // Implementation depends on how plugins are structured
  return <div>Plugin Component Placeholder</div>;
}

// Plugin navigation items hook
export function usePluginNavigation() {
  const { pluginComponents } = usePlugins();
  
  return pluginComponents
    .filter(component => component.navItem)
    .sort((a, b) => (a.navItem?.order || 0) - (b.navItem?.order || 0))
    .map(component => ({
      key: component.name,
      label: component.navItem!.label,
      href: component.route || `/plugins/${component.name}`,
      icon: component.navItem!.icon,
      order: component.navItem!.order,
    }));
}
