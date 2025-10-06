module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
    localeDetection: false, // We'll handle locale detection based on couple's preference
  },
  fallbackLng: 'en',
  debug: false,
  reloadOnPrerender: process.env.NODE_ENV === 'development',
  
  ns: [
    'common',
    'auth',
    'dashboard', 
    'guests',
    'rsvp',
    'seating',
    'tasks',
    'budget',
    'vendors',
    'settings'
  ],
  defaultNS: 'common',
};