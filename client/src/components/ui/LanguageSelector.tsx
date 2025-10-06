'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import { locales } from '@/i18n/config';

export default function LanguageSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const changeLanguage = (newLocale: string) => {
    // Remove the current locale from the pathname
    const segments = pathname.split('/');
    if (locales.includes(segments[1] as any)) {
      segments[1] = newLocale;
    } else {
      segments.unshift('', newLocale);
    }
    
    const newPath = segments.join('/') || `/${newLocale}`;
    router.push(newPath);
  };

  const languageNames = {
    en: 'English',
    fr: 'Français',
    es: 'Español'
  };

  const flagEmojis = {
    en: '🇺🇸',
    fr: '🇫🇷',
    es: '🇪🇸'
  };

  return (
    <div className="relative inline-block">
      <select
        value={locale}
        onChange={(e) => changeLanguage(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-md py-2 pl-3 pr-10 text-sm leading-5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {locales.map((lang) => (
          <option key={lang} value={lang}>
            {flagEmojis[lang]} {languageNames[lang]}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}