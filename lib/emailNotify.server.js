function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function emailConfig() {
  return {
    apiKey: String(process.env.RESEND_API_KEY || '').trim(),
    from: String(process.env.EMAIL_FROM || '').trim(),
    devMode:
      process.env.NODE_ENV !== 'production' &&
      String(process.env.EMAIL_DEV_MODE || '').trim().toLowerCase() === 'true',
  };
}

export async function sendTransactionalEmail({ to, subject, message }) {
  const recipient = String(to || '').trim().toLowerCase();
  const safeSubject = String(subject || '').trim();
  const safeMessage = String(message || '').trim();
  if (!recipient || !safeSubject || !safeMessage) {
    return { ok: false, channel: 'email', skipped: true, error: 'Email notification details are incomplete.' };
  }

  const config = emailConfig();
  if (config.devMode) {
    console.info(`[EMAIL DEV] To: ${recipient} | ${safeSubject} | ${safeMessage}`);
    return { ok: true, channel: 'email', devMode: true, recipient };
  }

  if (!config.apiKey || !config.from) {
    return {
      ok: false,
      channel: 'email',
      skipped: true,
      recipient,
      error: 'Email updates are not configured. Set RESEND_API_KEY and EMAIL_FROM.',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'alaga-program/1.0',
      },
      body: JSON.stringify({
        from: config.from,
        to: [recipient],
        subject: safeSubject,
        text: safeMessage,
        html: `
          <div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#1f2937">
            <h2 style="color:#1d4ed8">ALAGA Program Update</h2>
            <p style="font-size:16px;line-height:1.6">${escapeHtml(safeMessage)}</p>
            <p style="color:#6b7280;font-size:13px">Barangay Sta. Rita ALAGA Program</p>
          </div>
        `,
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        channel: 'email',
        recipient,
        error: result?.message || 'Email provider rejected the notification.',
      };
    }
    return { ok: true, channel: 'email', recipient, providerId: result?.id || null };
  } catch (error) {
    return { ok: false, channel: 'email', recipient, error: error?.message || 'Failed to send email notification.' };
  }
}

export function sendAccountStatusEmail({ email, status, notes }) {
  const normalizedStatus = status === 'Rejected' || status === 'Archived' ? 'Incomplete' : status;
  const note = String(notes || '').trim();
  const approved = normalizedStatus === 'Approved';
  return sendTransactionalEmail({
    to: email,
    subject: approved ? 'Your ALAGA account has been approved' : 'Update needed for your ALAGA signup',
    message: approved
      ? 'Your ALAGA signup has been approved. You may now sign in using your linked Gmail account or your account credentials.'
      : `Your ALAGA signup needs additional information.${note ? ` Details: ${note}` : ''}`,
  });
}

export function sendAccountResubmissionEmail({ email, notes, resubmissionCode }) {
  const note = String(notes || '').trim();
  return sendTransactionalEmail({
    to: email,
    subject: 'Action needed: update your ALAGA signup',
    message: `Your resubmission code is ${resubmissionCode}.${note ? ` Missing or incorrect information: ${note}.` : ''} Open the ALAGA resubmission page and enter this code.`,
  });
}

export function sendAssistanceStatusEmail({ email, status, controlNumber, remarks }) {
  const note = String(remarks || '').trim();
  return sendTransactionalEmail({
    to: email,
    subject: `ALAGA assistance request ${status}`,
    message: `Your assistance request${controlNumber ? ` (${controlNumber})` : ''} is now ${String(status || '').toLowerCase()}.${note ? ` Details: ${note}` : ''}`,
  });
}

export function sendRenewalStatusEmail({ email, status, remarks, expirationDate }) {
  const approved = status === 'Approved';
  return sendTransactionalEmail({
    to: email,
    subject: `ALAGA Beneficiary ID renewal ${status}`,
    message: approved
      ? `Your Beneficiary ID renewal was approved.${expirationDate ? ` Your ID is valid until ${expirationDate}.` : ''}`
      : `Your Beneficiary ID renewal needs additional information.${remarks ? ` Details: ${remarks}` : ''}`,
  });
}
