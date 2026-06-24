/**
 * SkateHive Video Transcoding — canonical server registry.
 *
 * SINGLE SOURCE OF TRUTH for transcoding servers in the web app. Both the
 * upload fallback chain (lib/utils/videoProcessing.ts) and the status health
 * check (app/api/status/route.ts) derive from this list — keep it the only
 * place server URLs/order live.
 *
 * Kept in sync with the authoritative registry in the SkateHive API service
 * (services/skatehive-api/src/app/api/transcode/config.ts → TRANSCODE_SERVICES),
 * which powers https://api.skatehive.app/api/status. All servers run the same
 * video-transcoder codebase.
 *
 * Priority order: Mac Mini M4 → Oracle.
 * IMPORTANT: video blobs must be uploaded directly to transcoder hosts. Do not
 * proxy uploads through Vercel/API routes; serverless body limits turn normal
 * phone clips into 413 FUNCTION_PAYLOAD_TOO_LARGE failures before Mac Mini sees them.
 */

/** Stable identifier for a transcoding server, used across UI + upload chain. */
export type TranscodeServerKey = 'macmini' | 'oracle';

export interface TranscodeServer {
  /** Stable identifier used across UI + upload chain */
  key: TranscodeServerKey;
  /** Numeric priority — 1 is tried first */
  priority: number;
  /** Human-readable name — matches api.skatehive.app */
  name: string;
  /** Short display label for the fallback chain */
  label: 'PRIMARY' | 'SECONDARY';
  /** Emoji used in the upload terminal UI */
  emoji: string;
  /** Base URL — endpoints derive as `${baseUrl}/healthz|transcode|progress` */
  baseUrl: string;
  /** Health check endpoint */
  healthUrl: string;
  /** Transcode upload endpoint */
  transcodeUrl: string;
  /**
   * Route browser uploads through /api/video-proxy instead of going direct.
   * Required for Tailscale hosts which are reachable from Vercel but may be
   * CORS-restricted or unreachable from some browser networks.
   */
  useProxy: boolean;
  /** Operational note shown in status/diagnostics */
  note: string;
}

export const TRANSCODE_SERVERS: TranscodeServer[] = [
  {
    key: 'macmini',
    priority: 1,
    name: 'Mac Mini M4 (Primary)',
    label: 'PRIMARY',
    emoji: '🍎',
    baseUrl: 'https://minivlad.tail83ea3e.ts.net/video',
    healthUrl: 'https://minivlad.tail83ea3e.ts.net/video/healthz',
    transcodeUrl: 'https://minivlad.tail83ea3e.ts.net/video/transcode',
    useProxy: false, // Direct browser upload — avoids Vercel body limits
    note: 'Tailscale Funnel — direct upload, no Vercel proxy',
  },
  {
    key: 'oracle',
    priority: 2,
    name: 'Oracle (Secondary)',
    label: 'SECONDARY',
    emoji: '🔮',
    baseUrl: 'https://transcode.skatehive.app',
    healthUrl: 'https://transcode.skatehive.app/healthz',
    transcodeUrl: 'https://transcode.skatehive.app/transcode',
    useProxy: false, // Public endpoint — browser can POST directly
    note: 'Public IP — direct fallback upload',
  },
];
