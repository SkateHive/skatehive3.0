import { APP_CONFIG } from '@/config/app.config';
import { escapeHtml } from './escapeHtml';

export interface MagicLinkEmail {
  subject: string;
  html: string;
  text: string;
}

/** Who sent an invite. Both fields are user-chosen, so they are escaped. */
export interface MagicLinkInviter {
  handle: string;
  displayName?: string | null;
}

/**
 * The sign-in email. With `invitedBy` it becomes the lite invite: a friend who
 * never asked for this mail is told up front who sent it, rather than getting a
 * bare "Sign in" that reads like phishing.
 */
export function buildMagicLinkEmail(
  loginUrl: string,
  { invitedBy }: { invitedBy?: MagicLinkInviter } = {}
): MagicLinkEmail {
  const fallbackLogo = 'https://docs.skatehive.app/img/skatehive.png';

  const inviterHandle = invitedBy ? `@${invitedBy.handle}` : '';
  const inviterName = invitedBy?.displayName?.trim() || inviterHandle;
  // "Ana (@ana)" when the two differ, just "@ana" when they do not.
  const inviterLabel =
    invitedBy && inviterName !== inviterHandle
      ? `${inviterName} (${inviterHandle})`
      : inviterHandle;

  const title = invitedBy
    ? `${inviterHandle} invited you to Skatehive`
    : 'Sign in to Skatehive';
  const heading = invitedBy
    ? `${escapeHtml(inviterName)} invited you.`
    : 'Drop in.';
  const intro = invitedBy
    ? `<strong style="color:#ffffff;">${escapeHtml(inviterLabel)}</strong> saved you a spot on Skatehive, the skateboarding community. Your account is ready &mdash; tap the button below to drop in. This link is good for one ride and expires in 15 minutes; if it lapses, sign in with this email address at ${APP_CONFIG.DOMAIN} to get a new one.`
    : 'Tap the button below to sign in to your Skatehive account. This link is good for one ride &mdash; it expires in 15 minutes.';
  const button = invitedBy ? 'Accept the invite &rarr;' : 'Sign in to Skatehive &rarr;';
  const disclaimer = invitedBy
    ? `Don't know ${escapeHtml(inviterHandle)}? You can safely ignore this email &mdash; nothing happens until this link is used.`
    : "If you didn't request this email, you can safely ignore it &mdash; someone may have typed your address by mistake. Your account stays locked until this link is used.";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#e0e0e0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0a0a0a;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#121212;border:1px solid #1f1f1f;border-radius:14px;overflow:hidden;box-shadow:0 0 40px rgba(76,175,80,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1b1b1b 0%,#0d0d0d 100%);padding:32px 28px;text-align:center;border-bottom:1px solid #1f1f1f;">
              <img src="${fallbackLogo}" alt="Skatehive" width="72" height="72" style="display:block;margin:0 auto 12px;border:0;">
              <h1 style="margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;color:#4caf50;">SKATEHIVE</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 8px;">
              <h2 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#ffffff;">${heading}</h2>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#bdbdbd;">
                ${intro}
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 32px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#4caf50" style="border-radius:8px;">
                    <a href="${loginUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:700;color:#0a0a0a;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">${button}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 8px;font-size:13px;color:#888;">Button not working? Paste this link into your browser:</p>
              <p style="margin:0;font-size:12px;line-height:1.5;word-break:break-all;">
                <a href="${loginUrl}" style="color:#4caf50;text-decoration:underline;">${loginUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <div style="border-top:1px solid #1f1f1f;padding-top:20px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#666;">
                  ${disclaimer}
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0d0d0d;padding:18px 32px;text-align:center;border-top:1px solid #1f1f1f;">
              <p style="margin:0 0 4px;font-size:12px;color:#777;">Skate fast. Post hard.</p>
              <p style="margin:0;font-size:12px;">
                <a href="${APP_CONFIG.BASE_URL}/" style="color:#4caf50;text-decoration:none;">${APP_CONFIG.DOMAIN}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = (
    invitedBy
      ? [
          title,
          '',
          `${inviterLabel} saved you a spot on Skatehive. Click the link below to accept. It expires in 15 minutes; if it lapses, sign in with this email address at ${APP_CONFIG.DOMAIN} to get a new one.`,
          '',
          loginUrl,
          '',
          `Don't know ${inviterHandle}? You can safely ignore this email.`,
        ]
      : [
          'Sign in to Skatehive',
          '',
          'Click the link below to sign in. It expires in 15 minutes.',
          '',
          loginUrl,
          '',
          "If you didn't request this email, you can safely ignore it.",
        ]
  )
    .concat(['', `— ${APP_CONFIG.DOMAIN}`])
    .join('\n');

  return {
    subject: title,
    html,
    text,
  };
}
