import { Helmet } from 'react-helmet-async';

export interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
  noIndex?: boolean;
  schema?: 'webApplication' | 'article';
}

const SITE_NAME = 'Schema Weaver';
const DEFAULT_TITLE = SITE_NAME;
const DEFAULT_DESCRIPTION = 'Database schema design and visualization tool — write PostgreSQL schemas, generate ER diagrams, compile 20-layer analysis, and run AI-powered migrations.';
const BASE_URL = 'https://sql-editor.schemaweaver.vivekmind.com';
const DEFAULT_OG_IMAGE = '/resona.png';

export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogTitle,
  ogDescription,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  noIndex = false,
  schema,
}: SEOProps) {
  const pageTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const pageOgTitle = ogTitle || title || SITE_NAME;
  const pageOgDescription = ogDescription || description;
  const pageUrl = canonical || BASE_URL;

  const jsonLd = schema === 'webApplication'
    ? {
        ...JSON_LD.webApplication,
        url: pageUrl,
        image: `${BASE_URL}${ogImage}`,
      }
    : null;

  return (
    <Helmet>
      <title>{pageTitle}</title>
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {!noIndex && <meta name="robots" content="index, follow" />}
      
      <meta name="title" content={pageTitle} />
      <meta name="description" content={description} />
      
      {canonical && <link rel="canonical" href={canonical} />}
      
      <meta property="og:url" content={pageUrl} />
      <meta property="og:title" content={pageOgTitle} />
      <meta property="og:description" content={pageOgDescription} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      {ogImage && <meta property="og:image" content={`${BASE_URL}${ogImage}`} />}
      {ogImage && <meta property="og:image:alt" content="Schema Weaver logo" />}
      
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={pageUrl} />
      <meta name="twitter:title" content={pageOgTitle} />
      <meta name="twitter:description" content={pageOgDescription} />
      {ogImage && <meta name="twitter:image" content={`${BASE_URL}${ogImage}`} />}
      
      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}

export const SEO_PAGES = {
  home: {
    title: 'SQL Editor',
    description: 'Write, organize, and analyze PostgreSQL schemas — multi-file projects, syntax highlighting, ER diagrams, and AI-powered schema analysis.',
    path: '/',
  },
  dataExplorer: {
    title: 'Data Explorer',
    description: 'Query, analyze, and visualize PostgreSQL data — timeseries analysis, ML insights, and AI-powered data exploration.',
    path: '/data',
  },
  databases: {
    title: 'Database Admin',
    description: 'Manage PostgreSQL database connections, run migrations, detect drift, and deploy schema changes.',
    path: '/databases',
  },
};

export function getCanonicalUrl(path: string): string {
  return `${BASE_URL}${path}`;
}

export const JSON_LD = {
  webApplication: {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Schema Weaver SQL Editor',
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Web',
    browserRequirements: 'Requires JavaScript',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
    },
    featureList: [
      'PostgreSQL schema editing',
      'ER diagram visualization',
      'Schema compiler (20-layer analysis)',
      'Schema diff and version history',
      'AI-powered SQL generation',
      'Database migration management',
    ],
  },
};
