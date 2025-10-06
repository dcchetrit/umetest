'use client';

import { Group } from '@ume/shared';
import { useTranslations } from 'next-intl';

interface FilterOptions {
  search: string;
  groups: string[];
  tags: string[];
  rsvpStatus: string;
}

interface GuestFiltersProps {
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  groups: Group[];
  availableTags: string[];
}

export default function GuestFilters({ 
  filters, 
  onFiltersChange, 
  groups, 
  availableTags 
}: GuestFiltersProps) {
  const t = useTranslations('guests.filters');
  const tRSVP = useTranslations('guests.rsvp');

  const handleSearchChange = (search: string) => {
    onFiltersChange({ ...filters, search });
  };

  const handleGroupToggle = (groupId: string) => {
    const newGroups = filters.groups.includes(groupId)
      ? filters.groups.filter(id => id !== groupId)
      : [...filters.groups, groupId];
    onFiltersChange({ ...filters, groups: newGroups });
  };

  const handleTagToggle = (tag: string, isAnd: boolean) => {
    // For now, implementing AND logic (guest must have ALL selected tags)
    const newTags = filters.tags.includes(tag)
      ? filters.tags.filter(t => t !== tag)
      : [...filters.tags, tag];
    onFiltersChange({ ...filters, tags: newTags });
  };

  const handleRSVPStatusChange = (status: string) => {
    onFiltersChange({ ...filters, rsvpStatus: status });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      groups: [],
      tags: [],
      rsvpStatus: ''
    });
  };

  const hasActiveFilters = filters.search || filters.groups.length > 0 || 
                          filters.tags.length > 0 || filters.rsvpStatus;

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">{t('title')}</h3>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {t('clear_all')}
          </button>
        )}
      </div>

      {/* Search */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('search')}
        </label>
        <input
          type="text"
          value={filters.search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder={t('search_placeholder')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Groups */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('groups')}
        </label>
        <div className="flex flex-wrap gap-2">
          {groups.map(group => (
            <button
              key={group.id}
              onClick={() => handleGroupToggle(group.id)}
              className={`px-3 py-1 rounded-full text-sm border ${
                filters.groups.includes(group.id)
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      {availableTags.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t('tags')} 
            <span className="text-xs text-gray-500 ml-1">
              ({t('tags_and_logic')})
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tag => (
              <button
                key={tag}
                onClick={() => handleTagToggle(tag, true)}
                className={`px-3 py-1 rounded-full text-sm border ${
                  filters.tags.includes(tag)
                    ? 'bg-green-100 border-green-300 text-green-700'
                    : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RSVP Status */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('rsvp_status')}
        </label>
        <div className="flex flex-wrap gap-2">
          {['pending', 'accepted', 'declined', 'maybe'].map(status => (
            <button
              key={status}
              onClick={() => handleRSVPStatusChange(status === filters.rsvpStatus ? '' : status)}
              className={`px-3 py-1 rounded-full text-sm border ${
                filters.rsvpStatus === status
                  ? 'bg-blue-100 border-blue-300 text-blue-700'
                  : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tRSVP(status)}
            </button>
          ))}
        </div>
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="pt-2 border-t border-gray-200">
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-gray-600">{t('active')}:</span>
            {filters.search && (
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">
                "{filters.search}"
              </span>
            )}
            {filters.groups.map(groupId => {
              const group = groups.find(g => g.id === groupId);
              return group && (
                <span key={groupId} className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                  {group.name}
                </span>
              );
            })}
            {filters.tags.map(tag => (
              <span key={tag} className="px-2 py-1 bg-green-100 text-green-700 rounded">
                {tag}
              </span>
            ))}
            {filters.rsvpStatus && (
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                {tRSVP(filters.rsvpStatus)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}