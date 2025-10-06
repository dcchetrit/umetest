import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'fr', 'es'],
  },
  transpilePackages: ['@ume/shared'],
};

export default nextConfig;
