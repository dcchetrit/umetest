'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db, FirestoreService, Guest, Group } from '@ume/shared';
import Head from 'next/head';
import TemplateRouter from '@/components/templates/TemplateRouter';

interface WebsiteEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  address: string;
  description?: string;
  dresscode?: string;
  picture?: string;
}

interface Accommodation {
  id: string;
  name: string;
  type: 'hotel' | 'airbnb' | 'other';
  address: string;
  phone?: string;
  website?: string;
  description?: string;
  priceRange?: string;
  distance?: string;
  picture?: string;
}

interface Contact {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
}

interface WebsiteSettings {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  branding: {
    logo?: string;
    favicon?: string;
    heroPicture?: string;
    coupleName: string;
    weddingDate: string;
    tagline?: string;
  };
  sections: {
    hero: boolean;
    story: boolean;
    gallery: boolean;
    events: boolean;
    rsvp: boolean;
    registry: boolean;
    accommodations: boolean;
    contact: boolean;
  };
  layout: {
    template: 'classic' | 'modern' | 'elegant' | 'minimal';
    navigation: 'top';
  };
  content: {
    heroMessage?: string;
    storyText?: string;
    additionalInfo?: string;
  };
  events: WebsiteEvent[];
  accommodations: Accommodation[];
  contacts: Contact[];
  registry?: {
    message?: string;
    links: Array<{
      store: string;
      url: string;
    }>;
  };
}

interface PersonalizedInviteClientProps {
  locale: string;
  coupleSlug: string;
  guestSlug: string;
}

export default function PersonalizedInviteClient({ 
  locale, 
  coupleSlug, 
  guestSlug 
}: PersonalizedInviteClientProps) {
  const [settings, setSettings] = useState<WebsiteSettings | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const [guestGroup, setGuestGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coupleId, setCoupleId] = useState<string | null>(null);
  const [personalizedEvents, setPersonalizedEvents] = useState<WebsiteEvent[]>([]);
  const [showRSVPForm, setShowRSVPForm] = useState(false);

  useEffect(() => {
    loadPersonalizedWebsite();
  }, [coupleSlug, guestSlug]);

  const loadPersonalizedWebsite = async () => {
    try {
      setLoading(true);
      setError(null);

      // Find couple by slug
      const couplesRef = collection(db, 'couples');
      const coupleQuery = query(couplesRef, where('profile.slug', '==', coupleSlug));
      const coupleSnapshot = await getDocs(coupleQuery);

      if (coupleSnapshot.empty) {
        setError('Wedding website not found');
        return;
      }

      const coupleDoc = coupleSnapshot.docs[0];
      const currentCoupleId = coupleDoc.id;
      setCoupleId(currentCoupleId);

      // Find guest by slug
      const guestData = await FirestoreService.getGuestBySlug(currentCoupleId, guestSlug);
      if (!guestData) {
        setError('Invalid invitation link');
        return;
      }
      setGuest(guestData);

      // Get guest's group
      const groupData = await FirestoreService.getCollection(`couples/${currentCoupleId}/groups`);
      const currentGroup = groupData.find(g => g.id === guestData.groupId);
      if (currentGroup) {
        setGuestGroup(currentGroup);
      }

      // Load website settings
      const websiteDocRef = doc(db, 'couples', currentCoupleId, 'settings', 'website');
      const websiteDocSnap = await getDoc(websiteDocRef);

      if (websiteDocSnap.exists()) {
        const websiteSettings = websiteDocSnap.data() as WebsiteSettings;
        setSettings(websiteSettings);

        // Filter events based on guest group permissions
        if (currentGroup && websiteSettings.events) {
          const allowedEvents = websiteSettings.events.filter(event => 
            currentGroup.allowedEvents.includes(event.id)
          );
          setPersonalizedEvents(allowedEvents);
        } else {
          setPersonalizedEvents(websiteSettings.events || []);
        }
      }

    } catch (error) {
      console.error('Error loading personalized website:', error);
      setError('Failed to load website');
    } finally {
      setLoading(false);
    }
  };

  const handleRSVPSubmit = async (rsvpData: any) => {
    if (!coupleId || !guest) return;

    try {
      await FirestoreService.updateGuest(coupleId, guest.id, {
        rsvp: {
          ...rsvpData,
          submittedAt: new Date()
        }
      });
      
      // Refresh guest data
      const updatedGuest = await FirestoreService.getGuestBySlug(coupleId, guestSlug);
      setGuest(updatedGuest);
      setShowRSVPForm(false);
    } catch (error) {
      console.error('Error submitting RSVP:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Oops!</h1>
          <p className="text-gray-600 mb-8">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!settings || !guest) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Website not available</h1>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{settings.branding.coupleName} - Wedding</title>
        <meta name="description" content={`You're invited to ${settings.branding.coupleName}'s wedding`} />
        {settings.branding.favicon && <link rel="icon" href={settings.branding.favicon} />}
      </Head>

      <TemplateRouter
        guest={guest}
        guestGroup={guestGroup}
        settings={settings}
        personalizedEvents={personalizedEvents}
        coupleId={coupleId}
      />

      {/* RSVP Modal - Pre-filled with guest data */}
      {showRSVPForm && (
        <PersonalizedRSVPForm
          guest={guest}
          events={personalizedEvents}
          colors={settings.colors}
          onSubmit={handleRSVPSubmit}
          onClose={() => setShowRSVPForm(false)}
        />
      )}
    </>
  );
}

// Personalized RSVP Form Component
interface PersonalizedRSVPFormProps {
  guest: Guest;
  events: WebsiteEvent[];
  colors: any;
  onSubmit: (data: any) => void;
  onClose: () => void;
}

function PersonalizedRSVPForm({ guest, events, colors, onSubmit, onClose }: PersonalizedRSVPFormProps) {
  const [status, setStatus] = useState(guest.rsvp?.status || 'pending');
  const [eventAttendance, setEventAttendance] = useState<{[key: string]: boolean}>({});
  const [dietaryRestrictions, setDietaryRestrictions] = useState(guest.rsvp?.dietaryRestrictions || '');
  const [mealChoice, setMealChoice] = useState(guest.rsvp?.mealChoice || '');
  const [plusOnes, setPlusOnes] = useState(guest.rsvp?.plusOnes || []);
  const [comments, setComments] = useState(guest.rsvp?.comments || '');

  useEffect(() => {
    // Initialize event attendance from existing RSVP
    if (guest.rsvp?.events) {
      setEventAttendance(guest.rsvp.events);
    }
  }, [guest.rsvp]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const rsvpData = {
      status,
      events: eventAttendance,
      dietaryRestrictions: dietaryRestrictions || undefined,
      mealChoice: mealChoice || undefined,
      plusOnes,
      comments: comments || undefined
    };
    
    onSubmit(rsvpData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold" style={{ color: colors.primary }}>
              RSVP for {guest.firstName}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* RSVP Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Will you be attending?
              </label>
              <div className="space-y-2">
                {['accepted', 'declined', 'maybe'].map((option) => (
                  <label key={option} className="flex items-center">
                    <input
                      type="radio"
                      name="status"
                      value={option}
                      checked={status === option}
                      onChange={(e) => setStatus(e.target.value as any)}
                      className="mr-2"
                    />
                    {option === 'accepted' ? 'Yes, I will attend' :
                     option === 'declined' ? 'No, I cannot attend' :
                     'Maybe, I\'m not sure yet'}
                  </label>
                ))}
              </div>
            </div>

            {/* Event Selection */}
            {events.length > 1 && status === 'accepted' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Which events will you attend?
                </label>
                <div className="space-y-2">
                  {events.map((event) => (
                    <label key={event.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={eventAttendance[event.id] || false}
                        onChange={(e) => setEventAttendance({
                          ...eventAttendance,
                          [event.id]: e.target.checked
                        })}
                        className="mr-2"
                      />
                      {event.name} - {event.date} at {event.time}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Dietary Restrictions */}
            {status === 'accepted' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dietary Restrictions (Optional)
                </label>
                <input
                  type="text"
                  value={dietaryRestrictions}
                  onChange={(e) => setDietaryRestrictions(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  placeholder="Any dietary restrictions or allergies?"
                />
              </div>
            )}

            {/* Comments */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Comments (Optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-md"
                rows={3}
                placeholder="Any special requests or messages..."
              />
            </div>

            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-3 text-white rounded-lg hover:opacity-90"
                style={{ backgroundColor: colors.primary }}
              >
                Submit RSVP
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}