// Invoice email template
export function getInvoiceEmailHtml(params: {
  customerName: string
  documentNumber: string
  total: number
  currency: string
  dueDate: string
  companyName: string
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${params.documentNumber}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${params.companyName}</h1>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <h2 style="color: #333; margin-top: 0;">Invoice ${params.documentNumber}</h2>

    <p>Dear ${params.customerName},</p>

    <p>Please find attached your invoice with the following details:</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Invoice Number:</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${params.documentNumber}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Total Amount:</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 18px; color: #667eea;"><strong>${params.currency} ${params.total.toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px;"><strong>Due Date:</strong></td>
        <td style="padding: 10px;">${params.dueDate}</td>
      </tr>
    </table>

    <p>Please ensure payment is made by the due date. If you have any questions regarding this invoice, please don't hesitate to contact us.</p>

    <p style="margin-bottom: 0;">Best regards,<br><strong>${params.companyName}</strong></p>
  </div>

  <div style="background: #333; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="color: #999; margin: 0; font-size: 12px;">This email was sent by BOTFORCE Unity</p>
  </div>
</body>
</html>
`
}

// Team invite email template
export function getTeamInviteEmailHtml(params: {
  inviterName: string
  companyName: string
  role: string
  inviteLink: string
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Team Invitation</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">BOTFORCE Unity</h1>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <h2 style="color: #333; margin-top: 0;">You're Invited!</h2>

    <p><strong>${params.inviterName}</strong> has invited you to join <strong>${params.companyName}</strong> as a <strong>${params.role}</strong>.</p>

    <p>Click the button below to accept the invitation and set up your account:</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${params.inviteLink}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Accept Invitation</a>
    </div>

    <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.</p>

    <p style="margin-bottom: 0;">Best regards,<br><strong>The BOTFORCE Unity Team</strong></p>
  </div>

  <div style="background: #333; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="color: #999; margin: 0; font-size: 12px;">This email was sent by BOTFORCE Unity</p>
  </div>
</body>
</html>
`
}

// Approval notification email template
export function getApprovalNotificationEmailHtml(params: {
  recipientName: string
  type: 'timesheet' | 'expense'
  status: 'submitted' | 'approved' | 'rejected'
  details: string
  reason?: string
  companyName: string
}) {
  const statusColors = {
    submitted: '#ffc107',
    approved: '#28a745',
    rejected: '#dc3545',
  }

  const statusLabels = {
    submitted: 'Submitted for Approval',
    approved: 'Approved',
    rejected: 'Rejected',
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${params.type === 'timesheet' ? 'Timesheet' : 'Expense'} ${statusLabels[params.status]}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${params.companyName}</h1>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <div style="background: ${statusColors[params.status]}; color: white; padding: 10px 20px; border-radius: 5px; display: inline-block; margin-bottom: 20px;">
      ${statusLabels[params.status]}
    </div>

    <h2 style="color: #333; margin-top: 0;">${params.type === 'timesheet' ? 'Timesheet' : 'Expense'} Update</h2>

    <p>Dear ${params.recipientName},</p>

    <p>Your ${params.type} has been <strong>${params.status}</strong>.</p>

    <div style="background: white; padding: 15px; border-radius: 5px; border-left: 4px solid ${statusColors[params.status]}; margin: 20px 0;">
      <p style="margin: 0;"><strong>Details:</strong> ${params.details}</p>
      ${params.reason ? `<p style="margin: 10px 0 0 0;"><strong>Reason:</strong> ${params.reason}</p>` : ''}
    </div>

    <p style="margin-bottom: 0;">Best regards,<br><strong>${params.companyName}</strong></p>
  </div>

  <div style="background: #333; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="color: #999; margin: 0; font-size: 12px;">This email was sent by BOTFORCE Unity</p>
  </div>
</body>
</html>
`
}

// Payment reminder email template
export function getPaymentReminderEmailHtml(params: {
  customerName: string
  documentNumber: string
  total: number
  currency: string
  dueDate: string
  daysOverdue: number
  companyName: string
}) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Reminder - ${params.documentNumber}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); padding: 30px; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 24px;">${params.companyName}</h1>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
    <h2 style="color: #dc3545; margin-top: 0;">Payment Reminder</h2>

    <p>Dear ${params.customerName},</p>

    <p>This is a friendly reminder that invoice <strong>${params.documentNumber}</strong> is now <strong>${params.daysOverdue} days overdue</strong>.</p>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Invoice Number:</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;">${params.documentNumber}</td>
      </tr>
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6;"><strong>Amount Due:</strong></td>
        <td style="padding: 10px; border-bottom: 1px solid #dee2e6; font-size: 18px; color: #dc3545;"><strong>${params.currency} ${params.total.toFixed(2)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 10px;"><strong>Original Due Date:</strong></td>
        <td style="padding: 10px;">${params.dueDate}</td>
      </tr>
    </table>

    <p>Please arrange payment at your earliest convenience. If you have already made the payment, please disregard this reminder.</p>

    <p>If you have any questions or concerns, please don't hesitate to contact us.</p>

    <p style="margin-bottom: 0;">Best regards,<br><strong>${params.companyName}</strong></p>
  </div>

  <div style="background: #333; padding: 20px; border-radius: 0 0 10px 10px; text-align: center;">
    <p style="color: #999; margin: 0; font-size: 12px;">This email was sent by BOTFORCE Unity</p>
  </div>
</body>
</html>
`
}
