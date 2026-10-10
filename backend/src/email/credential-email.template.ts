export interface CredentialEmailTemplateData {
  recipientName: string;
  username: string;
  password: string;
  role: string;
  schoolName?: string;
  loginUrl?: string;
  email?: string;
  loginNote?: string;
}

const escapeHtml = (value: string | undefined) =>
  String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[character] || character));

export function buildCredentialEmail(data: CredentialEmailTemplateData) {
  const displayName = escapeHtml(data.schoolName || 'Smart Tech');
  const recipientName = escapeHtml(data.recipientName);
  const role = escapeHtml(data.role);
  const username = escapeHtml(data.username);
  const password = escapeHtml(data.password);
  const email = escapeHtml(data.email);
  const loginUrl = escapeHtml(data.loginUrl || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/login`);
  const loginNote = data.loginNote ? escapeHtml(data.loginNote) : '';

  return {
    subject: `Your ${displayName} Account Credentials - Action Required`,
    html: `
      <!DOCTYPE html>
      <html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 20px;"><tr><td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
            <tr><td style="background:linear-gradient(135deg,#0f172a 0%,#1e40af 50%,#2563eb 100%);padding:40px 30px;border-radius:16px 16px 0 0;text-align:center;"><table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr><td style="width:48px;height:48px;background:#2563eb;border-radius:12px;text-align:center;vertical-align:middle;font-size:24px;color:#fff;font-weight:700;line-height:48px;">ST</td><td style="padding-left:14px;text-align:left;"><div style="color:#fff;font-size:22px;font-weight:700;">Smart Tech</div><div style="color:#93c5fd;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;margin-top:2px;">Education Platform</div></td></tr></table></td></tr>
            <tr><td style="height:4px;background:linear-gradient(90deg,#2563eb,#06b6d4,#2563eb);"></td></tr>
            <tr><td style="background:#fff;padding:40px 36px;"><h1 style="margin:0 0 8px;font-size:22px;color:#0f172a;">Welcome, ${recipientName}</h1><p style="margin:0 0 28px;font-size:15px;color:#64748b;line-height:1.6;">Your <strong style="color:#1e40af;">${role}</strong> account for <strong>${displayName}</strong> has been created. Use the credentials below to log in.</p>
              ${loginNote ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;margin-bottom:24px;"><tr><td style="padding:14px 16px;color:#1e3a8a;font-size:14px;line-height:1.5;"><strong>Access note:</strong> ${loginNote}</td></tr></table>` : ''}
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:24px;"><tr><td style="background:#1e40af;padding:14px 20px;color:#fff;font-size:13px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;">Login Credentials</td></tr><tr><td style="padding:24px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:10px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Username</td><td style="padding:10px 14px;color:#0f172a;font-size:15px;font-family:'Courier New',monospace;background:#e0f2fe;border-radius:6px;border:1px solid #bae6fd;">${username}</td></tr><tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr><tr><td style="padding:10px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Password</td><td style="padding:10px 14px;color:#0f172a;font-size:15px;font-family:'Courier New',monospace;background:#e0f2fe;border-radius:6px;border:1px solid #bae6fd;">${password}</td></tr>${data.email ? `<tr><td colspan="2" style="height:1px;background:#e2e8f0;"></td></tr><tr><td style="padding:10px 0;width:120px;color:#64748b;font-size:13px;font-weight:600;text-transform:uppercase;">Email</td><td style="padding:10px 14px;color:#0f172a;font-size:15px;font-family:'Courier New',monospace;background:#e0f2fe;border-radius:6px;border:1px solid #bae6fd;">${email}</td></tr>` : ''}</table></td></tr></table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;margin-bottom:28px;"><tr><td style="padding:16px 20px;color:#92400e;font-size:14px;line-height:1.5;"><strong>Important:</strong> Change your password after your first login and do not share these credentials.</td></tr></table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 32px;"><tr><td style="border-radius:10px;background:linear-gradient(135deg,#1e40af,#2563eb);box-shadow:0 4px 14px rgba(37,99,235,.35);"><a href="${loginUrl}" target="_blank" style="display:inline-block;padding:16px 48px;color:#fff;font-size:16px;font-weight:600;text-decoration:none;">Login to Portal &rarr;</a></td></tr></table>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px;background:#f0f9ff;border-radius:10px;border:1px solid #e0f2fe;"><p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0f172a;text-transform:uppercase;">Getting Started</p><p style="margin:5px 0;color:#475569;font-size:14px;">1. Open the portal using the button above.</p><p style="margin:5px 0;color:#475569;font-size:14px;">2. Enter your username${data.email ? ' or email' : ''} and password.</p><p style="margin:5px 0;color:#475569;font-size:14px;">3. Set a new secure password when prompted.</p></td></tr></table>
            </td></tr>
            <tr><td style="background:#f8fafc;padding:28px 36px;border-radius:0 0 16px 16px;border-top:1px solid #e2e8f0;text-align:center;"><strong style="font-size:14px;color:#1e40af;">Smart Tech</strong><span style="color:#cbd5e1;padding:0 8px;">|</span><span style="font-size:12px;color:#94a3b8;">Education Management Platform</span><p style="font-size:12px;color:#94a3b8;line-height:1.6;margin:12px 0 0;">This is an automated message. If you did not expect this email, contact your school administrator.</p></td></tr>
          </table>
        </td></tr></table>
      </body></html>`,
  };
}
