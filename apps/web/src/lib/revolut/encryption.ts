/**
 * Token Encryption Utilities
 * Handles encryption/decryption of OAuth tokens for secure storage
 *
 * Note: In production, use the database encryption functions (pgcrypto)
 * for tokens at rest. This module handles encryption for transit.
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16

/**
 * Get encryption key from environment
 * Key should be 32 bytes (256 bits) for AES-256
 */
function getEncryptionKey(): Buffer {
  const key = process.env.REVOLUT_ENCRYPTION_KEY

  if (!key) {
    throw new Error('REVOLUT_ENCRYPTION_KEY environment variable is required')
  }

  // Hash the key to ensure it's exactly 32 bytes
  return createHash('sha256').update(key).digest()
}

/**
 * Encrypt a string value
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  // Prepend IV to encrypted data (IV is not secret)
  return iv.toString('hex') + ':' + encrypted
}

/**
 * Decrypt an encrypted string
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey()

  const [ivHex, encrypted] = encryptedText.split(':')

  if (!ivHex || !encrypted) {
    throw new Error('Invalid encrypted text format')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Generate a secure random state for OAuth
 */
export function generateOAuthState(): string {
  return randomBytes(32).toString('hex')
}

/**
 * Generate a request ID for idempotent API calls
 */
export function generateRequestId(): string {
  return randomBytes(16).toString('hex')
}
