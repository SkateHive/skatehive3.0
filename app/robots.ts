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
            },
            {
                userAgent: 'Googlebot',
                allow: '/',
                disallow: COMMON_DISALLOWS,
            },
            {
                userAgent: 'Bingbot',
                allow: '/',
                disallow: COMMON_DISALLOWS,
            }
        ],
        sitemap: `${APP_CONFIG.BASE_URL}/sitemap.xml`,
        host: APP_CONFIG.BASE_URL,
    };
}
