// HivePredict on-chain + API constants.
// Verified against @hivepredict account history and the public API manifest
// at https://hivepredict.app/api/public.

// Treasury / platform account that receives bet transfers and emits payouts.
export const HIVEPREDICT_ACCOUNT = "hivepredict";

// custom_json operation ids used by the platform.
export const OP_PLACE_PREDICTION = "hivepredict_place_prediction";
export const OP_CREATE_MARKET = "hivepredict_create_market";

// Read-only public API base (proxied server-side via /api/predictions).
export const HIVEPREDICT_API_BASE = "https://hivepredict.app/api";

// HivePredict brand red — used wherever the platform is credited. Kept as a
// constant (not a theme token) because it must not vary across themes.
export const HIVEPREDICT_BRAND_COLOR = "#E31337";
