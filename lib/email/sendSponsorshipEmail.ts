'use server';

import nodemailer from 'nodemailer';
import { getSponsorshipEmailTemplate, getSponsorshipEmailText } from './sponsorshipTemplate';
import { HiveAccountKeys } from '@/lib/hive/keyGeneration';
import { APP_CONFIG, EMAIL_DEFAULTS } from '@/config/app.config';

/**
 * Sends sponsorship welcome email with Hive account keys
 *
 * @param recipientEmail - Email address of the sponsored user
 * @param username - New Hive username
 * @param sponsorUsername - Username of the sponsor
 * @param keys - Complete set of Hive keys
 * @param isBackup - If true, this is a backup/resend (changes subject line and messaging)
 * @returns true if email sent successfully, false otherwise
 */
export async function sendSponsorshipEmail(
  recipientEmail: string,
  username: string,
  sponsorUsername: string,
  keys: HiveAccountKeys,
  isBackup = false
): Promise<boolean> {
  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || EMAIL_DEFAULTS.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || EMAIL_DEFAULTS.SMTP_PORT,
      secure:
        process.env.SMTP_SECURE
          ? process.env.SMTP_SECURE === 'true'
          : EMAIL_DEFAULTS.SMTP_SECURE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Check if this is a partial backup (only posting key available)
    const isPartialBackup = keys.owner === 'NOT_STORED_CONTACT_SPONSOR';

    // Generate email content
    const html = getSponsorshipEmailTemplate(username, sponsorUsername, keys, isBackup, isPartialBackup);
    const text = getSponsorshipEmailText(username, sponsorUsername, keys, isBackup, isPartialBackup);

    // Create JSON attachment
    let keysJsonContent: string;
    if (isPartialBackup) {
      // Partial backup - only posting key
      keysJsonContent = JSON.stringify(
        {
          username: `@${username}`,
          backup_type: 'partial',
          backup_date: new Date().toISOString(),
          note: 'This is a PARTIAL backup containing only your posting key. Other keys (owner, active, memo) were not stored by the system and cannot be recovered. If you need these keys, please contact your sponsor.',
          keys: {
            posting: {
              private: keys.posting,
              public: keys.postingPublic,
              note: 'Use for daily activities: posting, commenting, voting.',
            },
          },
          security_notice:
            'CRITICAL: Keep this key private and secure. Never share it with anyone.',
          useful_links: {
            keychain: 'https://hive-keychain.com/',
            profile: `https://peakd.com/@${username}`,
            settings: `${APP_CONFIG.BASE_URL}/settings/hive-account`,
          },
        },
        null,
        2
      );
    } else {
      // Full backup - all keys
      keysJsonContent = JSON.stringify(
        {
          username: `@${username}`,
          sponsored_by: `@${sponsorUsername}`,
          [isBackup ? 'backup_date' : 'created_at']: new Date().toISOString(),
          created_via: 'skatehive_sponsorship',
          keys: {
            owner: {
              private: keys.owner,
              public: keys.ownerPublic,
              note: 'Most powerful key - store offline! Use for account recovery only.',
            },
            active: {
              private: keys.active,
              public: keys.activePublic,
              note: 'Use for transfers, trading, power up/down operations.',
            },
            posting: {
              private: keys.posting,
              public: keys.postingPublic,
              note: 'Use for daily activities: posting, commenting, voting.',
            },
            memo: {
              private: keys.memo,
              public: keys.memoPublic,
              note: 'Use for encrypting messages and transfer memos.',
            },
          },
          security_notice:
            'CRITICAL: Keep these keys private and secure. They cannot be recovered if lost. Never share them with anyone, not even Skatehive staff.',
          backup_instructions: [
            'Store this file in a password manager (recommended)',
            'Keep encrypted backups in multiple secure locations',
            'Import to Hive Keychain browser extension',
            'Write down your owner key on paper and store it safely',
          ],
          useful_links: {
            keychain: 'https://hive-keychain.com/',
            profile: `https://peakd.com/@${username}`,
            wallet: `https://wallet.hive.blog/@${username}`,
            settings: `${APP_CONFIG.BASE_URL}/settings/hive-account`,
          },
        },
        null,
        2
      );
    }

    // Determine subject line
    const subject = isBackup
      ? `🔑 Hive Key Backup - @${username}${isPartialBackup ? ' (Posting Key Only)' : ''}`
      : `🎉 Your Hive Account is Ready! (@${username})`;

    // Send email with attachments
    await transporter.sendMail({
      from: process.env.EMAIL_USER || EMAIL_DEFAULTS.FROM_ADDRESS,
      to: recipientEmail,
      bcc: isBackup ? undefined : process.env.EMAIL_RECOVERYACC, // Only BCC on initial send
      subject,
      text,
      html,
      attachments: [
        {
          filename: `hive-keys-${username}${isPartialBackup ? '-posting-only' : ''}.json`,
          content: keysJsonContent,
          contentType: 'application/json',
        },
        {
          filename: `hive-keys-${username}${isPartialBackup ? '-posting-only' : ''}.txt`,
          content: text,
          contentType: 'text/plain',
        },
      ],
    });

    console.log(`Sponsorship email sent successfully to ${recipientEmail} for @${username}`);
    return true;
  } catch (error) {
    console.error('Error sending sponsorship email:', error);
    return false;
  }
}

/**
 * Re-sends the key backup email to a sponsored user
 * Useful if they lost the original email
 *
 * @param recipientEmail - User's email address
 * @param username - Hive username
 * @param sponsorUsername - Original sponsor's username
 * @param keys - Hive keys (retrieved from encrypted storage)
 * @returns true if sent successfully
 */
export async function resendKeyBackup(
  recipientEmail: string,
  username: string,
  sponsorUsername: string,
  keys: HiveAccountKeys
): Promise<boolean> {
  // Same as sendSponsorshipEmail but with different subject
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || EMAIL_DEFAULTS.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || EMAIL_DEFAULTS.SMTP_PORT,
      secure:
        process.env.SMTP_SECURE
          ? process.env.SMTP_SECURE === 'true'
          : EMAIL_DEFAULTS.SMTP_SECURE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const html = getSponsorshipEmailTemplate(username, sponsorUsername, keys);
    const text = getSponsorshipEmailText(username, sponsorUsername, keys);

    const keysJsonContent = JSON.stringify(
      {
        username: `@${username}`,
        sponsored_by: `@${sponsorUsername}`,
        resent_at: new Date().toISOString(),
        keys: {
          owner: { private: keys.owner, public: keys.ownerPublic },
          active: { private: keys.active, public: keys.activePublic },
          posting: { private: keys.posting, public: keys.postingPublic },
          memo: { private: keys.memo, public: keys.memoPublic },
        },
      },
      null,
      2
    );

    await transporter.sendMail({
      from: process.env.EMAIL_USER || EMAIL_DEFAULTS.FROM_ADDRESS,
      to: recipientEmail,
      subject: `🔑 Hive Key Backup - @${username}`,
      text,
      html,
      attachments: [
        {
          filename: `hive-keys-${username}.json`,
          content: keysJsonContent,
          contentType: 'application/json',
        },
      ],
    });

    return true;
  } catch (error) {
    console.error('Error resending key backup:', error);
    return false;
  }
}
