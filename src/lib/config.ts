/**
 * Environment Configuration
 * Centralized access to environment variables with defaults
 */

export const config = {
  // API Configuration
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  
  // Supabase Configuration
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  
  // Google OAuth
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  
  // Feature Flags
  features: {
    offlineMode: import.meta.env.VITE_FEATURE_OFFLINE_MODE !== 'false',
    crossTabSync: import.meta.env.VITE_FEATURE_CROSS_TAB_SYNC !== 'false',
    autosave: import.meta.env.VITE_FEATURE_AUTOSAVE !== 'false',
  },
  
  // Session Configuration
  session: {
    durationDays: parseInt(import.meta.env.VITE_SESSION_DURATION_DAYS || '7', 10),
    refreshThresholdHours: parseInt(import.meta.env.VITE_SESSION_REFRESH_THRESHOLD_HOURS || '24', 10),
  },
  
  // Autosave Configuration
  autosave: {
    debounceMs: parseInt(import.meta.env.VITE_AUTOSAVE_DEBOUNCE_MS || '2000', 10),
    maxRetries: parseInt(import.meta.env.VITE_AUTOSAVE_MAX_RETRIES || '3', 10),
  },
  
  // Development
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

// Type for the config
export type AppConfig = typeof config;

// Validate required config on startup
export function validateConfig(): string[] {
  const errors: string[] = [];
  
  if (!config.supabaseUrl) {
    errors.push('VITE_SUPABASE_URL is required');
  }
  
  if (!config.supabaseAnonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is required');
  }
  
  if (!config.googleClientId) {
    errors.push('VITE_GOOGLE_CLIENT_ID is required');
  }
  
  return errors;
}
