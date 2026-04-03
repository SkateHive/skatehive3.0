import cinemaData from '@/public/data/cinema.json';
import { APP_CONFIG } from '@/config/app.config';

export async function GET() {
  const baseUrl = APP_CONFIG.BASE_URL;
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;

  // Videos
  for (const video of cinemaData.videos) {
    xml += `  <url>\n`;
    xml += `    <loc>${baseUrl}/cinema/${video.slug}</loc>\n`;
    xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
    xml += `    <changefreq>monthly</changefreq>\n`;
    xml += `    <priority>0.8</priority>\n`;
    xml += `  </url>\n`;
  }

  // Brands
  const brandSlugs = new Set<string>();
  for (const brand of cinemaData.brands) {
    const slug = brand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!brandSlugs.has(slug)) {
      brandSlugs.add(slug);
      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/cinema/${slug}</loc>\n`;
      xml += `    <lastmod>${new Date().toISOString()}</lastmod>\n`;
      xml += `    <changefreq>monthly</changefreq>\n`;
      xml += `    <priority>0.7</priority>\n`;
      xml += `  </url>\n`;
    }
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
