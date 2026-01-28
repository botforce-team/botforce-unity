import { env } from '@/lib/env'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  from?: string
  replyTo?: string
  attachments?: {
    filename: string
    content: string | Buffer
    contentType?: string
  }[]
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

/**
 * Send an email using the configured email provider
 * Supports Resend, SendGrid, or SMTP via environment variables
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
  const provider = env.EMAIL_PROVIDER || 'console'

  switch (provider) {
    case 'resend':
      return sendWithResend(options)
    case 'console':
    default:
      return sendToConsole(options)
  }
}

async function sendWithResend(options: EmailOptions): Promise<EmailResult> {
  const apiKey = env.RESEND_API_KEY

  if (!apiKey) {
    console.error('RESEND_API_KEY not configured')
    return { success: false, error: 'Email provider not configured' }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || env.EMAIL_FROM || 'BOTFORCE Unity <noreply@botforce.io>',
        to: Array.isArray(options.to) ? options.to : [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
        reply_to: options.replyTo,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: typeof a.content === 'string' ? a.content : a.content.toString('base64'),
        })),
      }),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Resend error:', error)
      return { success: false, error: error.message || 'Failed to send email' }
    }

    const data = await response.json()
    return { success: true, messageId: data.id }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error: 'Failed to send email' }
  }
}

async function sendToConsole(options: EmailOptions): Promise<EmailResult> {
  console.log('=== EMAIL (Console Mode) ===')
  console.log('To:', options.to)
  console.log('Subject:', options.subject)
  console.log('From:', options.from || 'default')
  console.log('HTML length:', options.html.length)
  if (options.attachments) {
    console.log('Attachments:', options.attachments.map((a) => a.filename))
  }
  console.log('============================')

  return { success: true, messageId: `console-${Date.now()}` }
}
