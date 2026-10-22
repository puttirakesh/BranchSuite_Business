import { join } from 'node:path';

export function createOtpEmail(otp: string, purpose: string) {
  // Only six numeric digits can be interpolated into the HTML template.
  if (!/^[0-9]{6}$/.test(otp)) throw new Error('Invalid OTP format');
  const reset = purpose === 'reset';
  const subject = reset
    ? 'Your BranchSuite Business Password Reset Code'
    : 'Your BranchSuite Business Verification Code';
  const introduction = reset
    ? 'We received a request to reset your BranchSuite Business password. Please use the following One-Time Password (OTP) to verify your identity and continue resetting your password:'
    : 'We received a request to verify your BranchSuite Business account. Please use the following One-Time Password (OTP) to complete your verification:';
  const text = [
    'Dear User,', '', introduction, '', otp, '',
    'Important Security Notice:',
    '- This code will expire in 10 minutes.',
    '- Never share this verification code with anyone. Our support team will never ask for your OTP.', '',
    'If you did not initiate this request, please ignore this email or contact our support team immediately if you suspect unauthorized activity.', '',
    'Best regards,', 'BranchSuite Security Team',
  ].join('\n');

  // Table layout and inline CSS keep the email readable across inboxes.
  // CID embeds the logo in the message; it needs no public URL or preview files.
  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background-color:#edf2fa;font-family:Arial,Helvetica,sans-serif;color:#1b2d4a;">
<div style="display:none;max-height:0;overflow:hidden;">Your BranchSuite Business code expires in 10 minutes. Never share it with anyone.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#edf2fa;">
<tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background-color:#ffffff;border:1px solid #d6e0ef;border-radius:14px;">
<tr><td style="padding:26px 26px 22px;border-bottom:1px solid #e8edf6;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td><img src="cid:branchsuite-logo" alt="BranchSuite logo" width="44" height="44" style="display:block;border:0;border-radius:10px;"></td>
<td style="padding-left:12px;"><span style="font-size:21px;font-weight:bold;color:#1b2d4a;">BranchSuite</span><br><span style="font-size:10px;letter-spacing:2px;color:#586d8b;">BUSINESS</span></td>
</tr></table></td></tr>
<tr><td style="padding:28px 26px 0;font-size:15px;line-height:25px;">
<p style="margin:0 0 18px;font-weight:bold;">Dear User,</p>
<p style="margin:0 0 24px;color:#586d8b;">${introduction}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5ff;border:1px solid #d6e1ff;border-radius:10px;">
<tr><td align="center" style="padding:20px 8px;">
<div style="font-size:10px;line-height:18px;letter-spacing:1.5px;color:#586d8b;font-weight:bold;">YOUR ONE-TIME PASSWORD</div>
<div style="font-family:'Courier New',monospace;font-size:42px;line-height:58px;font-weight:bold;letter-spacing:6px;color:#3157d5;white-space:nowrap;">${otp}</div>
</td></tr></table>
<p style="margin:10px 0 24px;text-align:center;font-size:12px;line-height:20px;color:#586d8b;">Select and copy this code, then paste it into the app.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fafbfe;border-left:3px solid #3157d5;">
<tr><td style="padding:16px;font-size:13px;line-height:23px;color:#586d8b;">
<strong style="color:#1b2d4a;">Important Security Notice:</strong>
<ul style="margin:8px 0 0;padding-left:18px;">
<li>This code will expire in <strong>10 minutes</strong>.</li>
<li>Never share this verification code with anyone. Our support team will never ask for your OTP.</li>
</ul></td></tr></table>
<p style="margin:24px 0;color:#586d8b;font-size:14px;line-height:24px;">If you did not initiate this request, please ignore this email or contact our support team immediately if you suspect unauthorized activity.</p>
<p style="margin:0 0 28px;font-size:14px;line-height:24px;">Best regards,<br><strong>BranchSuite Security Team</strong></p>
</td></tr></table>
<p style="margin:18px 0 0;font-size:11px;line-height:18px;color:#7a8aa1;">BranchSuite Business &middot; Account security</p>
</td></tr></table></body></html>`;

  return {
    subject,
    text,
    html,
    attachments: [{
      filename: 'branchsuite-logo.png',
      path: join(__dirname, 'branchsuite-logo.png'),
      cid: 'branchsuite-logo',
      contentDisposition: 'inline' as const,
    }],
  };
}
