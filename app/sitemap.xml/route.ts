import { APP_CONFIG } from '@/config/app.config';

export async function GET() {
  const baseUrl = APP_CONFIG.BASE_URL;
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  // Static URLs and categories
  xml += `  <sitemap>\n`;
  xml += `    <loc>${baseUrl}/sitemap-static.xml</loc>\n`;
  xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
  xml += `  </sitemap>\n`;

  // Cinema videos and brands
  xml += `  <sitemap>\n`;
  xml += `    <loc>${baseUrl}/sitemap-cinema.xml</loc>\n`;
  xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
  xml += `  </sitemap>\n`;

  // Posts, Snaps, Users, Tags
  xml += `  <sitemap>\n`;
  xml += `    <loc>${baseUrl}/sitemap-posts.xml</loc>\n`;
  xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
  xml += `  </sitemap>\n`;

  xml += `</sitemapindex>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate',
    },
  });
}
