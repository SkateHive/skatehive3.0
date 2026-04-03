import { APP_CONFIG } from '@/config/app.config';

export async function GET() {
  const baseUrl = APP_CONFIG.BASE_URL;
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  const pages = [
    { path: '', freq: 'daily', prio: 1 },
    { path: '/blog', freq: 'daily', prio: 0.9 },
    { path: '/map', freq: 'weekly', prio: 0.8 },
    { path: '/leaderboard', freq: 'weekly', prio: 0.7 },
    { path: '/bounties', freq: 'daily', prio: 0.7 },
    { path: '/auction', freq: 'daily', prio: 0.7 },
    { path: '/magazine', freq: 'weekly', prio: 0.6 },
    { path: '/invite', freq: 'monthly', prio: 0.4 },
    { path: '/tricks', freq: 'weekly', prio: 0.8 },
    { path: '/skateshops', freq: 'weekly', prio: 0.8 },
    { path: '/videos', freq: 'daily', prio: 0.9 },
    { path: '/skaters', freq: 'weekly', prio: 0.8 },
    { path: '/cinema', freq: 'weekly', prio: 0.9 },
    { path: '/spots', freq: 'weekly', prio: 0.8 },
    { path: '/dao', freq: 'weekly', prio: 0.7 },
    { path: '/map/near-me', freq: 'weekly', prio: 0.9 },
    { path: '/games', freq: 'weekly', prio: 0.8 },
    { path: '/games/quest-for-stoken', freq: 'monthly', prio: 0.7 },
    { path: '/games/lougnar', freq: 'monthly', prio: 0.7 },
  ];

  const tricks = ['kickflip', 'heelflip', 'ollie', 'pop-shove-it', 'varial-kickflip', 'tre-flip',
    'hardflip', 'laser-flip', 'nollie', 'manual', 'no-comply', 'boneless',
    '50-50', 'boardslide', 'nosegrind', 'smith-grind', 'feeble', 'crooked-grind',
    'blunt-stall', 'wallride', 'drop-in', 'rock-to-fakie', 'axle-stall',
    'frontside-air', 'backside-air'];

  for (const trick of tricks) {
    pages.push({ path: `/tricks/${trick}`, freq: 'weekly', prio: 0.7 });
  }

  for (const page of pages) {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}${page.path}</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += `    <changefreq>${page.freq}</changefreq>\n`;
    xml += `    <priority>${page.prio}</priority>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate',
    },
  });
}
