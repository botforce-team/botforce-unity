/**
 * Environment variables with type safety
 * All environment variables should be accessed through this module
 */

function getEnvVar(key: string, required = false): string | undefined {
  const value = process.env[key]
  if (required && !value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value
}

export const env = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: getEnvVar('NEXT_PUBLIC_SUPABASE_URL', true)!,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY', true)!,

  // Email
  EMAIL_PROVIDER: getEnvVar('EMAIL_PROVIDER') as 'resend' | 'console' | undefined,
  EMAIL_FROM: getEnvVar('EMAIL_FROM'),
  RESEND_API_KEY: getEnvVar('RESEND_API_KEY'),

  // App
  NEXT_PUBLIC_APP_URL: getEnvVar('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000',

  // Feature flags
  ENABLE_EMAIL_NOTIFICATIONS: getEnvVar('ENABLE_EMAIL_NOTIFICATIONS') === 'true',

  // Revolut Business API
  REVOLUT_CLIENT_ID: getEnvVar('REVOLUT_CLIENT_ID'),
  REVOLUT_SANDBOX: getEnvVar('REVOLUT_SANDBOX') !== 'false', // Default to sandbox mode
  REVOLUT_REDIRECT_URI: getEnvVar('REVOLUT_REDIRECT_URI') || `${getEnvVar('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000'}/api/revolut/callback`,
  REVOLUT_WEBHOOK_SECRET: getEnvVar('REVOLUT_WEBHOOK_SECRET'),

  // AI Tax Advisor (Claude)
  ANTHROPIC_API_KEY: getEnvVar('ANTHROPIC_API_KEY'),
}
