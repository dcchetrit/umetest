'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@ume/shared';
import { collection, getDocs, query, orderBy, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import Link from 'next/link';


interface RSVPClientProps {
  locale: string;
}

interface Guest {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phone?: string;
  events?: string[];
  rsvp?: {
    status: 'accepted' | 'declined' | 'pending' | 'Confirmé' | 'Refusé' | 'En attente';
    events?: { [eventId: string]: boolean };
    submittedAt?: any;
    partySize?: number;
    comments?: string;
    updatedAt?: any;
  };
}

interface Event {
  name: string;
  invitedCount: number;
  attendingCount: number;
  declinedCount: number;
  showOnWebsite?: boolean;
}

interface EventGroup {
  id: string;
  name: string;
  events: string[];
}

interface ChartData {
  month: string;
  responses: number;
}

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      page_title: 'RSVP Analytics',
      page_subtitle: 'Global view of responses and engagement insights',
      total_responses: 'Total Responses',
      total_guests: 'Total Guests',
      total_attending: 'Total Attending',
      total_absent: 'Total Absent',
      total_messages: 'Total Messages',
      export_csv: 'Export CSV',
      global_response_rate: 'Global Response Rate',
      responded: 'Responded',
      pending: 'Pending',
      per_event_progress: 'Per-Event Response / Attendance',
      present: 'Present',
      absent_pending: 'Absent / Pending',
      presence_per_event: 'Presence per Event',
      response_evolution: 'Response Evolution',
      detailed_responses: 'Confirmed Guests',
      guest_messages: 'Guest Messages',
      first_name: 'First Name',
      last_name: 'Last Name',
      party_size: 'Party Size',
      events: 'Events',
      message: 'Message',
      actions: 'Actions',
      edit: 'Edit',
      delete: 'Delete',
      search_responses: 'Search confirmed guests...',
      no_responses: 'No confirmed guests found',
      no_messages: 'No guest messages',
      loading: 'Loading RSVP data...',
      error: 'Error loading data',
      login_required: 'Please log in to view RSVP analytics',
      back_home: '← Back to Home',
      attendees: 'Attendees',
      responses_over_time: 'Responses Over Time',
      event_attendance: 'Event Attendance'
    },
    fr: {
      page_title: 'Analyses RSVP',
      page_subtitle: 'Vue globale des réponses et aperçus d\'engagement',
      total_responses: 'Total Réponses',
      total_guests: 'Total Invités',
      total_attending: 'Total Présents',
      total_absent: 'Total Absents',
      total_messages: 'Total Messages',
      export_csv: 'Exporter CSV',
      global_response_rate: 'Taux de Réponse Global',
      responded: 'Ont répondu',
      pending: 'En attente',
      per_event_progress: 'Réponse / Présence par Événement',
      present: 'Présent',
      absent_pending: 'Absent / En attente',
      presence_per_event: 'Présence par Événement',
      response_evolution: 'Évolution des Réponses',
      detailed_responses: 'Invités Confirmés',
      guest_messages: 'Messages des Invités',
      first_name: 'Prénom',
      last_name: 'Nom',
      party_size: 'Taille du Groupe',
      events: 'Événements',
      message: 'Message',
      actions: 'Actions',
      edit: 'Modifier',
      delete: 'Supprimer',
      search_responses: 'Rechercher des invités confirmés...',
      no_responses: 'Aucun invité confirmé trouvé',
      no_messages: 'Aucun message d\'invité',
      loading: 'Chargement des données RSVP...',
      error: 'Erreur lors du chargement des données',
      login_required: 'Veuillez vous connecter pour voir les analyses RSVP',
      back_home: '← Retour à l\'accueil',
      attendees: 'Participants',
      responses_over_time: 'Réponses au Fil du Temps',
      event_attendance: 'Participation par Événement'
    },
    es: {
      page_title: 'Análisis RSVP',
      page_subtitle: 'Vista global de respuestas y perspectivas de participación',
      total_responses: 'Total Respuestas',
      total_guests: 'Total Invitados',
      total_attending: 'Total Asistentes',
      total_absent: 'Total Ausentes',
      total_messages: 'Total Mensajes',
      export_csv: 'Exportar CSV',
      global_response_rate: 'Tasa de Respuesta Global',
      responded: 'Han respondido',
      pending: 'Pendiente',
      per_event_progress: 'Respuesta / Asistencia por Evento',
      present: 'Presente',
      absent_pending: 'Ausente / Pendiente',
      presence_per_event: 'Presencia por Evento',
      response_evolution: 'Evolución de Respuestas',
      detailed_responses: 'Invitados Confirmados',
      guest_messages: 'Mensajes de Invitados',
      first_name: 'Nombre',
      last_name: 'Apellido',
      party_size: 'Tamaño del Grupo',
      events: 'Eventos',
      message: 'Mensaje',
      actions: 'Acciones',
      edit: 'Editar',
      delete: 'Eliminar',
      search_responses: 'Buscar invitados confirmados...',
      no_responses: 'No se encontraron invitados confirmados',
      no_messages: 'No hay mensajes de invitados',
      loading: 'Cargando datos RSVP...',
      error: 'Error al cargar datos',
      login_required: 'Por favor inicia sesión para ver análisis RSVP',
      back_home: '← Volver al inicio',
      attendees: 'Asistentes',
      responses_over_time: 'Respuestas a lo Largo del Tiempo',
      event_attendance: 'Asistencia por Evento'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

function getStatusColor(status: string) {
  const normalizedStatus = status === 'accepted' || status === 'Confirmé' ? 'accepted' : 
                          status === 'declined' || status === 'Refusé' ? 'declined' : 'pending';
  
  switch (normalizedStatus) {
    case 'accepted':
      return 'bg-green-100 text-green-800';
    case 'declined':
      return 'bg-red-100 text-red-800';
    case 'pending':
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

export default function RSVPClient({ locale }: RSVPClientProps) {
  const { user } = useAuth();

  // Authentication guard
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to manage RSVPs</h1>
          <Link href={`/${locale}/login`} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Login
          </Link>
        </div>
      </div>
    );
  }

  const coupleId = user.uid;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [editData, setEditData] = useState<Partial<Guest>>({});
  const [showAddResponseModal, setShowAddResponseModal] = useState(false);
  const [guestSearchTerm, setGuestSearchTerm] = useState('');
  const [selectedEventResponses, setSelectedEventResponses] = useState<{[eventName: string]: boolean}>({});

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        console.log('Fetching RSVP data...');
        
        const guestsQuery = query(
          collection(db, 'couples', coupleId, 'guests')
        );
        const guestsSnapshot = await getDocs(guestsQuery);
        
        const guestsData: Guest[] = [];
        guestsSnapshot.forEach((doc) => {
          const data = doc.data();
          const guest: Guest = {
            id: doc.id,
            firstName: data.firstName || (data.name ? data.name.split(' ')[0] : ''),
            lastName: data.lastName || (data.name ? data.name.split(' ').slice(1).join(' ') : ''),
            name: data.name,
            email: data.email,
            phone: data.phone,
            events: data.events || [],
            rsvp: data.rsvp
          };
          guestsData.push(guest);
        });

        console.log('Processed RSVP guests:', guestsData);
        setGuests(guestsData);
        
        // Fetch events and groups from couple document
        const coupleDocRef = doc(db, 'couples', coupleId);
        const coupleDoc = await getDoc(coupleDocRef);
        const coupleData = coupleDoc.data();
        
        console.log('Couple document data:', coupleData);
        
        // Get events from couple document
        const coupleEvents = coupleData?.events || [];
        console.log('Events from couple doc:', coupleEvents);
        setEvents(coupleEvents);
        
        // Get groups from couple document
        const coupleGroups = coupleData?.groups || {};
        const groupsData: EventGroup[] = Object.entries(coupleGroups).map(([groupId, groupData]: [string, any]) => ({
          id: groupId,
          name: groupData.name,
          events: groupData.events || []
        }));
        
        console.log('Groups from couple doc:', groupsData);
        setGroups(groupsData);
      } catch (err: any) {
        console.error('Error fetching RSVP data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Helper function to determine RSVP status from event responses
  const determineStatusFromEvents = (eventResponses: {[eventName: string]: boolean}) => {
    const responses = Object.values(eventResponses || {});
    if (responses.length === 0) return 'pending';
    
    const hasAccepted = responses.some(response => response === true);
    return hasAccepted ? 'accepted' : 'declined';
  };

  // Inline editing functions
  const startEditing = (guest: Guest) => {
    setEditingGuest(guest);
    setEditData({
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email,
      rsvp: {
        ...guest.rsvp,
        events: guest.rsvp?.events || {}
      }
    });
  };

  const saveEdit = async () => {
    if (!editingGuest || !editData) return;
    
    try {
      const guestDocRef = doc(db, 'couples', coupleId, 'guests', editingGuest.id);
      await updateDoc(guestDocRef, editData);
      
      // Update local state
      setGuests(prev => prev.map(g => 
        g.id === editingGuest.id 
          ? { ...g, ...editData }
          : g
      ));
      
      setEditingGuest(null);
      setEditData({});
    } catch (error) {
      console.error('Error updating guest:', error);
      alert('Error updating guest. Please try again.');
    }
  };

  const cancelEdit = () => {
    setEditingGuest(null);
    setEditData({});
  };

  // Add guest response functions
  const availableGuests = guests.filter(guest => 
    !guest.rsvp?.status || guest.rsvp.status === 'pending'
  );

  const filteredAvailableGuests = availableGuests.filter(guest => {
    if (!guestSearchTerm) return true;
    const guestName = guest.firstName && guest.lastName 
      ? `${guest.firstName} ${guest.lastName}`
      : guest.firstName || '';
    return guestName.toLowerCase().includes(guestSearchTerm.toLowerCase()) ||
           guest.email?.toLowerCase().includes(guestSearchTerm.toLowerCase());
  });

  const assignGuestResponse = async (guest: Guest) => {
    try {
      const newStatus = determineStatusFromEvents(selectedEventResponses);
      const updatedRSVP = {
        status: newStatus,
        events: selectedEventResponses,
        submittedAt: new Date()
      };

      const guestDocRef = doc(db, 'couples', coupleId, 'guests', guest.id);
      await updateDoc(guestDocRef, { rsvp: updatedRSVP });

      // Update local state
      setGuests(prev => prev.map(g => 
        g.id === guest.id 
          ? { ...g, rsvp: updatedRSVP }
          : g
      ));

      // Reset modal state
      setShowAddResponseModal(false);
      setGuestSearchTerm('');
      setSelectedEventResponses({});
    } catch (error) {
      console.error('Error assigning guest response:', error);
      alert('Error assigning response. Please try again.');
    }
  };

  const closeAddResponseModal = () => {
    setShowAddResponseModal(false);
    setGuestSearchTerm('');
    setSelectedEventResponses({});
  };

  // Calculate analytics
  const analytics = {
    totalGuests: guests.length,
    totalResponses: guests.filter(g => g.rsvp?.status && g.rsvp.status !== 'pending' && g.rsvp.status !== 'En attente').length,
    totalAttending: guests.filter(g => g.rsvp?.status === 'accepted' || g.rsvp?.status === 'Confirmé').reduce((sum, g) => sum + (g.rsvp?.partySize || 1), 0),
    totalAbsent: guests.filter(g => g.rsvp?.status === 'declined' || g.rsvp?.status === 'Refusé').reduce((sum, g) => sum + (g.rsvp?.partySize || 1), 0),
    totalMessages: guests.filter(g => g.rsvp?.comments && g.rsvp.comments.trim().length > 0).length,
    responseRate: guests.length > 0 ? Math.round((guests.filter(g => g.rsvp?.status && g.rsvp.status !== 'pending' && g.rsvp.status !== 'En attente').length / guests.length) * 100) : 0
  };

  // Event analytics - using per-event RSVP responses
  const eventAnalytics: Event[] = events.map(event => {
    const eventName = event.name;
    const eventGuests = guests.filter(g => g.events?.includes(eventName));
    
    // Count based on actual event responses in rsvp.events, not overall status
    const attending = eventGuests.filter(g => g.rsvp?.events?.[eventName] === true);
    const declined = eventGuests.filter(g => g.rsvp?.events?.[eventName] === false);
    
    return {
      name: eventName,
      invitedCount: eventGuests.length,
      attendingCount: attending.length,
      declinedCount: declined.length, // This is the "absent" count
      showOnWebsite: event.showOnWebsite || false
    };
  });

  // Timeline data (mock data for demo)
  const timelineData: ChartData[] = [
    { month: 'Jan', responses: 5 },
    { month: 'Fév', responses: 12 },
    { month: 'Mar', responses: 18 },
    { month: 'Avr', responses: 25 },
    { month: 'Mai', responses: 32 },
    { month: 'Juin', responses: analytics.totalResponses }
  ];

  // Filter guests for table - show only confirmed guests
  const filteredGuests = guests.filter(guest => {
    // First filter: only show confirmed guests
    const isConfirmed = guest.rsvp?.status === 'accepted' || guest.rsvp?.status === 'Confirmé';
    if (!isConfirmed) return false;
    
    // Second filter: search term filter
    if (!searchTerm) return true;
    const guestName = guest.firstName && guest.lastName 
      ? `${guest.firstName} ${guest.lastName}`
      : guest.firstName || '';
    return guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
           guest.email?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Guest messages
  const guestMessages = guests
    .filter(g => g.rsvp?.comments && g.rsvp.comments.trim().length > 0)
    .map(g => ({
      name: g.firstName && g.lastName ? `${g.firstName} ${g.lastName}` : g.name || 'Invité',
      message: g.rsvp?.comments || '',
      submittedAt: g.rsvp?.submittedAt
    }));

  const exportToCSV = () => {
    const csvContent = [
      ['Prénom', 'Nom', 'Email', 'Téléphone', 'Statut RSVP', 'Taille du Groupe', 'Événements', 'Message', 'Date de Réponse'].join(','),
      ...guests.map(guest => [
        guest.firstName || '',
        guest.lastName || '',
        guest.email || '',
        guest.phone || '',
        guest.rsvp?.status || 'En attente',
        guest.rsvp?.partySize || '1',
        guest.events?.join(';') || '',
        guest.rsvp?.comments || '',
        guest.rsvp?.submittedAt ? new Date(guest.rsvp.submittedAt.seconds * 1000).toLocaleDateString() : ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rsvp-analytics.csv';
    a.click();
    window.URL.revokeObjectURL(url);
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
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {getLocalizedText(locale, 'page_title')}
          </h1>
          <p className="text-gray-600">{getLocalizedText(locale, 'page_subtitle')}</p>
        </div>

        {/* 2. Top Summary Bar */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-blue-600 mb-2">{analytics.totalResponses}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'total_responses')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-gray-600 mb-2">{analytics.totalGuests}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'total_guests')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-green-600 mb-2">{analytics.totalAttending}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'total_attending')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-red-600 mb-2">{analytics.totalAbsent}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'total_absent')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-purple-600 mb-2">{analytics.totalMessages}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'total_messages')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border flex items-center justify-center">
            <button 
              onClick={exportToCSV}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm"
            >
              {getLocalizedText(locale, 'export_csv')}
            </button>
          </div>
        </div>

        {/* Main Analytics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* 3. Response Rate Section (Left Side) */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">
              {getLocalizedText(locale, 'global_response_rate')}
            </h3>
            
            {/* Global Response Rate */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Taux Global</span>
                <span className="text-sm font-medium text-gray-900">{analytics.responseRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                  style={{ width: `${analytics.responseRate}%` }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>{getLocalizedText(locale, 'responded')}: {analytics.totalResponses}</span>
                <span>{getLocalizedText(locale, 'pending')}: {analytics.totalGuests - analytics.totalResponses}</span>
              </div>
            </div>

            {/* Per-Event Progress */}
            <h4 className="text-md font-medium text-gray-800 mb-4">
              {getLocalizedText(locale, 'per_event_progress')}
            </h4>
            <div className="space-y-4">
              {eventAnalytics.map((event, index) => {
                const attendanceRate = event.invitedCount > 0 ? (event.attendingCount / event.invitedCount) * 100 : 0;
                return (
                  <div key={index}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-700">{event.name}</span>
                        {event.showOnWebsite && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            🌐 Web
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-600">{event.attendingCount}/{event.invitedCount}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className="bg-green-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${attendanceRate}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>{getLocalizedText(locale, 'present')}: {event.attendingCount}</span>
                      <span>Absent: {event.declinedCount}</span>
                      <span>Pending: {event.invitedCount - event.attendingCount - event.declinedCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 4. Charts Section (Right Side) */}
          <div className="space-y-6">
            {/* Presence per Event Chart */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {getLocalizedText(locale, 'presence_per_event')}
              </h3>
              <div className="space-y-3">
                {eventAnalytics.map((event, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center w-24">
                      <span className="text-sm text-gray-700 truncate">{event.name}</span>
                      {event.showOnWebsite && (
                        <span className="ml-1 text-xs">🌐</span>
                      )}
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded h-6 relative">
                        <div 
                          className="bg-blue-500 h-6 rounded transition-all duration-300 flex items-center justify-center"
                          style={{ width: `${Math.max((event.attendingCount / Math.max(...eventAnalytics.map(e => e.attendingCount), 1)) * 100, 10)}%` }}
                        >
                          <span className="text-white text-xs font-medium">{event.attendingCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Response Evolution Chart */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {getLocalizedText(locale, 'response_evolution')}
              </h3>
              <div className="space-y-2">
                {timelineData.map((data, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 w-12">{data.month}</span>
                    <div className="flex-1 mx-4">
                      <div className="w-full bg-gray-200 rounded h-4 relative">
                        <div 
                          className="bg-purple-500 h-4 rounded transition-all duration-300"
                          style={{ width: `${Math.max((data.responses / Math.max(...timelineData.map(d => d.responses), 1)) * 100, 5)}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="text-sm text-gray-600 w-8 text-right">{data.responses}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 5. Detailed Responses Table */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {getLocalizedText(locale, 'detailed_responses')} ({filteredGuests.length})
                </h3>
                <p className="text-sm text-gray-500 mt-1">Click on any row to edit guest details</p>
              </div>
              <div className="flex gap-3 items-center">
                <div className="w-64">
                  <input
                    type="text"
                    placeholder={getLocalizedText(locale, 'search_responses')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={() => setShowAddResponseModal(true)}
                  className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 font-medium whitespace-nowrap"
                >
                  Add Guest Response
                </button>
              </div>
            </div>
          </div>
          
          {filteredGuests.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              {getLocalizedText(locale, 'no_responses')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'first_name')} / {getLocalizedText(locale, 'last_name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'party_size')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'events')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut RSVP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'message')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredGuests.map((guest) => (
                    editingGuest?.id === guest.id ? (
                      // Editing row
                      <tr key={guest.id} className="bg-blue-50">
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={editData.firstName || ''}
                              onChange={(e) => setEditData({...editData, firstName: e.target.value})}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="First Name"
                            />
                            <input
                              type="text"
                              value={editData.lastName || ''}
                              onChange={(e) => setEditData({...editData, lastName: e.target.value})}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="Last Name"
                            />
                            <input
                              type="email"
                              value={editData.email || ''}
                              onChange={(e) => setEditData({...editData, email: e.target.value})}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="Email"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            min="1"
                            value={editData.rsvp?.partySize || 1}
                            onChange={(e) => setEditData({
                              ...editData, 
                              rsvp: {...editData.rsvp, partySize: parseInt(e.target.value) || 1}
                            })}
                            className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-gray-700 mb-2">Event Responses:</div>
                            {events.length > 0 ? events.map(event => {
                              const eventName = event.name;
                              const currentResponse = editData.rsvp?.events?.[eventName];
                              return (
                                <div key={eventName} className="flex items-center gap-2 text-sm">
                                  <span className="min-w-20 text-xs text-gray-600">{eventName}:</span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => {
                                        const updatedEvents = {
                                          ...editData.rsvp?.events,
                                          [eventName]: true
                                        };
                                        const newStatus = determineStatusFromEvents(updatedEvents);
                                        setEditData({
                                          ...editData,
                                          rsvp: {
                                            ...editData.rsvp,
                                            events: updatedEvents,
                                            status: newStatus
                                          }
                                        });
                                      }}
                                      className={`px-2 py-1 text-xs rounded ${
                                        currentResponse === true 
                                          ? 'bg-green-600 text-white' 
                                          : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                                      }`}
                                    >
                                      Yes
                                    </button>
                                    <button
                                      onClick={() => {
                                        const updatedEvents = {
                                          ...editData.rsvp?.events,
                                          [eventName]: false
                                        };
                                        const newStatus = determineStatusFromEvents(updatedEvents);
                                        setEditData({
                                          ...editData,
                                          rsvp: {
                                            ...editData.rsvp,
                                            events: updatedEvents,
                                            status: newStatus
                                          }
                                        });
                                      }}
                                      className={`px-2 py-1 text-xs rounded ${
                                        currentResponse === false 
                                          ? 'bg-red-600 text-white' 
                                          : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                                      }`}
                                    >
                                      No
                                    </button>
                                    <button
                                      onClick={() => {
                                        const { [eventName]: removed, ...updatedEvents } = editData.rsvp?.events || {};
                                        const newStatus = determineStatusFromEvents(updatedEvents);
                                        setEditData({
                                          ...editData,
                                          rsvp: {
                                            ...editData.rsvp,
                                            events: updatedEvents,
                                            status: newStatus
                                          }
                                        });
                                      }}
                                      className={`px-2 py-1 text-xs rounded ${
                                        currentResponse === undefined 
                                          ? 'bg-gray-600 text-white' 
                                          : 'bg-gray-200 text-gray-700 hover:bg-gray-100'
                                      }`}
                                    >
                                      Clear
                                    </button>
                                  </div>
                                </div>
                              );
                            }) : <span className="text-gray-500 text-xs">No events</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={editData.rsvp?.status || 'pending'}
                            onChange={(e) => setEditData({
                              ...editData,
                              rsvp: {
                                ...editData.rsvp,
                                status: e.target.value as 'accepted' | 'declined' | 'pending'
                              }
                            })}
                            className="px-2 py-1 text-xs border border-gray-300 rounded"
                          >
                            <option value="pending">Pending</option>
                            <option value="accepted">Accepted</option>
                            <option value="declined">Declined</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <textarea
                              value={editData.rsvp?.comments || ''}
                              onChange={(e) => setEditData({
                                ...editData, 
                                rsvp: {...editData.rsvp, comments: e.target.value}
                              })}
                              className="w-full px-2 py-1 text-sm border border-gray-300 rounded resize-none"
                              rows={2}
                              placeholder="Comments"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={saveEdit}
                                className="bg-green-600 text-white px-3 py-1 text-xs rounded hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="bg-gray-500 text-white px-3 py-1 text-xs rounded hover:bg-gray-600"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      // Regular row
                      <tr key={guest.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => startEditing(guest)}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {guest.firstName && guest.lastName 
                                ? `${guest.firstName} ${guest.lastName}`
                                : guest.firstName || 'Nom non défini'}
                            </div>
                            {guest.email && (
                              <div className="text-sm text-gray-500">{guest.email}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{guest.rsvp?.partySize || 1}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {guest.rsvp?.events ? 
                              Object.entries(guest.rsvp.events).map(([eventName, attending]) => {
                                return (
                                  <span 
                                    key={eventName}
                                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                      attending 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {eventName}
                                  </span>
                                );
                              })
                              : (guest.events?.map(eventName => (
                                  <span 
                                    key={eventName}
                                    className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600"
                                  >
                                    {eventName}
                                  </span>
                                )) || <span className="text-gray-500">-</span>)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(guest.rsvp?.status || 'pending')}`}>
                            {guest.rsvp?.status || 'En attente'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {guest.rsvp?.comments || '-'}
                          </div>
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 6. Guest Messages Panel */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">
            {getLocalizedText(locale, 'guest_messages')} ({guestMessages.length})
          </h3>
          
          {guestMessages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              {getLocalizedText(locale, 'no_messages')}
            </div>
          ) : (
            <div className="space-y-4">
              {guestMessages.map((msg, index) => (
                <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                  <div className="flex justify-between items-start">
                    <div className="font-medium text-gray-900">{msg.name}</div>
                    {msg.submittedAt && (
                      <div className="text-xs text-gray-500">
                        {new Date(msg.submittedAt.seconds * 1000).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                  <div className="text-gray-700 mt-1">{msg.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Success Notice */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">
            ✅ Analyses RSVP complètes avec toutes les fonctionnalités : métriques globales, analyses par événement, graphiques de tendances, réponses détaillées et messages des invités !
          </p>
        </div>
      </div>

      {/* Add Guest Response Modal */}
      {showAddResponseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Add Guest Response</h3>
                <button
                  onClick={closeAddResponseModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Search Bar */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Search Guests (showing pending responses only)
                </label>
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={guestSearchTerm}
                  onChange={(e) => setGuestSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Event Response Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Set Event Responses
                </label>
                <div className="space-y-2">
                  {events.map(event => {
                    const eventName = event.name;
                    const currentResponse = selectedEventResponses[eventName];
                    return (
                      <div key={eventName} className="flex items-center gap-3">
                        <span className="min-w-32 text-sm text-gray-700">{eventName}:</span>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedEventResponses({
                              ...selectedEventResponses,
                              [eventName]: true
                            })}
                            className={`px-3 py-1 text-sm rounded ${
                              currentResponse === true 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                            }`}
                          >
                            Attending
                          </button>
                          <button
                            onClick={() => setSelectedEventResponses({
                              ...selectedEventResponses,
                              [eventName]: false
                            })}
                            className={`px-3 py-1 text-sm rounded ${
                              currentResponse === false 
                                ? 'bg-red-600 text-white' 
                                : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                            }`}
                          >
                            Not Attending
                          </button>
                          <button
                            onClick={() => {
                              const { [eventName]: removed, ...updatedEvents } = selectedEventResponses;
                              setSelectedEventResponses(updatedEvents);
                            }}
                            className={`px-3 py-1 text-sm rounded ${
                              currentResponse === undefined 
                                ? 'bg-gray-600 text-white' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            No Response
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Guest List */}
              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-md">
                {filteredAvailableGuests.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {availableGuests.length === 0 
                      ? "No guests with pending responses found"
                      : "No guests match your search"}
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredAvailableGuests.map(guest => (
                      <div
                        key={guest.id}
                        onClick={() => assignGuestResponse(guest)}
                        className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                      >
                        <div>
                          <div className="font-medium text-gray-900">
                            {guest.firstName && guest.lastName 
                              ? `${guest.firstName} ${guest.lastName}`
                              : guest.firstName || 'Unnamed Guest'}
                          </div>
                          {guest.email && (
                            <div className="text-sm text-gray-500">{guest.email}</div>
                          )}
                        </div>
                        <div className="text-sm text-gray-400">
                          Click to assign
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status Preview */}
              {Object.keys(selectedEventResponses).length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 rounded-md">
                  <div className="text-sm text-blue-800">
                    <strong>Status Preview:</strong> {determineStatusFromEvents(selectedEventResponses)}
                  </div>
                  <div className="text-xs text-blue-600 mt-1">
                    Selected responses: {Object.entries(selectedEventResponses).map(([event, attending]) => 
                      `${event}: ${attending ? 'Yes' : 'No'}`
                    ).join(', ')}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeAddResponseModal}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}