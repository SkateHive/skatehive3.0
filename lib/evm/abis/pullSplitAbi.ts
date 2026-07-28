/**
 * Minimal ABI for a 0xSplits PullSplit V2.2 wallet.
 *
 * Only the surface the Skatehive swap-fee admin panel needs is declared here.
 * The `_split` tuple must match the on-chain split exactly (it is verified
 * against the stored `splitHash`), otherwise state-changing calls revert.
 *
 * `updateSplit`, `setPaused` and `transferOwnership` are included so the
 * panel can grow future admin actions without touching this file again.
 */

/** The SplitV2Lib.Split tuple, reused across functions and the event. */
export const SPLIT_TUPLE_COMPONENTS = [
  { name: "recipients", type: "address[]" },
  { name: "allocations", type: "uint256[]" },
  { name: "totalAllocation", type: "uint256" },
  { name: "distributionIncentive", type: "uint16" },
] as const;

export const PULL_SPLIT_ABI = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "splitHash",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "getSplitBalance",
    stateMutability: "view",
    inputs: [{ name: "token", type: "address" }],
    outputs: [
      { name: "splitBalance", type: "uint256" },
      { name: "warehouseBalance", type: "uint256" },
    ],
  },
  {
    type: "function",
    name: "distribute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_split", type: "tuple", components: SPLIT_TUPLE_COMPONENTS },
      { name: "_token", type: "address" },
      { name: "_distributor", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "updateSplit",
    stateMutability: "nonpayable",
    inputs: [{ name: "_split", type: "tuple", components: SPLIT_TUPLE_COMPONENTS }],
    outputs: [],
  },
  {
    type: "function",
    name: "setPaused",
    stateMutability: "nonpayable",
    inputs: [{ name: "_paused", type: "bool" }],
    outputs: [],
  },
  {
    type: "function",
    name: "transferOwnership",
    stateMutability: "nonpayable",
    inputs: [{ name: "_owner", type: "address" }],
    outputs: [],
  },
  {
    type: "event",
    name: "SplitUpdated",
    inputs: [
      { name: "_split", type: "tuple", indexed: false, components: SPLIT_TUPLE_COMPONENTS },
    ],
  },
  {
    type: "event",
    name: "SplitDistributed",
    inputs: [
      { name: "_token", type: "address", indexed: true },
      { name: "_distributor", type: "address", indexed: true },
      { name: "_amount", type: "uint256", indexed: false },
    ],
  },
] as const;
