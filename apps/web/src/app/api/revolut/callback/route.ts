/**
 * Revolut OAuth Callback
 * Handles the OAuth callback from Revolut and stores tokens
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens } from '@/lib/revolut'
import { encrypt } from '@/lib/revolut/encryption'
import { errorResponse } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')

  const baseRedirectUrl = new URL('/settings', request.url)
  baseRedirectUrl.searchParams.set('tab', 'integrations')

  try {
    // Handle OAuth errors from Revolut
    if (error) {
      console.error('Revolut OAuth error:', error, errorDescription)
      baseRedirectUrl.searchParams.set('error', 'oauth_denied')
      baseRedirectUrl.searchParams.set('message', errorDescription || error)
      return NextResponse.redirect(baseRedirectUrl)
    }

    // Validate required parameters
    if (!code || !state) {
      baseRedirectUrl.searchParams.set('error', 'invalid_callback')
      return NextResponse.redirect(baseRedirectUrl)
    }

    // Verify state parameter
    const cookieStore = await cookies()
    const storedState = cookieStore.get('revolut_oauth_state')?.value
    const companyId = cookieStore.get('revolut_oauth_company')?.value

    if (!storedState || storedState !== state) {
      console.error('OAuth state mismatch')
      baseRedirectUrl.searchParams.set('error', 'state_mismatch')
      return NextResponse.redirect(baseRedirectUrl)
    }

    if (!companyId) {
      console.error('Missing company ID in OAuth flow')
      baseRedirectUrl.searchParams.set('error', 'session_expired')
      return NextResponse.redirect(baseRedirectUrl)
    }

    // Clear OAuth cookies
    cookieStore.delete('revolut_oauth_state')
    cookieStore.delete('revolut_oauth_company')

    // Exchange code for tokens
    // Note: In production, you need to generate a JWT client assertion
    // signed with your private key. For sandbox, you can use a simple string.
    const clientAssertion = generateClientAssertion()
    const tokens = await exchangeCodeForTokens(code, clientAssertion)

    // Calculate expiry times
    const now = new Date()
    const accessTokenExpiresAt = new Date(now.getTime() + tokens.expires_in * 1000)
    // Refresh tokens typically expire in 90 days for Revolut
    const refreshTokenExpiresAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

    // Encrypt tokens for storage
    const accessTokenEncrypted = encrypt(tokens.access_token)
    const refreshTokenEncrypted = encrypt(tokens.refresh_token)

    // Store connection in database
    const supabase = await createClient()

    // Delete any existing connection first (in case of reconnection)
    await supabase
      .from('revolut_connections')
      .delete()
      .eq('company_id', companyId)

    // Insert new connection
    const { error: insertError } = await supabase
      .from('revolut_connections')
      .insert({
        company_id: companyId,
        access_token_encrypted: accessTokenEncrypted,
        refresh_token_encrypted: refreshTokenEncrypted,
        token_type: tokens.token_type || 'Bearer',
        access_token_expires_at: accessTokenExpiresAt.toISOString(),
        refresh_token_expires_at: refreshTokenExpiresAt.toISOString(),
        status: 'active',
        connected_at: now.toISOString(),
      })

    if (insertError) {
      console.error('Failed to store Revolut connection:', insertError)
      baseRedirectUrl.searchParams.set('error', 'storage_failed')
      return NextResponse.redirect(baseRedirectUrl)
    }

    // Success - redirect to settings with success message
    baseRedirectUrl.searchParams.set('success', 'revolut_connected')
    return NextResponse.redirect(baseRedirectUrl)

  } catch (err) {
    console.error('Revolut OAuth callback error:', err)
    baseRedirectUrl.searchParams.set('error', 'callback_failed')
    return NextResponse.redirect(baseRedirectUrl)
  }
}

/**
 * Generate JWT client assertion for Revolut API
 * In production, this should be a proper JWT signed with your private key
 * For sandbox testing, Revolut accepts a simpler format
 */
function generateClientAssertion(): string {
  // For sandbox/development, we can use a simple assertion
  // In production, implement proper JWT signing with your certificate
  const clientId = process.env.REVOLUT_CLIENT_ID || ''

  // This is a simplified version for sandbox
  // Production requires RS256-signed JWT with:
  // - iss: client_id
  // - sub: client_id
  // - aud: https://revolut.com
  // - exp: current time + 2 minutes
  // - jti: unique identifier

  // For now, return the client_id as placeholder
  // You'll need to implement proper JWT signing for production
  return clientId
}
