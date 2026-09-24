// Type-safe environment variables
// Next.js automatically loads .env files at build time and development time
export const env = {
  // API Configuration
  api: {
    url: (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080').replace(/\/+$/, ''),
    wsUrl: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/ws',
  },

  // When true, the frontend uses mock data from mock-client.ts instead of
  // hitting the backend. Useful for local UI development without a running server.
  useMock: process.env.NEXT_PUBLIC_USE_MOCK === 'true',

  devTools: process.env.NEXT_PUBLIC_DEV_TOOLS === 'true',

  // Kratos (Authentication) Configuration
  kratos: {
    publicUrl: process.env.NEXT_PUBLIC_KRATOS_URL || 'http://localhost:8081',
    internalUrl:
      process.env.KRATOS_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_KRATOS_URL ||
      'http://localhost:8081',
  },

  // App Configuration
  app: {
    name: process.env.NEXT_PUBLIC_APP_NAME || 'Guma',
    version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
    env: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  },

  // OAuth Configuration
  oauth: {
    discordClientId: process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID || '',
    redirectUri:
      process.env.NEXT_PUBLIC_OAUTH_REDIRECT_URI || 'http://localhost:3000/auth/callback',
  },

  // Feature Flags
  features: {
    enablePWA: process.env.NEXT_PUBLIC_ENABLE_PWA !== 'false',
    enableNotifications: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS !== 'false',
    enableOfflineMode: process.env.NEXT_PUBLIC_ENABLE_OFFLINE_MODE !== 'false',
  },

  // Analytics & Monitoring
  analytics: {
    analyticsId: process.env.NEXT_PUBLIC_ANALYTICS_ID || '',
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
  },

  // Node environment
  nodeEnv: process.env.NODE_ENV || 'development',
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
} as const;

/**
 * Validates that all required environment variables are set
 * Throws an error if any required variable is missing
 */
export function validateEnvironment() {
  const errors: string[] = [];

  // Check required variables
  if (!process.env.NEXT_PUBLIC_API_URL) {
    errors.push('NEXT_PUBLIC_API_URL is not set');
  }

  if (!process.env.NEXT_PUBLIC_KRATOS_URL) {
    errors.push('NEXT_PUBLIC_KRATOS_URL is not set');
  }

  if (errors.length > 0) {
    console.warn('⚠️  Environment Validation Warnings:\n' + errors.map(e => `  - ${e}`).join('\n'));
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Validate environment on module load (only in non-production)
if (typeof window === 'undefined' && !env.isProduction) {
  const validation = validateEnvironment();
  if (!validation.isValid) {
    console.warn('Some environment variables may not be set correctly');
  }
}

export default env;
