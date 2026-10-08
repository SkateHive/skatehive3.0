import { Metadata } from "next";
import WalletLegalDocument, {
  WalletLegalSection,
} from "@/components/wallet/WalletLegalDocument";

export const metadata: Metadata = {
  title: "Wallet Fees",
  description:
    "What you pay when using Skatehive Wallet: no wallet fee, network fees, and the fees of swap and payment providers.",
};

const sections: WalletLegalSection[] = [
  {
    title: "Skatehive Wallet fee",
    paragraphs: [
      "Skatehive does not charge a fee to install the Wallet, hold assets, send transfers, connect to websites or sign transactions.",
    ],
  },
  {
    title: "Network fees",
    items: [
      "Hive: transactions have no fee. They use Resource Credits, which come from your Hive Power.",
      "EVM networks (Base, Ethereum and others): every transaction pays gas to the network, not to Skatehive. The Wallet shows the estimated gas before you confirm, and you can pick a lower or higher speed.",
    ],
  },
  {
    title: "Swaps",
    paragraphs: [
      "Swaps are routed through third-party services: the Hive Keychain swap service for Hive assets, and LI.FI routes (quoted through Hive Keychain services) for EVM assets. Their quotes can include exchange or bridge fees, slippage, and a service fee from those providers.",
      "The Wallet shows the amount you will receive, after those fees, before you confirm. Skatehive does not add a fee on top of the quote.",
    ],
  },
  {
    title: "Buying and selling",
    paragraphs: [
      "If you buy or sell crypto with a card or bank transfer, the payment provider you choose sets and charges its own fees. They are shown by the provider before you pay.",
    ],
  },
  {
    title: "Creating a Hive account",
    paragraphs: [
      "Creating a new Hive account from an existing one costs the Hive network account creation fee, or uses a claimed account token. The Wallet shows the cost before you confirm.",
      "You can also pay for a new Hive account with crypto through the Hive Keychain account creation service. That service sets its own price, which is shown before you pay.",
    ],
  },
  {
    title: "Changes",
    paragraphs: [
      "If Skatehive ever adds a fee, we will list it on this page and show it in the Wallet before you confirm a transaction.",
    ],
  },
];

export default function WalletFeesPage() {
  return (
    <WalletLegalDocument
      title="Skatehive Wallet Fees"
      lastUpdated="October 8, 2026"
      summary="The Wallet is free. You only pay network gas on EVM chains, and the fees of the swap or payment providers you choose, always shown before you confirm."
      sections={sections}
    />
  );
}
