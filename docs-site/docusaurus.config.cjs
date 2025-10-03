// Docusaurus config for pdfdancer TypeScript Client docs
/** @type {import('@docusaurus/types').Config} */
module.exports = {
  title: 'pdfdancer TypeScript Client',
  url: 'https://example.com', // TODO: set to real domain or GitHub Pages URL
  baseUrl: '/', // For GitHub Pages project site, set to '/pdfdancer-client-typescript/'
  favicon: undefined,
  organizationName: 'MenschMachine', // GitHub org/user
  projectName: 'pdfdancer-client-typescript', // Repo name
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  i18n: { defaultLocale: 'en', locales: ['en'] },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/docs',
          sidebarPath: require.resolve('./sidebars.js'),
          editCurrentVersion: false,
        },
        blog: false,
        theme: { customCss: undefined },
      },
    ],
  ],
  plugins: [
    [
      'docusaurus-plugin-typedoc',
      {
        entryPoints: ['../src/index.ts'],
        tsconfig: '../tsconfig.json',
        out: 'api',
        sidebar: {
          categoryLabel: 'API Reference',
          position: 3,
        },
        // Clean output on rebuild to avoid stale pages
        cleanOutputDir: true,
      },
    ],
  ],
  themeConfig: {
    navbar: {
      title: 'pdfdancer TypeScript Client',
      items: [
        { type: 'docSidebar', sidebarId: 'tutorialSidebar', label: 'Docs', position: 'left' },
        { to: '/docs/api', label: 'API', position: 'left' },
        { href: 'https://github.com/MenschMachine/pdfdancer-client-typescript', label: 'GitHub', position: 'right' },
      ],
    },
    footer: { style: 'light', copyright: `© ${new Date().getFullYear()} pdfdancer` },
  },
};