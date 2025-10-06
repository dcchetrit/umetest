module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
  },
  fallbackLng: 'en',
  debug: false,
  reloadOnPrerender: process.env.NODE_ENV === 'development',
  
  ns: [
    'common',
    'auth',
    'admin',
    'couples',
    'analytics',
    'settings'
  ],
  defaultNS: 'common',
};