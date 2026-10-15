import { Metadata } from "next";
import WalletLegalDocument, {
  WalletLegalSection,
} from "@/components/wallet/WalletLegalDocument";

export const metadata: Metadata = {
  title: "Wallet Privacy Policy",
  description:
    "How Skatehive Wallet handles your data: keys stay on your device, no tracking, and the third-party services the wallet talks to.",
};

const sections: WalletLegalSection[] = [
  {
    title: "Scope",
    paragraphs: [
      "This policy covers the Skatehive Wallet browser extension. The Skatehive website and mobile app are covered by the general Skatehive Privacy Policy at skatehive.app/privacypolicy.",
    ],
  },
  {
    title: "What stays on your device",
    paragraphs: [
      "The Wallet stores the following in your browser's extension storage. We have no copy of it:",
    ],
    items: [
      "your Hive keys and EVM seed phrases and private keys, encrypted with your password;",
      "your account names and public addresses, contacts and connected websites;",
      "your settings, such as theme, language, networks and auto-lock.",
    ],
    footer:
      "Your password is never stored or sent anywhere. Removing the extension or using “Clear all data” deletes this information from your browser.",
  },
  {
    title: "What we do not collect",
    items: [
      "We do not run analytics or tracking in the Wallet.",
      "We do not collect your name, email or phone number.",
      "We never receive your password, private keys or seed phrases.",
      "We do not sell or share data for advertising.",
    ],
  },
  {
    title: "Services the Wallet talks to",
    paragraphs: [
      "To work, the Wallet sends requests to services that we do not operate. These requests can include your public account names or addresses and, like any internet request, your IP address. They never include your keys or password.",
    ],
    items: [
      "Hive and EVM network nodes (RPC), to read balances and broadcast your signed transactions;",
      "Hive Keychain backend services (api.hive-keychain.com, evm.hive-keychain.com, swap.hive-keychain.com, api-multisig.hive-keychain.com), which the Wallet is built on, for prices, token and NFT data, transaction history, security checks, swap quotes, multisig and paid account creation;",
      "price feeds such as CoinGecko, and LI.FI for EVM swap routes;",
      "block explorers such as Blockscout, and chainlist.org and icons.llamao.fi for EVM network details and icons;",
      "images.hive.blog and files.peakd.com for profile pictures and images, IPFS gateways for NFT images, Gravatar for account avatars, and placehold.co for placeholder images;",
      "Google's favicon service, which receives the domain name of each website you connect, to show that website's icon;",
      "HiveAuth, only if you use the keyless mode;",
      "the PeakD notifications service (hivehub.dev), only if you turn on notifications;",
      "swap and payment providers, only when you start a swap or purchase with them.",
    ],
    footer:
      "Each of these services has its own privacy policy. Public blockchain data, like your account name, balances and transactions, is visible to everyone by design.",
  },
  {
    title: "Websites you connect to",
    paragraphs: [
      "When a website asks to connect or to sign something, the Wallet shares only what you approve, such as your public address or a signed transaction. You can review and remove connected websites in Settings.",
    ],
  },
  {
    title: "Browser permissions",
    items: [
      "Access to websites: lets Hive and EVM websites request signatures from the Wallet, and lets the \"Wallet links\" feature open the Wallet when you click a Hive signing link (such as hivesigner or hive:// links). The Wallet does not collect or send anywhere the content of the websites you visit.",
      "Scripting: adds the Wallet's connection script to websites, including tabs already open when the Wallet is installed or updated.",
      "Storage: keeps your encrypted data and settings.",
      "Offscreen: keeps the unlocked Wallet key in memory only while the Wallet is unlocked.",
      "Idle: locks the Wallet when your device locks or after the idle time you choose.",
      "Alarms: runs scheduled tasks such as auto-lock and the reward claims you turn on.",
      "Notifications: tells you when a transaction confirms.",
      "Side panel: lets you open the Wallet in the browser side panel.",
    ],
  },
  {
    title: "Children",
    paragraphs: [
      "The Wallet is not meant for children under 13, and we do not knowingly collect information from them.",
    ],
  },
  {
    title: "Changes",
    paragraphs: [
      "We may update this policy. When we do, we will change the date at the top of this page.",
    ],
  },
];

export default function WalletPrivacyPage() {
  return (
    <WalletLegalDocument
      title="Skatehive Wallet Privacy Policy"
      lastUpdated="October 8, 2026"
      summary="Your keys and settings stay encrypted on your device. The Wallet has no tracking, and it only talks to the networks and services it needs to work."
      sections={sections}
    />
  );
}
