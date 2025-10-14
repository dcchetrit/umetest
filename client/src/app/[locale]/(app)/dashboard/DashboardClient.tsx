'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@ume/shared';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { filterUndefined } from '@/utils/firestore';
import { getDashboardStats, subscribeToStats, DashboardStats, Alert } from '@/services/dashboardService';
import { createEventGuestSyncService } from '@/services/eventGuestSyncService';

interface DashboardEvent {
  id: string;
  name: string;
  showOnWebsite: boolean;
}

interface EventGroup {
  id: string;
  name: string;
  events: string[]; // Array of event names, not IDs
}

interface DashboardClientProps {
  locale: string;
}

function getLocalizedText(locale: string, section: string, key: string): string {
  try {
    // Import our JSON translations directly
    const enTranslations = require('@/messages/en.json');
    const frTranslations = require('@/messages/fr.json');
    const esTranslations = require('@/messages/es.json');

    const translations = {
      en: enTranslations,
      fr: frTranslations,
      es: esTranslations
    };
    
    const localeData = translations[locale as keyof typeof translations] || translations.en;
    
    // Get the section data
    let sectionData = localeData[section as keyof typeof localeData];
    
    if (!sectionData) {
      // Fallback to English if section doesn't exist
      sectionData = enTranslations[section as keyof typeof enTranslations];
    }

    if (!sectionData) {
      console.warn(`Section '${section}' not found in translations`);
      return key;
    }
    
    // Handle nested keys like "buttons.edit"
    const keys = key.split('.');
    let result: any = sectionData;
    
    for (const k of keys) {
      if (result && typeof result === 'object' && k in result) {
        result = result[k];
      } else {
        result = null;
        break;
      }
    }
    
    // If not found, try English fallback
    if (!result || typeof result !== 'string') {
      let englishSection = enTranslations[section as keyof typeof enTranslations];
      if (englishSection) {
        let englishResult: any = englishSection;
        for (const k of keys) {
          if (englishResult && typeof englishResult === 'object' && k in englishResult) {
            englishResult = englishResult[k];
          } else {
            englishResult = null;
            break;
          }
        }
        result = englishResult;
      }
    }
    
    if (typeof result === 'string') {
      return result;
    } else {
      console.warn(`Translation not found: ${section}.${key} for locale ${locale}`);
      return key;
    }
  } catch (error) {
    console.error('Error in getLocalizedText:', error);
    return key;
  }
}

export default function DashboardClient({ locale }: DashboardClientProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [coupleNames, setCoupleNames] = useState('');
  
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<EventGroup | null>(null);
  const [editingEvent, setEditingEvent] = useState<DashboardEvent | null>(null);
  const [newEvent, setNewEvent] = useState({ name: '', showOnWebsite: true });
  const [newGroup, setNewGroup] = useState({ name: '', eventNames: [] as string[] });

  // Early return if no authenticated user
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{getLocalizedText(locale, 'dashboard', 'login_required') || 'Please log in to view your dashboard'}</p>
        </div>
      </div>
    );
  }

  // Use authenticated user's ID as couple ID
  const coupleId = user.uid;

  // Initialize event-guest sync service with dynamic couple ID
  const syncService = createEventGuestSyncService(coupleId);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch couple data for names
        const coupleDoc = await getDoc(doc(db, 'couples', coupleId));
        if (coupleDoc.exists()) {
          const coupleData = coupleDoc.data();
          if (coupleData?.profile?.names?.partner1 && coupleData?.profile?.names?.partner2) {
            setCoupleNames(`${coupleData.profile.names.partner1} & ${coupleData.profile.names.partner2}`);
          } else {
            setCoupleNames('Your Wedding Dashboard');
          }
        }

        // Fetch comprehensive dashboard stats
        const dashboardStats = await getDashboardStats(coupleId);
        setStats(dashboardStats);

        // Fetch events and groups from main couple document
        if (coupleDoc.exists()) {
          const coupleData = coupleDoc.data();
          
          // Get events array from couple document
          const coupleEvents = coupleData.events || [];
          const eventsData: DashboardEvent[] = coupleEvents.map((event: any, index: number) => ({
            id: event.id || `event-${index}`,
            name: event.name || '',
            showOnWebsite: event.showOnWebsite ?? false
          }));
          setEvents(eventsData);
          
          // Get groups map from couple document
          const coupleGroups = coupleData.groups || {};
          const groupsData: EventGroup[] = Object.entries(coupleGroups).map(([groupId, groupData]: [string, any]) => ({
            id: groupId,
            name: groupData.name || '',
            events: groupData.events || []
          }));
          setGroups(groupsData);
        }

        // Set up real-time listener for stats updates
        const unsubscribe = subscribeToStats(coupleId, (updatedStats) => {
          setStats(updatedStats);
        });

        // Store unsubscribe function for cleanup
        return unsubscribe;

      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    const unsubscribePromise = fetchData();

    // Cleanup function
    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
    };
  }, [user]);

  // Helper function to update couple document
  const updateCoupleDocument = async (updatedEvents: any[], updatedGroups: Record<string, any>) => {
    try {
      const coupleDocRef = doc(db, 'couples', coupleId);
      await updateDoc(coupleDocRef, filterUndefined({ 
        events: updatedEvents,
        groups: updatedGroups 
      }));
    } catch (error) {
      console.error('Error updating couple document:', error);
    }
  };

  // Event CRUD operations
  const createEvent = async () => {
    if (!newEvent.name.trim()) return;
    
    try {
      const newEventId = `event-${Date.now()}`;
      const newEventObj: DashboardEvent = {
        id: newEventId,
        name: newEvent.name,
        showOnWebsite: newEvent.showOnWebsite
      };
      
      // Get current website settings
      const coupleDocRef = doc(db, 'couples', coupleId);
      const coupleDocSnap = await getDoc(coupleDocRef);
      
      if (coupleDocSnap.exists()) {
        const currentSettings = coupleDocSnap.data();
        const currentEvents = currentSettings.events || [];
        const currentGroups = currentSettings.groups || {};
        
        // Add new event to events array
        const websiteEvent = {
          id: newEventId,
          name: newEvent.name,
          showOnWebsite: newEvent.showOnWebsite,
          date: '',
          time: '',
          location: '',
          address: '',
          description: '',
          dresscode: '',
          picture: ''
        };
        
        const updatedEvents = [...currentEvents, websiteEvent];
        await updateCoupleDocument(updatedEvents, currentGroups);
        
        // Sync with guest assignments
        await syncService.handleEventCreated(newEventId, newEvent.name);
        
        setEvents(prev => [...prev, newEventObj]);
        setNewEvent({ name: '', showOnWebsite: true });
        setShowEventModal(false);
      }
    } catch (err) {
      console.error('Error creating event:', err);
    }
  };

  const updateEvent = async () => {
    if (!editingEvent || !editingEvent.name.trim()) return;
    
    try {
      // Get current website settings
      const coupleDocRef = doc(db, 'couples', coupleId);
      const coupleDocSnap = await getDoc(coupleDocRef);
      
      if (coupleDocSnap.exists()) {
        const currentSettings = coupleDocSnap.data();
        const currentEvents = currentSettings.events || [];
        const currentGroups = currentSettings.groups || {};
        
        // Get the original event to check if name changed
        const originalEvent = currentEvents.find((event: any) => event.id === editingEvent.id);
        const oldName = originalEvent?.name;
        const newName = editingEvent.name;
        
        // Update event in events array
        const updatedEvents = currentEvents.map((event: any) => 
          event.id === editingEvent.id 
            ? { ...event, name: editingEvent.name, showOnWebsite: editingEvent.showOnWebsite }
            : event
        );
        
        await updateCoupleDocument(updatedEvents, currentGroups);
        
        // Sync with guest assignments if name changed
        if (oldName && newName && oldName !== newName) {
          await syncService.handleEventRenamed(editingEvent.id, oldName, newName);
        }
        
        setEvents(prev => prev.map(event => 
          event.id === editingEvent.id ? editingEvent : event
        ));
        setEditingEvent(null);
        setShowEventModal(false);
      }
    } catch (err) {
      console.error('Error updating event:', err);
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const eventToDelete = events.find(event => event.id === eventId);
      if (!eventToDelete) return;
      
      // Get current couple document
      const coupleDocRef = doc(db, 'couples', coupleId);
      const coupleDocSnap = await getDoc(coupleDocRef);
      
      if (coupleDocSnap.exists()) {
        const currentSettings = coupleDocSnap.data();
        const currentEvents = currentSettings.events || [];
        const currentGroups = currentSettings.groups || {};
        
        // Remove event from events array
        const updatedEvents = currentEvents.filter((event: any) => event.id !== eventId);
        
        // Remove event name from all groups
        const updatedGroups = { ...currentGroups };
        Object.keys(updatedGroups).forEach(groupId => {
          if (updatedGroups[groupId].events) {
            updatedGroups[groupId].events = updatedGroups[groupId].events.filter(
              (eventName: string) => eventName !== eventToDelete.name
            );
          }
        });
        
        await updateCoupleDocument(updatedEvents, updatedGroups);
        
        // Sync with guest assignments
        await syncService.handleEventDeleted(eventId, eventToDelete.name);
        
        setEvents(prev => prev.filter(event => event.id !== eventId));
        
        // Update groups state
        setGroups(prev => prev.map(group => ({
          ...group,
          events: group.events.filter(eventName => eventName !== eventToDelete.name)
        })));
      }
    } catch (err) {
      console.error('Error deleting event:', err);
    }
  };

  const startEditingEvent = (event: DashboardEvent) => {
    setEditingEvent({ ...event });
    setShowEventModal(true);
  };

  // Group CRUD operations
  const createGroup = async () => {
    if (!newGroup.name.trim()) return;
    
    try {
      const newGroupId = `group-${Date.now()}`;
      
      // Get current website settings
      const coupleDocRef = doc(db, 'couples', coupleId);
      const coupleDocSnap = await getDoc(coupleDocRef);
      
      if (coupleDocSnap.exists()) {
        const currentSettings = coupleDocSnap.data();
        const currentEvents = currentSettings.events || [];
        const currentGroups = currentSettings.groups || {};
        
        // Add new group to groups map
        const updatedGroups = {
          ...currentGroups,
          [newGroupId]: {
            name: newGroup.name,
            events: newGroup.eventNames
          }
        };
        
        await updateCoupleDocument(currentEvents, updatedGroups);
        
        const newGroupObj: EventGroup = {
          id: newGroupId,
          name: newGroup.name,
          events: newGroup.eventNames
        };
        
        setGroups(prev => [...prev, newGroupObj]);
        setNewGroup({ name: '', eventNames: [] });
        setShowGroupModal(false);
      }
    } catch (err) {
      console.error('Error creating group:', err);
    }
  };

  const updateGroup = async () => {
    if (!editingGroup || !editingGroup.name.trim()) return;
    
    try {
      // Get current website settings
      const coupleDocRef = doc(db, 'couples', coupleId);
      const coupleDocSnap = await getDoc(coupleDocRef);
      
      if (coupleDocSnap.exists()) {
        const currentSettings = coupleDocSnap.data();
        const currentEvents = currentSettings.events || [];
        const currentGroups = currentSettings.groups || {};
        
        // Update group in groups map
        const updatedGroups = {
          ...currentGroups,
          [editingGroup.id]: {
            name: editingGroup.name,
            events: editingGroup.events
          }
        };
        
        await updateCoupleDocument(currentEvents, updatedGroups);
        
        setGroups(prev => prev.map(group => 
          group.id === editingGroup.id ? editingGroup : group
        ));
        setEditingGroup(null);
        setShowGroupModal(false);
      }
    } catch (err) {
      console.error('Error updating group:', err);
    }
  };

  const deleteGroup = async (groupId: string) => {
    try {
      // Get current website settings
      const coupleDocRef = doc(db, 'couples', coupleId);
      const coupleDocSnap = await getDoc(coupleDocRef);
      
      if (coupleDocSnap.exists()) {
        const currentSettings = coupleDocSnap.data();
        const currentEvents = currentSettings.events || [];
        const currentGroups = currentSettings.groups || {};
        
        // Remove group from groups map
        const updatedGroups = { ...currentGroups };
        delete updatedGroups[groupId];
        
        await updateCoupleDocument(currentEvents, updatedGroups);
        
        setGroups(prev => prev.filter(group => group.id !== groupId));
      }
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  const startEditingGroup = (group: EventGroup) => {
    setEditingGroup({ ...group });
    setShowGroupModal(true);
  };

  const removeEventFromGroup = async (groupId: string, eventName: string) => {
    try {
      const group = groups.find(g => g.id === groupId);
      if (!group) return;

      const updatedEvents = group.events.filter(name => name !== eventName);
      
      // Get current website settings
      const coupleDocRef = doc(db, 'couples', coupleId);
      const coupleDocSnap = await getDoc(coupleDocRef);
      
      if (coupleDocSnap.exists()) {
        const currentSettings = coupleDocSnap.data();
        const currentEvents = currentSettings.events || [];
        const currentGroups = currentSettings.groups || {};
        
        // Update group in groups map
        const updatedGroups = {
          ...currentGroups,
          [groupId]: {
            ...currentGroups[groupId],
            events: updatedEvents
          }
        };
        
        await updateCoupleDocument(currentEvents, updatedGroups);

        setGroups(prev => prev.map(g => 
          g.id === groupId ? { ...g, events: updatedEvents } : g
        ));
      }
    } catch (err) {
      console.error('Error removing event from group:', err);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{getLocalizedText(locale, 'dashboard', 'login_required') || 'Please log in to view your dashboard'}</h1>
          <Link href={`/${locale}/login`} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Login
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl">{getLocalizedText(locale, 'common', 'status.loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-red-600">{getLocalizedText(locale, 'common', 'status.error')}: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
{getLocalizedText(locale, 'dashboard', 'subtitle')}{coupleNames}!
          </h1>
          <p className="text-gray-600">Welcome back! Here's what's happening with your wedding.</p>
          {stats?.trends && (
            <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
              <span>⏰ {stats.trends.daysUntilWedding} {getLocalizedText(locale, 'common', 'dashboard_specific.days_until_wedding')}</span>
            </div>
          )}
        </div>

        {/* Enhanced Stats Grid */}
        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {/* Guests Stats */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-600">{getLocalizedText(locale, 'common', 'dashboard_specific.guests_rsvp')}</h3>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm">👥</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-blue-600">{stats.guests.total}</p>
                  <p className="text-xs text-gray-500">{getLocalizedText(locale, 'common', 'dashboard_specific.total_guests')}</p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600">✓ {getLocalizedText(locale, 'common', 'dashboard_specific.accepted')}: {stats.guests.rsvpAccepted}</span>
                      <span className="text-red-600">✗ {getLocalizedText(locale, 'common', 'dashboard_specific.declined')}: {stats.guests.rsvpDeclined}</span>
                    </div>
                    <div className="text-xs text-gray-500">{getLocalizedText(locale, 'common', 'dashboard_specific.response_rate')}: {stats.guests.responseRate}%</div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                        style={{ width: `${stats.guests.responseRate}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tasks Stats */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-600">{getLocalizedText(locale, 'common', 'dashboard_specific.tasks_progress')}</h3>
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 text-sm">✓</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-purple-600">{stats.tasks.completed}/{stats.tasks.total}</p>
                  <p className="text-xs text-gray-500">{stats.tasks.completionRate}% {getLocalizedText(locale, 'common', 'dashboard_specific.complete')}</p>
                  {stats.tasks.overdue > 0 && (
                    <p className="text-xs text-red-600">⚠️ {stats.tasks.overdue} {getLocalizedText(locale, 'common', 'dashboard_specific.overdue')}</p>
                  )}
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-purple-600 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${stats.tasks.completionRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Budget Stats */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-600">{getLocalizedText(locale, 'common', 'dashboard_specific.budget_health')}</h3>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    stats.budget.budgetHealth === 'healthy' ? 'bg-green-100' :
                    stats.budget.budgetHealth === 'warning' ? 'bg-yellow-100' : 'bg-red-100'
                  }`}>
                    <span className={`text-sm ${
                      stats.budget.budgetHealth === 'healthy' ? 'text-green-600' :
                      stats.budget.budgetHealth === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    }`}>💰</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-green-600">
                    ${stats.budget.remainingFunds.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">{getLocalizedText(locale, 'common', 'dashboard_specific.remaining')}</p>
                  <div className="text-xs space-y-1">
                    <div>Spent: ${stats.budget.totalSpent.toLocaleString()}</div>
                    <div>Budget: ${stats.budget.totalAllocated.toLocaleString()}</div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div 
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        stats.budget.budgetHealth === 'healthy' ? 'bg-green-600' :
                        stats.budget.budgetHealth === 'warning' ? 'bg-yellow-600' : 'bg-red-600'
                      }`}
                      style={{ width: `${Math.min(stats.budget.spendingRate, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>

            </div>

            {/* Smart Alerts Section */}
            {stats.alerts.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">📢 {getLocalizedText(locale, 'common', 'dashboard_specific.smart_alerts')}</h2>
                <div className="grid gap-4">
                  {stats.alerts.slice(0, 2).map((alert) => (
                    <div key={alert.id} className={`p-4 rounded-xl border-l-4 ${
                      alert.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' :
                      alert.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' :
                      alert.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' :
                      'bg-blue-50 border-blue-500 text-blue-800'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm">{alert.title}</h3>
                          <p className="text-sm mt-1">{alert.message}</p>
                          {alert.actionRequired && (
                            <p className="text-xs mt-2 font-medium">⚡ {getLocalizedText(locale, 'common', 'dashboard_specific.action_required')}</p>
                          )}
                        </div>
                        <div className={`px-2 py-1 rounded text-xs font-medium ${
                          alert.priority === 'high' ? 'bg-red-100 text-red-800' :
                          alert.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {alert.priority}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Events & Groups Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Events & Groups</h2>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setShowEventModal(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
              >
                + {getLocalizedText(locale, 'common', 'buttons.add')} Event
              </button>
              <button
                onClick={() => {
                  setEditingGroup(null);
                  setShowGroupModal(true);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center"
              >
                + {getLocalizedText(locale, 'common', 'buttons.add')} Group
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Events Table */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Events</h3>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
{getLocalizedText(locale, 'common', 'dashboard_specific.website')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
{getLocalizedText(locale, 'common', 'dashboard_specific.no_events_created')}
                        </td>
                      </tr>
                    ) : (
                      events.map((event) => (
                        <tr key={event.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {event.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              event.showOnWebsite 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {event.showOnWebsite ? `🌐 ${getLocalizedText(locale, 'common', 'dashboard_specific.visible')}` : getLocalizedText(locale, 'common', 'dashboard_specific.hidden')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => startEditingEvent(event)}
                                className="text-blue-600 hover:text-blue-900"
                              >
{getLocalizedText(locale, 'common', 'buttons.edit')}
                              </button>
                              <button
                                onClick={() => deleteEvent(event.id)}
                                className="text-red-600 hover:text-red-900"
                              >
{getLocalizedText(locale, 'common', 'buttons.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Groups Table */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Groups</h3>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Events
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groups.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
No groups created yet
                        </td>
                      </tr>
                    ) : (
                      groups.map((group) => (
                        <tr key={group.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {group.name}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {group.events.length === 0 ? (
                              <span className="text-gray-400">{getLocalizedText(locale, 'common', 'dashboard_specific.no_events_available')}</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {group.events.map((eventName) => {
                                  const event = events.find(e => e.name === eventName);
                                  return (
                                    <span
                                      key={eventName}
                                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium group relative ${
                                        event?.showOnWebsite
                                          ? 'bg-green-100 text-green-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}
                                    >
                                      {eventName} {event?.showOnWebsite && '🌐'}
                                      <button
                                        onClick={() => removeEventFromGroup(group.id, eventName)}
                                        className="ml-1 hover:bg-red-200 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title={getLocalizedText(locale, 'common', 'dashboard_specific.remove_event_from_group')}
                                      >
                                        ×
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => startEditingGroup(group)}
                                className="text-blue-600 hover:text-blue-900"
                              >
{getLocalizedText(locale, 'common', 'buttons.edit')}
                              </button>
                              <button
                                onClick={() => deleteGroup(group.id)}
                                className="text-red-600 hover:text-red-900"
                              >
{getLocalizedText(locale, 'common', 'buttons.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Event Modal */}
        {showEventModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                {editingEvent ? `${getLocalizedText(locale, 'common', 'buttons.edit')} Event` : `${getLocalizedText(locale, 'common', 'buttons.add')} Event`}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Name
                  </label>
                  <input
                    type="text"
                    value={editingEvent ? editingEvent.name : newEvent.name}
                    onChange={(e) => {
                      if (editingEvent) {
                        setEditingEvent({ ...editingEvent, name: e.target.value });
                      } else {
                        setNewEvent({ ...newEvent, name: e.target.value });
                      }
                    }}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    placeholder="Event Name"
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showOnWebsite"
                    checked={editingEvent ? editingEvent.showOnWebsite : newEvent.showOnWebsite}
                    onChange={(e) => {
                      if (editingEvent) {
                        setEditingEvent({ ...editingEvent, showOnWebsite: e.target.checked });
                      } else {
                        setNewEvent({ ...newEvent, showOnWebsite: e.target.checked });
                      }
                    }}
                    className="h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="showOnWebsite" className="ml-2 text-sm text-gray-700">
                    Show on Website
                  </label>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEventModal(false);
                    setEditingEvent(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={editingEvent ? updateEvent : createEvent}
                  disabled={editingEvent ? !editingEvent.name.trim() : !newEvent.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingEvent ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Group Modal */}
        {showGroupModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">
                {editingGroup ? 'Edit Group' : 'Add Group'}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Group Name
                  </label>
                  <input
                    type="text"
                    value={editingGroup ? editingGroup.name : newGroup.name}
                    onChange={(e) => {
                      if (editingGroup) {
                        setEditingGroup({ ...editingGroup, name: e.target.value });
                      } else {
                        setNewGroup({ ...newGroup, name: e.target.value });
                      }
                    }}
                    className="w-full p-3 border border-gray-300 rounded-md"
                    placeholder="Group Name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Events
                  </label>
                  <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-md p-2">
                    {events.length === 0 ? (
                      <p className="text-gray-500 text-sm">No events available. Create events first.</p>
                    ) : (
                      events.map((event) => (
                        <div key={event.id} className="flex items-center mb-2">
                          <input
                            type="checkbox"
                            id={`event-${event.id}`}
                            checked={editingGroup ? editingGroup.events.includes(event.name) : newGroup.eventNames.includes(event.name)}
                            onChange={(e) => {
                              if (editingGroup) {
                                if (e.target.checked) {
                                  setEditingGroup({
                                    ...editingGroup,
                                    events: [...editingGroup.events, event.name]
                                  });
                                } else {
                                  setEditingGroup({
                                    ...editingGroup,
                                    events: editingGroup.events.filter(name => name !== event.name)
                                  });
                                }
                              } else {
                                if (e.target.checked) {
                                  setNewGroup({
                                    ...newGroup,
                                    eventNames: [...newGroup.eventNames, event.name]
                                  });
                                } else {
                                  setNewGroup({
                                    ...newGroup,
                                    eventNames: newGroup.eventNames.filter(name => name !== event.name)
                                  });
                                }
                              }
                            }}
                            className="h-4 w-4 text-purple-600 rounded focus:ring-purple-500"
                          />
                          <label htmlFor={`event-${event.id}`} className="ml-2 text-sm text-gray-700">
                            {event.name} {event.showOnWebsite && '🌐'}
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowGroupModal(false);
                    setEditingGroup(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={editingGroup ? updateGroup : createGroup}
                  disabled={editingGroup ? !editingGroup.name.trim() : !newGroup.name.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {editingGroup ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}