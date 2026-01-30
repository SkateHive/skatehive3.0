import { APP_CONFIG } from '@/config/app.config';
import { HiveAccountKeys } from '@/lib/hive/keyGeneration';

/**
 * Generates HTML email template for sponsored Hive account
 *
 * @param username - The new Hive username
 * @param sponsorUsername - Username of the sponsor
 * @param keys - Complete set of Hive keys
 * @param isBackup - If true, this is a backup/resend email
 * @param isPartialBackup - If true, only posting key is available
 * @returns HTML email template
 */
export function getSponsorshipEmailTemplate(
  username: string,
  sponsorUsername: string,
  keys: HiveAccountKeys,
  isBackup = false,
  isPartialBackup = false
): string {
  const template = `
<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0a0a0a; color: #e0e0e0; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 30px auto; border-radius: 12px; overflow: hidden; box-shadow: 0 0 30px rgba(0, 0, 0, 0.7);">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #4CAF50, #45a049); padding: 40px 30px; text-align: center;">
      <img src="https://docs.skatehive.app/img/skatehive.png" alt="Skatehive" style="max-width: 80px; margin-bottom: 15px;">
      <h1 style="margin: 10px 0 0; font-size: 28px; color: #fff;">${isBackup ? '🔑 Hive Key Backup' : '🎉 Your Hive Account is Ready!'}</h1>
      <p style="margin: 10px 0 0; font-size: 16px; color: #f0f0f0;">${isBackup ? `Key backup for @${username}` : `Welcome to Hive, @${username}`}</p>
    </div>

    <!-- Body -->
    <div style="background-color: #1a1a1a; padding: 30px;">

      ${isBackup && isPartialBackup ? `
      <!-- Partial Backup Warning -->
      <div style="background-color: #FFA726; padding: 20px; border-radius: 10px; margin-bottom: 25px; text-align: center;">
        <h3 style="margin: 0 0 10px; color: #000; font-size: 20px;">⚠️ Partial Backup - Posting Key Only</h3>
        <p style="margin: 0; color: #000; line-height: 1.6;">
          This backup contains only your <strong>posting key</strong>. Other keys (owner, active, memo) were not stored by the system and cannot be recovered.<br><br>
          If you need your other keys, please contact your sponsor: <strong>@${sponsorUsername}</strong>
        </p>
      </div>
      ` : isBackup ? `
      <!-- Backup Notice -->
      <div style="background: linear-gradient(135deg, #2a2a2a, #1a1a1a); padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #4CAF50;">
        <h2 style="color: #4CAF50; margin-top: 0; font-size: 22px;">Key Backup 🔑</h2>
        <p style="margin: 10px 0; line-height: 1.6;">
          This is a backup of your Hive account keys for <strong style="color: #4CAF50;">@${username}</strong>.
        </p>
        <p style="margin: 10px 0; line-height: 1.6;">
          Store this backup securely in case you need to recover your account.
        </p>
      </div>
      ` : `
      <!-- Congratulations Section -->
      <div style="background: linear-gradient(135deg, #2a2a2a, #1a1a1a); padding: 20px; border-radius: 10px; margin-bottom: 25px; border-left: 4px solid #4CAF50;">
        <h2 style="color: #4CAF50; margin-top: 0; font-size: 22px;">Congratulations! 🛹</h2>
        <p style="margin: 10px 0; line-height: 1.6;">
          You've been sponsored by <strong style="color: #4CAF50;">@${sponsorUsername}</strong> and now have a full Hive account!
        </p>
        <p style="margin: 10px 0; line-height: 1.6;">
          <strong>What this means:</strong>
        </p>
        <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
          <li>✅ Your posts now earn real crypto rewards (HIVE tokens)</li>
          <li>✅ You can vote on other people's content</li>
          <li>✅ You're now part of the Hive blockchain community</li>
          <li>✅ Full access to the decentralized web</li>
        </ul>
      </div>
      `}

      <!-- Critical Warning -->
      <div style="background-color: #d32f2f; padding: 20px; border-radius: 10px; margin-bottom: 25px; text-align: center;">
        <h3 style="margin: 0 0 10px; color: #fff; font-size: 20px;">⚠️ CRITICAL: Save Your Keys!</h3>
        <p style="margin: 0; color: #fff; font-weight: bold; line-height: 1.6;">
          Your private keys are the ONLY way to access your account.<br>
          We cannot recover them if lost. Ever.
        </p>
      </div>

      <!-- Account Details -->
      <div style="background-color: #2a2a2a; border: 2px solid #4CAF50; border-radius: 10px; padding: 20px; margin-bottom: 25px;">
        <h3 style="color: #4CAF50; margin-top: 0;">Your New Hive Account</h3>
        <p style="margin: 10px 0;">
          <strong style="color: #4CAF50;">Username:</strong><br>
          <span style="font-size: 18px; font-family: monospace; color: #fff;">@${username}</span>
        </p>
        <p style="margin: 10px 0;">
          <strong style="color: #4CAF50;">Sponsored by:</strong><br>
          <span style="font-size: 16px;">@${sponsorUsername}</span>
        </p>
        <p style="margin: 10px 0;">
          <strong style="color: #4CAF50;">Status:</strong><br>
          <span style="color: #4CAF50; font-weight: bold;">Active & Ready to Earn!</span>
        </p>
      </div>

      <!-- What's Next -->
      <div style="background-color: #2a2a2a; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
        <h3 style="color: #4CAF50; margin-top: 0;">What's Next? 🚀</h3>
        <ol style="padding-left: 20px; line-height: 1.8; margin: 10px 0;">
          <li><strong>Download the attached file</strong> - Contains all your private keys</li>
          <li><strong>Save it securely</strong> - Use a password manager or encrypted storage</li>
          <li><strong>Import to Hive Keychain</strong> - Browser extension for easy login (optional but recommended)</li>
          <li><strong>Start posting and earning!</strong> - Your next post will earn Hive rewards</li>
        </ol>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${APP_CONFIG.BASE_URL}/settings/hive-account"
           style="display: inline-block; background: linear-gradient(135deg, #4CAF50, #45a049); color: #fff; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-size: 18px; font-weight: bold; box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);">
          View Account Settings
        </a>
        <p style="font-size: 14px; color: #888; margin-top: 15px;">
          Manage your keys, import to Keychain, and more
        </p>
      </div>

      <!-- Key Explanations -->
      <div style="background-color: #2a2a2a; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
        <h3 style="color: #4CAF50; margin-top: 0;">Understanding Your Keys 🔑</h3>
        ${isPartialBackup ? `
        <p style="margin: 10px 0; line-height: 1.6;">
          This backup contains only your <strong>posting key</strong>:
        </p>
        <div style="margin: 15px 0; padding: 15px; background-color: #1a1a1a; border-left: 3px solid #4CAF50; border-radius: 5px;">
          <p style="margin: 0; color: #4CAF50; font-weight: bold;">Posting Key (Most Used)</p>
          <p style="margin: 5px 0 0; font-size: 14px; line-height: 1.6;">
            Use this for daily activities: posting, commenting, voting. This is stored securely in your Skatehive account.
          </p>
        </div>
        <p style="margin: 10px 0; font-size: 14px; color: #FFA726; line-height: 1.6;">
          <strong>Note:</strong> Your other keys (owner, active, memo) were never stored by the system for security reasons. If you need them, contact your sponsor @${sponsorUsername}.
        </p>
        ` : `
        <p style="margin: 10px 0; line-height: 1.6;">
          Your Hive account has 4 different keys, each with different permissions:
        </p>

        <div style="margin: 15px 0; padding: 15px; background-color: #1a1a1a; border-left: 3px solid #4CAF50; border-radius: 5px;">
          <p style="margin: 0; color: #4CAF50; font-weight: bold;">Posting Key (Most Used)</p>
          <p style="margin: 5px 0 0; font-size: 14px; line-height: 1.6;">
            Use this for daily activities: posting, commenting, voting. This is stored securely in your Skatehive account.
          </p>
        </div>

        <div style="margin: 15px 0; padding: 15px; background-color: #1a1a1a; border-left: 3px solid #FFA726; border-radius: 5px;">
          <p style="margin: 0; color: #FFA726; font-weight: bold;">Active Key (Important)</p>
          <p style="margin: 5px 0 0; font-size: 14px; line-height: 1.6;">
            Use for transfers, trading, and power up/down. Keep this safe!
          </p>
        </div>

        <div style="margin: 15px 0; padding: 15px; background-color: #1a1a1a; border-left: 3px solid #42A5F5; border-radius: 5px;">
          <p style="margin: 0; color: #42A5F5; font-weight: bold;">Memo Key (Messages)</p>
          <p style="margin: 5px 0 0; font-size: 14px; line-height: 1.6;">
            Use for encrypting messages and transfer memos.
          </p>
        </div>

        <div style="margin: 15px 0; padding: 15px; background-color: #1a1a1a; border-left: 3px solid #EF5350; border-radius: 5px;">
          <p style="margin: 0; color: #EF5350; font-weight: bold;">Owner Key (Most Powerful)</p>
          <p style="margin: 5px 0 0; font-size: 14px; line-height: 1.6;">
            Account recovery and changing other keys. Store this offline! Never use it for daily activities.
          </p>
        </div>
        `}
      </div>

      <!-- Security Best Practices -->
      <div style="background-color: #2a2a2a; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
        <h3 style="color: #4CAF50; margin-top: 0;">Security Best Practices 🔒</h3>
        <ul style="padding-left: 20px; line-height: 1.8; margin: 10px 0;">
          <li>✅ Never share your private keys with anyone (not even Skatehive admins)</li>
          <li>✅ Use Hive Keychain browser extension for secure key storage</li>
          <li>✅ Keep multiple backups in secure locations (password manager, encrypted USB)</li>
          <li>✅ Only use your posting key for everyday activities</li>
          <li>✅ Store your owner key offline (write it down and keep it safe)</li>
          <li>❌ Never enter your keys on suspicious websites</li>
          <li>❌ Don't store keys in plain text files on your computer</li>
        </ul>
      </div>

      <!-- How to Import to Keychain -->
      <div style="background-color: #2a2a2a; padding: 20px; border-radius: 10px; margin-bottom: 25px;">
        <h3 style="color: #4CAF50; margin-top: 0;">Import to Hive Keychain (Optional) 🔗</h3>
        <ol style="padding-left: 20px; line-height: 1.8; margin: 10px 0;">
          <li>Install Hive Keychain browser extension: <a href="https://hive-keychain.com/" style="color: #4CAF50;">hive-keychain.com</a></li>
          <li>Click the Keychain icon in your browser</li>
          <li>Click "Add Account"</li>
          <li>Enter your username: <strong>@${username}</strong></li>
          <li>Import your keys from the attached file</li>
          <li>Done! You can now use Keychain for secure transactions</li>
        </ol>
        <p style="margin: 10px 0; font-size: 14px; color: #888;">
          Note: Even with Keychain, you should keep the backup file safe!
        </p>
      </div>

      <!-- Support Section -->
      <div style="background-color: #2a2a2a; padding: 20px; border-radius: 10px;">
        <h3 style="color: #4CAF50; margin-top: 0;">Need Help? 🙋</h3>
        <p style="margin: 10px 0; line-height: 1.6;">
          Questions about your new account? Join our community:
        </p>
        <ul style="padding-left: 20px; line-height: 1.8; margin: 10px 0;">
          <li><a href="https://discord.gg/skatehive" style="color: #4CAF50;">Discord</a> - Live chat with the community</li>
          <li><a href="${APP_CONFIG.BASE_URL}/docs/hive-guide" style="color: #4CAF50;">Hive Getting Started Guide</a> - Learn the basics</li>
          <li><a href="https://peakd.com/@${username}" style="color: #4CAF50;">View Your Hive Profile</a> - See how it looks</li>
        </ul>
      </div>

    </div>

    <!-- Footer -->
    <div style="background-color: #0a0a0a; color: #888; text-align: center; padding: 25px; font-size: 14px;">
      <p style="margin: 0 0 10px;">
        This email contains your Hive account credentials. Keep it secure!
      </p>
      <p style="margin: 10px 0;">
        <strong>Remember:</strong> Skatehive staff will never ask for your private keys.
      </p>
      <p style="margin: 20px 0 0;">
        <a href="${APP_CONFIG.BASE_URL}/" style="color: #4CAF50; text-decoration: none;">
          🛹 Skatehive.app
        </a>
      </p>
    </div>

  </div>
</div>
`;

  return template;
}

/**
 * Generates plain text version of the sponsorship email
 * For email clients that don't support HTML
 */
export function getSponsorshipEmailText(
  username: string,
  sponsorUsername: string,
  keys: HiveAccountKeys,
  isBackup = false,
  isPartialBackup = false
): string {
  const header = isBackup
    ? isPartialBackup
      ? `🔑 HIVE KEY BACKUP (POSTING KEY ONLY)\n\nBackup for @${username}\n\n⚠️ PARTIAL BACKUP NOTICE:\nThis backup contains only your POSTING KEY.\nOther keys (owner, active, memo) were not stored and cannot be recovered.\nContact your sponsor @${sponsorUsername} if you need other keys.`
      : `🔑 HIVE KEY BACKUP\n\nBackup for @${username}\n\nThis is a backup of your Hive account keys.\nStore this securely in case you need to recover your account.`
    : `🎉 YOUR HIVE ACCOUNT IS READY!\n\nWelcome to Hive, @${username}!\n\nCONGRATULATIONS!\nYou've been sponsored by @${sponsorUsername} and now have a full Hive account!`;

  return `
${header}

WHAT THIS MEANS:
✅ Your posts now earn real crypto rewards (HIVE tokens)
✅ You can vote on other people's content
✅ You're now part of the Hive blockchain community
✅ Full access to the decentralized web

⚠️ CRITICAL: SAVE YOUR KEYS!
Your private keys are the ONLY way to access your account.
We cannot recover them if lost. Ever.

YOUR NEW HIVE ACCOUNT:
Username: @${username}
Sponsored by: @${sponsorUsername}
Status: Active & Ready to Earn!

WHAT'S NEXT?
1. Download the attached file (contains all your private keys)
2. Save it securely (password manager or encrypted storage)
3. Import to Hive Keychain (optional but recommended)
4. Start posting and earning!

${isPartialBackup ? `
ABOUT YOUR POSTING KEY:
Posting Key: Use for daily activities (posting, commenting, voting)
This is the only key stored securely in your Skatehive account.

NOTE: Other keys (owner, active, memo) were not stored by the system.
Contact your sponsor @${sponsorUsername} if you need them.
` : `
UNDERSTANDING YOUR KEYS:

Posting Key: Use for daily activities (posting, commenting, voting)
Active Key: Use for transfers, trading, power up/down
Memo Key: Use for encrypting messages
Owner Key: Account recovery and changing keys (store offline!)
`}

SECURITY BEST PRACTICES:
✅ Never share your keys with anyone
✅ Use Hive Keychain for secure storage
✅ Keep multiple backups in secure locations
✅ Only use posting key for everyday activities
❌ Never enter keys on suspicious websites

IMPORT TO HIVE KEYCHAIN:
1. Install Hive Keychain: https://hive-keychain.com/
2. Click Keychain icon → Add Account
3. Enter username: @${username}
4. Import keys from attached file

NEED HELP?
Discord: https://discord.gg/skatehive
Hive Guide: ${APP_CONFIG.BASE_URL}/docs/hive-guide
Your Profile: https://peakd.com/@${username}

Remember: Skatehive staff will never ask for your private keys!

🛹 Skatehive.app
`;
}
