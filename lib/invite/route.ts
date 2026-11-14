'use server'
import { htmlToText } from 'html-to-text';
import getMailTemplate_Invite from './template';
import { buildInviteKeysBackup } from './backup';
import { createTransport, fromAddress } from '@/lib/email/transport';

/**
 * The keys BCC goes to a mailbox that archives every invite. It used to fall
 * back to APP_CONFIG.RECOVERY_ACCOUNT, which is a Hive account name — SMTP
 * rejects that as a recipient and the whole message dies, invite email
 * included. Only pass through something that is actually an address.
 */
function resolveKeysArchiveBcc(): string | undefined {
  const configured = process.env.EMAIL_RECOVERYACC?.trim();
  if (!configured) return undefined;
  if (!configured.includes('@')) {
    console.warn(
      `EMAIL_RECOVERYACC is set to "${configured}", which is not an email address — skipping the invite BCC.`
    );
    return undefined;
  }
  return configured;
}

export default async function serverMailer(
  to: string,
  subject: string,
  createdby: string,
  desiredUsername: string,
  masterPassword: string,
  keys: any,
  language: string // Add language parameter
): Promise<{ ok: true } | { ok: false; code: string }> {

  const transporter = createTransport();

  // Try sending the email
  try {
    // Get HTML template and Convert HTML to plain text (fallback for non-HTML clients)
    const html = getMailTemplate_Invite(createdby, desiredUsername, masterPassword, keys, language); // Pass language
    const text = htmlToText(html, {
      preserveNewlines: true,
    });

    // Build a clean, structured key backup file. The attached file is the
    // user's permanent record of their account — it must spell out the master
    // password and every key explicitly, not just whatever fell out of htmlToText.
    const backup = buildInviteKeysBackup({
      createdby,
      desiredUsername,
      masterPassword,
      keys,
    });

    const attachment = {
      name: `KEYS-BACKUP-${desiredUsername}-SKATEHIVE.TXT`,
      data: backup,
      type: "text/plain"
    };

    const info = await transporter.sendMail({
      from: fromAddress(),
      bcc: resolveKeysArchiveBcc(), // mailbox that archives the keys, when configured
      to, subject,
      text, html,
      attachments: [{
        filename: attachment.name,    // Name of the attachment
        content: attachment.data,     // Sanitized text content
        contentType: attachment.type, // MIME type of the attachment
      }]
    });

    return { ok: true };

  } catch (error: any) {
    // The caller only gets a short code — enough for the inviter to tell an
    // auth problem from a bad address without leaking the SMTP transcript.
    console.error(
      `Invite email to ${to} for @${desiredUsername} failed:`,
      error
    );
    return { ok: false, code: String(error?.code || error?.responseCode || 'UNKNOWN') };
  }

}
