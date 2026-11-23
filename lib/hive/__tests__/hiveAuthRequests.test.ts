import assert from "assert";
import {
  cancelHiveAuthRequest,
  expireHiveAuthRequest,
  getHiveAuthRequest,
  installHiveAuthRequestTracking,
  isMobileBrowser,
  subscribeHiveAuthRequest,
} from "../hiveAuthRequests";

/** A stand-in for Aioha whose HiveAuth calls settle when the test says so. */
function fakeAioha() {
  const handlers: Record<string, (...args: any[]) => void> = {};
  const pending: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];
  const call = (value: (self: any) => unknown) =>
    function (this: any) {
      return new Promise((resolve, reject) => {
        pending.push({ resolve: () => resolve(value(this)), reject });
      });
    };
  const aioha = {
    handlers,
    pending,
    on(event: string, listener: (...args: any[]) => void) {
      handlers[event] = listener;
    },
    providers: {
      hiveauth: {
        name: "hiveauth",
        login: call((self) => ({ success: true, self: self.name })),
        signMessage: call(() => ({ success: true })),
        signAndBroadcastTx: call(() => ({ success: true })),
      } as Record<string, any>,
    },
  };
  return aioha;
}

async function main() {
  const aioha = fakeAioha();
  const hiveauth = aioha.providers.hiveauth;
  installHiveAuthRequestTracking(aioha);
  installHiveAuthRequestTracking(aioha); // second install is a no-op

  const seen: Array<string | null> = [];
  const unsubscribe = subscribeHiveAuthRequest((r) => seen.push(r ? r.kind : null));
  assert.deepStrictEqual(seen, [null], "subscribe delivers the current state");

  // Login: the event opens the request, the settled promise clears it.
  const login = hiveauth.login("skater");
  aioha.handlers.hiveauth_login_request("has://auth_req/abc", { expire: 2000 }, () => {});
  assert.strictEqual(getHiveAuthRequest()?.payload, "has://auth_req/abc");
  assert.strictEqual(getHiveAuthRequest()?.kind, "login");
  aioha.pending.shift()!.resolve(null);
  const result: any = await login;
  assert.strictEqual(result.self, "hiveauth", "wrapped method keeps its `this`");
  assert.strictEqual(getHiveAuthRequest(), null, "settled login clears the request");

  // A rejected call clears it too, and the rejection still reaches the caller.
  const challenge = hiveauth.signMessage("msg");
  aioha.handlers.hiveauth_challenge_request("has://challenge_req/x", { expire: 2000 }, () => {});
  assert.strictEqual(getHiveAuthRequest()?.kind, "challenge");
  aioha.pending.shift()!.reject(new Error("cancelled"));
  await assert.rejects(challenge, /cancelled/);
  assert.strictEqual(getHiveAuthRequest(), null);

  // Two calls at once: the request stays until the last one settles.
  const first = hiveauth.signAndBroadcastTx({});
  const second = hiveauth.signAndBroadcastTx({});
  aioha.handlers.hiveauth_sign_request("has://sign_req/b", { expire: 2000 }, () => {});
  aioha.pending.shift()!.resolve(null);
  await first;
  assert.strictEqual(getHiveAuthRequest()?.payload, "has://sign_req/b", "still waiting on the second call");
  aioha.pending.shift()!.resolve(null);
  await second;
  assert.strictEqual(getHiveAuthRequest(), null);

  // Cancel calls Aioha's cancel callback and clears.
  let cancelled = false;
  aioha.handlers.hiveauth_sign_request("has://sign_req/y", { expire: 2000 }, () => {
    cancelled = true;
  });
  cancelHiveAuthRequest();
  assert.strictEqual(cancelled, true);
  assert.strictEqual(getHiveAuthRequest(), null);

  // Expiry clears only once the deadline passes.
  aioha.handlers.hiveauth_sign_request("has://sign_req/z", { expire: 2000 }, () => {});
  expireHiveAuthRequest(1999);
  assert.ok(getHiveAuthRequest(), "still valid before expire");
  expireHiveAuthRequest(2000);
  assert.strictEqual(getHiveAuthRequest(), null);

  unsubscribe();
  aioha.handlers.hiveauth_sign_request("has://sign_req/w", {}, () => {});
  assert.deepStrictEqual(
    seen,
    [null, "login", null, "challenge", null, "sign", null, "sign", null, "sign", null],
    "unsubscribed listener stops receiving"
  );
  cancelHiveAuthRequest();

  // Mobile detection
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
  const ipadOs = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36";
  const windowsTouch = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36";
  assert.strictEqual(isMobileBrowser({ userAgent: iphone, maxTouchPoints: 5 }), true);
  assert.strictEqual(isMobileBrowser({ userAgent: ipadOs, maxTouchPoints: 5 }), true, "iPadOS reports as Mac");
  assert.strictEqual(isMobileBrowser({ userAgent: ipadOs, maxTouchPoints: 0 }), false, "real Mac");
  assert.strictEqual(isMobileBrowser({ userAgent: android, maxTouchPoints: 5 }), true);
  assert.strictEqual(isMobileBrowser({ userAgent: windowsTouch, maxTouchPoints: 10 }), false, "touch laptop keeps desktop flow");
  assert.strictEqual(isMobileBrowser(undefined), false);

  console.log("hiveAuthRequests tests passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
