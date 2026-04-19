export const BASE_URL = 'https://sql-editor.schemaweaver.vivekmind.com';
export const BRAND_IMAGE = `${BASE_URL}/resona.png`;

export const ROUTES = [
  {
    path: '/',
    title: 'Schema Weaver | SQL Editor for PostgreSQL',
    description:
      'Write, organize, and analyze PostgreSQL schemas in Schema Weaver with a multi-file SQL editor, live ER diagrams, schema diffing, version history, and AI-assisted workflows.',
    priority: '1.0',
    changefreq: 'daily',
    heading: 'Schema Weaver SQL Editor',
    intro:
      'Schema Weaver is a PostgreSQL schema workspace for teams that need a visual SQL editor, live diagramming, schema analysis, and migration-ready project structure in one browser-based environment.',
    features: [
      'Write PostgreSQL schema across multiple files and folders.',
      'Generate ER diagrams and relationship views as schema changes.',
      'Run 20-layer schema analysis with grades, issues, and recommendations.',
      'Review diffs, version history, and AI-assisted schema edits.',
    ],
    schemaType: 'WebApplication',
  },
  {
    path: '/data',
    title: 'Schema Weaver | Data Explorer for PostgreSQL',
    description:
      'Explore PostgreSQL data inside Schema Weaver with table browsing, SQL querying, exports, column insights, and AI-assisted analysis connected to the same workspace.',
    priority: '0.8',
    changefreq: 'weekly',
    heading: 'Schema Weaver Data Explorer',
    intro:
      'The Data Explorer extends the Schema Weaver SQL Editor with connected table browsing, query workflows, export tools, and AI-assisted analysis for production PostgreSQL databases.',
    features: [
      'Browse schemas and tables from connected PostgreSQL databases.',
      'Inspect rows, columns, and table context without leaving the workspace.',
      'Export query results and table data for reporting workflows.',
      'Use Resona AI to analyze tables and generate query help.',
    ],
    schemaType: 'WebPage',
  },
  {
    path: '/databases',
    title: 'Schema Weaver | Database Admin and Migrations',
    description:
      'Manage PostgreSQL connections, migrations, drift checks, health, and deployment workflows inside Schema Weaver’s database administration workspace.',
    priority: '0.8',
    changefreq: 'weekly',
    heading: 'Schema Weaver Database Administration',
    intro:
      'Schema Weaver includes a database administration workspace for connection management, migration review, health inspection, security visibility, and deployment-oriented schema operations.',
    features: [
      'Manage and inspect PostgreSQL database connections.',
      'Create, apply, and review migration workflows.',
      'Track health, audit, configuration, and security views.',
      'Support schema deployment and drift-detection workflows.',
    ],
    schemaType: 'WebPage',
  },
];

export function getCanonicalUrl(pathname) {
  return `${BASE_URL}${pathname}`;
}

export function buildJsonLd(route) {
  if (route.schemaType === 'WebApplication') {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: route.heading,
      url: getCanonicalUrl(route.path),
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      browserRequirements: 'Requires JavaScript',
      image: BRAND_IMAGE,
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
      },
      featureList: route.features,
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: route.heading,
    url: getCanonicalUrl(route.path),
    description: route.description,
    image: BRAND_IMAGE,
  };
}

export function buildFallbackMarkup(route) {
  const items = route.features.map((feature) => `<li>${feature}</li>`).join('');

  return [
    '<main>',
    `  <h1>${route.heading}</h1>`,
    `  <p>${route.intro}</p>`,
    '  <section>',
    '    <h2>Core Capabilities</h2>',
    `    <ul>${items}</ul>`,
    '  </section>',
    '</main>',
  ].join('\n');
}
