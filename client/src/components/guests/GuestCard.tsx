'use client';

import { useState } from 'react';
import { Guest, Group, FirestoreService } from '@ume/shared';
import { useTranslations } from 'next-intl';

interface GuestCardProps {
  guest: Guest;
  groups: Group[];
  coupleId: string;
  coupleSlug: string;
  onUpdate: (guestId: string, data: Partial<Guest>) => void;
  onDelete: (guestId: string) => void;
}

export default function GuestCard({ guest, groups, coupleId, coupleSlug, onUpdate, onDelete }: GuestCardProps) {
  const t = useTranslations('guests');
  const tRSVP = useTranslations('guests.rsvp');
  const tCommon = useTranslations('common');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(guest);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [showInviteLink, setShowInviteLink] = useState(false);

  const group = groups.find(g => g.id === guest.groupId);
  
  const getRSVPStatusColor = (status: string) => {
    switch (status) {
      case 'accepted': return 'text-green-600 bg-green-100';
      case 'declined': return 'text-red-600 bg-red-100';
      case 'maybe': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const handleSave = () => {
    onUpdate(guest.id, editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(guest);
    setIsEditing(false);
  };

  const handleTagChange = (tag: string, checked: boolean) => {
    const newTags = checked 
      ? [...editData.tags, tag]
      : editData.tags.filter(t => t !== tag);
    setEditData({ ...editData, tags: newTags });
  };

  const generateInviteToken = async () => {
    if (isGeneratingToken) return;
    
    setIsGeneratingToken(true);
    try {
      const token = await FirestoreService.generateGuestToken(coupleId, guest.id);
      onUpdate(guest.id, { inviteToken: token });
    } catch (error) {
      console.error('Error generating token:', error);
      alert('Failed to generate invite link');
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const getInviteLink = () => {
    if (!guest.inviteToken) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/en/${coupleSlug}/${guest.inviteToken}`;
  };

  const copyInviteLink = async () => {
    const link = getInviteLink();
    try {
      await navigator.clipboard.writeText(link);
      alert('Invite link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy link:', error);
      alert('Failed to copy link');
    }
  };

  const commonTags = ['Vegetarian', 'Vegan', 'Plus One', 'Kids Table', 'Close Friend', 'Family', 'Single'];

  if (isEditing) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <div className="space-y-3">
          <input
            type="text"
            value={editData.name}
            onChange={(e) => setEditData({ ...editData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder={t('guest_name')}
          />
          
          <input
            type="email"
            value={editData.email || ''}
            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder={t('email')}
          />

          <input
            type="tel"
            value={editData.phone || ''}
            onChange={(e) => setEditData({ ...editData, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder={t('phone')}
          />

          <select
            value={editData.groupId}
            onChange={(e) => setEditData({ ...editData, groupId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            {groups.map(group => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('tags')}</label>
            <div className="flex flex-wrap gap-2">
              {commonTags.map(tag => (
                <label key={tag} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editData.tags.includes(tag)}
                    onChange={(e) => handleTagChange(tag, e.target.checked)}
                    className="mr-1"
                  />
                  <span className="text-sm">{tag}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-md hover:bg-blue-700"
            >
              {tCommon('buttons.save')}
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-500 text-white py-2 px-3 rounded-md hover:bg-gray-600"
            >
              {tCommon('buttons.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h3 className="font-semibold text-gray-900">{guest.firstName}</h3>
        <div className="flex gap-1">
          <button
            onClick={() => setIsEditing(true)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(guest.id)}
            className="text-gray-400 hover:text-red-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      <div className="space-y-2 text-sm text-gray-600">
        {guest.email && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
            </svg>
            <span className="truncate">{guest.email}</span>
          </div>
        )}

        {guest.phone && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{guest.phone}</span>
          </div>
        )}

        {group && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span>{group.name}</span>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-3">
        <div className="flex flex-wrap gap-1">
          {guest.tags.map(tag => (
            <span
              key={tag}
              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>

        <span className={`px-2 py-1 text-xs rounded-full ${getRSVPStatusColor(guest.rsvp.status)}`}>
          {tRSVP(guest.rsvp.status)}
        </span>
      </div>

      {guest.rsvp.status !== 'pending' && guest.rsvp.submittedAt && (
        <div className="mt-2 text-xs text-gray-500">
          {t('rsvp_submitted')}: {new Date(guest.rsvp.submittedAt).toLocaleDateString()}
        </div>
      )}

      {/* Invite Link Section */}
      <div className="mt-3 pt-3 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-700">Invite Link</span>
          {guest.inviteToken ? (
            <div className="flex gap-2">
              <button
                onClick={() => setShowInviteLink(!showInviteLink)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                {showInviteLink ? 'Hide' : 'Show'}
              </button>
              <button
                onClick={copyInviteLink}
                className="text-xs text-green-600 hover:text-green-800"
              >
                Copy
              </button>
            </div>
          ) : (
            <button
              onClick={generateInviteToken}
              disabled={isGeneratingToken}
              className="text-xs text-purple-600 hover:text-purple-800 disabled:opacity-50"
            >
              {isGeneratingToken ? 'Generating...' : 'Generate'}
            </button>
          )}
        </div>
        
        {guest.inviteToken && showInviteLink && (
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs break-all">
            <div className="text-gray-600 mb-1">Personal invite link:</div>
            <div className="text-blue-600 font-mono">{getInviteLink()}</div>
          </div>
        )}
      </div>
    </div>
  );
}