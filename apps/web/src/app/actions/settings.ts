'use server'

import { revalidatePath } from 'next/cache'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { getTeamInviteEmailHtml } from '@/lib/email/templates'
import type { UserRole } from '@/types/database'

interface CompanyMembership {
  company_id: string
  role: string
}

export async function updateCompanyInfo(formData: FormData) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company and verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can update company settings' }
  }

  const { error } = await supabase
    .from('companies')
    .update({
      name: formData.get('name') as string,
      legal_name: (formData.get('legal_name') as string) || null,
      vat_number: (formData.get('vat_number') as string) || null,
      registration_number: (formData.get('registration_number') as string) || null,
    } as never)
    .eq('id', membership.company_id)

  if (error) {
    console.error('Error updating company info:', error)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function updateCompanyAddress(formData: FormData) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company and verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can update company settings' }
  }

  const { error } = await supabase
    .from('companies')
    .update({
      address_line1: (formData.get('address_line1') as string) || null,
      address_line2: (formData.get('address_line2') as string) || null,
      postal_code: (formData.get('postal_code') as string) || null,
      city: (formData.get('city') as string) || null,
      country: (formData.get('country') as string) || 'AT',
    } as never)
    .eq('id', membership.company_id)

  if (error) {
    console.error('Error updating company address:', error)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

export async function updateCompanyContact(formData: FormData) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Get user's company and verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can update company settings' }
  }

  const { error } = await supabase
    .from('companies')
    .update({
      email: (formData.get('email') as string) || null,
      phone: (formData.get('phone') as string) || null,
      website: (formData.get('website') as string) || null,
    } as never)
    .eq('id', membership.company_id)

  if (error) {
    console.error('Error updating company contact:', error)
    return { error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

// Team management functions
export async function inviteTeamMember(formData: FormData) {
  const supabase = createClient()
  const serviceClient = createServiceClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can invite team members' }
  }

  const email = formData.get('email') as string
  const role = formData.get('role') as UserRole
  const firstName = formData.get('first_name') as string
  const lastName = formData.get('last_name') as string
  const hourlyRate = formData.get('hourly_rate')
    ? parseFloat(formData.get('hourly_rate') as string)
    : null

  if (!email || !role) {
    return { error: 'Email and role are required' }
  }

  // Get company details
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', membership.company_id)
    .single()

  // Get inviter's profile
  const { data: inviterProfile } = await supabase
    .from('profiles')
    .select('first_name, last_name')
    .eq('id', user.id)
    .single()

  const inviterName = inviterProfile
    ? `${inviterProfile.first_name || ''} ${inviterProfile.last_name || ''}`.trim() || email
    : email

  // Check if user already exists in auth
  const { data: existingUsers } = await serviceClient.auth.admin.listUsers()
  const existingUser = existingUsers?.users.find((u: { email?: string }) => u.email === email)

  let userId: string

  if (existingUser) {
    userId = existingUser.id

    // Check if already a member of this company
    const { data: existingMember } = await supabase
      .from('company_members')
      .select('id, is_active')
      .eq('company_id', membership.company_id)
      .eq('user_id', userId)
      .single()

    if (existingMember) {
      if (existingMember.is_active) {
        return { error: 'User is already a member of this company' }
      }
      // Reactivate membership
      const { error: updateError } = await supabase
        .from('company_members')
        .update({
          is_active: true,
          role: role,
          hourly_rate: hourlyRate,
          joined_at: new Date().toISOString(),
        } as never)
        .eq('id', existingMember.id)

      if (updateError) {
        return { error: updateError.message }
      }

      revalidatePath('/team')
      return { success: true, message: 'Team member reactivated' }
    }
  } else {
    // Create new user via Supabase Auth invite
    const { data: inviteData, error: inviteError } =
      await serviceClient.auth.admin.inviteUserByEmail(email, {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
      })

    if (inviteError) {
      console.error('Error inviting user:', inviteError)
      return { error: inviteError.message }
    }

    userId = inviteData.user.id

    // Create profile for new user
    const { error: profileError } = await serviceClient.from('profiles').insert({
      id: userId,
      email: email,
      first_name: firstName || null,
      last_name: lastName || null,
    } as never)

    if (profileError) {
      console.error('Error creating profile:', profileError)
      // Continue anyway, profile might be created by trigger
    }
  }

  // Create company membership
  const { error: memberError } = await supabase.from('company_members').insert({
    company_id: membership.company_id,
    user_id: userId,
    role: role,
    hourly_rate: hourlyRate,
    invited_at: new Date().toISOString(),
    is_active: true,
  } as never)

  if (memberError) {
    console.error('Error creating membership:', memberError)
    return { error: memberError.message }
  }

  // Send invitation email
  const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/login`
  const emailHtml = getTeamInviteEmailHtml({
    inviterName,
    companyName: company?.name || 'BOTFORCE',
    role: role === 'superadmin' ? 'Admin' : role === 'accountant' ? 'Accountant' : 'Employee',
    inviteLink,
  })

  await sendEmail({
    to: email,
    subject: `You're invited to join ${company?.name || 'BOTFORCE'} on BOTFORCE Unity`,
    html: emailHtml,
  })

  revalidatePath('/team')
  return { success: true, message: `Invitation sent to ${email}` }
}

export async function updateTeamMemberRole(memberId: string, newRole: UserRole) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can update team member roles' }
  }

  // Update the member's role
  const { error } = await supabase
    .from('company_members')
    .update({ role: newRole } as never)
    .eq('id', memberId)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Error updating member role:', error)
    return { error: error.message }
  }

  revalidatePath('/team')
  return { success: true }
}

export async function removeTeamMember(memberId: string) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role, user_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as (CompanyMembership & { user_id: string }) | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can remove team members' }
  }

  // Get the member to be removed
  const { data: targetMember } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('id', memberId)
    .eq('company_id', membership.company_id)
    .single()

  if (!targetMember) {
    return { error: 'Team member not found' }
  }

  // Prevent removing yourself
  if (targetMember.user_id === user.id) {
    return { error: 'You cannot remove yourself from the team' }
  }

  // Soft delete - deactivate the membership
  const { error } = await supabase
    .from('company_members')
    .update({ is_active: false } as never)
    .eq('id', memberId)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Error removing team member:', error)
    return { error: error.message }
  }

  revalidatePath('/team')
  return { success: true }
}

export async function updateTeamMemberHourlyRate(memberId: string, hourlyRate: number | null) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'Unauthorized' }
  }

  // Verify admin role
  const { data: membershipData } = await supabase
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  const membership = membershipData as CompanyMembership | null

  if (!membership || membership.role !== 'superadmin') {
    return { error: 'Only admins can update hourly rates' }
  }

  const { error } = await supabase
    .from('company_members')
    .update({ hourly_rate: hourlyRate } as never)
    .eq('id', memberId)
    .eq('company_id', membership.company_id)

  if (error) {
    console.error('Error updating hourly rate:', error)
    return { error: error.message }
  }

  revalidatePath('/team')
  return { success: true }
}
