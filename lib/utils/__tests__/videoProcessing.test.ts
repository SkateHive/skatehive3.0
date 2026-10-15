import assert from 'node:assert/strict';
import { processVideoOnServer, SERVER_CONFIG } from '../videoProcessing';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'sessionStorage', { value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
}});
const originalFetch = globalThis.fetch;
const originalSetTimeout = globalThis.setTimeout;
const file = new File(['test-video'], 'video.mp4', { type: 'video/mp4' });
const goodHealth = { ok: true, capacity: { available: 1 } };
const calls: string[] = [];
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });

async function run() {
  try {
    // A failing worker must not prevent the alternate worker accepting a file.
    globalThis.fetch = async (input, init) => {
      const url = String(input);
      calls.push(url);
      if (url.startsWith(SERVER_CONFIG[0].url) && !url.includes('/macmini/')) {
        throw new TypeError('Failed to fetch');
      }
      return init?.method === 'POST' ? reply({ cid: 'QmAlternateWorker' }) : reply(goodHealth);
    };
    assert.equal((await processVideoOnServer(file)).hash, 'QmAlternateWorker');
    assert(calls.includes(`${SERVER_CONFIG[1].url}/transcode`));

    // Busy responses are transient and must not trip the first worker's circuit.
    storage.clear();
    globalThis.fetch = async (input, init) => {
      if (init?.method !== 'POST') return reply(goodHealth);
      return String(input) === `${SERVER_CONFIG[0].url}/transcode`
        ? reply({ error: 'busy' }, 503) : reply({ cid: 'QmBusyFallback' });
    };
    assert.equal((await processVideoOnServer(file)).hash, 'QmBusyFallback');
    assert.equal(storage.has(`circuit_${SERVER_CONFIG[0].key}`), false);

    // A 200 HTML/malformed response is not a healthy worker.
    storage.clear();
    let uploads = 0;
    globalThis.fetch = async (_input, init) => {
      if (init?.method === 'POST') uploads++;
      return new Response('<html>proxy error</html>');
    };
    assert.equal((await processVideoOnServer(file)).success, false);
    assert.equal(uploads, 0);

    // A body stalled after HTTP headers is aborted and fallback still runs.
    storage.clear();
    globalThis.setTimeout = ((fn: (...args: unknown[]) => void, ms?: number) =>
      originalSetTimeout(fn, ms === 5_000 ? 10 : ms)) as typeof setTimeout;
    globalThis.fetch = async (input, init) => {
      if (String(input) === `${SERVER_CONFIG[0].url}/healthz`) {
        return { ok: true, json: () => new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }) } as Response;
      }
      return init?.method === 'POST' ? reply({ cid: 'QmAfterStall' }) : reply(goodHealth);
    };
    assert.equal((await processVideoOnServer(file)).hash, 'QmAfterStall');

    // A URL without a CID must not produce a successful /ipfs/undefined result.
    storage.clear();
    globalThis.fetch = async (_input, init) => init?.method === 'POST'
      ? reply({ gatewayUrl: 'https://example.com/video' }) : reply(goodHealth);
    assert.equal((await processVideoOnServer(file)).success, false);
    console.log('PASS: offline, busy, invalid health, stalled body and invalid result');
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
