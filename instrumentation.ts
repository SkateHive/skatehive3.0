/**
 * Next.js Instrumentation — runs once when the server starts.
 *
 * We polyfill `indexedDB` on the server so that libraries like
 * `idb-keyval` (used by @farcaster/auth-kit) don't crash with
 * "ReferenceError: indexedDB is not defined" during SSR.
 *
 * The polyfill is intentionally minimal: every operation resolves
 * to `undefined` / no-ops. Auth-kit will simply find no persisted
 * state on the server and fall through to its defaults, which is
 * the correct behaviour.
 */

function noopRequest(result: any = undefined): IDBRequest {
  const req = {
    result,
    error: null,
    source: null,
    transaction: null,
    readyState: "done" as IDBRequestReadyState,
    onsuccess: null as any,
    onerror: null as any,
    onupgradeneeded: null as any,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    oncomplete: null as any,
    onabort: null as any,
  };

  // Fire onsuccess asynchronously so callers that set handlers after
  // the call still work.
  queueMicrotask(() => {
    req.onsuccess?.({ target: req } as any);
    req.oncomplete?.({ target: req } as any);
  });

  return req as unknown as IDBRequest;
}

function noopObjectStore(): IDBObjectStore {
  return {
    get: () => noopRequest(undefined),
    getAll: () => noopRequest([]),
    put: () => noopRequest(undefined),
    add: () => noopRequest(undefined),
    delete: () => noopRequest(undefined),
    clear: () => noopRequest(undefined),
    count: () => noopRequest(0),
    openCursor: () => noopRequest(null),
    openKeyCursor: () => noopRequest(null),
    getKey: () => noopRequest(undefined),
    getAllKeys: () => noopRequest([]),
    index: () => ({}) as any,
    createIndex: () => ({}) as any,
    deleteIndex: () => {},
    name: "",
    keyPath: "",
    indexNames: { length: 0, contains: () => false, item: () => null } as any,
    transaction: {} as any,
    autoIncrement: false,
  } as unknown as IDBObjectStore;
}

function noopTransaction(): IDBTransaction {
  return {
    objectStore: () => noopObjectStore(),
    abort: () => {},
    commit: () => {},
    oncomplete: null,
    onerror: null,
    onabort: null,
    db: {} as any,
    durability: "default",
    error: null,
    mode: "readonly" as IDBTransactionMode,
    objectStoreNames: { length: 0, contains: () => false, item: () => null } as any,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as IDBTransaction;
}

function noopDB(): IDBDatabase {
  return {
    createObjectStore: () => noopObjectStore(),
    deleteObjectStore: () => {},
    transaction: () => noopTransaction(),
    close: () => {},
    name: "",
    version: 1,
    objectStoreNames: { length: 0, contains: () => false, item: () => null } as any,
    onabort: null,
    onclose: null,
    onerror: null,
    onversionchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as unknown as IDBDatabase;
}

export async function register() {
  if (typeof globalThis.indexedDB === "undefined") {
    (globalThis as any).indexedDB = {
      open: (_name?: string, _version?: number) => noopRequest(noopDB()),
      deleteDatabase: () => noopRequest(undefined),
      databases: async () => [],
      cmp: () => 0,
    };
  }
}
