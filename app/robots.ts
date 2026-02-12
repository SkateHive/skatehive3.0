import { MetadataRoute } from 'next';
import { APP_CONFIG } from '@/config/app.config';

const COMMON_DISALLOWS = [
    '/admin/',
    '/api/',
    '/compose/',
    '/settings/',
    '/notifications/',
    '/share/',
    '/wallet/',
    '/chat/',
    '/_next/',
    '/_vercel/',
    '/pages/',
    '/src/',
    '/ipfs/',
    '/coin/',
    '/notifications.db',
];

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: COMMON_DISALLOWS,
                crawlDelay: 1,
            },
            {
                userAgent: 'Googlebot',
                allow: '/',
                disallow: COMMON_DISALLOWS,
                crawlDelay: 0.5,
            },
            {
                userAgent: 'Bingbot',
                allow: '/',
                disallow: COMMON_DISALLOWS,
                crawlDelay: 1,
            }
        ],
        sitemap: `${APP_CONFIG.BASE_URL}/sitemap.xml`,
        host: APP_CONFIG.BASE_URL,
    };
}
