import { APP_CONFIG } from '@/config/app.config';

export interface WelcomeEmail {
  subject: string;
  html: string;
  text: string;
}

export interface WelcomeEmailParams {
  handle: string;
  displayName?: string | null;
}

/**
 * Welcome email for brand-new accounts created via email sign-up.
 * Transactional one-shot — fired once when the user first signs up.
 */
export function buildWelcomeEmail({ handle, displayName }: WelcomeEmailParams): WelcomeEmail {
  const fallbackLogo = 'https://docs.skatehive.app/img/skatehive.png';
  const name = (displayName && displayName.trim()) || handle;
  const profileUrl = `${APP_CONFIG.BASE_URL}/user/${handle}`;
  const composeUrl = `${APP_CONFIG.BASE_URL}/compose`;
  const docsUrl = 'https://docs.skatehive.app';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to Skatehive</title>
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
              <h2 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#ffffff;">Welcome to the session, ${name}.</h2>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#bdbdbd;">
                You're in. <span style="color:#4caf50;font-weight:600;">@${handle}</span> is now part of the infinite skateboard magazine &mdash; built by skaters, for skaters. Post clips, find spots, earn crypto. No gatekeepers.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#bdbdbd;">&#9654;&nbsp;&nbsp;<strong style="color:#fff;">Post your first clip</strong> &mdash; landed it or not, the bails count too.</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#bdbdbd;">&#9654;&nbsp;&nbsp;<strong style="color:#fff;">Drop a spot</strong> &mdash; put your local on the map for the crew.</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#bdbdbd;">&#9654;&nbsp;&nbsp;<strong style="color:#fff;">Stack rewards</strong> &mdash; good clips earn. Keep skating, keep posting.</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#4caf50" style="border-radius:8px;">
                    <a href="${composeUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:700;color:#0a0a0a;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">Post your first clip &rarr;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px;">
              <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#888;">
                Check out your profile: <a href="${profileUrl}" style="color:#4caf50;text-decoration:underline;">${APP_CONFIG.DOMAIN}/user/${handle}</a>
              </p>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#888;">
                New to all this? The <a href="${docsUrl}" style="color:#4caf50;text-decoration:underline;">Skatehive docs</a> break down how it works &mdash; posting, rewards, getting your own Hive account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0d0d0d;padding:18px 32px;text-align:center;border-top:1px solid #1f1f1f;">
              <p style="margin:0 0 4px;font-size:12px;color:#777;">Skate fast. Post hard.</p>
              <p style="margin:0;font-size:12px;">
                <a href="${APP_CONFIG.BASE_URL}/" style="color:#4caf50;text-decoration:none;">${APP_CONFIG.DOMAIN}</a>
                <span style="color:#444;">&nbsp;&middot;&nbsp;</span>
                <a href="${docsUrl}" style="color:#4caf50;text-decoration:none;">docs.skatehive.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `Welcome to the session, ${name}.`,
    '',
    `You're in. @${handle} is now part of the infinite skateboard magazine — built by skaters, for skaters.`,
    '',
    'Get rolling:',
    '- Post your first clip — landed it or not, the bails count too.',
    '- Drop a spot — put your local on the map for the crew.',
    '- Stack rewards — good clips earn. Keep skating, keep posting.',
    '',
    `Post your first clip: ${composeUrl}`,
    `Your profile: ${profileUrl}`,
    '',
    `New to all this? The Skatehive docs break down how it works: ${docsUrl}`,
    '',
    'Skate fast. Post hard.',
    `— ${APP_CONFIG.DOMAIN}`,
  ].join('\n');

  return {
    subject: `Welcome to Skatehive, @${handle} 🛹`,
    html,
    text,
  };
}
