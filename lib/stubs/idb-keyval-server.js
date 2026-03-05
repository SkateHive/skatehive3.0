/**
 * Server-side stub for idb-keyval.
 *
 * idb-keyval calls `indexedDB.open()` at the module/top level, which
 * crashes in Node.js (no indexedDB global).  Webpack bundles it into
 * shared server chunks even when the consuming component uses
 * `dynamic(() => import(…), { ssr: false })`.
 *
 * This stub exports the same public API but every operation is a no-op
 * that resolves to `undefined`.  Auth-kit will simply see "no persisted
 * state" and fall through to defaults — which is the correct behaviour
 * on the server.
 */

// --- helpers ----------------------------------------------------------------

function noopStore(txMode, callback) {
  // Simulate an empty object store
  const fakeStore = {
    get:          () => fakeReq(undefined),
    getAll:       () => fakeReq([]),
    getAllKeys:    () => fakeReq([]),
    put:          () => fakeReq(undefined),
    add:          () => fakeReq(undefined),
    delete:       () => fakeReq(undefined),
    clear:        () => fakeReq(undefined),
    count:        () => fakeReq(0),
    openCursor:   () => fakeReq(null),
    openKeyCursor:() => fakeReq(null),
  };
  return Promise.resolve(callback(fakeStore));
}

function fakeReq(result) {
  return { result, onsuccess: null, onerror: null };
}

// --- public API (mirrors idb-keyval 6.x) ------------------------------------

export function createStore(_dbName, _storeName) {
  return noopStore;
}

export function promisifyRequest(request) {
  return Promise.resolve(request?.result);
}

export function get(_key, _customStore) {
  return Promise.resolve(undefined);
}

export function set(_key, _value, _customStore) {
  return Promise.resolve();
}

export function setMany(_entries, _customStore) {
  return Promise.resolve();
}

export function getMany(_keys, _customStore) {
  return Promise.resolve(_keys.map(() => undefined));
}

export function update(_key, _updater, _customStore) {
  return Promise.resolve();
}

export function del(_key, _customStore) {
  return Promise.resolve();
}

export function delMany(_keys, _customStore) {
  return Promise.resolve();
}

export function clear(_customStore) {
  return Promise.resolve();
}

export function keys(_customStore) {
  return Promise.resolve([]);
}

export function values(_customStore) {
  return Promise.resolve([]);
}

export function entries(_customStore) {
  return Promise.resolve([]);
}
