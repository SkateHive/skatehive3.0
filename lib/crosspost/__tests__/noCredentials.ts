/**
 * Import this FIRST in any test that exercises the publish paths.
 *
 * Those tests assert on deterministic failures ("Instagram is not configured",
 * "API key not configured"). If real credentials happen to be in the shell,
 * the same code would instead reach Meta and Neynar for real — a unit test run
 * could post to @skatehive.
 *
 * It has to be its own module rather than statements at the top of the test:
 * `import` declarations are hoisted and their modules evaluated before any
 * statement in the importing file, so clearing the environment inline would
 * happen too late to protect anything read at module scope. Modules are
 * evaluated in import order, so importing this first does run first.
 *
 * The names below are the real ones — see lib/instagram/graph.ts (getConfig)
 * and lib/farcaster/neynar.ts (getApiKey). Getting them wrong is silent: the
 * guard looks present and does nothing.
 */
const CREDENTIAL_ENV_VARS = [
  "INSTAGRAM_BUSINESS_ACCOUNT_ID",
  "INSTAGRAM_PAGE_ACCESS_TOKEN",
  "INSTAGRAM_GRAPH_HOST",
  "NEYNAR_API_KEY",
  "FARCASTER_APP_MNEMONIC",
  "FARCASTER_APP_FID",
];

for (const name of CREDENTIAL_ENV_VARS) {
  delete process.env[name];
}

export {};
