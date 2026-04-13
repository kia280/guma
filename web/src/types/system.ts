// System health and monitoring types

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  version: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    api: ServiceStatus;
  };
  metrics: {
    memoryUsage: number;
    cpuUsage: number;
    activeConnections: number;
  };
}

export interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  lastCheck: string;
}
