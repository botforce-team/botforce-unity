/**
 * Revolut OAuth Initiation
 * Redirects user to Revolut Business authorization page
 */

import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateAuthUrl, generateOAuthState } from '@/lib/revolut'
import { unauthorizedResponse, forbiddenResponse, errorResponse } from '@/lib/api-utils'
import { env } from '@/lib/env'

export async function GET(request: NextRequest) {
  try {
    // Check if Revolut is configured
    if (!env.REVOLUT_CLIENT_ID) {
      return errorResponse('Revolut integration is not configured', 500, 'NOT_CONFIGURED')
    }

    // Verify user is authenticated and is superadmin
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return unauthorizedResponse()
    }

    // Get company membership with role using admin client to bypass RLS
    const adminClient = await createAdminClient()
    const { data: membership, error: membershipError } = await adminClient
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (membershipError || !membership) {
      return unauthorizedResponse('No active company membership')
    }

    if (membership.role !== 'superadmin') {
      return forbiddenResponse('Only superadmins can connect Revolut')
    }

    // Check if already connected
    const { data: existingConnection } = await supabase
      .from('revolut_connections')
      .select('id, status')
      .eq('company_id', membership.company_id)
      .single()

    if (existingConnection && existingConnection.status === 'active') {
      // Redirect to settings with message
      return NextResponse.redirect(
        new URL('/settings?tab=integrations&error=already_connected', request.url)
      )
    }

    // Generate OAuth state and store it in a cookie
    const state = generateOAuthState()

    const cookieStore = await cookies()
    cookieStore.set('revolut_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    })

    // Store company_id in cookie for callback
    cookieStore.set('revolut_oauth_company', membership.company_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    })

    // Generate authorization URL and redirect
    const authUrl = generateAuthUrl(state)

    return NextResponse.redirect(authUrl)
  } catch (error) {
    console.error('Revolut OAuth initiation error:', error)
    return NextResponse.redirect(
      new URL('/settings?tab=integrations&error=oauth_failed', request.url)
    )
  }
}
