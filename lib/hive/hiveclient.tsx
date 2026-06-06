import { Client } from "@hiveio/dhive"

// A bounded per-request timeout + fast failover keeps a single slow/stalled
// Hive node from holding a serverless function alive (on Fluid compute,
// wall-time is billed as provisioned-memory-seconds). If a node doesn't
// answer within the timeout, dhive rotates to the next address.
const HiveClient = new Client(
  [
    "https://api.hive.blog",
    "https://api.deathwing.me",
    "https://anyx.io",
    "https://techcoderx.com",
    "https://hive-api.arcange.eu",
    "https://hive-api.3speak.tv",
  ],
  {
    timeout: 5000, // ms before a request to a node is abandoned
    failoverThreshold: 2, // retries on a node before rotating to the next
  }
)

export default HiveClient
