'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@ume/shared';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import NavigationStyleSelector from '@/components/website/NavigationStyleSelector';
import TemplateStyleSelector from '@/components/website/TemplateStyleSelector';

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
    navigation: 'top' | 'side' | 'overlay';
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

const defaultSettings: WebsiteSettings = {
  colors: {
    primary: '#8B5CF6',
    secondary: '#EC4899',
    accent: '#F59E0B',
    background: '#FFFFFF',
    text: '#1F2937'
  },
  branding: {
    coupleName: '',
    weddingDate: '',
    tagline: ''
  },
  sections: {
    hero: true,
    story: true,
    gallery: true,
    events: true,
    rsvp: true,
    registry: false,
    accommodations: true,
    contact: true
  },
  layout: {
    template: 'classic',
    navigation: 'top'
  },
  content: {
    heroMessage: '',
    storyText: '',
    additionalInfo: ''
  },
  events: [],
  accommodations: [],
  contacts: [],
  registry: {
    message: '',
    links: []
  }
};

export default function WebsiteClient({ locale }: { locale: string }) {
  const { user } = useAuth();

  // Authentication guard
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to customize your website</h1>
          <Link href={`/${locale}/login`} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Login
          </Link>
        </div>
      </div>
    );
  }

  const coupleId = user.uid;
  const [settings, setSettings] = useState<WebsiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('colors');
  const [editingEvent, setEditingEvent] = useState<WebsiteEvent | null>(null);
  const [editingAccommodation, setEditingAccommodation] = useState<Accommodation | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [heroPictureFile, setHeroPictureFile] = useState<File | null>(null);
  const [eventPictureFiles, setEventPictureFiles] = useState<{ [eventId: string]: File }>({});
  const [accommodationPictureFiles, setAccommodationPictureFiles] = useState<{ [accommodationId: string]: File }>({});

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      // Load from both the old website settings and the couple document
      const [websiteDocRef, coupleDocRef] = [
        doc(db, 'couples', coupleId, 'settings', 'website'),
        doc(db, 'couples', coupleId)
      ];
      
      const [websiteDocSnap, coupleDocSnap] = await Promise.all([
        getDoc(websiteDocRef),
        getDoc(coupleDocRef)
      ]);
      
      let loadedSettings = { ...defaultSettings };
      
      // Load website settings first
      if (websiteDocSnap.exists()) {
        loadedSettings = { ...loadedSettings, ...websiteDocSnap.data() };
      }
      
      // Then load events from couple document if available
      if (coupleDocSnap.exists()) {
        const coupleData = coupleDocSnap.data();
        if (coupleData.events && coupleData.events.length > 0) {
          // Convert couple document events to website events format
          const websiteEvents = coupleData.events.map((event: any) => ({
            id: event.id || event.name.replace(/\s+/g, '-').toLowerCase(),
            name: event.name,
            date: event.date || '',
            time: event.time || '',
            location: event.location || '',
            address: event.address || '',
            description: event.description || '',
            dresscode: event.dresscode || '',
            picture: event.picture || ''
          }));
          loadedSettings.events = websiteEvents;
        }
      }
      
      setSettings(loadedSettings);
    } catch (error) {
      console.error('Error loading website settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      let updatedSettings = { ...settings };

      if (logoFile) {
        const logoRef = ref(storage, `couples/${coupleId}/branding/logo`);
        await uploadBytes(logoRef, logoFile);
        const logoUrl = await getDownloadURL(logoRef);
        updatedSettings.branding.logo = logoUrl;
        setLogoFile(null);
      }

      if (faviconFile) {
        const faviconRef = ref(storage, `couples/${coupleId}/branding/favicon`);
        await uploadBytes(faviconRef, faviconFile);
        const faviconUrl = await getDownloadURL(faviconRef);
        updatedSettings.branding.favicon = faviconUrl;
        setFaviconFile(null);
      }

      if (heroPictureFile) {
        const heroPictureRef = ref(storage, `couples/${coupleId}/branding/heroPicture`);
        await uploadBytes(heroPictureRef, heroPictureFile);
        const heroPictureUrl = await getDownloadURL(heroPictureRef);
        updatedSettings.branding.heroPicture = heroPictureUrl;
        setHeroPictureFile(null);
      }

      // Upload event pictures
      for (const eventId in eventPictureFiles) {
        const file = eventPictureFiles[eventId];
        const eventPictureRef = ref(storage, `couples/${coupleId}/events/${eventId}/picture`);
        await uploadBytes(eventPictureRef, file);
        const eventPictureUrl = await getDownloadURL(eventPictureRef);
        
        const eventIndex = updatedSettings.events.findIndex(e => e.id === eventId);
        if (eventIndex !== -1) {
          updatedSettings.events[eventIndex].picture = eventPictureUrl;
        }
      }
      setEventPictureFiles({});

      // Upload accommodation pictures
      for (const accommodationId in accommodationPictureFiles) {
        const file = accommodationPictureFiles[accommodationId];
        const accommodationPictureRef = ref(storage, `couples/${coupleId}/accommodations/${accommodationId}/picture`);
        await uploadBytes(accommodationPictureRef, file);
        const accommodationPictureUrl = await getDownloadURL(accommodationPictureRef);
        
        const accommodationIndex = updatedSettings.accommodations.findIndex(a => a.id === accommodationId);
        if (accommodationIndex !== -1) {
          updatedSettings.accommodations[accommodationIndex].picture = accommodationPictureUrl;
        }
      }
      setAccommodationPictureFiles({});

      const docRef = doc(db, 'couples', coupleId, 'settings', 'website');
      await setDoc(docRef, updatedSettings, { merge: true });
      setSettings(updatedSettings);
    } catch (error) {
      console.error('Error saving website settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSettings = (path: string, value: any) => {
    setSettings(prev => {
      const keys = path.split('.');
      const updated = { ...prev };
      let current: any = updated;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return updated;
    });
  };

  // Event management
  const addEvent = () => {
    const newEvent: WebsiteEvent = {
      id: Date.now().toString(),
      name: '',
      date: '',
      time: '',
      location: '',
      address: '',
      description: '',
      dresscode: '',
      picture: ''
    };
    setEditingEvent(newEvent);
  };

  const saveEvent = async () => {
    if (!editingEvent) return;
    
    try {
      // Update local website settings first
      setSettings(prev => ({
        ...prev,
        events: editingEvent.id && prev.events.find(e => e.id === editingEvent.id)
          ? prev.events.map(e => e.id === editingEvent.id ? editingEvent : e)
          : [...prev.events, editingEvent]
      }));

      // Also update the couple document events
      const coupleDocRef = doc(db, 'couples', coupleId);
      const coupleDoc = await getDoc(coupleDocRef);
      
      if (coupleDoc.exists()) {
        const coupleData = coupleDoc.data();
        const currentEvents = coupleData.events || [];
        
        // Convert website event to couple document event format with showOnWebsite: true
        const coupleEvent = {
          name: editingEvent.name,
          date: editingEvent.date,
          time: editingEvent.time,
          location: editingEvent.location,
          address: editingEvent.address,
          description: editingEvent.description,
          dresscode: editingEvent.dresscode,
          picture: editingEvent.picture,
          showOnWebsite: true, // Automatically set to true for website events
          createdAt: new Date()
        };

        // Check if event already exists in couple document
        const existingEventIndex = currentEvents.findIndex((e: any) => 
          e.name === editingEvent.name || 
          (e.id && e.id === editingEvent.id)
        );

        let updatedEvents;
        if (existingEventIndex >= 0) {
          // Update existing event
          updatedEvents = currentEvents.map((e: any, index: number) => 
            index === existingEventIndex ? { ...e, ...coupleEvent } : e
          );
        } else {
          // Add new event
          updatedEvents = [...currentEvents, coupleEvent];
        }

        // Update couple document
        await updateDoc(coupleDocRef, {
          events: updatedEvents
        });

        console.log('Event saved to both website settings and couple document with showOnWebsite: true');
      }
      
      setEditingEvent(null);
    } catch (error) {
      console.error('Error saving event:', error);
      setEditingEvent(null);
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      // Find the event to delete to get its name
      const eventToDelete = settings.events.find(e => e.id === id);
      if (!eventToDelete) return;

      // Update website settings
      const updatedSettings = {
        ...settings,
        events: settings.events.filter(e => e.id !== id)
      };
      
      const websiteDocRef = doc(db, 'couples', coupleId, 'settings', 'website');
      await setDoc(websiteDocRef, updatedSettings, { merge: true });
      setSettings(updatedSettings);

      // Also remove from couple document
      const coupleDocRef = doc(db, 'couples', coupleId);
      const coupleDoc = await getDoc(coupleDocRef);
      
      if (coupleDoc.exists()) {
        const coupleData = coupleDoc.data();
        const currentEvents = coupleData.events || [];
        
        // Remove event by name from couple document
        const updatedEvents = currentEvents.filter((event: any) => 
          event.name !== eventToDelete.name
        );

        await updateDoc(coupleDocRef, {
          events: updatedEvents
        });

        console.log('Event deleted from both website settings and couple document');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
    }
  };

  // Accommodation management
  const addAccommodation = () => {
    const newAccommodation: Accommodation = {
      id: Date.now().toString(),
      name: '',
      type: 'hotel',
      address: '',
      phone: '',
      website: '',
      description: '',
      priceRange: '',
      distance: '',
      picture: ''
    };
    setEditingAccommodation(newAccommodation);
  };

  const saveAccommodation = () => {
    if (!editingAccommodation) return;
    
    setSettings(prev => ({
      ...prev,
      accommodations: editingAccommodation.id && prev.accommodations.find(a => a.id === editingAccommodation.id)
        ? prev.accommodations.map(a => a.id === editingAccommodation.id ? editingAccommodation : a)
        : [...prev.accommodations, editingAccommodation]
    }));
    setEditingAccommodation(null);
  };

  const deleteAccommodation = (id: string) => {
    setSettings(prev => ({
      ...prev,
      accommodations: prev.accommodations.filter(a => a.id !== id)
    }));
  };

  // Contact management
  const addContact = () => {
    const newContact: Contact = {
      id: Date.now().toString(),
      name: '',
      role: '',
      phone: '',
      email: ''
    };
    setEditingContact(newContact);
  };

  const saveContact = () => {
    if (!editingContact) return;
    
    setSettings(prev => ({
      ...prev,
      contacts: editingContact.id && prev.contacts.find(c => c.id === editingContact.id)
        ? prev.contacts.map(c => c.id === editingContact.id ? editingContact : c)
        : [...prev.contacts, editingContact]
    }));
    setEditingContact(null);
  };

  const deleteContact = (id: string) => {
    setSettings(prev => ({
      ...prev,
      contacts: prev.contacts.filter(c => c.id !== id)
    }));
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  const tabs = ['colors', 'branding', 'sections', 'layout', 'content', 'events', 'accommodations', 'registry'];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Website Customization
        </h1>
        <p className="text-gray-600">
          Customize your wedding website's appearance and content
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                activeTab === tab
                  ? 'bg-white text-purple-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        {activeTab === 'colors' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Colors & Theme</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Object.keys(settings.colors).map((colorKey) => (
                <div key={colorKey} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 capitalize">
                    {colorKey} Color
                  </label>
                  <div className="flex items-center space-x-3">
                    <input
                      type="color"
                      value={settings.colors[colorKey as keyof typeof settings.colors]}
                      onChange={(e) => updateSettings(`colors.${colorKey}`, e.target.value)}
                      className="h-10 w-16 rounded-md border border-gray-300"
                    />
                    <input
                      type="text"
                      value={settings.colors[colorKey as keyof typeof settings.colors]}
                      onChange={(e) => updateSettings(`colors.${colorKey}`, e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-md"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'branding' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Branding</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Couple Name
                  </label>
                  <input
                    type="text"
                    value={settings.branding.coupleName}
                    onChange={(e) => updateSettings('branding.coupleName', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    placeholder="John & Jane"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Wedding Date
                  </label>
                  <input
                    type="date"
                    value={settings.branding.weddingDate}
                    onChange={(e) => updateSettings('branding.weddingDate', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tagline
                  </label>
                  <input
                    type="text"
                    value={settings.branding.tagline || ''}
                    onChange={(e) => updateSettings('branding.tagline', e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    placeholder="Our love story begins..."
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Logo
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                  />
                  {settings.branding.logo && (
                    <img src={settings.branding.logo} alt="Logo" className="mt-2 h-16 object-contain" />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Favicon
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFaviconFile(e.target.files?.[0] || null)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                  />
                  {settings.branding.favicon && (
                    <img src={settings.branding.favicon} alt="Favicon" className="mt-2 h-8 w-8 object-contain" />
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Hero Picture
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setHeroPictureFile(e.target.files?.[0] || null)}
                    className="w-full p-3 border border-gray-300 rounded-md"
                  />
                  {settings.branding.heroPicture && (
                    <img src={settings.branding.heroPicture} alt="Hero Picture" className="mt-2 h-32 object-cover rounded-md" />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sections' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Website Sections</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.keys(settings.sections).map((sectionKey) => (
                <div key={sectionKey} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg">
                  <input
                    type="checkbox"
                    id={sectionKey}
                    checked={settings.sections[sectionKey as keyof typeof settings.sections]}
                    onChange={(e) => updateSettings(`sections.${sectionKey}`, e.target.checked)}
                    className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <label htmlFor={sectionKey} className="text-sm font-medium text-gray-700 capitalize">
                    {sectionKey}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'layout' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold mb-2">Layout & Design</h2>
              <p className="text-gray-600 mb-6">
                Customize your website's visual appearance and navigation structure
              </p>
            </div>
            
            <TemplateStyleSelector
              value={settings.layout.template}
              onChange={(value) => updateSettings('layout.template', value)}
              colors={settings.colors}
            />
            
            <div className="border-t border-gray-200 pt-8">
              <NavigationStyleSelector
                value={settings.layout.navigation}
                onChange={(value) => updateSettings('layout.navigation', value)}
                colors={settings.colors}
              />
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Content</h2>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Hero Message
                </label>
                <textarea
                  value={settings.content.heroMessage || ''}
                  onChange={(e) => updateSettings('content.heroMessage', e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  placeholder="Welcome to our wedding website..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Our Story
                </label>
                <textarea
                  value={settings.content.storyText || ''}
                  onChange={(e) => updateSettings('content.storyText', e.target.value)}
                  rows={5}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  placeholder="Tell your love story..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Information
                </label>
                <textarea
                  value={settings.content.additionalInfo || ''}
                  onChange={(e) => updateSettings('content.additionalInfo', e.target.value)}
                  rows={4}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  placeholder="Any additional information for your guests..."
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Events</h2>
              <button
                onClick={addEvent}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                Add Event
              </button>
            </div>

            <div className="grid gap-4">
              {settings.events.map((event) => (
                <div key={event.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{event.name || 'Untitled Event'}</h3>
                    <div className="space-x-2">
                      <button
                        onClick={() => setEditingEvent(event)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteEvent(event.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600">{event.date} at {event.time}</p>
                  <p className="text-sm text-gray-600">{event.location}</p>
                </div>
              ))}
            </div>

            {/* Event Modal */}
            {editingEvent && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingEvent.id && settings.events.find(e => e.id === editingEvent.id) ? 'Edit Event' : 'Add Event'}
                  </h3>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Event Name"
                      value={editingEvent.name}
                      onChange={(e) => setEditingEvent({ ...editingEvent, name: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <input
                      type="date"
                      value={editingEvent.date}
                      onChange={(e) => setEditingEvent({ ...editingEvent, date: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <input
                      type="time"
                      value={editingEvent.time}
                      onChange={(e) => setEditingEvent({ ...editingEvent, time: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Location"
                      value={editingEvent.location}
                      onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Address"
                      value={editingEvent.address}
                      onChange={(e) => setEditingEvent({ ...editingEvent, address: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <textarea
                      placeholder="Description"
                      value={editingEvent.description || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                      rows={3}
                    />
                    <input
                      type="text"
                      placeholder="Dress Code"
                      value={editingEvent.dresscode || ''}
                      onChange={(e) => setEditingEvent({ ...editingEvent, dresscode: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event Picture (Optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && editingEvent.id) {
                            setEventPictureFiles(prev => ({
                              ...prev,
                              [editingEvent.id]: file
                            }));
                          }
                        }}
                        className="w-full p-3 border border-gray-300 rounded-md"
                      />
                      {editingEvent.picture && (
                        <img src={editingEvent.picture} alt="Event" className="mt-2 h-32 w-full object-cover rounded-md" />
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => setEditingEvent(null)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveEvent}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'accommodations' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Accommodations</h2>
              <button
                onClick={addAccommodation}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
              >
                Add Accommodation
              </button>
            </div>

            <div className="grid gap-4">
              {settings.accommodations.map((accommodation) => (
                <div key={accommodation.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium">{accommodation.name || 'Untitled Accommodation'}</h3>
                    <div className="space-x-2">
                      <button
                        onClick={() => setEditingAccommodation(accommodation)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteAccommodation(accommodation.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 capitalize">{accommodation.type}</p>
                  <p className="text-sm text-gray-600">{accommodation.address}</p>
                  {accommodation.priceRange && (
                    <p className="text-sm text-gray-600">{accommodation.priceRange}</p>
                  )}
                </div>
              ))}
            </div>

            {/* Accommodation Modal */}
            {editingAccommodation && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-md">
                  <h3 className="text-lg font-semibold mb-4">
                    {editingAccommodation.id && settings.accommodations.find(a => a.id === editingAccommodation.id) ? 'Edit Accommodation' : 'Add Accommodation'}
                  </h3>
                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Name"
                      value={editingAccommodation.name}
                      onChange={(e) => setEditingAccommodation({ ...editingAccommodation, name: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <select
                      value={editingAccommodation.type}
                      onChange={(e) => setEditingAccommodation({ ...editingAccommodation, type: e.target.value as 'hotel' | 'airbnb' | 'other' })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    >
                      <option value="hotel">Hotel</option>
                      <option value="airbnb">Airbnb</option>
                      <option value="other">Other</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Address"
                      value={editingAccommodation.address}
                      onChange={(e) => setEditingAccommodation({ ...editingAccommodation, address: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Phone"
                      value={editingAccommodation.phone || ''}
                      onChange={(e) => setEditingAccommodation({ ...editingAccommodation, phone: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <input
                      type="url"
                      placeholder="Website"
                      value={editingAccommodation.website || ''}
                      onChange={(e) => setEditingAccommodation({ ...editingAccommodation, website: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Price Range (e.g., $100-200/night)"
                      value={editingAccommodation.priceRange || ''}
                      onChange={(e) => setEditingAccommodation({ ...editingAccommodation, priceRange: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <input
                      type="text"
                      placeholder="Distance from venue"
                      value={editingAccommodation.distance || ''}
                      onChange={(e) => setEditingAccommodation({ ...editingAccommodation, distance: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                    />
                    <textarea
                      placeholder="Description"
                      value={editingAccommodation.description || ''}
                      onChange={(e) => setEditingAccommodation({ ...editingAccommodation, description: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-md"
                      rows={3}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Accommodation Picture (Optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file && editingAccommodation.id) {
                            setAccommodationPictureFiles(prev => ({
                              ...prev,
                              [editingAccommodation.id]: file
                            }));
                          }
                        }}
                        className="w-full p-3 border border-gray-300 rounded-md"
                      />
                      {editingAccommodation.picture && (
                        <img src={editingAccommodation.picture} alt="Accommodation" className="mt-2 h-32 w-full object-cover rounded-md" />
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      onClick={() => setEditingAccommodation(null)}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveAccommodation}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'registry' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold mb-4">Gift Registry</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registry Message
                </label>
                <textarea
                  value={settings.registry?.message || ''}
                  onChange={(e) => updateSettings('registry.message', e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-gray-300 rounded-md"
                  placeholder="Your presence is the only present we need..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registry Links
                </label>
                {settings.registry?.links.map((link, index) => (
                  <div key={index} className="flex space-x-3 mb-3">
                    <input
                      type="text"
                      placeholder="Store Name"
                      value={link.store}
                      onChange={(e) => {
                        const newLinks = [...(settings.registry?.links || [])];
                        newLinks[index] = { ...link, store: e.target.value };
                        updateSettings('registry.links', newLinks);
                      }}
                      className="flex-1 p-3 border border-gray-300 rounded-md"
                    />
                    <input
                      type="url"
                      placeholder="Registry URL"
                      value={link.url}
                      onChange={(e) => {
                        const newLinks = [...(settings.registry?.links || [])];
                        newLinks[index] = { ...link, url: e.target.value };
                        updateSettings('registry.links', newLinks);
                      }}
                      className="flex-1 p-3 border border-gray-300 rounded-md"
                    />
                    <button
                      onClick={() => {
                        const newLinks = (settings.registry?.links || []).filter((_, i) => i !== index);
                        updateSettings('registry.links', newLinks);
                      }}
                      className="px-3 py-2 text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newLinks = [...(settings.registry?.links || []), { store: '', url: '' }];
                    updateSettings('registry.links', newLinks);
                  }}
                  className="text-purple-600 hover:text-purple-800"
                >
                  + Add Registry Link
                </button>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-medium mb-4">Contacts</h3>
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600">Manage contact information for your wedding</p>
                <button
                  onClick={addContact}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
                >
                  Add Contact
                </button>
              </div>

              <div className="grid gap-4">
                {settings.contacts.map((contact) => (
                  <div key={contact.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium">{contact.name || 'Untitled Contact'}</h4>
                        <p className="text-sm text-gray-600">{contact.role}</p>
                      </div>
                      <div className="space-x-2">
                        <button
                          onClick={() => setEditingContact(contact)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteContact(contact.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    {contact.phone && <p className="text-sm text-gray-600">{contact.phone}</p>}
                    {contact.email && <p className="text-sm text-gray-600">{contact.email}</p>}
                  </div>
                ))}
              </div>

              {/* Contact Modal */}
              {editingContact && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 w-full max-w-md">
                    <h3 className="text-lg font-semibold mb-4">
                      {editingContact.id && settings.contacts.find(c => c.id === editingContact.id) ? 'Edit Contact' : 'Add Contact'}
                    </h3>
                    <div className="space-y-4">
                      <input
                        type="text"
                        placeholder="Name"
                        value={editingContact.name}
                        onChange={(e) => setEditingContact({ ...editingContact, name: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-md"
                      />
                      <input
                        type="text"
                        placeholder="Role (e.g., Maid of Honor, Best Man)"
                        value={editingContact.role}
                        onChange={(e) => setEditingContact({ ...editingContact, role: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-md"
                      />
                      <input
                        type="tel"
                        placeholder="Phone"
                        value={editingContact.phone || ''}
                        onChange={(e) => setEditingContact({ ...editingContact, phone: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-md"
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        value={editingContact.email || ''}
                        onChange={(e) => setEditingContact({ ...editingContact, email: e.target.value })}
                        className="w-full p-3 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => setEditingContact(null)}
                        className="px-4 py-2 text-gray-600 hover:text-gray-800"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveContact}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <button
          onClick={saveSettings}
          disabled={saving}
          className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center space-x-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Saving...</span>
            </>
          ) : (
            <span>Save Changes</span>
          )}
        </button>

        <button 
          onClick={() => window.open(`/preview/${locale}/${coupleId}`, '_blank')}
          className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700"
        >
          Preview Website
        </button>
      </div>
    </div>
  );
}