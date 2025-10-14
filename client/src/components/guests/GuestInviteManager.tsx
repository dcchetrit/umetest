'use client';

import { useState, useEffect } from 'react';
import { FirestoreService } from '@ume/shared';
import TokenManager from './TokenManager';

interface GuestInviteManagerProps {
  coupleId: string;
  locale: string;
}

export default function GuestInviteManager({ coupleId, locale }: GuestInviteManagerProps) {
  const [guests, setGuests] = useState<any[]>([]);
  const [coupleSlug, setCoupleSlug] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [coupleId]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load guests using the new shared service
      const guestData = await FirestoreService.getGuests(coupleId);
      setGuests(guestData);

      // Get couple slug
      const couple = await FirestoreService.getCouple(coupleId);
      if (couple?.profile?.slug) {
        setCoupleSlug(couple.profile.slug);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-200 rounded-lg h-48 mb-6"></div>
    );
  }

  if (!coupleSlug) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <p className="text-yellow-800">
          Please set up your couple profile with a website slug to enable personalized invites.
        </p>
      </div>
    );
  }

  return (
    <TokenManager
      coupleId={coupleId}
      coupleSlug={coupleSlug}
      guests={guests}
      onTokensGenerated={loadData}
    />
  );
}