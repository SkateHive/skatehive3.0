import { getLocalizedStrings } from "./localization";

import { APP_CONFIG } from "@/config/app.config";
import { escapeHtml } from "@/lib/email/escapeHtml";

export default function getMailTemplate_Invite(
  createdby: string,
  desiredUsername: string,
  masterPassword: string,
  keys: any,
  language: string
) {
  const localizedStrings = getLocalizedStrings(language);

  // The master password is whatever the caller chose when deriving the keys,
  // so none of these may reach the HTML raw.
  createdby = escapeHtml(createdby);
  desiredUsername = escapeHtml(desiredUsername);
  masterPassword = escapeHtml(masterPassword);

  // Replace placeholder in localized string
  const onboardedMessage = localizedStrings.onboardedMessage.replace('{createdby}', createdby);
  const enterDetailsStep = localizedStrings.enterDetailsStep.replace('{desiredUsername}', desiredUsername);

  const INVITE_MAIL_TEMPLATE = `
<div style="font-family: 'Segoe UI', sans-serif; background-color: ${localizedStrings.colors.background1}; color: ${localizedStrings.colors.foreground2}; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 30px auto; border-radius: 12px; overflow: hidden; box-shadow: 0 0 30px rgba(0, 0, 0, 0.7);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${localizedStrings.colors.foreground1}, ${localizedStrings.colors.highlightBackground}); padding: 30px; text-align: center;">
      <img src="https://docs.skatehive.app/img/skatehive.png" alt="Skate Hive" style="max-width: 80px;">
      <h1 style="margin: 10px 0 0; font-size: 26px;">${localizedStrings.welcomeMessage}</h1>
    </div>
    <!-- Body -->
    <div style="padding: 25px 30px;">
      <h2 style="color: ${localizedStrings.colors.foreground1};">${onboardedMessage}</h2>
      <p>${localizedStrings.introParagraph}</p>
      <!-- Essentials -->
      <div style="background-color: ${localizedStrings.colors.keyBackground}; border: 2px solid ${localizedStrings.colors.foreground1}; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; font-weight: bold; color: ${localizedStrings.colors.foreground1};">${localizedStrings.usernameLabel}</p>
        <p style="margin: 5px 0 15px; font-size: 14px;">${desiredUsername}</p>
        <p style="margin: 0; font-weight: bold; color: ${localizedStrings.colors.foreground1};">${localizedStrings.masterPasswordLabel}</p>
        <p style="margin: 5px 0; font-size: 14px;">${masterPassword}</p>
      </div>
      <!-- Step-by-step instructions -->
      <div style="background-color: ${localizedStrings.colors.keyBackground}; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <h3 style="color: ${localizedStrings.colors.foreground1}; margin-top: 0;">${localizedStrings.howToLoginTitle}</h3>
        <ol style="padding-left: 20px; line-height: 1.6;">
          <li>${localizedStrings.installKeychainStep}</li>
          <li>${localizedStrings.openKeychainStep}</li>
          <li>${enterDetailsStep}</li>
          <li>${localizedStrings.readyStep}</li>
        </ol>
      </div>
      <!-- Image Button (CTA) -->
      <div style="text-align: center; margin: 30px 0;">
        <a href="${localizedStrings.ctaLink}" target="_blank">
          <img src="https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/QmUkU1BL1yHfk9h33V1BXjBF1FpQKEhAcJxpzV2PixCfLi" alt="${localizedStrings.ctaAltText}" style="max-width: 100%; border-radius: 10px; box-shadow: 0 0 10px rgba(76, 175, 80, 0.5);">
        </a>
        <p style="font-size: 14px; color: ${localizedStrings.colors.helpText}; margin-top: 10px;">${localizedStrings.ctaHelpText}</p>
      </div>
    </div>
    <!-- Warning -->
    <div style="background-color: ${localizedStrings.colors.alertBackground}; padding: 10px; border-radius: 8px; text-align: center; font-weight: bold; color: #fff;">
      ${localizedStrings.warningMessage}
    </div>
    <!-- Key Explanation -->
    <div style="background-color: ${localizedStrings.colors.highlightBackground}; padding: 15px; border-radius: 8px; color: ${localizedStrings.colors.foreground2}; margin-top: 20px;">
      <h3 style="margin-top: 0; color: #fff;">${localizedStrings.keysExplanationTitle}</h3>
      <p>${localizedStrings.postingKeyDescription}</p>
      <p>${localizedStrings.activeKeyDescription}</p>
      <p>${localizedStrings.memoKeyDescription}</p>
      <p>${localizedStrings.ownerKeyDescription}</p>
    </div>
    <!-- Footer -->
    <div style="background-color: ${localizedStrings.colors.background2}; color: ${localizedStrings.colors.helpText}; text-align: center; padding: 20px; font-size: 14px;">
      <p style="margin: 20px 0 0;"><a href="${APP_CONFIG.BASE_URL}/" style="color: ${localizedStrings.colors.link};">${localizedStrings.footerLinkText}</a></p>
    </div>
  </div>
</div>
`;
  return INVITE_MAIL_TEMPLATE;
} 