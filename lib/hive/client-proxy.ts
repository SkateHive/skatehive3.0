/**
 * Hive Client Proxy
 *
 * Wraps HiveClient.call to use /api/hive proxy when running in browser
 * (avoids CORS errors when calling api.hive.blog directly). On the
 * browser path we also microbatch calls into JSON-RPC batches so a
 * feed of N snaps each kicking off their own `get_content` refresh
 * collapses into a single round trip.
 */

import HiveClient from "./hiveclient";

const BATCH_WINDOW_MS = 30;

interface PendingCall {
  method: string;
  params: unknown;
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}

let pendingBatch: PendingCall[] = [];
let batchTimer: ReturnType<typeof setTimeout> | null = null;

async function flushBatch() {
  const batch = pendingBatch;
  pendingBatch = [];
  batchTimer = null;

  if (batch.length === 0) return;

  // Fast path: single call → send as a single JSON-RPC request to keep
  // the proxy + Hive node behavior identical to pre-batching code.
  if (batch.length === 1) {
    const { method, params, resolve, reject } = batch[0];
    try {
      const response = await fetch("/api/hive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
      });
      const data = await response.json();
      if (data?.error) {
        reject(new Error(data.error.message || "Hive API error"));
      } else {
        resolve(data?.result);
      }
    } catch (err) {
      reject(err);
    }
    return;
  }

  // Batched path: send a JSON-RPC array. Hive nodes return an array of
  // responses keyed by request id; we resolve each pending call by its
  // own position.
  const requests = batch.map((c, idx) => ({
    jsonrpc: "2.0",
    method: c.method,
    params: c.params,
    id: idx,
  }));

  try {
    const response = await fetch("/api/hive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requests),
    });
    const data = await response.json();
    if (!Array.isArray(data)) {
      // Server returned a single error (e.g. 502 from proxy). Fail all
      // pending calls with the same error.
      const message = data?.error?.message || data?.error || "Hive API error";
      const err = new Error(typeof message === "string" ? message : "Hive API error");
      batch.forEach((c) => c.reject(err));
      return;
    }
    // Map responses back to callers by id. Hive may reorder array items
    // so we can't trust index alignment.
    const byId = new Map<number, any>();
    for (const r of data) {
      if (typeof r?.id === "number") byId.set(r.id, r);
    }
    batch.forEach((c, idx) => {
      const r = byId.get(idx);
      if (!r) {
        c.reject(new Error("Missing response in batch"));
      } else if (r.error) {
        c.reject(new Error(r.error.message || "Hive API error"));
      } else {
        c.resolve(r.result);
      }
    });
  } catch (err) {
    batch.forEach((c) => c.reject(err));
  }
}

/**
 * Call Hive API method
 * - Server-side: calls HiveClient directly (no batching needed; SSR
 *   calls are already serialized by Next).
 * - Client-side: queues into a microbatch flushed every 30ms.
 */
export async function callHiveApi(method: string, params: any): Promise<any> {
  const isBrowser = typeof window !== "undefined";

  if (!isBrowser) {
    return HiveClient.call(method as any, params as any);
  }

  return new Promise((resolve, reject) => {
    pendingBatch.push({ method, params, resolve, reject });
    if (!batchTimer) {
      batchTimer = setTimeout(flushBatch, BATCH_WINDOW_MS);
    }
  });
}
