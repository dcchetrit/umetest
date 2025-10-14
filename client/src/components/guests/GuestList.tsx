'use client';

import { useState, useEffect } from 'react';
import { Guest, Group } from '@ume/shared';
import { FirestoreService } from '@ume/shared';
import { useTranslations } from 'next-intl';
import GuestCard from './GuestCard';
import GuestFilters from './GuestFilters';
import AddGuestModal from './AddGuestModal';

interface GuestListProps {
  coupleId: string;
  coupleSlug: string;
}

interface FilterOptions {
  search: string;
  groups: string[];
  tags: string[];
  rsvpStatus: string;
}

export default function GuestList({ coupleId, coupleSlug }: GuestListProps) {
  const t = useTranslations('guests');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    search: '',
    groups: [],
    tags: [],
    rsvpStatus: ''
  });

  useEffect(() => {
    loadGuests();
    loadGroups();
  }, [coupleId]);

  const loadGuests = async () => {
    try {
      setLoading(true);
      const guestData = await FirestoreService.getGuests(coupleId);
      setGuests(guestData);
    } catch (error) {
      console.error('Error loading guests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const groupData = await FirestoreService.getCollection(`couples/${coupleId}/groups`);
      setGroups(groupData);
    } catch (error) {
      console.error('Error loading groups:', error);
    }
  };

  const handleAddGuest = async (guestData: Omit<Guest, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await FirestoreService.addGuest(coupleId, guestData);
      await loadGuests();
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding guest:', error);
    }
  };

  const handleUpdateGuest = async (guestId: string, guestData: Partial<Guest>) => {
    try {
      await FirestoreService.updateGuest(coupleId, guestId, guestData);
      await loadGuests();
    } catch (error) {
      console.error('Error updating guest:', error);
    }
  };

  const handleDeleteGuest = async (guestId: string) => {
    if (confirm(t('confirm_delete'))) {
      try {
        await FirestoreService.deleteGuest(coupleId, guestId);
        await loadGuests();
      } catch (error) {
        console.error('Error deleting guest:', error);
      }
    }
  };

  const filteredGuests = guests.filter(guest => {
    // Search filter
    if (filters.search && !guest.firstName.toLowerCase().includes(filters.search.toLowerCase())) {
      return false;
    }

    // Group filter
    if (filters.groups.length > 0 && !filters.groups.includes(guest.groupId)) {
      return false;
    }

    // Tags filter (AND logic - guest must have ALL selected tags)
    if (filters.tags.length > 0) {
      const hasAllTags = filters.tags.every(tag => guest.tags.includes(tag));
      if (!hasAllTags) return false;
    }

    // RSVP Status filter
    if (filters.rsvpStatus && guest.rsvp.status !== filters.rsvpStatus) {
      return false;
    }

    return true;
  });

  // Get unique tags from all guests
  const allTags = [...new Set(guests.flatMap(guest => guest.tags))];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          {t('add_guest')}
        </button>
      </div>

      <GuestFilters
        filters={filters}
        onFiltersChange={setFilters}
        groups={groups}
        availableTags={allTags}
      />

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">
            {t('guest_count', { count: filteredGuests.length, total: guests.length })}
          </h2>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredGuests.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {guests.length === 0 ? t('no_guests_yet') : t('no_guests_match_filters')}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredGuests.map(guest => (
              <GuestCard
                key={guest.id}
                guest={guest}
                groups={groups}
                coupleId={coupleId}
                coupleSlug={coupleSlug}
                onUpdate={handleUpdateGuest}
                onDelete={handleDeleteGuest}
              />
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddGuestModal
          groups={groups}
          onSave={handleAddGuest}
          onCancel={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}