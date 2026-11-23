/**
 * Tracks the HiveAuth request waiting for approval in the user's wallet app.
 *
 * Aioha creates the HiveAuth request (login, challenge or transaction) and
 * emits an event with a `has://…` link. It is up to the site to open that link
 * (mobile) or show it as a QR code (desktop). Without a listener, nothing
 * happens until the request expires. That is the iPhone bug: Safari has no
 * Keychain extension, so HiveAuth is the only way in.
 *
 * Aioha has no "request finished" event, so the HiveAuth provider's methods
 * are wrapped to clear the pending request when their promise settles.
 * Reconnecting after Safari freezes the tab is handled inside Aioha
 * (it re-attaches the request on every poll).
 */

export type HiveAuthRequestKind = "login" | "challenge" | "sign";

export interface HiveAuthRequest {
  kind: HiveAuthRequestKind;
  /** `has://auth_req/…`, `has://challenge_req/…` or `has://sign_req/…` */
  payload: string;
  /** Epoch ms after which the request is no longer valid. */
  expire?: number;
  cancel: () => void;
}

type Listener = (request: HiveAuthRequest | null) => void;

interface AiohaLike {
  on(event: string, listener: (...args: any[]) => void): unknown;
}

const EVENTS: Record<string, HiveAuthRequestKind> = {
  hiveauth_login_request: "login",
  hiveauth_challenge_request: "challenge",
  hiveauth_sign_request: "sign",
};

const WRAPPED_METHODS = ["login", "signMessage", "signAndBroadcastTx"] as const;

let current: HiveAuthRequest | null = null;
/** HiveAuth calls still running; the request is cleared when the last settles. */
let inFlight = 0;
const listeners = new Set<Listener>();
const installed = new WeakSet<object>();

function set(request: HiveAuthRequest | null) {
  current = request;
  listeners.forEach((listener) => listener(current));
}

export function getHiveAuthRequest(): HiveAuthRequest | null {
  return current;
}

export function subscribeHiveAuthRequest(listener: Listener): () => void {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

/** Cancels the pending request (the wrapped call then rejects with "cancelled"). */
export function cancelHiveAuthRequest() {
  const request = current;
  set(null);
  request?.cancel();
}

/** Clears the pending request when it is no longer valid. */
export function expireHiveAuthRequest(now = Date.now()) {
  if (current?.expire && current.expire <= now) set(null);
}

export function installHiveAuthRequestTracking(aioha: AiohaLike) {
  if (installed.has(aioha)) return;
  installed.add(aioha);

  for (const [event, kind] of Object.entries(EVENTS)) {
    aioha.on(event, (payload: string, evt?: { expire?: number }, cancel?: () => void) => {
      if (typeof payload !== "string") return;
      set({
        kind,
        payload,
        expire: typeof evt?.expire === "number" ? evt.expire : undefined,
        cancel: typeof cancel === "function" ? cancel : () => {},
      });
    });
  }

  // `providers` is internal to Aioha (checked against @aioha/aioha 1.8). If it
  // moves, the modal still closes on cancel and on expiry.
  const provider = (aioha as any).providers?.hiveauth;
  if (!provider) return;
  for (const method of WRAPPED_METHODS) {
    const original = provider[method];
    if (typeof original !== "function") continue;
    provider[method] = async function (this: unknown, ...args: unknown[]) {
      inFlight += 1;
      try {
        return await original.apply(this, args);
      } finally {
        inFlight = Math.max(0, inFlight - 1);
        if (inFlight === 0) set(null);
      }
    };
  }
}

/** iPhone, iPad (including iPadOS reporting as a Mac) and Android browsers. */
export function isMobileBrowser(
  nav: Pick<Navigator, "userAgent" | "maxTouchPoints"> | undefined =
    typeof navigator === "undefined" ? undefined : navigator
): boolean {
  if (!nav) return false;
  const ua = nav.userAgent || "";
  if (/iPhone|iPad|iPod|Android/i.test(ua)) return true;
  return /Macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1;
}
