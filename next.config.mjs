import { fileURLToPath } from 'url';
import { dirname, resolve as pathResolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ---------------------------------------------------------------------------
// Server-side polyfills for browser-only globals.
//
// Some dependencies (e.g. @farcaster/auth-kit → idb-keyval) access
// `indexedDB` or `localStorage` at the module/top-level.  When Next.js
// bundles them into a server chunk or prerenders pages, these globals
// don't exist and the process crashes.
//
// We shim them here (before any Next.js code runs) so that the calls
// silently return empty/no-op values instead of throwing.
// ---------------------------------------------------------------------------

if (typeof globalThis.indexedDB === "undefined") {
  const noop = () => {};
  const noopReq = (result) => {
    const r = { result, error: null, onsuccess: null, onerror: null, oncomplete: null, onupgradeneeded: null };
    queueMicrotask(() => { r.onsuccess?.({ target: r }); r.oncomplete?.({ target: r }); });
    return r;
  };
  const noopStore = () => ({
    get: () => noopReq(undefined), put: () => noopReq(), delete: () => noopReq(),
    getAll: () => noopReq([]), clear: () => noopReq(), count: () => noopReq(0),
    openCursor: () => noopReq(null), openKeyCursor: () => noopReq(null),
  });
  const noopTx = () => ({ objectStore: noopStore, abort: noop, commit: noop, oncomplete: null, onerror: null, onabort: null });
  const noopDB = () => ({
    createObjectStore: noopStore, deleteObjectStore: noop,
    transaction: noopTx, close: noop,
    name: "", version: 1, objectStoreNames: { length: 0, contains: () => false },
    onclose: null, onabort: null, onerror: null, onversionchange: null,
  });
  globalThis.indexedDB = { open: () => noopReq(noopDB()), deleteDatabase: () => noopReq(), databases: async () => [], cmp: () => 0 };
}

if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage?.getItem !== "function") {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() { return store.size; },
  };
}

/** @type {import('next').NextConfig} */
const nextConfig = {
    // Production optimizations
    compress: true,
    poweredByHeader: false,
    reactStrictMode: true,

    // Image optimization domains
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.hive.blog',
            },
            {
                protocol: 'https',
                hostname: 'ipfs.skatehive.app',
            },
            {
                protocol: 'https',
                hostname: '**.supabase.co',
            },
            {
                protocol: 'https',
                hostname: 'i.ibb.co',
            },
        ],
    },

    experimental: {
        serverActions: {
            bodySizeLimit: '200mb', // Increase the body size limit for large video uploads
        },
    },
    webpack: (config, { isServer, dev, webpack }) => {
        // On the server, replace idb-keyval with a no-op stub so that
        // indexedDB.open() is never called.  The real idb-keyval will
        // still be used on the client.
        if (isServer) {
            config.resolve.alias = {
                ...config.resolve.alias,
                'idb-keyval': pathResolve(__dirname, 'lib/stubs/idb-keyval-server.js'),
            };

            // Polyfill localStorage for prerender workers — Chakra UI's
            // color-mode script accesses localStorage at module level,
            // crashing static generation.  BannerPlugin injects this into
            // every server chunk so it runs before any Chakra code.
            config.plugins.push(
                new webpack.BannerPlugin({
                    banner: [
                        'if(typeof globalThis.localStorage==="undefined"||typeof globalThis.localStorage.getItem!=="function"){',
                        '  var _ls={};',
                        '  globalThis.localStorage={',
                        '    getItem:function(k){return Object.prototype.hasOwnProperty.call(_ls,k)?_ls[k]:null},',
                        '    setItem:function(k,v){_ls[k]=String(v)},',
                        '    removeItem:function(k){delete _ls[k]},',
                        '    clear:function(){_ls={}},',
                        '    key:function(i){return Object.keys(_ls)[i]||null},',
                        '    get length(){return Object.keys(_ls).length}',
                        '  };',
                        '}',
                    ].join(''),
                    raw: true,
                    entryOnly: false,
                }),
            );
        }

        if (!isServer) {
            config.resolve.fallback = {
                fs: false,
                net: false,
                tls: false,
                crypto: false,
                stream: false,
                buffer: false,
                util: false,
                assert: false,
                url: false,
                os: false,
                path: false,
                memcpy: false,
                'pino-pretty': false,
            };
        }
        
        // Remove console statements in production
        if (!dev) {
            config.optimization = {
                ...config.optimization,
                usedExports: true,
                sideEffects: false,
                minimize: true,
                minimizer: [
                    ...(config.optimization.minimizer || []),
                ].map((minimizer) => {
                    if (minimizer.constructor.name === 'TerserPlugin') {
                        return Object.assign({}, minimizer, {
                            options: {
                                ...minimizer.options,
                                terserOptions: {
                                    ...minimizer.options?.terserOptions,
                                    compress: {
                                        ...minimizer.options?.terserOptions?.compress,
                                        drop_console: true,
                                        drop_debugger: true,
                                    },
                                },
                            },
                        });
                    }
                    return minimizer;
                }),
            };
        }
        
        // Ignore specific problematic modules
        config.resolve.alias = {
            ...config.resolve.alias,
            'memcpy': false,
            'pino-pretty': false,
        };
        
        // Add externals for server-side only modules
        if (!isServer) {
            config.externals = config.externals || [];
            config.externals.push({
                'memcpy': 'memcpy',
                'pino-pretty': 'pino-pretty',
            });
        }
        
        return config;
    },
    async redirects() {
        return [
            // Legacy game route
            {
                source: '/game',
                destination: '/games',
                permanent: true,
            },
            // Profile redirects: /@username -> /user/username
            {
                source: '/@:username',
                destination: '/user/:username',
                permanent: true,
            },
            // Old profile page: /skater/author -> /user/author
            {
                source: '/skater/:author',
                destination: '/user/:author',
                permanent: true,
            },
            // Post redirects: /@author/permlink -> /post/author/permlink
            {
                source: '/@:author/:permlink',
                destination: '/post/:author/:permlink',
                permanent: true,
            },
            // Category post redirects: /category/@author/permlink -> /post/author/permlink
            {
                source: '/:category/@:author/:permlink',
                destination: '/post/:author/:permlink',
                permanent: true,
            },
            {
                source: '/post/hive-173115/@:author/:permlink',
                destination: '/post/:author/:permlink',
                permanent: true,
            },
            // Redirect /skatespots to /map
            {
                source: '/skatespots',
                destination: '/map',
                permanent: true,
            },
            // Hive community URL patterns (from Ecency/PeakD links)
            {
                source: '/hive-173115/@:author/:permlink',
                destination: '/post/:author/:permlink',
                permanent: true,
            },
            // Redirect /blog/tag URLs with encoded # (from old sitemap)
            {
                source: '/blog/tag/%23:tag',
                destination: '/blog/tag/:tag',
                permanent: true,
            }
        ];
    },
    async headers() {
        // Block search engine indexing on non-production deployments
        // (dev.skatehive.app, preview branches, etc.) to avoid duplicate content
        const isProduction = process.env.VERCEL_ENV === 'production';
        const noIndexHeaders = !isProduction ? [
            {
                key: 'X-Robots-Tag',
                value: 'noindex, nofollow',
            },
        ] : [];

        return [
            {
                // Apply headers to all routes
                source: '/(.*)',
                headers: [
                    ...noIndexHeaders,
                    {
                        // Allow embedding in any iframe (for Farcaster frames and embeds)
                        key: 'X-Frame-Options',
                        value: 'ALLOWALL',
                    },
                    {
                        // Alternative modern approach - allow all origins to embed
                        key: 'Content-Security-Policy',
                        value: "frame-ancestors *;",
                    },
                    {
                        // Prevent MIME type sniffing
                        key: 'X-Content-Type-Options',
                        value: 'nosniff',
                    },
                    {
                        // Enable XSS protection
                        key: 'X-XSS-Protection',
                        value: '1; mode=block',
                    },
                    {
                        // Referrer policy for privacy
                        key: 'Referrer-Policy',
                        value: 'strict-origin-when-cross-origin',
                    },
                    {
                        // Permissions policy
                        key: 'Permissions-Policy',
                        value: 'camera=(), microphone=(), geolocation=(self)',
                    },
                    {
                        // Strict Transport Security (force HTTPS)
                        key: 'Strict-Transport-Security',
                        value: 'max-age=31536000; includeSubDomains; preload',
                    },
                ],
            },
            {
                // Cache static assets (images, fonts) for 1 year
                source: '/(.*)\\.(jpg|jpeg|png|gif|webp|svg|woff|woff2|ttf|eot|ico)$',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            {
                // Cache JS and CSS chunks for 1 year (Next.js adds hash to filenames)
                source: '/_next/static/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=31536000, immutable',
                    },
                ],
            },
            {
                // Cache public folder assets for 1 day
                source: '/public/:path*',
                headers: [
                    {
                        key: 'Cache-Control',
                        value: 'public, max-age=86400, stale-while-revalidate=604800',
                    },
                ],
            },
        ];
    },
}

export default nextConfig;
