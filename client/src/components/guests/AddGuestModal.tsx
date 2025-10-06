'use client';

import { useState } from 'react';
import { Guest, Group, RSVPResponse } from '@ume/shared';
import { useTranslations } from 'next-intl';

interface AddGuestModalProps {
  groups: Group[];
  onSave: (guest: Omit<Guest, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onCancel: () => void;
}

export default function AddGuestModal({ groups, onSave, onCancel }: AddGuestModalProps) {
  const t = useTranslations('guests');
  const tCommon = useTranslations('common');
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    groupId: groups.length > 0 ? groups[0].id : '',
    tags: [] as string[],
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: ''
    }
  });

  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [customTag, setCustomTag] = useState('');

  const commonTags = ['Vegetarian', 'Vegan', 'Plus One', 'Kids Table', 'Close Friend', 'Family', 'Single'];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return;

    const defaultRSVP: RSVPResponse = {
      status: 'pending',
      events: {},
      plusOnes: []
    };

    const guestData: Omit<Guest, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.name.trim(),
      email: formData.email.trim() || undefined,
      phone: formData.phone.trim() || undefined,
      groupId: formData.groupId,
      tags: Array.from(selectedTags),
      rsvp: defaultRSVP,
      address: formData.address.street ? formData.address : undefined
    };

    onSave(guestData);
  };

  const handleTagToggle = (tag: string) => {
    const newTags = new Set(selectedTags);
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }
    setSelectedTags(newTags);
  };

  const addCustomTag = () => {
    if (customTag.trim()) {
      setSelectedTags(new Set([...selectedTags, customTag.trim()]));
      setCustomTag('');
    }
  };

  const removeTag = (tag: string) => {
    const newTags = new Set(selectedTags);
    newTags.delete(tag);
    setSelectedTags(newTags);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">{t('add_modal.title')}</h2>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('guest_name')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enter_name')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('group')} *
                </label>
                <select
                  required
                  value={formData.groupId}
                  onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {groups.map(group => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enter_email')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('phone')}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={t('enter_phone')}
                />
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('tags')}
              </label>
              
              {/* Common Tags */}
              <div className="flex flex-wrap gap-2 mb-3">
                {commonTags.map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1 rounded-full text-sm border ${
                      selectedTags.has(tag)
                        ? 'bg-blue-100 border-blue-300 text-blue-700'
                        : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>

              {/* Custom Tag Input */}
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={customTag}
                  onChange={(e) => setCustomTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomTag())}
                  className="flex-1 px-3 py-1 border border-gray-300 rounded-md text-sm"
                  placeholder={t('add_custom_tag')}
                />
                <button
                  type="button"
                  onClick={addCustomTag}
                  className="px-3 py-1 bg-gray-500 text-white rounded-md text-sm hover:bg-gray-600"
                >
                  {tCommon('buttons.add')}
                </button>
              </div>

              {/* Selected Tags */}
              {selectedTags.size > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedTags).map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 text-green-600 hover:text-green-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Address (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('address')} ({tCommon('forms.optional')})
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={formData.address.street}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, street: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder={t('street_address')}
                />
                <input
                  type="text"
                  value={formData.address.city}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, city: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder={t('city')}
                />
                <input
                  type="text"
                  value={formData.address.state}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, state: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder={t('state')}
                />
                <input
                  type="text"
                  value={formData.address.postalCode}
                  onChange={(e) => setFormData({ 
                    ...formData, 
                    address: { ...formData.address, postalCode: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                  placeholder={t('postal_code')}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700"
              >
                {t('add_guest')}
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600"
              >
                {tCommon('buttons.cancel')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}