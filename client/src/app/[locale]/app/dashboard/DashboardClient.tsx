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

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      dashboard: 'Dashboard',
      welcome: 'Welcome to your Wedding Dashboard',
      overview: 'Overview of your wedding planning progress',
      total_guests: 'Total Guests',
      rsvp_responses: 'RSVP Responses',
      tasks_completed: 'Tasks Completed',
      back_home: '← Back to Home',
      loading: 'Loading...',
      error: 'Error loading data',
      couple_names: '',
      login_required: 'Please log in to view your dashboard',
      events_and_groups: 'Events & Groups',
      add_event: 'Add Event',
      edit_event: 'Edit Event',
      add_group: 'Add Group',
      event_name: 'Event Name',
      show_on_website: 'Show on Website',
      group_name: 'Group Name',
      select_events: 'Select Events',
      create: 'Create',
      cancel: 'Cancel',
      groups: 'Groups',
      events: 'Events',
      no_groups: 'No groups created yet',
      no_events: 'No events in this group',
      actions: 'Actions',
      delete: 'Delete',
      edit: 'Edit',
      update: 'Update'
    },
    fr: {
      dashboard: 'Tableau de bord',
      welcome: 'Bienvenue sur votre tableau de bord de mariage',
      overview: 'Aperçu de l\'avancement de la planification de votre mariage',
      total_guests: 'Total des invités',
      rsvp_responses: 'Réponses RSVP',
      tasks_completed: 'Tâches terminées',
      back_home: '← Retour à l\'accueil',
      loading: 'Chargement...',
      error: 'Erreur lors du chargement des données',
      couple_names: '',
      login_required: 'Veuillez vous connecter pour voir votre tableau de bord',
      events_and_groups: 'Événements et groupes',
      add_event: 'Ajouter un événement',
      edit_event: 'Modifier l\'événement',
      add_group: 'Ajouter un groupe',
      event_name: 'Nom de l\'événement',
      show_on_website: 'Afficher sur le site web',
      group_name: 'Nom du groupe',
      select_events: 'Sélectionner des événements',
      create: 'Créer',
      cancel: 'Annuler',
      groups: 'Groupes',
      events: 'Événements',
      no_groups: 'Aucun groupe créé',
      no_events: 'Aucun événement dans ce groupe',
      actions: 'Actions',
      delete: 'Supprimer',
      edit: 'Modifier',
      update: 'Mettre à jour'
    },
    es: {
      dashboard: 'Panel de control',
      welcome: 'Bienvenido a tu panel de bodas',
      overview: 'Resumen del progreso de planificación de tu boda',
      total_guests: 'Total de invitados',
      rsvp_responses: 'Respuestas RSVP',
      tasks_completed: 'Tareas completadas',
      back_home: '← Volver al inicio',
      loading: 'Cargando...',
      error: 'Error al cargar los datos',
      couple_names: '',
      login_required: 'Por favor inicia sesión para ver tu panel',
      events_and_groups: 'Eventos y grupos',
      add_event: 'Agregar evento',
      edit_event: 'Editar evento',
      add_group: 'Agregar grupo',
      event_name: 'Nombre del evento',
      show_on_website: 'Mostrar en el sitio web',
      group_name: 'Nombre del grupo',
      select_events: 'Seleccionar eventos',
      create: 'Crear',
      cancel: 'Cancelar',
      groups: 'Grupos',
      events: 'Eventos',
      no_groups: 'No hay grupos creados',
      no_events: 'No hay eventos en este grupo',
      actions: 'Acciones',
      delete: 'Eliminar',
      edit: 'Editar',
      update: 'Actualizar'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
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
          <p className="text-gray-600">{getLocalizedText(locale, 'login_required')}</p>
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
          <h1 className="text-2xl font-bold mb-4">{getLocalizedText(locale, 'login_required')}</h1>
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
        <div className="text-xl">{getLocalizedText(locale, 'loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-red-600">{getLocalizedText(locale, 'error')}: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {getLocalizedText(locale, 'welcome')}, {coupleNames}!
          </h1>
          <p className="text-gray-600">{getLocalizedText(locale, 'overview')}</p>
          {stats?.trends && (
            <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
              <span>📈 {stats.trends.weeklyProgress}% weekly progress</span>
              <span>🎯 {stats.trends.monthlyProgress}% overall progress</span>
              <span>⏰ {stats.trends.daysUntilWedding} days until wedding</span>
            </div>
          )}
        </div>

        {/* Enhanced Stats Grid */}
        {stats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {/* Guests Stats */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-600">Guests & RSVP</h3>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600 text-sm">👥</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-blue-600">{stats.guests.total}</p>
                  <p className="text-xs text-gray-500">Total Guests</p>
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-green-600">✓ Accepted: {stats.guests.rsvpAccepted}</span>
                      <span className="text-red-600">✗ Declined: {stats.guests.rsvpDeclined}</span>
                    </div>
                    <div className="text-xs text-gray-500">Response Rate: {stats.guests.responseRate}%</div>
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
                  <h3 className="text-sm font-semibold text-gray-600">Tasks Progress</h3>
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <span className="text-purple-600 text-sm">✓</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-bold text-purple-600">{stats.tasks.completed}/{stats.tasks.total}</p>
                  <p className="text-xs text-gray-500">{stats.tasks.completionRate}% Complete</p>
                  {stats.tasks.overdue > 0 && (
                    <p className="text-xs text-red-600">⚠️ {stats.tasks.overdue} overdue</p>
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
                  <h3 className="text-sm font-semibold text-gray-600">Budget Health</h3>
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
                  <p className="text-xs text-gray-500">Remaining</p>
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

              {/* Website Stats */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-600">Website</h3>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    stats.website.isPublished ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <span className={`text-sm ${
                      stats.website.isPublished ? 'text-green-600' : 'text-gray-600'
                    }`}>🌐</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className={`text-2xl font-bold ${
                    stats.website.isPublished ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {stats.website.isPublished ? 'LIVE' : 'DRAFT'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {stats.website.pagesComplete}/{stats.website.totalPages} Pages Complete
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-blue-600 h-1.5 rounded-full transition-all duration-300" 
                      style={{ width: `${(stats.website.pagesComplete / stats.website.totalPages) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Smart Alerts Section */}
            {stats.alerts.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">📢 Smart Alerts</h2>
                <div className="grid gap-4">
                  {stats.alerts.map((alert) => (
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
                            <p className="text-xs mt-2 font-medium">⚡ Action Required</p>
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
            <h2 className="text-2xl font-bold text-gray-900">{getLocalizedText(locale, 'events_and_groups')}</h2>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setShowEventModal(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center"
              >
                + {getLocalizedText(locale, 'add_event')}
              </button>
              <button
                onClick={() => {
                  setEditingGroup(null);
                  setShowGroupModal(true);
                }}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center"
              >
                + {getLocalizedText(locale, 'add_group')}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Events Table */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{getLocalizedText(locale, 'events')}</h3>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Website
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {getLocalizedText(locale, 'actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                          No events created yet
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
                              {event.showOnWebsite ? '🌐 Visible' : 'Hidden'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => startEditingEvent(event)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                {getLocalizedText(locale, 'edit')}
                              </button>
                              <button
                                onClick={() => deleteEvent(event.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                {getLocalizedText(locale, 'delete')}
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
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{getLocalizedText(locale, 'groups')}</h3>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {getLocalizedText(locale, 'events')}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {getLocalizedText(locale, 'actions')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {groups.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-6 py-4 text-center text-gray-500">
                          {getLocalizedText(locale, 'no_groups')}
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
                              <span className="text-gray-400">{getLocalizedText(locale, 'no_events')}</span>
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
                                        title="Remove event from group"
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
                                {getLocalizedText(locale, 'edit')}
                              </button>
                              <button
                                onClick={() => deleteGroup(group.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                {getLocalizedText(locale, 'delete')}
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
                {editingEvent ? getLocalizedText(locale, 'edit_event') : getLocalizedText(locale, 'add_event')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLocalizedText(locale, 'event_name')}
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
                    placeholder={getLocalizedText(locale, 'event_name')}
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
                    {getLocalizedText(locale, 'show_on_website')}
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
                  {getLocalizedText(locale, 'cancel')}
                </button>
                <button
                  onClick={editingEvent ? updateEvent : createEvent}
                  disabled={editingEvent ? !editingEvent.name.trim() : !newEvent.name.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {editingEvent ? getLocalizedText(locale, 'update') : getLocalizedText(locale, 'create')}
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
                {editingGroup ? `${getLocalizedText(locale, 'edit')} ${getLocalizedText(locale, 'groups')}` : getLocalizedText(locale, 'add_group')}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLocalizedText(locale, 'group_name')}
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
                    placeholder={getLocalizedText(locale, 'group_name')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLocalizedText(locale, 'select_events')}
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
                  {getLocalizedText(locale, 'cancel')}
                </button>
                <button
                  onClick={editingGroup ? updateGroup : createGroup}
                  disabled={editingGroup ? !editingGroup.name.trim() : !newGroup.name.trim()}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {editingGroup ? getLocalizedText(locale, 'update') : getLocalizedText(locale, 'create')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced Success Notice */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-sm">✨</span>
              </div>
            </div>
            <div>
              <h3 className="text-green-800 font-semibold">Enhanced Dashboard Active!</h3>
              <p className="text-green-700 text-sm mt-1">
                Real-time stats, smart alerts, and comprehensive wedding planning insights are now live.
                Your dashboard automatically updates when you make changes in other sections.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}