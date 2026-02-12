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
    webpack: (config, { isServer, dev }) => {
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
            }
        ];
    },
    async headers() {
        return [
            {
                // Apply headers to all routes
                source: '/(.*)',
                headers: [
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
        ];
    },
}

export default nextConfig;
