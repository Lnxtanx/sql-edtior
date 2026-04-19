import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  BASE_URL,
  BRAND_IMAGE,
  ROUTES,
  buildFallbackMarkup,
  buildJsonLd,
  getCanonicalUrl,
} from './seo-pages.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '../public');
const distDir = path.join(__dirname, '../dist');

function generateSitemap() {
  console.log('🗺️  Generating sitemap.xml...');

  const today = new Date().toISOString().split('T')[0];

  const urls = ROUTES.map(route => [
    '  <url>',
    `    <loc>${BASE_URL}${route.path}</loc>`,
    `    <lastmod>${today}</lastmod>`,
    `    <changefreq>${route.changefreq}</changefreq>`,
    `    <priority>${route.priority}</priority>`,
    '  </url>',
  ].join('\n'));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');

  const outputDirs = [publicDir, distDir];
  
  for (const dir of outputDirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const outputPath = path.join(dir, 'sitemap.xml');
    fs.writeFileSync(outputPath, xml);
    console.log(`✓ Generated sitemap.xml → ${outputPath}`);
  }

  console.log(`✓ Generated sitemap.xml (${ROUTES.length} URLs)`);
}

function replaceOrInsert(html, pattern, replacement, insertBefore = '</head>') {
  if (pattern.test(html)) {
    return html.replace(pattern, replacement);
  }
  return html.replace(insertBefore, `${replacement}\n${insertBefore}`);
}

function renderRouteHtml(template, route) {
  const canonical = getCanonicalUrl(route.path);
  const jsonLd = JSON.stringify(buildJsonLd(route), null, 2);
  const fallbackMarkup = buildFallbackMarkup(route);
  const escapedDescription = route.description.replace(/"/g, '&quot;');
  const escapedTitle = route.title.replace(/"/g, '&quot;');

  let html = template;

  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${route.title}</title>`);
  html = html.replace(
    /<meta name="title" content="[^"]*"\s*\/?>/i,
    `<meta name="title" content="${escapedTitle}" />`
  );
  html = html.replace(
    /<meta name="description" content="[^"]*"\s*\/?>/i,
    `<meta name="description" content="${escapedDescription}" />`
  );
  html = replaceOrInsert(
    html,
    /<meta name="robots" content="[^"]*"\s*\/?>/i,
    '<meta name="robots" content="index, follow" />'
  );
  html = html.replace(/<meta property="og:url" content="[^"]*"\s*\/?>/i, `<meta property="og:url" content="${canonical}" />`);
  html = html.replace(/<meta property="og:title" content="[^"]*"\s*\/?>/i, `<meta property="og:title" content="${escapedTitle}" />`);
  html = html.replace(
    /<meta property="og:description" content="[^"]*"\s*\/?>/i,
    `<meta property="og:description" content="${escapedDescription}" />`
  );
  html = html.replace(/<meta property="og:image" content="[^"]*"\s*\/?>/i, `<meta property="og:image" content="${BRAND_IMAGE}" />`);
  html = replaceOrInsert(
    html,
    /<meta property="og:image:alt" content="[^"]*"\s*\/?>/i,
    '<meta property="og:image:alt" content="Schema Weaver logo" />'
  );
  html = html.replace(/<meta property="twitter:url" content="[^"]*"\s*\/?>/i, `<meta property="twitter:url" content="${canonical}" />`);
  html = html.replace(/<meta property="twitter:title" content="[^"]*"\s*\/?>/i, `<meta property="twitter:title" content="${escapedTitle}" />`);
  html = html.replace(
    /<meta property="twitter:description" content="[^"]*"\s*\/?>/i,
    `<meta property="twitter:description" content="${escapedDescription}" />`
  );
  html = html.replace(/<meta property="twitter:image" content="[^"]*"\s*\/?>/i, `<meta property="twitter:image" content="${BRAND_IMAGE}" />`);
  html = html.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/i, `<link rel="canonical" href="${canonical}" />`);
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/i,
    `<script type="application\/ld\+json">\n${jsonLd}\n    </script>`
  );

  // Keep root empty to prevent flicker
  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, '<div id="root"></div>');

  // Inject SEO content into the dedicated hidden container
  html = html.replace(/<main id="seo-content"[\s\S]*?<\/main>/i, fallbackMarkup);

  return html;
  }

function generateRouteHtml() {
  const distIndexPath = path.join(distDir, 'index.html');
  if (!fs.existsSync(distIndexPath)) {
    console.warn('⚠ dist/index.html not found, skipping route HTML generation.');
    return;
  }

  console.log('🧭 Generating route-level SEO HTML...');

  const template = fs.readFileSync(distIndexPath, 'utf8');

  for (const route of ROUTES) {
    const html = renderRouteHtml(template, route);
    const outputPath =
      route.path === '/'
        ? distIndexPath
        : path.join(distDir, route.path.replace(/^\//, ''), 'index.html');

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, html);
    console.log(`✓ Generated SEO HTML → ${outputPath}`);
  }
}

generateSitemap();
generateRouteHtml();
