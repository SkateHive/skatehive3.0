import {
  FaHome,
  FaBlog,
  FaCalendar,
  FaWallet,
  FaBullseye,
  FaMapMarkerAlt,
  FaBell,
  FaCog,
  FaEnvelope,
  FaTrophy,
  FaPen,
  FaShareAlt,
  FaGavel,
  FaUser,
  FaGift,
  FaGamepad,
  FaStore,
  FaBug,
} from "react-icons/fa";
import { PageResult } from "./types";
import { ETH_ADDRESSES } from "@/config/app.config";

// Platform configuration
export const SKATEHIVE_PLATFORM_REFERRER = ETH_ADDRESSES.SKATEHIVE_HOT;

export const STATIC_PAGES: PageResult[] = [
  {
    title: "Home",
    path: "/",
    description: "Skatehive homepage with latest content",
    icon: FaHome,
  },
  {
    title: "Blog",
    path: "/blog",
    description: "Read latest skateboarding articles and stories",
    icon: FaBlog,
  },
  {
    title: "Magazine",
    path: "/magazine",
    description: "Skatehive digital magazine",
    icon: FaCalendar,
  },
  {
    title: "Wallet",
    path: "/wallet",
    description: "Manage your crypto wallet and tokens",
    icon: FaWallet,
  },
  {
    title: "Skate Games",
    path: "/games",
    description: "Play free skateboarding games built by the community",
    icon: FaGamepad,
  },
  {
    title: "Quest for Stoken",
    path: "/games/quest-for-stoken",
    description: "The OG SkateHive skate game — play in your browser",
    icon: FaGamepad,
  },
  {
    title: "Lougnar",
    path: "/games/lougnar",
    description: "New SkateHive game by webgnar — play in your browser",
    icon: FaGamepad,
  },
  {
    title: "Bounties",
    path: "/bounties",
    description: "Explore skateboarding bounties and challenges",
    icon: FaBullseye,
  },
  {
    title: "Auction",
    path: "/auction",
    description: "Bid on exclusive skateboarding NFTs and collectibles",
    icon: FaGavel,
  },
  {
    title: "Skate Spots",
    path: "/map",
    description: "Discover skateboarding spots around the world",
    icon: FaMapMarkerAlt,
  },
  {
    title: "Skate Shops",
    path: "/skateshops",
    description: "Find local skateboard shops and gear stores",
    icon: FaStore,
  },
  {
    title: "Leaderboard",
    path: "/leaderboard",
    description: "Top performers in the Skatehive community",
    icon: FaTrophy,
  },
  {
    title: "Notifications",
    path: "/notifications",
    description: "View your notifications and updates",
    icon: FaBell,
  },
  {
    title: "Settings",
    path: "/settings",
    description: "Configure your account settings",
    icon: FaCog,
  },
  {
    title: "Invite Friends",
    path: "/invite",
    description: "Invite friends to join Skatehive",
    icon: FaEnvelope,
  },
  {
    title: "Create Post",
    path: "/compose",
    description: "Write a new post or article",
    icon: FaPen,
  },
  {
    title: "Share Content",
    path: "/share",
    description: "Share content with the community",
    icon: FaShareAlt,
  },
  {
    title: "DAO",
    path: "/dao",
    description: "Decentralized Autonomous Organization management",
    icon: FaUser,
  }
];

// Special commands that trigger modal actions
export const COMMAND_PAGES: PageResult[] = [
  {
    title: "Airdrop",
    path: "command:airdrop",
    description: "Open airdrop modal to distribute tokens",
    icon: FaGift,
  },
  {
    title: "Report",
    path: "command:report",
    description: "Report a bug",
    icon: FaBug,
  }
];

export const getPopularPages = () => {
  const popularStaticPages = STATIC_PAGES.filter((page) =>
    ["Home", "Blog", "Skate Games", "Bounties", "Leaderboard", "Create Post"].includes(
      page.title
    )
  );
  
  // Add airdrop command to popular pages
  const popularCommands = COMMAND_PAGES.filter((page) =>
    ["Airdrop"].includes(page.title)
  );
  
  return [...popularStaticPages, ...popularCommands];
};
