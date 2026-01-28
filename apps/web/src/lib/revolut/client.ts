/**
 * Revolut Business API Client
 * Handles OAuth flow, API requests, and token management
 */

import { env } from '@/lib/env'

// ============================================================================
// Types
// ============================================================================

export interface RevolutTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface RevolutAccount {
  id: string
  name: string
  balance: number
  currency: string
  state: 'active' | 'inactive'
  public: boolean
  created_at: string
  updated_at: string
}

export interface RevolutCounterparty {
  id?: string
  name?: string
  account_id?: string
  account_type?: string
}

export interface RevolutMerchant {
  name?: string
  city?: string
  category_code?: string
  country?: string
}

export interface RevolutTransactionLeg {
  leg_id: string
  account_id: string
  counterparty?: RevolutCounterparty
  amount: number
  currency: string
  description?: string
  balance?: number
}

export interface RevolutTransaction {
  id: string
  type: string
  state: 'pending' | 'completed' | 'declined' | 'reverted' | 'failed'
  created_at: string
  completed_at?: string
  request_id?: string
  reference?: string
  legs: RevolutTransactionLeg[]
  merchant?: RevolutMerchant
  card?: {
    card_number: string
  }
}

export interface RevolutPaymentRequest {
  request_id: string
  account_id: string
  receiver: {
    counterparty_id?: string
    account_id?: string
    iban?: string
    bic?: string
  }
  amount: number
  currency: string
  reference?: string
  schedule_for?: string
}

export interface RevolutPaymentResponse {
  id: string
  state: 'pending' | 'completed' | 'failed' | 'cancelled'
  created_at: string
  completed_at?: string
  reason_code?: string
}

// ============================================================================
// API URLs
// ============================================================================

const SANDBOX_BASE_URL = 'https://sandbox-b2b.revolut.com/api/1.0'
const PRODUCTION_BASE_URL = 'https://b2b.revolut.com/api/1.0'

const SANDBOX_AUTH_URL = 'https://sandbox-business.revolut.com/app-confirm'
const PRODUCTION_AUTH_URL = 'https://business.revolut.com/app-confirm'

export function getBaseUrl(): string {
  return env.REVOLUT_SANDBOX ? SANDBOX_BASE_URL : PRODUCTION_BASE_URL
}

export function getAuthUrl(): string {
  return env.REVOLUT_SANDBOX ? SANDBOX_AUTH_URL : PRODUCTION_AUTH_URL
}

// ============================================================================
// OAuth Helper Functions
// ============================================================================

/**
 * Generate OAuth authorization URL
 */
export function generateAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.REVOLUT_CLIENT_ID || '',
    redirect_uri: env.REVOLUT_REDIRECT_URI,
    response_type: 'code',
    scope: 'accounts:read transactions:read payments:write',
    state,
  })

  return `${getAuthUrl()}?${params.toString()}`
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  clientAssertion: string
): Promise<RevolutTokens> {
  const response = await fetch(`${getBaseUrl()}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: env.REVOLUT_CLIENT_ID || '',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: clientAssertion,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to exchange code for tokens: ${error}`)
  }

  return response.json()
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientAssertion: string
): Promise<RevolutTokens> {
  const response = await fetch(`${getBaseUrl()}/auth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: env.REVOLUT_CLIENT_ID || '',
      client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
      client_assertion: clientAssertion,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to refresh token: ${error}`)
  }

  return response.json()
}

// ============================================================================
// API Client Class
// ============================================================================

export class RevolutClient {
  private accessToken: string
  private baseUrl: string

  constructor(accessToken: string) {
    this.accessToken = accessToken
    this.baseUrl = getBaseUrl()
  }

  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Revolut API error (${response.status}): ${error}`)
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  // ============================================================================
  // Accounts
  // ============================================================================

  /**
   * Get all accounts
   */
  async getAccounts(): Promise<RevolutAccount[]> {
    return this.request<RevolutAccount[]>('GET', '/accounts')
  }

  /**
   * Get a specific account
   */
  async getAccount(accountId: string): Promise<RevolutAccount> {
    return this.request<RevolutAccount>('GET', `/accounts/${accountId}`)
  }

  // ============================================================================
  // Transactions
  // ============================================================================

  /**
   * Get transactions with optional filters
   */
  async getTransactions(params?: {
    from?: string // ISO date
    to?: string // ISO date
    counterparty?: string
    count?: number
    type?: string
  }): Promise<RevolutTransaction[]> {
    const searchParams = new URLSearchParams()

    if (params?.from) searchParams.set('from', params.from)
    if (params?.to) searchParams.set('to', params.to)
    if (params?.counterparty) searchParams.set('counterparty', params.counterparty)
    if (params?.count) searchParams.set('count', params.count.toString())
    if (params?.type) searchParams.set('type', params.type)

    const queryString = searchParams.toString()
    const endpoint = `/transactions${queryString ? `?${queryString}` : ''}`

    return this.request<RevolutTransaction[]>('GET', endpoint)
  }

  /**
   * Get a specific transaction
   */
  async getTransaction(transactionId: string): Promise<RevolutTransaction> {
    return this.request<RevolutTransaction>('GET', `/transaction/${transactionId}`)
  }

  // ============================================================================
  // Payments
  // ============================================================================

  /**
   * Create a payment
   */
  async createPayment(payment: RevolutPaymentRequest): Promise<RevolutPaymentResponse> {
    return this.request<RevolutPaymentResponse>('POST', '/pay', payment)
  }

  /**
   * Get payment status
   */
  async getPayment(paymentId: string): Promise<RevolutPaymentResponse> {
    return this.request<RevolutPaymentResponse>('GET', `/transaction/${paymentId}`)
  }

  // ============================================================================
  // Counterparties
  // ============================================================================

  /**
   * Get all counterparties
   */
  async getCounterparties(): Promise<RevolutCounterparty[]> {
    return this.request<RevolutCounterparty[]>('GET', '/counterparties')
  }

  /**
   * Create a counterparty (external bank account)
   */
  async createCounterparty(counterparty: {
    company_name?: string
    individual_name?: { first_name: string; last_name: string }
    profile_type?: 'personal' | 'business'
    bank_country: string
    currency: string
    iban?: string
    bic?: string
  }): Promise<RevolutCounterparty & { id: string }> {
    return this.request<RevolutCounterparty & { id: string }>('POST', '/counterparty', counterparty)
  }

  /**
   * Delete a counterparty
   */
  async deleteCounterparty(counterpartyId: string): Promise<void> {
    return this.request<void>('DELETE', `/counterparty/${counterpartyId}`)
  }

  /**
   * Cancel a pending payment
   */
  async cancelPayment(paymentId: string): Promise<void> {
    return this.request<void>('DELETE', `/transaction/${paymentId}`)
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parse Revolut transaction into our database format
 */
export function parseTransaction(tx: RevolutTransaction, accountId: string) {
  const leg = tx.legs.find(l => l.account_id === accountId) || tx.legs[0]

  return {
    revolut_transaction_id: tx.id,
    revolut_leg_id: leg?.leg_id,
    type: tx.type,
    state: tx.state,
    amount: leg?.amount || 0,
    currency: leg?.currency || 'EUR',
    balance_after: leg?.balance,
    counterparty_name: leg?.counterparty?.name,
    counterparty_account_id: leg?.counterparty?.account_id,
    counterparty_account_type: leg?.counterparty?.account_type,
    reference: tx.reference,
    description: leg?.description,
    merchant_name: tx.merchant?.name,
    merchant_category_code: tx.merchant?.category_code,
    merchant_city: tx.merchant?.city,
    merchant_country: tx.merchant?.country,
    card_last_four: tx.card?.card_number?.slice(-4),
    transaction_date: new Date(tx.created_at).toISOString().split('T')[0],
    created_at_revolut: tx.created_at,
    completed_at_revolut: tx.completed_at,
  }
}

/**
 * Parse Revolut account into our database format
 */
export function parseAccount(account: RevolutAccount) {
  return {
    revolut_account_id: account.id,
    name: account.name,
    currency: account.currency,
    balance: account.balance,
    state: account.state,
  }
}
