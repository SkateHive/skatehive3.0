import { APP_CONFIG } from '@/config/app.config';

export interface MissYouEmail {
  subject: string;
  html: string;
  text: string;
}

export interface MissYouEmailParams {
  handle: string;
  displayName?: string | null;
}

const APP_STORE_URL = 'https://apps.apple.com/br/app/skatehive/id6751173076';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * "We miss you" winback email for inactive users.
 * Highlights what changed since they left and invites them back to the crew.
 */
export function buildMissYouEmail({ handle, displayName }: MissYouEmailParams): MissYouEmail {
  const fallbackLogo = 'https://docs.skatehive.app/img/skatehive.png';
  const name = (displayName && displayName.trim()) || handle;
  const safeName = escapeHtml(name);
  const safeHandle = escapeHtml(handle);
  const homeUrl = `${APP_CONFIG.BASE_URL}/`;
  const mapUrl = `${APP_CONFIG.BASE_URL}/map`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>We miss you at Skatehive</title>
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
              <h2 style="margin:0 0 12px;font-size:24px;font-weight:700;color:#ffffff;">We miss you, ${safeName}.</h2>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#bdbdbd;">
                It's been a minute since <span style="color:#4caf50;font-weight:600;">@${safeHandle}</span> rolled through the session. While you were away, Skatehive kept growing &mdash; the crew is now <strong style="color:#fff;">over 2000 skaters</strong> strong, and a lot has changed. Here's what you missed:
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 8px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#bdbdbd;">&#9654;&nbsp;&nbsp;<strong style="color:#fff;">Skatehive is on iOS</strong> &mdash; the whole magazine in your pocket. <a href="${APP_STORE_URL}" style="color:#4caf50;text-decoration:underline;">Grab it on the App Store</a>.</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#bdbdbd;">&#9654;&nbsp;&nbsp;<strong style="color:#fff;">Log in your way</strong> &mdash; email, Ethereum wallet, or your Farcaster account. One tap and you're back in.</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#bdbdbd;">&#9654;&nbsp;&nbsp;<strong style="color:#fff;">Instagram cross-posting</strong> &mdash; post your clip once on Skatehive, share it straight to Instagram.</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:14px;line-height:1.6;color:#bdbdbd;">&#9654;&nbsp;&nbsp;<strong style="color:#fff;">Spots Map leveled up</strong> &mdash; a growing <a href="${mapUrl}" style="color:#4caf50;text-decoration:underline;">database of spots</a>, a brand-new map, and map widgets on mobile.</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 0;">
              <p style="margin:0;font-size:15px;line-height:1.6;color:#bdbdbd;">
                Skatehive is <strong style="color:#fff;">the internet for skateboarders</strong> &mdash; built by skaters, for skaters. And the session isn't the same without you.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 32px 12px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="#4caf50" style="border-radius:8px;">
                    <a href="${homeUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:16px;font-weight:700;color:#0a0a0a;text-decoration:none;border-radius:8px;letter-spacing:0.5px;">Come back to the session &rarr;</a>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#888;">
                Come back and be part of the crew.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color:#0d0d0d;padding:18px 32px;text-align:center;border-top:1px solid #1f1f1f;">
              <p style="margin:0 0 4px;font-size:12px;color:#777;">Skate fast. Post hard.</p>
              <p style="margin:0;font-size:12px;">
                <a href="${APP_CONFIG.BASE_URL}/" style="color:#4caf50;text-decoration:none;">${APP_CONFIG.DOMAIN}</a>
                <span style="color:#444;">&nbsp;&middot;&nbsp;</span>
                <a href="${APP_STORE_URL}" style="color:#4caf50;text-decoration:none;">iOS app</a>
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
    `We miss you, ${name}.`,
    '',
    `It's been a minute since @${handle} rolled through the session. While you were away, Skatehive kept growing — the crew is now over 2000 skaters strong, and a lot has changed.`,
    '',
    "Here's what you missed:",
    `- Skatehive is on iOS — the whole magazine in your pocket: ${APP_STORE_URL}`,
    '- Log in your way — email, Ethereum wallet, or your Farcaster account.',
    '- Instagram cross-posting — post your clip once on Skatehive, share it straight to Instagram.',
    `- Spots Map leveled up — a growing database of spots, a brand-new map, and map widgets on mobile: ${mapUrl}`,
    '',
    "Skatehive is the internet for skateboarders — built by skaters, for skaters. And the session isn't the same without you.",
    '',
    `Come back and be part of the crew: ${homeUrl}`,
    '',
    'Skate fast. Post hard.',
    `— ${APP_CONFIG.DOMAIN}`,
  ].join('\n');

  return {
    subject: `We miss you, @${handle} — Skatehive kept rolling 🛹`,
    html,
    text,
  };
}
