'use client';

import { useState, useEffect } from 'react';
import { Couple, Event } from '@ume/shared';
import { FirestoreService } from '@ume/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface WeddingInfoProps {
  coupleSlug: string;
}

export default function WeddingInfo({ coupleSlug }: WeddingInfoProps) {
  const t = useTranslations('rsvp');
  const tCommon = useTranslations('common');
  const [couple, setCouple] = useState<Couple | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWeddingData();
  }, [coupleSlug]);

  const loadWeddingData = async () => {
    try {
      setLoading(true);
      // TODO: In a real implementation, look up couple by slug
      // For now using a default couple ID - this should be dynamic based on slug
      const defaultCoupleId = 'couple-default';
      const coupleData = await FirestoreService.getCouple(defaultCoupleId);
      const eventsData = await FirestoreService.getEvents(defaultCoupleId);
      
      setCouple(coupleData);
      setEvents(eventsData);
    } catch (error) {
      console.error('Error loading wedding data:', error);
      setError(tCommon('status.error'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (error || !couple) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('title')}</h1>
          <p className="text-gray-600">{tCommon('status.error')}</p>
        </div>
      </div>
    );
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-pink-500 to-purple-600 text-white">
        <div className="absolute inset-0 bg-black opacity-20"></div>
        <div className="relative max-w-4xl mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-4">
            {couple.profile.names.partner1} & {couple.profile.names.partner2}
          </h1>
          <p className="text-xl md:text-2xl mb-8">
            {t('celebrating_our_love')}
          </p>
          {events.length > 0 && (
            <p className="text-lg opacity-90">
              {formatDate(events[0].date)}
            </p>
          )}
        </div>
      </div>

      {/* Events Section */}
      {events.length > 0 && (
        <div className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
              {t('wedding_events')}
            </h2>
            
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {events.map((event) => (
                <div key={event.id} className="bg-gray-50 rounded-lg p-6 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {event.name}
                  </h3>
                  <div className="space-y-2 text-gray-600">
                    <p className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v16a2 2 0 002 2z" />
                      </svg>
                      {formatDate(event.date)}
                    </p>
                    <p className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {formatTime(event.date)}
                    </p>
                    <p className="flex items-start justify-center gap-2">
                      <svg className="w-4 h-4 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="text-left">
                        {event.location.name}<br />
                        {event.location.address.street}<br />
                        {event.location.address.city}, {event.location.address.state}
                      </span>
                    </p>
                  </div>
                  {event.description && (
                    <p className="mt-4 text-gray-700 italic">
                      {event.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* RSVP Section */}
      <div className="py-16 bg-gradient-to-r from-pink-100 to-purple-100">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            {t('rsvp_title')}
          </h2>
          <p className="text-lg text-gray-700 mb-8">
            {t('rsvp_message')}
          </p>
          
          <Link
            href={`/rsvp/${coupleSlug}/form`}
            className="inline-block bg-pink-500 hover:bg-pink-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors duration-200 text-lg"
          >
            {t('rsvp_button')}
          </Link>
          
          <p className="mt-4 text-sm text-gray-600">
            {t('rsvp_deadline_notice', { date: 'March 1st, 2024' })}
          </p>
        </div>
      </div>

      {/* Additional Info Section */}
      <div className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Accommodation */}
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {t('accommodation')}
              </h3>
              <p className="text-gray-600 mb-4">
                {t('accommodation_message')}
              </p>
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">{t('hotel.name')}</h4>
                <p className="text-gray-600">Grand Wedding Hotel</p>
                <p className="text-gray-600">123 Wedding Street</p>
                <p className="text-gray-600">City, State 12345</p>
                <p className="text-gray-600 mt-2">{t('hotel.use_code', { code: 'WEDDING2024' })}</p>
              </div>
            </div>

            {/* Registry */}
            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                {t('registry')}
              </h3>
              <p className="text-gray-600 mb-4">
                {t('registry_message')}
              </p>
              <div className="space-y-2">
                <a
                  href="#"
                  className="block bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition-colors"
                >
                  Amazon Registry
                </a>
                <a
                  href="#"
                  className="block bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded transition-colors"
                >
                  Target Registry
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-lg mb-2">
            {couple.profile.names.partner1} & {couple.profile.names.partner2}
          </p>
          <p className="text-gray-400">
            {t('footer_message')}
          </p>
        </div>
      </footer>
    </div>
  );
}