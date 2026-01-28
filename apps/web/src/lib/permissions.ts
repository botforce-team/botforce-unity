import { type UserRole } from '@/types'

/**
 * Permission definitions for each role
 */
export const permissions = {
  // Navigation visibility
  nav: {
    dashboard: ['superadmin', 'employee', 'accountant'],
    customers: ['superadmin'],
    projects: ['superadmin', 'employee'],
    timesheets: ['superadmin', 'employee'],
    documents: ['superadmin', 'accountant'],
    expenses: ['superadmin', 'employee', 'accountant'],
    finance: ['superadmin', 'accountant'],
    reports: ['superadmin', 'accountant'],
    accounting: ['superadmin', 'accountant'],
    team: ['superadmin'],
    settings: ['superadmin'],
  },

  // CRUD operations
  customers: {
    read: ['superadmin'],
    create: ['superadmin'],
    update: ['superadmin'],
    delete: ['superadmin'],
  },

  projects: {
    read: ['superadmin', 'employee'],
    create: ['superadmin'],
    update: ['superadmin'],
    delete: ['superadmin'],
  },

  timeEntries: {
    read: ['superadmin', 'employee'],
    create: ['superadmin', 'employee'],
    update: ['superadmin', 'employee'],
    delete: ['superadmin', 'employee'],
    approve: ['superadmin'],
    reject: ['superadmin'],
  },

  expenses: {
    read: ['superadmin', 'employee', 'accountant'],
    create: ['superadmin', 'employee'],
    update: ['superadmin', 'employee'],
    delete: ['superadmin', 'employee'],
    approve: ['superadmin'],
    reject: ['superadmin'],
  },

  documents: {
    read: ['superadmin', 'accountant'],
    create: ['superadmin'],
    update: ['superadmin'],
    delete: ['superadmin'],
    issue: ['superadmin'],
  },

  exports: {
    read: ['superadmin', 'accountant'],
    create: ['superadmin', 'accountant'],
  },

  team: {
    read: ['superadmin'],
    create: ['superadmin'],
    update: ['superadmin'],
    delete: ['superadmin'],
  },

  company: {
    read: ['superadmin'],
    update: ['superadmin'],
  },
} as const

type PermissionCategory = keyof typeof permissions
type PermissionAction<T extends PermissionCategory> = keyof (typeof permissions)[T]

/**
 * Check if a role has permission for a specific action
 */
export function hasPermission<T extends PermissionCategory>(
  role: UserRole,
  category: T,
  action: PermissionAction<T>
): boolean {
  const allowedRoles = permissions[category][action] as readonly UserRole[]
  return allowedRoles.includes(role)
}

/**
 * Check if a role can see a navigation item
 */
export function canAccessNav(role: UserRole, navItem: keyof typeof permissions.nav): boolean {
  return (permissions.nav[navItem] as readonly string[]).includes(role)
}

/**
 * Get all permitted navigation items for a role
 */
export function getPermittedNavItems(role: UserRole): (keyof typeof permissions.nav)[] {
  return (Object.keys(permissions.nav) as (keyof typeof permissions.nav)[]).filter((item) =>
    canAccessNav(role, item)
  )
}
