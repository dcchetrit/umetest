'use client';

import { useState, useEffect } from 'react';
import { Couple, Event, Group, Guest, PlusOne, RSVPResponse } from '@ume/shared';
import { FirestoreService } from '@ume/shared';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface RSVPFormProps {
  coupleSlug: string;
  token?: string;
}

interface FormData {
  guestName: string;
  status: 'accepted' | 'declined' | 'maybe';
  events: { [eventId: string]: boolean };
  dietaryRestrictions: string;
  mealChoice: string;
  plusOnes: PlusOne[];
  comments: string;
}

export default function RSVPForm({ coupleSlug, token }: RSVPFormProps) {
  const t = useTranslations('rsvp');
  const tCommon = useTranslations('common');
  const [couple, setCouple] = useState<Couple | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Access control
  const [accessGranted, setAccessGranted] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [accessMode, setAccessMode] = useState<'token' | 'password'>('password');

  const [formData, setFormData] = useState<FormData>({
    guestName: '',
    status: 'accepted',
    events: {},
    dietaryRestrictions: '',
    mealChoice: '',
    plusOnes: [],
    comments: ''
  });

  useEffect(() => {
    loadWeddingData();
    if (token) {
      setAccessMode('token');
      validateToken(token);
    }
  }, [coupleSlug, token]);

  const loadWeddingData = async () => {
    try {
      setLoading(true);
      // TODO: In real implementation, look up couple by slug
      // For now using a default couple ID - this should be dynamic based on slug
      const defaultCoupleId = 'couple-default';
      const coupleData = await FirestoreService.getCouple(defaultCoupleId);
      const eventsData = await FirestoreService.getEvents(defaultCoupleId);
      const groupsData = await FirestoreService.getCollection(`couples/${defaultCoupleId}/groups`);
      
      setCouple(coupleData);
      setEvents(eventsData);
      setGroups(groupsData);
      
      // Initialize events in form data
      const eventDefaults: { [eventId: string]: boolean } = {};
      eventsData.forEach(event => {
        eventDefaults[event.id] = false;
      });
      setFormData(prev => ({ ...prev, events: eventDefaults }));
      
    } catch (error) {
      console.error('Error loading wedding data:', error);
      setError(tCommon('status.error'));
    } finally {
      setLoading(false);
    }
  };

  const validateToken = async (tokenValue: string) => {
    try {
      // In real implementation, validate token server-side
      // For demo, just grant access
      setAccessGranted(true);
      setFormData(prev => ({ ...prev, guestName: 'John Doe' })); // Pre-fill for token users
    } catch (error) {
      setError(t('access.access_denied'));
    }
  };

  const validatePassword = async () => {
    try {
      // Find matching group password
      const group = groups.find(g => g.password === passwordInput);
      if (group) {
        setAccessGranted(true);
        // Filter events based on group permissions
        const filteredEvents = events.filter(e => group.allowedEvents.includes(e.id));
        const eventDefaults: { [eventId: string]: boolean } = {};
        filteredEvents.forEach(event => {
          eventDefaults[event.id] = false;
        });
        setFormData(prev => ({ ...prev, events: eventDefaults }));
      } else {
        setError(t('access.invalid_password'));
      }
    } catch (error) {
      setError(t('access.access_denied'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couple || !formData.guestName.trim()) return;

    setSubmitting(true);
    try {
      // Create RSVP response object
      const rsvpResponse: RSVPResponse = {
        status: formData.status,
        events: formData.events,
        dietaryRestrictions: formData.dietaryRestrictions || undefined,
        mealChoice: formData.mealChoice || undefined,
        plusOnes: formData.plusOnes,
        comments: formData.comments || undefined,
        submittedAt: new Date()
      };

      // In real implementation:
      // 1. Find or create guest record
      // 2. Update RSVP response
      // 3. Send confirmation email to couple
      // 4. Send confirmation to guest

      console.log('RSVP Submitted:', {
        guestName: formData.guestName,
        rsvp: rsvpResponse,
        coupleId: defaultCoupleId
      });

      setSubmitted(true);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      setError(t('messages.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const addPlusOne = () => {
    setFormData(prev => ({
      ...prev,
      plusOnes: [...prev.plusOnes, { name: '', dietaryRestrictions: '', mealChoice: '' }]
    }));
  };

  const removePlusOne = (index: number) => {
    setFormData(prev => ({
      ...prev,
      plusOnes: prev.plusOnes.filter((_, i) => i !== index)
    }));
  };

  const updatePlusOne = (index: number, field: keyof PlusOne, value: string) => {
    setFormData(prev => ({
      ...prev,
      plusOnes: prev.plusOnes.map((plusOne, i) => 
        i === index ? { ...plusOne, [field]: value } : plusOne
      )
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  if (error && !couple) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('form.title')}</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <Link href="/" className="text-pink-500 hover:text-pink-700">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  // Access control screen
  if (!accessGranted) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-gray-900">{t('access.title')}</h1>
              <p className="text-gray-600 mt-2">
                {couple && `${couple.profile.names.partner1} & ${couple.profile.names.partner2}`}
              </p>
            </div>

            {accessMode === 'password' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t('access.enter_password')}
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder={t('access.password_placeholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  onKeyPress={(e) => e.key === 'Enter' && validatePassword()}
                />
                <button
                  onClick={validatePassword}
                  className="w-full mt-4 bg-pink-500 text-white py-2 px-4 rounded-md hover:bg-pink-600"
                >
                  {t('access.access_button')}
                </button>
              </div>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
                {error}
              </div>
            )}

            <div className="mt-6 text-center">
              <Link
                href={`/rsvp/${coupleSlug}`}
                className="text-pink-500 hover:text-pink-700 text-sm"
              >
                {t('access.back_to_wedding')}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success screen
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {t('messages.submitted')}
            </h1>
            <p className="text-gray-600 mb-6">
              {t('messages.confirmation_sent')}
            </p>
            
            <Link
              href={`/rsvp/${coupleSlug}`}
              className="inline-block bg-pink-500 text-white py-2 px-6 rounded-md hover:bg-pink-600"
            >
              Back to Wedding Info
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Available events (filtered by group if using password access)
  const availableEvents = accessMode === 'password' 
    ? events.filter(e => {
        const group = groups.find(g => g.password === passwordInput);
        return group?.allowedEvents.includes(e.id);
      })
    : events;

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {t('form.title')}
            </h1>
            {couple && (
              <p className="text-lg text-gray-600">
                {couple.profile.names.partner1} & {couple.profile.names.partner2}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Guest Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('form.guest_name')} *
              </label>
              <input
                type="text"
                required
                value={formData.guestName}
                onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder={t('form.guest_name')}
              />
            </div>

            {/* Attendance Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {t('form.attending')} *
              </label>
              <div className="space-y-2">
                {['accepted', 'declined', 'maybe'].map(status => (
                  <label key={status} className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      value={status}
                      checked={formData.status === status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="mr-2"
                    />
                    <span>{t(`form.${status}`)}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Event Selection (only if attending) */}
            {formData.status !== 'declined' && availableEvents.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  {t('form.events')}
                </label>
                <div className="space-y-2">
                  {availableEvents.map(event => (
                    <label key={event.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.events[event.id] || false}
                        onChange={(e) => setFormData({
                          ...formData,
                          events: { ...formData.events, [event.id]: e.target.checked }
                        })}
                        className="mr-2"
                      />
                      <span>{event.name} - {new Date(event.date).toLocaleDateString()}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Meal Preferences (only if attending) */}
            {formData.status !== 'declined' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('form.meal_preference')}
                  </label>
                  <select
                    value={formData.mealChoice}
                    onChange={(e) => setFormData({ ...formData, mealChoice: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="">{t('form.meal_options.select')}</option>
                    <option value="chicken">{t('form.meal_options.chicken')}</option>
                    <option value="beef">{t('form.meal_options.beef')}</option>
                    <option value="fish">{t('form.meal_options.fish')}</option>
                    <option value="vegetarian">{t('form.meal_options.vegetarian')}</option>
                    <option value="vegan">{t('form.meal_options.vegan')}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('form.dietary_restrictions')}
                  </label>
                  <input
                    type="text"
                    value={formData.dietaryRestrictions}
                    onChange={(e) => setFormData({ ...formData, dietaryRestrictions: e.target.value })}
                    placeholder={t('form.dietary_placeholder')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>
            )}

            {/* Plus Ones (only if attending) */}
            {formData.status !== 'declined' && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-gray-700">
                    {t('form.plus_ones')}
                  </label>
                  <button
                    type="button"
                    onClick={addPlusOne}
                    className="text-sm bg-gray-500 text-white px-3 py-1 rounded hover:bg-gray-600"
                  >
                    {t('form.add_plus_one')}
                  </button>
                </div>

                {formData.plusOnes.map((plusOne, index) => (
                  <div key={index} className="border border-gray-200 rounded-md p-4 mb-3">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="font-medium">Guest {index + 1}</h4>
                      <button
                        type="button"
                        onClick={() => removePlusOne(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        {t('form.remove_plus_one')}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder={t('form.plus_one_name')}
                        value={plusOne.name}
                        onChange={(e) => updatePlusOne(index, 'name', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                      <select
                        value={plusOne.mealChoice || ''}
                        onChange={(e) => updatePlusOne(index, 'mealChoice', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      >
                        <option value="">{t('form.meal_options.select')}</option>
                        <option value="chicken">{t('form.meal_options.chicken')}</option>
                        <option value="beef">{t('form.meal_options.beef')}</option>
                        <option value="fish">{t('form.meal_options.fish')}</option>
                        <option value="vegetarian">{t('form.meal_options.vegetarian')}</option>
                        <option value="vegan">{t('form.meal_options.vegan')}</option>
                      </select>
                      <input
                        type="text"
                        placeholder={t('form.dietary_restrictions')}
                        value={plusOne.dietaryRestrictions || ''}
                        onChange={(e) => updatePlusOne(index, 'dietaryRestrictions', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('form.comments')}
              </label>
              <textarea
                rows={3}
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                placeholder={t('form.comments_placeholder')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>

            {/* Error Display */}
            {error && (
              <div className="p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-pink-500 text-white py-3 px-6 rounded-md hover:bg-pink-600 disabled:opacity-50"
              >
                {submitting ? t('messages.loading') : t('form.submit_rsvp')}
              </button>
              
              <Link
                href={`/rsvp/${coupleSlug}`}
                className="flex-1 text-center bg-gray-500 text-white py-3 px-6 rounded-md hover:bg-gray-600"
              >
                {tCommon('buttons.back')}
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}