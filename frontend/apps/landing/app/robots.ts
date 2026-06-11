import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/register',
    },
    sitemap: 'https://www.smarttechsaas.com/sitemap.xml',
  };
}
