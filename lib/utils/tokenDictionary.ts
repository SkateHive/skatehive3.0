import { ERC20ABI } from './abis/ERC20ABI';
import { BOAR_ERC20_ADDRESS, GNARS_ERC20_ADDRESS, HIGHER_ERC20_ADDRESS, SKATEHIVE_ERC20_ADDRESS } from './constants';
import { ETH_ADDRESSES } from "@/config/app.config";

export interface TokenInfo {
  address: string;
  abi: readonly any[];
  tokenLogo: string;
  decimals?: number;
  network?: string;
}

export const tokenDictionary: { [key: string]: TokenInfo } = {
  HIGHER: {
    address: HIGHER_ERC20_ADDRESS,
    abi: ERC20ABI,
    tokenLogo: "/logos/higher.png",
    decimals: 18,
    network: "base"
  },
  SKATEHIVE: {
    address: SKATEHIVE_ERC20_ADDRESS,
    abi: ERC20ABI,
    tokenLogo: "/logos/SKATE_HIVE_CIRCLE.svg",
    decimals: 18,
    network: "base"
  },
  GNARS: {
    address: GNARS_ERC20_ADDRESS,
    abi: ERC20ABI,
    tokenLogo: "https://www.gnars.wtf/images/logo.png",
    decimals: 18,
    network: "base"
  },
  BOAR: {
    address: BOAR_ERC20_ADDRESS,
    abi: ERC20ABI,
    tokenLogo: "/logos/boar.jpg",
    decimals: 18,
    network: "base"
  },
  USDC: {
    address: ETH_ADDRESSES.USDC,
    abi: ERC20ABI,
    tokenLogo: "/logos/usdc.png",
    decimals: 6,
    network: "base"
  },
  HIVE: {
    address: '0xNATIVE_HIVE',
    abi: [],
    tokenLogo: "/logos/hiveLogo.png",
    network: "hive"
  },
  HBD: {
    address: '0xNATIVE_HBD',
    abi: [],
    tokenLogo: "/logos/hbd.svg",
    network: "hive"
  }
};
