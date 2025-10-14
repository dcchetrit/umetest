'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { authService } from '@ume/shared';

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      dashboard: 'Dashboard',
      guests: 'Guests',
      rsvp: 'RSVP',
      website: 'Website',
      seating: 'Seating',
      tasks: 'Tasks', 
      budget: 'Budget',
      vendors: 'Vendors',
      settings: 'Settings',
      forecast: 'Forecast',
      benchmark: 'Benchmark',
      platform_title: 'U&Me',
      planning_management: 'Planning & Management',
      guests_events: 'Guests & Events',
      financial: 'Financial',
      vendor: 'Vendor',
      logout: 'Log Out',
      profile: 'Profile'
    },
    fr: {
      dashboard: 'Accueil',
      guests: 'Invités',
      rsvp: 'RSVP',
      website: 'Site Web',
      seating: 'Places',
      tasks: 'Tâches',
      budget: 'Budget',
      vendors: 'Fournisseurs',
      settings: 'Paramètres',
      forecast: 'Prévisions',
      benchmark: 'Benchmark',
      platform_title: 'U&Me',
      planning_management: 'Planification et Gestion',
      guests_events: 'Invités',
      financial: 'Financier',
      vendor: 'Prestataires',
      logout: 'Se déconnecter',
      profile: 'Mon Profil'
    },
    es: {
      dashboard: 'Panel',
      guests: 'Invitados',
      rsvp: 'RSVP',
      website: 'Sitio Web',
      seating: 'Asientos',
      tasks: 'Tareas',
      budget: 'Presupuesto',
      vendors: 'Proveedores',
      settings: 'Configuración',
      forecast: 'Pronóstico',
      benchmark: 'Referencia',
      platform_title: 'U&Me',
      planning_management: 'Planificación y Gestión',
      guests_events: 'Invitados y Eventos',
      financial: 'Financiero',
      vendor: 'Proveedor',
      logout: 'Cerrar sesión',
      profile: 'Perfil'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Extract locale from pathname
  const segments = pathname.split('/');
  const locale = segments[1] || 'en';

  const handleLogout = async () => {
    try {
      await authService.signOut();
      router.push(`/${locale}/login`);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navGroups = [
    {
      label: 'dashboard',
      single: true,
      href: `/${locale}/dashboard`,
      labelKey: 'dashboard',
      icon: 'dashboard'
    },
    {
      label: 'tasks',
      single: true,
      href: `/${locale}/tasks`,
      labelKey: 'tasks',
      icon: 'tasks'
    },
    {
      label: 'guests_events', 
      items: [
        { href: `/${locale}/guests`, labelKey: 'guests', icon: 'guests' },
        { href: `/${locale}/rsvp`, labelKey: 'rsvp', icon: 'rsvp' },
        { href: `/${locale}/seating`, labelKey: 'seating', icon: 'seating' },
      ]
    },
    {
      label: 'website',
      single: true,
      href: `/${locale}/website`,
      labelKey: 'website',
      icon: 'website'
    },
    {
      label: 'financial',
      items: [
        { href: `/${locale}/forecast`, labelKey: 'forecast', icon: 'forecast' },
        { href: `/${locale}/budget`, labelKey: 'budget', icon: 'budget' },
      ]
    },
    {
      label: 'vendor',
      items: [
        { href: `/${locale}/vendors`, labelKey: 'vendors', icon: 'vendors' },
        { href: `/${locale}/benchmark`, labelKey: 'benchmark', icon: 'benchmark' },
      ]
    },
  ];

  const getIcon = (iconName: string) => {
    const icons: Record<string, React.ReactElement> = {
      dashboard: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v1H8V5z" />
        </svg>
      ),
      guests: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      seating: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
        </svg>
      ),
      tasks: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
      budget: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      vendors: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      rsvp: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      website: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      ),
      settings: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      forecast: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
      benchmark: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      guests_events: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      financial: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
      vendor: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
      logout: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      profile: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    };
    
    return icons[iconName] || icons.dashboard;
  };

  return (
    <nav className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-50" ref={dropdownRef}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href={`/${locale}`} className="text-xl font-bold bg-gradient-to-r from-rose-500 to-pink-500 bg-clip-text text-transparent hover:from-rose-600 hover:to-pink-600 transition-all duration-300">
                {getLocalizedText(locale, 'platform_title')}
              </Link>
            </div>
            <div className="hidden sm:ml-8 sm:flex sm:space-x-2">
              {navGroups.map((group) => {
                if (group.single) {
                  return (
                    <Link
                      key={group.href}
                      href={group.href!}
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        pathname === group.href
                          ? 'bg-rose-50 text-rose-700 shadow-sm border border-rose-100'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <span className="mr-2 w-4 h-4">{getIcon(group.icon!)}</span>
                      {getLocalizedText(locale, group.labelKey!)}
                    </Link>
                  );
                }

                const isActive = group.items?.some(item => pathname === item.href);
                return (
                  <div key={group.label} className="relative flex items-center">
                    <button
                      className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-rose-50 text-rose-700 shadow-sm border border-rose-100'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                      onClick={() => setOpenDropdown(openDropdown === group.label ? null : group.label)}
                    >
                      <span className="mr-2 w-4 h-4">{getIcon(group.label)}</span>
                      {getLocalizedText(locale, group.label)}
                      <svg 
                        className={`ml-2 w-4 h-4 transition-transform duration-200 ${
                          openDropdown === group.label ? 'rotate-180' : ''
                        }`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {openDropdown === group.label && (
                      <div className="absolute left-0 top-full mt-2 w-56 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="py-2">
                          {group.items?.map((item, index) => (
                            <Link
                              key={item.href}
                              href={item.href}
                              className={`flex items-center px-4 py-3 text-sm font-medium transition-all duration-200 ${
                                pathname === item.href
                                  ? 'bg-rose-50 text-rose-700 border-l-4 border-rose-500'
                                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                              }`}
                              onClick={() => setOpenDropdown(null)}
                              style={{ animationDelay: `${index * 50}ms` }}
                            >
                              <span className="mr-3 w-5 h-5 flex-shrink-0">{getIcon(item.icon)}</span>
                              <span className="flex-1">{getLocalizedText(locale, item.labelKey)}</span>
                              {pathname === item.href && (
                                <div className="w-2 h-2 bg-rose-500 rounded-full ml-2"></div>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Profile button */}
            <Link
              href={`/${locale}/profile`}
              className={`hidden sm:inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                pathname === `/${locale}/profile`
                  ? 'bg-rose-50 text-rose-700 shadow-sm border border-rose-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="mr-2 w-4 h-4">{getIcon('profile')}</span>
              {getLocalizedText(locale, 'profile')}
            </Link>
            
            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="hidden sm:inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all duration-200"
            >
              <span className="mr-2 w-4 h-4">{getIcon('logout')}</span>
              {getLocalizedText(locale, 'logout')}
            </button>
            
            {/* Mobile menu button */}
            <div className="sm:hidden">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile menu */}
        <div className={`sm:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isMobileMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'
        }`}>
          <div className="px-4 pt-4 pb-6 space-y-2 bg-gray-50/50 border-t border-gray-200/50">
            {navGroups.map((group, groupIndex) => {
              if (group.single) {
                return (
                  <Link
                    key={group.href}
                    href={group.href!}
                    className={`flex items-center px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                      pathname === group.href
                        ? 'text-rose-700 bg-rose-50 border border-rose-100 shadow-sm'
                        : 'text-gray-700 hover:text-gray-900 hover:bg-white/70'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                    style={{ animationDelay: `${groupIndex * 50}ms` }}
                  >
                    <span className="mr-4 w-5 h-5">{getIcon(group.icon!)}</span>
                    <span className="flex-1">{getLocalizedText(locale, group.labelKey!)}</span>
                    {pathname === group.href && (
                      <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                    )}
                  </Link>
                );
              }

              return (
                <div key={group.label} className="space-y-1" style={{ animationDelay: `${groupIndex * 50}ms` }}>
                  <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-200/50">
                    {getLocalizedText(locale, group.label)}
                  </div>
                  {group.items?.map((item, itemIndex) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center pl-8 pr-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                        pathname === item.href
                          ? 'text-rose-700 bg-rose-50 border border-rose-100 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/70'
                      }`}
                      onClick={() => setIsMobileMenuOpen(false)}
                      style={{ animationDelay: `${(groupIndex * 100) + (itemIndex * 50)}ms` }}
                    >
                      <span className="mr-4 w-5 h-5">{getIcon(item.icon)}</span>
                      <span className="flex-1">{getLocalizedText(locale, item.labelKey)}</span>
                      {pathname === item.href && (
                        <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                      )}
                    </Link>
                  ))}
                </div>
              );
            })}
            
            {/* Mobile profile link */}
            <div className="pt-6 border-t border-gray-200/50">
              <Link
                href={`/${locale}/profile`}
                className={`flex items-center px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                  pathname === `/${locale}/profile`
                    ? 'text-rose-700 bg-rose-50 border border-rose-100 shadow-sm'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-white/70'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="mr-4 w-5 h-5">{getIcon('profile')}</span>
                <span className="flex-1">{getLocalizedText(locale, 'profile')}</span>
                {pathname === `/${locale}/profile` && (
                  <div className="w-2 h-2 bg-rose-500 rounded-full"></div>
                )}
              </Link>
            </div>
            
            {/* Mobile logout button */}
            <div className="pt-4 border-t border-gray-200/50">
              <button
                onClick={handleLogout}
                className="flex items-center w-full px-4 py-3 rounded-xl text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-white/70 transition-all duration-200"
              >
                <span className="mr-4 w-5 h-5">{getIcon('logout')}</span>
                <span className="flex-1 text-left">{getLocalizedText(locale, 'logout')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}