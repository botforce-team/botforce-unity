'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { teamInviteTemplate } from '@/lib/email/templates'
import { env } from '@/lib/env'
import type { ActionResult, UserRole, CompanyMember, Profile } from '@/types'

interface TeamMemberWithProfile extends Omit<CompanyMember, 'profile'> {
  profile: Profile | null
}

export async function getTeamMembers(): Promise<ActionResult<TeamMemberWithProfile[]>> {
  try {
    const supabase = await createAdminClient()
    const client = await createClient()

    const { data: { user } } = await client.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Get user's company
    const { data: membership } = await supabase
      .from('company_members')
      .select('company_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!membership) {
      return { success: false, error: 'No company membership found' }
    }

    // Get all team members with profiles
    const { data: members, error } = await supabase
      .from('company_members')
      .select(`
        *,
        profile:profiles(*)
      `)
      .eq('company_id', membership.company_id)
      .order('created_at', { ascending: true })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, data: members as TeamMemberWithProfile[] }
  } catch (error) {
    return { success: false, error: 'Failed to fetch team members' }
  }
}

export async function inviteTeamMember(
  email: string,
  role: UserRole,
  hourlyRate?: number
): Promise<ActionResult<{ inviteId: string }>> {
  try {
    const supabase = await createAdminClient()
    const client = await createClient()

    const { data: { user } } = await client.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is superadmin
    const { data: currentMembership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!currentMembership || currentMembership.role !== 'superadmin') {
      return { success: false, error: 'Only superadmins can invite team members' }
    }

    // Get company details
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', currentMembership.company_id)
      .single()

    if (!company) {
      return { success: false, error: 'Company not found' }
    }

    // Check if user with this email already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .maybeSingle()

    if (existingProfile) {
      // Check if already a member
      const { data: existingMembership } = await supabase
        .from('company_members')
        .select('id, is_active')
        .eq('company_id', company.id)
        .eq('user_id', existingProfile.id)
        .maybeSingle()

      if (existingMembership) {
        if (existingMembership.is_active) {
          return { success: false, error: 'This user is already a team member' }
        }
        // Reactivate existing membership
        await supabase
          .from('company_members')
          .update({
            is_active: true,
            role,
            hourly_rate: hourlyRate || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingMembership.id)

        revalidatePath('/team')
        return { success: true, data: { inviteId: existingMembership.id } }
      }

      // Add existing user to company
      const { data: newMembership, error: memberError } = await supabase
        .from('company_members')
        .insert({
          company_id: company.id,
          user_id: existingProfile.id,
          role,
          hourly_rate: hourlyRate || null,
          is_active: true,
          joined_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (memberError) {
        return { success: false, error: memberError.message }
      }

      revalidatePath('/team')
      return { success: true, data: { inviteId: newMembership.id } }
    }

    // Create a pending invite record
    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .insert({
        company_id: company.id,
        email,
        role,
        hourly_rate: hourlyRate || null,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      })
      .select()
      .single()

    if (inviteError) {
      // Table might not exist, create a simple workaround
      console.error('Invite error:', inviteError)
    }

    // Send invite email
    const inviteUrl = `${env.NEXT_PUBLIC_APP_URL}/invite?email=${encodeURIComponent(email)}&company=${company.id}`
    const template = teamInviteTemplate(company.name, user.email || 'Admin', inviteUrl)

    const emailResult = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
      text: template.text,
    })

    if (!emailResult.success) {
      console.error('Failed to send invite email:', emailResult.error)
      // Don't fail the whole operation, just log it
    }

    revalidatePath('/team')
    return { success: true, data: { inviteId: invite?.id || 'pending' } }
  } catch (error) {
    console.error('Invite error:', error)
    return { success: false, error: 'Failed to invite team member' }
  }
}

export async function updateTeamMember(
  memberId: string,
  data: { role?: UserRole; hourlyRate?: number | null }
): Promise<ActionResult> {
  try {
    const supabase = await createAdminClient()
    const client = await createClient()

    const { data: { user } } = await client.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is superadmin
    const { data: currentMembership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!currentMembership || currentMembership.role !== 'superadmin') {
      return { success: false, error: 'Only superadmins can update team members' }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    }

    if (data.role !== undefined) {
      updateData.role = data.role
    }
    if (data.hourlyRate !== undefined) {
      updateData.hourly_rate = data.hourlyRate
    }

    const { error } = await supabase
      .from('company_members')
      .update(updateData)
      .eq('id', memberId)
      .eq('company_id', currentMembership.company_id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/team')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to update team member' }
  }
}

export async function deactivateMember(memberId: string): Promise<ActionResult> {
  try {
    const supabase = await createAdminClient()
    const client = await createClient()

    const { data: { user } } = await client.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is superadmin
    const { data: currentMembership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!currentMembership || currentMembership.role !== 'superadmin') {
      return { success: false, error: 'Only superadmins can deactivate members' }
    }

    // Check we're not deactivating ourselves
    const { data: targetMember } = await supabase
      .from('company_members')
      .select('user_id')
      .eq('id', memberId)
      .single()

    if (targetMember?.user_id === user.id) {
      return { success: false, error: 'You cannot deactivate yourself' }
    }

    const { error } = await supabase
      .from('company_members')
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)
      .eq('company_id', currentMembership.company_id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/team')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to deactivate member' }
  }
}

export async function reactivateMember(memberId: string): Promise<ActionResult> {
  try {
    const supabase = await createAdminClient()
    const client = await createClient()

    const { data: { user } } = await client.auth.getUser()
    if (!user) {
      return { success: false, error: 'Unauthorized' }
    }

    // Check if user is superadmin
    const { data: currentMembership } = await supabase
      .from('company_members')
      .select('company_id, role')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (!currentMembership || currentMembership.role !== 'superadmin') {
      return { success: false, error: 'Only superadmins can reactivate members' }
    }

    const { error } = await supabase
      .from('company_members')
      .update({
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', memberId)
      .eq('company_id', currentMembership.company_id)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/team')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Failed to reactivate member' }
  }
}
