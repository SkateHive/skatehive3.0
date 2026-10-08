import { Metadata } from "next";
import WalletLegalDocument, {
  WalletLegalSection,
} from "@/components/wallet/WalletLegalDocument";

export const metadata: Metadata = {
  title: "Wallet Terms of Service",
  description:
    "Terms of Service for Skatehive Wallet, the self-custodial Hive and EVM browser wallet of the Skatehive community.",
};

const sections: WalletLegalSection[] = [
  {
    title: "Agreement",
    paragraphs: [
      'These Terms of Service ("Terms") govern your use of Skatehive Wallet (the "Wallet"), a browser extension published by Skatehive ("we", "our", "us"). By creating a password in the Wallet or using it, you agree to these Terms. If you do not agree, do not use the Wallet.',
      "You must be old enough to enter into a binding agreement where you live (at least 18 in most places), and you must be allowed to use crypto-asset software under the laws that apply to you.",
    ],
  },
  {
    title: "A self-custodial wallet",
    paragraphs: [
      "The Wallet is software that runs on your device. It lets you hold Hive and EVM accounts, sign transactions and connect to decentralized applications. We never hold your funds and we never have access to your keys.",
    ],
    items: [
      "Your private keys and seed phrases are encrypted with your password and stored only on your device.",
      "We cannot recover your password, keys or seed phrase. If you lose them, you may lose access to your assets forever.",
      "Back up your keys and seed phrases somewhere safe, outside the Wallet.",
    ],
  },
  {
    title: "Transactions",
    paragraphs: [
      "Every transaction you approve is signed on your device and broadcast to a public blockchain. Blockchain transactions are public and cannot be reversed or cancelled by us. Always check the recipient, amount, network and the website asking for your signature before you confirm.",
    ],
  },
  {
    title: "Third-party services",
    paragraphs: [
      "To show balances, prices and history, and to offer swaps or purchases, the Wallet talks to services we do not operate. These include Hive and EVM network nodes, block explorers, price feeds, HiveAuth, the Hive Keychain backend services the Wallet is built on, and swap or payment providers. Those services have their own terms, fees and privacy policies, and we are not responsible for them.",
    ],
  },
  {
    title: "Fees",
    paragraphs: [
      <>
        Skatehive Wallet is free to use. Network fees and any third-party or
        swap fees are described on the{" "}
        <a href="/wallet/fees">Wallet Fees page</a>, and the Wallet shows
        them before you confirm a transaction.
      </>,
    ],
  },
  {
    title: "Acceptable use",
    paragraphs: ["You agree not to use the Wallet to:"],
    items: [
      "break any law or sanctions that apply to you;",
      "fund or launder the proceeds of illegal activity;",
      "attack, reverse engineer for malicious purposes, or disrupt the Wallet or the networks it connects to.",
    ],
  },
  {
    title: "No financial advice",
    paragraphs: [
      "Nothing in the Wallet is financial, investment, legal or tax advice. Crypto assets are volatile and you can lose money. You are responsible for your own decisions and for any taxes that apply to you.",
    ],
  },
  {
    title: "Open source",
    paragraphs: [
      "Skatehive Wallet is open-source software released under the MIT License. It is built on the open-source Hive Keychain codebase; the original copyright notice is kept in the source code.",
    ],
  },
  {
    title: "No warranty",
    paragraphs: [
      'The Wallet is provided "as is" and "as available", without warranties of any kind. We do not guarantee that it will be error-free, secure or always available, or that third-party services will work.',
    ],
  },
  {
    title: "Limitation of liability",
    paragraphs: [
      "To the maximum extent allowed by law, Skatehive and its contributors are not liable for any lost funds, lost profits, or indirect or consequential damages that come from using or being unable to use the Wallet, including losses caused by lost keys, mistaken transactions, malicious websites or third-party services.",
    ],
  },
  {
    title: "Changes",
    paragraphs: [
      "We may update these Terms. When we do, we will change the date at the top of this page. Continuing to use the Wallet after an update means you accept the new Terms.",
    ],
  },
];

export default function WalletTermsPage() {
  return (
    <WalletLegalDocument
      title="Skatehive Wallet Terms of Service"
      lastUpdated="October 8, 2026"
      summary="Skatehive Wallet is free, self-custodial software. Your keys stay on your device, nobody can recover them for you, and blockchain transactions are final."
      sections={sections}
    />
  );
}
