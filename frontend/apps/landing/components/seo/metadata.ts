export const siteConfig = {
  name: 'SMART_TECH',
  tagline: 'Empowering Education Through Technology',
  url: 'https://www.smarttechsaas.com',
  appUrl: 'https://app.smarttechsaas.com',
  apiUrl: 'https://api.smarttechsaas.com',
  email: 'support@smarttechsaas.com',
  phone: '+260 978805917',
  description:
    'AI-powered school management platform for modern education. Manage students, teachers, attendance, examinations, results, communication, AI learning, and school operations from a single intelligent platform.',
  keywords: [
    'school management system',
    'education SaaS platform',
    'AI-powered learning',
    'student information system',
    'teacher management software',
    'exam management system',
    'report card generator',
    'school communication platform',
    'AI tutor for students',
    'educational technology',
    'Zambia school software',
    'Africa education platform',
    'school administration software',
  ],
  social: {
    twitter: '@smarttechsaas',
  },
};

export const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SMART_TECH',
  url: siteConfig.url,
  logo: `${siteConfig.url}/icon.svg`,
  description: siteConfig.description,
  foundingDate: '2024',
  contactPoint: {
    '@type': 'ContactPoint',
    email: 'support@smarttechsaas.com',
    telephone: '+260978805917',
    contactType: 'customer support',
  },
  sameAs: [
    'https://www.linkedin.com/company/smarttechsaas',
    'https://twitter.com/smarttechsaas',
    'https://www.facebook.com/smarttechsaas',
  ],
};

export const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: siteConfig.name,
  url: siteConfig.url,
  description: siteConfig.description,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${siteConfig.url}/search?q={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SMART_TECH School Management System',
  operatingSystem: 'Web, Android, iOS',
  applicationCategory: 'EducationalApplication',
  description: siteConfig.description,
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
};
