import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://autolevelup.com',
  integrations: [
    tailwind({ applyBaseStyles: false }),
    sitemap({
      filter: (page) => !page.includes('/thank-you'),
      serialize: (item) => {
        // Set priorities based on page importance
        if (item.url === 'https://autolevelup.com/') {
          return { ...item, changefreq: 'weekly', priority: 1.0 };
        }
        if (item.url.includes('/pricing')) {
          return { ...item, changefreq: 'weekly', priority: 0.9 };
        }
        if (item.url.includes('/contact')) {
          return { ...item, changefreq: 'monthly', priority: 0.8 };
        }
        if (item.url.includes('/blog')) {
          return { ...item, changefreq: 'weekly', priority: 0.7 };
        }
        if (item.url.includes('/compliance')) {
          return { ...item, changefreq: 'monthly', priority: 0.6 };
        }
        // Legal pages
        return { ...item, changefreq: 'yearly', priority: 0.4 };
      },
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
});
