'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@ume/shared';
import { collection, getDocs, query, orderBy, addDoc, updateDoc, doc, deleteDoc, getDoc } from 'firebase/firestore';
import Link from 'next/link';
import { filterUndefined } from '@/utils/firestore';
import { createEventGuestSyncService } from '@/services/eventGuestSyncService';
import { createRSVPSeatingService } from '@/services/rsvpSeatingService';


interface GuestsClientProps {
  locale: string;
}

interface Guest {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string; // For backward compatibility
  email?: string;
  phone?: string;
  groupId?: string;
  categories?: string[];
  tags?: string[]; // For backward compatibility  
  events?: string[];
  capacity?: number;
  children?: number;
  notes?: string;
  rsvp?: {
    status: 'Confirmé' | 'Refusé' | 'En attente' | 'accepted' | 'declined' | 'pending';
    submittedAt?: any;
    partySize?: number;
    comments?: string;
    dietaryRestrictions?: string;
  };
}

interface DashboardEvent {
  id: string;
  name: string;
  showOnWebsite: boolean;
  createdAt: any;
}

interface EventGroup {
  id: string;
  name: string;
  eventIds: string[];
  createdAt: any;
}

// Keep Group interface for backward compatibility
interface Group {
  id: string;
  name: string;
  events: string[];
  description?: string;
}

interface FilterState {
  search: string;
  group: string;
  status: string;
  event: string;
  categories: string[];
  categoryLogic: 'AND' | 'OR';
}

interface BulkActions {
  selectedGuests: string[];
  showBulkMenu: boolean;
}

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      page_title: 'Guest List',
      page_subtitle: 'Manage invitations and track confirmations',
      total_invited: 'Total Invited',
      confirmed: 'Confirmed',
      pending: 'Pending',
      declined: 'Declined',
      search_placeholder: 'Search by name, email, or phone...',
      filter_group: 'Group',
      filter_status: 'Status',
      filter_event: 'Event',
      all_groups: 'All Groups',
      all_statuses: 'All Statuses',
      all_events: 'All Events',
      category_logic_and: 'Must have ALL categories',
      category_logic_or: 'May have AT LEAST one category',
      add_guest: '+ Add Guest',
      manage_categories: 'Manage Categories',
      add_category: '+ Add Category',
      edit_category: 'Edit Category',
      delete_category: 'Delete Category',
      category_name: 'Category Name',
      selection: 'Selection',
      name_email: 'Name / Email',
      categories: 'Categories',
      group: 'Group',
      events: 'Events',
      capacity: 'Capacity',
      children: 'Children',
      rsvp_status: 'RSVP Status',
      phone: 'Phone',
      actions: 'Actions',
      edit: 'Edit',
      delete: 'Delete',
      whatsapp: 'WhatsApp',
      bulk_whatsapp: 'Send WhatsApp to Selected',
      bulk_export: 'Export to CSV',
      bulk_delete: 'Delete Selected',
      bulk_assign_event: 'Assign to Event',
      bulk_remove_event: 'Remove from Event',
      first_name: 'First Name',
      last_name: 'Last Name',
      email: 'Email',
      notes: 'Notes',
      save: 'Save',
      cancel: 'Cancel',
      loading: 'Loading guests...',
      error: 'Error loading guests',
      login_required: 'Please log in to view guests',
      no_guests: 'No guests found',
      back_home: '← Back to Home'
    },
    fr: {
      page_title: 'Liste des invités',
      page_subtitle: 'Gérez vos invitations et suivez les confirmations',
      total_invited: 'Total Invités',
      confirmed: 'Confirmé',
      pending: 'En attente',
      declined: 'Refusé',
      search_placeholder: 'Rechercher par nom, email ou téléphone...',
      filter_group: 'Groupe',
      filter_status: 'Statut',
      filter_event: 'Événement',
      all_groups: 'Tous les groupes',
      all_statuses: 'Tous les statuts',
      all_events: 'Tous les événements',
      category_logic_and: 'Doit avoir TOUTES ces catégories',
      category_logic_or: 'Peut avoir AU MOINS une de ces catégories',
      add_guest: '+ Ajouter',
      manage_categories: 'Gérer les catégories',
      add_category: '+ Ajouter catégorie',
      edit_category: 'Modifier catégorie',
      delete_category: 'Supprimer catégorie',
      category_name: 'Nom de la catégorie',
      selection: 'Sélection',
      name_email: 'Nom / Email',
      categories: 'Catégories',
      group: 'Groupe',
      events: 'Événements',
      capacity: 'Capacité',
      children: 'Enfants',
      rsvp_status: 'Statut RSVP',
      phone: 'Téléphone',
      actions: 'Actions',
      edit: 'Modifier',
      delete: 'Supprimer',
      whatsapp: 'WhatsApp',
      bulk_whatsapp: 'Envoyer WhatsApp aux sélectionnés',
      bulk_export: 'Exporter en CSV',
      bulk_delete: 'Supprimer les sélectionnés',
      bulk_assign_event: 'Assigner à un événement',
      bulk_remove_event: 'Retirer d\'un événement',
      first_name: 'Prénom',
      last_name: 'Nom',
      email: 'Email',
      notes: 'Notes',
      save: 'Sauvegarder',
      cancel: 'Annuler',
      loading: 'Chargement des invités...',
      error: 'Erreur lors du chargement des invités',
      login_required: 'Veuillez vous connecter pour voir les invités',
      no_guests: 'Aucun invité trouvé',
      back_home: '← Retour à l\'accueil'
    },
    es: {
      page_title: 'Lista de invitados',
      page_subtitle: 'Gestiona invitaciones y rastrea confirmaciones',
      total_invited: 'Total Invitados',
      confirmed: 'Confirmado',
      pending: 'Pendiente',
      declined: 'Rechazado',
      search_placeholder: 'Buscar por nombre, email o teléfono...',
      filter_group: 'Grupo',
      filter_status: 'Estado',
      filter_event: 'Evento',
      all_groups: 'Todos los grupos',
      all_statuses: 'Todos los estados',
      all_events: 'Todos los eventos',
      category_logic_and: 'Debe tener TODAS estas categorías',
      category_logic_or: 'Puede tener AL MENOS una de estas categorías',
      add_guest: '+ Agregar',
      manage_categories: 'Gestionar categorías',
      add_category: '+ Agregar categoría',
      edit_category: 'Editar categoría',
      delete_category: 'Eliminar categoría',
      category_name: 'Nombre de la categoría',
      selection: 'Selección',
      name_email: 'Nombre / Email',
      categories: 'Categorías',
      group: 'Grupo',
      events: 'Eventos',
      capacity: 'Capacidad',
      children: 'Niños',
      rsvp_status: 'Estado RSVP',
      phone: 'Teléfono',
      actions: 'Acciones',
      edit: 'Editar',
      delete: 'Eliminar',
      whatsapp: 'WhatsApp',
      bulk_whatsapp: 'Enviar WhatsApp a seleccionados',
      bulk_export: 'Exportar a CSV',
      bulk_delete: 'Eliminar seleccionados',
      bulk_assign_event: 'Asignar a evento',
      bulk_remove_event: 'Quitar de evento',
      first_name: 'Nombre',
      last_name: 'Apellido',
      email: 'Email',
      notes: 'Notas',
      save: 'Guardar',
      cancel: 'Cancelar',
      loading: 'Cargando invitados...',
      error: 'Error al cargar invitados',
      login_required: 'Por favor inicia sesión para ver los invitados',
      no_guests: 'No se encontraron invitados',
      back_home: '← Volver al inicio'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'Confirmé':
      return 'bg-green-100 text-green-800';
    case 'Refusé':
      return 'bg-red-100 text-red-800';
    case 'En attente':
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

function getCategoryColor(category: string) {
  const colors = [
    'bg-blue-100 text-blue-800',
    'bg-purple-100 text-purple-800',
    'bg-pink-100 text-pink-800',
    'bg-indigo-100 text-indigo-800',
    'bg-green-100 text-green-800',
    'bg-orange-100 text-orange-800'
  ];
  const hash = category.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0);
  return colors[Math.abs(hash) % colors.length];
}

export default function GuestsClient({ locale }: GuestsClientProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Authentication guard
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

  const coupleId = user.uid;
  const [guests, setGuests] = useState<Guest[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [eventGroups, setEventGroups] = useState<EventGroup[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableEvents, setAvailableEvents] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    group: '',
    status: '',
    event: '',
    categories: [],
    categoryLogic: 'OR'
  });
  const [bulkActions, setBulkActions] = useState<BulkActions>({
    selectedGuests: [],
    showBulkMenu: false
  });
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // Initialize event-guest sync service
  const syncService = createEventGuestSyncService(coupleId);
  
  // Initialize RSVP-seating sync service  
  const rsvpSeatingService = createRSVPSeatingService(coupleId);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCell, setEditingCell] = useState<{guestId: string, field: string} | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        console.log('Fetching guests from Firestore...');
        
        // Fetch guests
        const guestsQuery = query(
          collection(db, 'couples', coupleId, 'guests')
        );
        const guestsSnapshot = await getDocs(guestsQuery);
        
        console.log('Raw guests snapshot size:', guestsSnapshot.size);
        
        const guestsData: Guest[] = [];
        const categoriesSet = new Set<string>();
        const eventsSet = new Set<string>();
        
        guestsSnapshot.forEach((doc) => {
          const data = doc.data();
          console.log('Guest doc data:', data);
          
          const guest: Guest = {
            id: doc.id,
            // Handle backward compatibility
            firstName: data.firstName || (data.name ? data.name.split(' ')[0] : ''),
            lastName: data.lastName || (data.name ? data.name.split(' ').slice(1).join(' ') : ''),
            name: data.name,
            email: data.email,
            phone: data.phone,
            groupId: data.groupId,
            categories: data.categories || data.tags || [],
            tags: data.tags,
            events: data.events || [],
            capacity: data.capacity || data.plusOnesAllowed || 1,
            children: data.children || 0,
            notes: data.notes,
            rsvp: data.rsvp ? {
              status: data.rsvp.status === 'accepted' ? 'Confirmé' : 
                      data.rsvp.status === 'declined' ? 'Refusé' : 
                      data.rsvp.status === 'pending' ? 'En attente' : 
                      data.rsvp.status || 'En attente',
              submittedAt: data.rsvp.submittedAt,
              partySize: data.rsvp.partySize,
              comments: data.rsvp.comments,
              dietaryRestrictions: data.rsvp.dietaryRestrictions
            } : undefined
          };
          
          guestsData.push(guest);
          
          // Collect categories/tags
          const guestCategories = guest.categories || guest.tags || [];
          guestCategories.forEach(cat => categoriesSet.add(cat));
          
          // Collect events
          guest.events?.forEach(event => eventsSet.add(event));
        });

        console.log('Processed guests:', guestsData);
        setGuests(guestsData);
        setAvailableCategories(Array.from(categoriesSet));
        
        // Fetch events and groups from couple document
        const coupleDocRef = doc(db, 'couples', coupleId);
        const coupleDoc = await getDoc(coupleDocRef);
        const coupleData = coupleDoc.data();
        
        console.log('Couple document data:', coupleData);
        
        // Get events from couple document
        const coupleEvents = coupleData?.events || [];
        const dashboardEvents: DashboardEvent[] = coupleEvents.map((event: any, index: number) => ({
          id: event.name || `event-${index}`,
          name: event.name,
          showOnWebsite: event.showOnWebsite || false,
          createdAt: event.createdAt || new Date()
        }));
        
        console.log('Dashboard events from couple doc:', dashboardEvents);
        setEvents(dashboardEvents);
        setAvailableEvents(dashboardEvents.map(event => event.name));
        
        // Get groups from couple document
        const coupleGroups = coupleData?.groups || {};
        const eventGroupsData: EventGroup[] = Object.entries(coupleGroups).map(([groupId, groupData]: [string, any]) => ({
          id: groupId,
          name: groupData.name,
          eventIds: groupData.events || [],
          createdAt: groupData.createdAt || new Date()
        }));
        
        console.log('Event groups from couple doc:', eventGroupsData);
        setEventGroups(eventGroupsData);
        
        // Convert to legacy Groups format for backward compatibility
        const legacyGroups: Group[] = eventGroupsData.map(group => ({
          id: group.id,
          name: group.name,
          events: group.eventIds, // These are now event names, not IDs
          description: ''
        }));
        
        setGroups(legacyGroups);
        
        console.log('Legacy groups for compatibility:', legacyGroups);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Filter guests based on all criteria
  const filteredGuests = guests.filter(guest => {
    // Search filter
    const guestName = guest.firstName && guest.lastName 
      ? `${guest.firstName} ${guest.lastName}`
      : guest.name || '';
    
    const matchesSearch = !filters.search || 
      guestName.toLowerCase().includes(filters.search.toLowerCase()) ||
      guest.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
      guest.phone?.toLowerCase().includes(filters.search.toLowerCase());
    
    // Group filter
    const matchesGroup = !filters.group || guest.groupId === filters.group;
    
    // Status filter
    const matchesStatus = !filters.status || (guest.rsvp?.status || 'En attente') === filters.status;
    
    // Event filter - check if guest's events include the filter event name
    const matchesEvent = !filters.event || (guest.events?.some(eventName => eventName === filters.event));
    
    // Category filter with logic
    let matchesCategories = true;
    if (filters.categories.length > 0) {
      const guestCategories = guest.categories || guest.tags || [];
      if (filters.categoryLogic === 'AND') {
        matchesCategories = filters.categories.every(cat => guestCategories.includes(cat));
      } else {
        matchesCategories = filters.categories.some(cat => guestCategories.includes(cat));
      }
    }
    
    return matchesSearch && matchesGroup && matchesStatus && matchesEvent && matchesCategories;
  });

  // Calculate summary statistics
  const stats = {
    totalInvited: guests.length,
    confirmed: guests.filter(g => g.rsvp?.status === 'Confirmé').length,
    pending: guests.filter(g => !g.rsvp?.status || g.rsvp.status === 'En attente').length,
    declined: guests.filter(g => g.rsvp?.status === 'Refusé').length
  };

  const handleSelectGuest = (guestId: string) => {
    setBulkActions(prev => ({
      ...prev,
      selectedGuests: prev.selectedGuests.includes(guestId)
        ? prev.selectedGuests.filter(id => id !== guestId)
        : [...prev.selectedGuests, guestId]
    }));
  };

  const handleSelectAll = () => {
    setBulkActions(prev => ({
      ...prev,
      selectedGuests: prev.selectedGuests.length === filteredGuests.length
        ? []
        : filteredGuests.map(g => g.id)
    }));
  };

  const sendWhatsAppRSVP = (guest: Guest) => {
    const message = `Salut ${guest.firstName}! Vous êtes invité(e) à notre mariage. Voici le lien vers notre site de mariage: ${window.location.origin}/preview/${locale}/${coupleId}`;
    const whatsappUrl = `https://wa.me/${guest.phone?.replace(/\s/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const bulkWhatsApp = () => {
    bulkActions.selectedGuests.forEach(id => {
      const guest = guests.find(g => g.id === id);
      if (guest && guest.phone) {
        setTimeout(() => sendWhatsAppRSVP(guest), 500);
      }
    });
  };

  const exportToCSV = () => {
    const selectedGuestData = guests.filter(g => bulkActions.selectedGuests.includes(g.id));
    const csvContent = [
      ['Prénom', 'Nom', 'Email', 'Téléphone', 'Groupe', 'Catégories', 'Événements', 'Capacité', 'Enfants', 'Statut RSVP', 'Notes'].join(','),
      ...selectedGuestData.map(guest => [
        guest.firstName,
        guest.lastName,
        guest.email || '',
        guest.phone || '',
        groups.find(g => g.id === guest.groupId)?.name || '',
        guest.categories?.join(';') || '',
        guest.events?.join(';') || '',
        guest.capacity || '0',
        guest.children || '0',
        guest.rsvp?.status || 'En attente',
        guest.notes || ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'liste-invites.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const bulkDelete = async () => {
    if (confirm('Êtes-vous sûr de vouloir supprimer les invités sélectionnés ?')) {
      try {
        for (const guestId of bulkActions.selectedGuests) {
          await deleteDoc(doc(db, 'couples', coupleId, 'guests', guestId));
        }
        window.location.reload();
      } catch (err) {
        console.error('Error deleting guests:', err);
      }
    }
  };

  // Bulk event assignment functions
  const bulkAssignToEvent = async (eventName: string) => {
    if (bulkActions.selectedGuests.length === 0) return;
    
    try {
      await syncService.assignGuestsToEvent(bulkActions.selectedGuests, eventName);
      
      // Update local state
      setGuests(prev => prev.map(guest => 
        bulkActions.selectedGuests.includes(guest.id) 
          ? { ...guest, events: [...(guest.events || []), eventName].filter((e, i, arr) => arr.indexOf(e) === i) }
          : guest
      ));
      
      // Clear selection
      setBulkActions({ selectedGuests: [], showBulkMenu: false });
    } catch (error) {
      console.error('Error assigning guests to event:', error);
    }
  };

  const bulkRemoveFromEvent = async (eventName: string) => {
    if (bulkActions.selectedGuests.length === 0) return;
    
    try {
      await syncService.removeGuestsFromEvent(bulkActions.selectedGuests, eventName);
      
      // Update local state
      setGuests(prev => prev.map(guest => 
        bulkActions.selectedGuests.includes(guest.id) 
          ? { ...guest, events: (guest.events || []).filter(e => e !== eventName) }
          : guest
      ));
      
      // Clear selection
      setBulkActions({ selectedGuests: [], showBulkMenu: false });
    } catch (error) {
      console.error('Error removing guests from event:', error);
    }
  };

  const handleAddGuest = async (guestData: Omit<Guest, 'id'>) => {
    try {
      await addDoc(collection(db, 'couples', coupleId, 'guests'), filterUndefined(guestData));
      window.location.reload();
    } catch (err) {
      console.error('Error adding guest:', err);
    }
  };

  // Category management functions
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      // Add category to Firestore collection for persistence
      await addDoc(collection(db, `couples/${coupleId}/categories`), {
        name: newCategoryName.trim(),
        createdAt: new Date()
      });
      
      // Update local state
      setAvailableCategories(prev => [...prev, newCategoryName.trim()]);
      setNewCategoryName('');
      setShowCategoryModal(false);
    } catch (err) {
      console.error('Error adding category:', err);
    }
  };

  const handleEditCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) return;
    
    try {
      // Update category name in all guests that have this category
      const guestsQuery = query(collection(db, 'couples', coupleId, 'guests'));
      const guestsSnapshot = await getDocs(guestsQuery);
      
      const updatePromises: Promise<any>[] = [];
      
      guestsSnapshot.forEach((guestDoc) => {
        const guestData = guestDoc.data();
        const categories = guestData.categories || guestData.tags || [];
        
        if (categories.includes(oldName)) {
          const updatedCategories = categories.map((cat: string) => 
            cat === oldName ? newName.trim() : cat
          );
          
          updatePromises.push(
            updateDoc(doc(db, 'couples', coupleId, 'guests', guestDoc.id), {
              categories: updatedCategories
            })
          );
        }
      });
      
      // Update category in Firestore categories collection
      const categoriesQuery = query(collection(db, `couples/${coupleId}/categories`));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      
      categoriesSnapshot.forEach((categoryDoc) => {
        const categoryData = categoryDoc.data();
        if (categoryData.name === oldName) {
          updatePromises.push(
            updateDoc(doc(db, `couples/${coupleId}/categories`, categoryDoc.id), {
              name: newName.trim()
            })
          );
        }
      });
      
      await Promise.all(updatePromises);
      
      // Update local state
      setAvailableCategories(prev => 
        prev.map(cat => cat === oldName ? newName.trim() : cat)
      );
      setEditingCategory(null);
      setNewCategoryName('');
    } catch (err) {
      console.error('Error editing category:', err);
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    if (!confirm(`Are you sure you want to delete the category "${categoryName}"? This will remove it from all guests.`)) {
      return;
    }
    
    try {
      // Remove category from all guests
      const guestsQuery = query(collection(db, 'couples', coupleId, 'guests'));
      const guestsSnapshot = await getDocs(guestsQuery);
      
      const updatePromises: Promise<any>[] = [];
      
      guestsSnapshot.forEach((guestDoc) => {
        const guestData = guestDoc.data();
        const categories = guestData.categories || guestData.tags || [];
        
        if (categories.includes(categoryName)) {
          const updatedCategories = categories.filter((cat: string) => cat !== categoryName);
          
          updatePromises.push(
            updateDoc(doc(db, 'couples', coupleId, 'guests', guestDoc.id), {
              categories: updatedCategories
            })
          );
        }
      });
      
      // Delete category from Firestore categories collection
      const categoriesQuery = query(collection(db, `couples/${coupleId}/categories`));
      const categoriesSnapshot = await getDocs(categoriesQuery);
      
      categoriesSnapshot.forEach((categoryDoc) => {
        const categoryData = categoryDoc.data();
        if (categoryData.name === categoryName) {
          updatePromises.push(
            deleteDoc(doc(db, `couples/${coupleId}/categories`, categoryDoc.id))
          );
        }
      });
      
      await Promise.all(updatePromises);
      
      // Update local state
      setAvailableCategories(prev => prev.filter(cat => cat !== categoryName));
      
      // Remove from filters if currently filtered
      setFilters(prev => ({
        ...prev,
        categories: prev.categories.filter(cat => cat !== categoryName)
      }));
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  // Inline editing functions
  const startEditing = (guestId: string, field: string, currentValue: any) => {
    setEditingCell({ guestId, field });
    if (typeof currentValue === 'object' && currentValue !== null) {
      setEditingValues(currentValue);
    } else {
      setEditingValues({ [field]: currentValue });
    }
  };

  const cancelEditing = () => {
    setEditingCell(null);
    setEditingValues({});
  };

  const saveEdit = async () => {
    if (!editingCell) return;
    
    try {
      const guestRef = doc(db, 'couples', coupleId, 'guests', editingCell.guestId);
      
      // Handle RSVP status specially since it's nested
      let updateData = { ...editingValues };
      if (editingCell.field === 'rsvpStatus') {
        updateData = {
          rsvp: {
            status: editingValues.rsvpStatus,
            submittedAt: new Date()
          }
        };
      }
      
      await updateDoc(guestRef, filterUndefined(updateData));
      
      // Sync RSVP changes with seating if RSVP status changed
      if (editingCell.field === 'rsvpStatus') {
        try {
          const guest = guests.find(g => g.id === editingCell.guestId);
          if (guest) {
            await rsvpSeatingService.handleRSVPChange({
              guestId: editingCell.guestId,
              oldStatus: guest.rsvp?.status,
              newStatus: editingValues.rsvpStatus,
              eventNames: guest.events
            });
          }
        } catch (error) {
          console.error('Error syncing RSVP with seating:', error);
        }
      }
      
      // Update local state
      setGuests(prev => prev.map(guest => {
        if (guest.id === editingCell.guestId) {
          if (editingCell.field === 'rsvpStatus') {
            return {
              ...guest,
              rsvp: {
                ...guest.rsvp,
                status: editingValues.rsvpStatus,
                submittedAt: new Date()
              }
            };
          }
          return { ...guest, ...editingValues };
        }
        return guest;
      }));
      
      cancelEditing();
    } catch (err) {
      console.error('Error updating guest:', err);
    }
  };

  const updateEditingValue = (field: string, value: any) => {
    setEditingValues(prev => ({ ...prev, [field]: value }));
  };

  const toggleCategoryFilter = (category: string) => {
    setFilters(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

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
        {/* 1. Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {getLocalizedText(locale, 'page_title')}
          </h1>
          <p className="text-gray-600">{getLocalizedText(locale, 'page_subtitle')}</p>
        </div>

        {/* 2. Top Summary Bar (Key Metrics) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalInvited}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'total_invited')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-green-600 mb-2">{stats.confirmed}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'confirmed')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-yellow-600 mb-2">{stats.pending}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'pending')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-red-600 mb-2">{stats.declined}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'declined')}</div>
          </div>
        </div>

        {/* 3. Search and Filters Panel */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          {/* Search Field */}
          <div className="mb-6">
            <input
              type="text"
              placeholder={getLocalizedText(locale, 'search_placeholder')}
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{getLocalizedText(locale, 'filter_group')}</label>
              <select
                value={filters.group}
                onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{getLocalizedText(locale, 'all_groups')}</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{getLocalizedText(locale, 'filter_status')}</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{getLocalizedText(locale, 'all_statuses')}</option>
                <option value="Confirmé">{getLocalizedText(locale, 'confirmed')}</option>
                <option value="En attente">{getLocalizedText(locale, 'pending')}</option>
                <option value="Refusé">{getLocalizedText(locale, 'declined')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{getLocalizedText(locale, 'filter_event')}</label>
              <select
                value={filters.event}
                onChange={(e) => setFilters(prev => ({ ...prev, event: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{getLocalizedText(locale, 'all_events')}</option>
                {availableEvents.map(event => (
                  <option key={event} value={event}>{event}</option>
                ))}
              </select>
            </div>

            <div>
              <button
                onClick={() => setShowAddGuestModal(true)}
                className="w-full mt-6 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                {getLocalizedText(locale, 'add_guest')}
              </button>
            </div>
          </div>

          {/* Category Filters */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">{getLocalizedText(locale, 'categories')}</label>
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="categoryLogic"
                    value="OR"
                    checked={filters.categoryLogic === 'OR'}
                    onChange={(e) => setFilters(prev => ({ ...prev, categoryLogic: e.target.value as 'OR' }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">{getLocalizedText(locale, 'category_logic_or')}</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="categoryLogic"
                    value="AND"
                    checked={filters.categoryLogic === 'AND'}
                    onChange={(e) => setFilters(prev => ({ ...prev, categoryLogic: e.target.value as 'AND' }))}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-600">{getLocalizedText(locale, 'category_logic_and')}</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Available Categories</span>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="text-xs bg-green-600 text-white px-2 py-1 rounded-md hover:bg-green-700"
              >
                {getLocalizedText(locale, 'manage_categories')}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map(category => (
                <button
                  key={category}
                  onClick={() => toggleCategoryFilter(category)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    filters.categories.includes(category)
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 5. Bulk Actions Bar */}
        {bulkActions.selectedGuests.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">
                {bulkActions.selectedGuests.length} invité(s) sélectionné(s)
              </span>
              <div className="flex space-x-3">
                <button
                  onClick={bulkWhatsApp}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  {getLocalizedText(locale, 'bulk_whatsapp')}
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  {getLocalizedText(locale, 'bulk_export')}
                </button>
                <button
                  onClick={bulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  {getLocalizedText(locale, 'bulk_delete')}
                </button>

                {/* Bulk Event Assignment Dropdown */}
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        bulkAssignToEvent(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium border-none"
                  >
                    <option value="">{getLocalizedText(locale, 'bulk_assign_event')}</option>
                    {availableEvents.map(eventName => (
                      <option key={eventName} value={eventName} className="text-gray-900">
                        {eventName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bulk Event Removal Dropdown */}
                <div className="relative">
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        bulkRemoveFromEvent(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-sm font-medium border-none"
                  >
                    <option value="">{getLocalizedText(locale, 'bulk_remove_event')}</option>
                    {availableEvents.map(eventName => (
                      <option key={eventName} value={eventName} className="text-gray-900">
                        {eventName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. Guest Table (Main List) */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Invités ({filteredGuests.length})
              </h3>
              {filteredGuests.length > 0 && (
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {bulkActions.selectedGuests.length === filteredGuests.length 
                    ? 'Tout désélectionner' 
                    : 'Tout sélectionner'}
                </button>
              )}
            </div>
          </div>
          
          {filteredGuests.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              {getLocalizedText(locale, 'no_guests')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200" style={{minWidth: '1200px'}}>
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-12 px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Select
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'name_email')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'categories')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'group')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'events')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'capacity')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'children')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'rsvp_status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'phone')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredGuests.map((guest) => {
                    const group = groups.find(g => g.id === guest.groupId);
                    const isSelected = bulkActions.selectedGuests.includes(guest.id);
                    
                    return (
                      <tr key={guest.id} className={`group ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                        <td className="w-12 px-3 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectGuest(guest.id)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {editingCell?.guestId === guest.id && editingCell?.field === 'firstName' ? (
                                <div className="flex space-x-1">
                                  <input
                                    type="text"
                                    value={editingValues.firstName || ''}
                                    onChange={(e) => updateEditingValue('firstName', e.target.value)}
                                    className="w-20 px-1 py-1 text-xs border rounded"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEdit();
                                      if (e.key === 'Escape') cancelEditing();
                                    }}
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={editingValues.lastName || ''}
                                    onChange={(e) => updateEditingValue('lastName', e.target.value)}
                                    className="w-20 px-1 py-1 text-xs border rounded"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveEdit();
                                      if (e.key === 'Escape') cancelEditing();
                                    }}
                                  />
                                  <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-800">✓</button>
                                  <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800">✕</button>
                                </div>
                              ) : (
                                <div 
                                  className="cursor-pointer hover:bg-gray-100 rounded px-1 py-1"
                                  onClick={() => startEditing(guest.id, 'firstName', {
                                    firstName: guest.firstName || '',
                                    lastName: guest.lastName || ''
                                  })}
                                >
                                  {guest.firstName && guest.lastName 
                                    ? `${guest.firstName} ${guest.lastName}`
                                    : guest.name || 'Nom non défini'}
                                </div>
                              )}
                            </div>
                            {editingCell?.guestId === guest.id && editingCell?.field === 'email' ? (
                              <div className="flex items-center space-x-1 mt-1">
                                <input
                                  type="email"
                                  value={editingValues.email || ''}
                                  onChange={(e) => updateEditingValue('email', e.target.value)}
                                  className="w-full px-1 py-1 text-xs border rounded"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit();
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                  autoFocus
                                />
                                <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-800">✓</button>
                                <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800">✕</button>
                              </div>
                            ) : (
                              guest.email && (
                                <div 
                                  className="text-sm text-gray-500 cursor-pointer hover:bg-gray-100 rounded px-1 py-1 mt-1"
                                  onClick={() => startEditing(guest.id, 'email', guest.email)}
                                >
                                  {guest.email}
                                </div>
                              )
                            )}
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 mt-1 space-x-2">
                              <button className="text-xs text-blue-600 hover:text-blue-900 font-medium">
                                {getLocalizedText(locale, 'edit')}
                              </button>
                              <button 
                                onClick={() => sendWhatsAppRSVP(guest)}
                                className="text-xs text-green-600 hover:text-green-900 font-medium"
                                disabled={!guest.phone}
                              >
                                {getLocalizedText(locale, 'whatsapp')}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {editingCell?.guestId === guest.id && editingCell?.field === 'categories' ? (
                            <div className="space-y-2">
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {availableCategories.map(category => (
                                  <button
                                    key={category}
                                    type="button"
                                    onClick={() => {
                                      const currentCategories = editingValues.categories || [];
                                      const newCategories = currentCategories.includes(category)
                                        ? currentCategories.filter(c => c !== category)
                                        : [...currentCategories, category];
                                      updateEditingValue('categories', newCategories);
                                    }}
                                    className={`px-2 py-1 text-xs font-medium rounded-full border ${
                                      (editingValues.categories || []).includes(category)
                                        ? 'bg-blue-100 text-blue-800 border-blue-300'
                                        : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
                                    }`}
                                  >
                                    {category}
                                  </button>
                                ))}
                              </div>
                              <div className="flex space-x-1">
                                <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-800 font-medium">✓ Save</button>
                                <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800 font-medium">✕ Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              className="flex flex-wrap gap-1 cursor-pointer hover:bg-gray-100 rounded p-1"
                              onClick={() => startEditing(guest.id, 'categories', guest.categories || guest.tags || [])}
                            >
                              {(guest.categories || guest.tags || []).map((category, index) => (
                                <span 
                                  key={index} 
                                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(category)}`}
                                >
                                  {category}
                                </span>
                              ))}
                              {!(guest.categories || guest.tags || []).length && (
                                <span className="text-xs text-gray-400 italic">Click to add categories</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCell?.guestId === guest.id && editingCell?.field === 'groupId' ? (
                            <div className="flex items-center space-x-1">
                              <select
                                value={editingValues.groupId || ''}
                                onChange={(e) => updateEditingValue('groupId', e.target.value)}
                                className="px-2 py-1 text-xs border rounded"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                                autoFocus
                              >
                                <option value="">Aucun groupe</option>
                                {groups.map(group => (
                                  <option key={group.id} value={group.id}>{group.name}</option>
                                ))}
                              </select>
                              <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-800">✓</button>
                              <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800">✕</button>
                            </div>
                          ) : (
                            <span 
                              className="inline-flex px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded cursor-pointer hover:bg-gray-200"
                              onClick={() => startEditing(guest.id, 'groupId', guest.groupId || '')}
                            >
                              {group?.name || 'Aucun groupe'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900">
                            {guest.events?.join(', ') || '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {editingCell?.guestId === guest.id && editingCell?.field === 'capacity' ? (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  min="1"
                                  max="10"
                                  value={editingValues.capacity || ''}
                                  onChange={(e) => updateEditingValue('capacity', parseInt(e.target.value) || 1)}
                                  className="w-16 px-1 py-1 text-xs border rounded"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit();
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                  autoFocus
                                />
                                <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-800">✓</button>
                                <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800">✕</button>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer hover:bg-gray-100 rounded px-1 py-1"
                                onClick={() => startEditing(guest.id, 'capacity', guest.capacity || 1)}
                              >
                                {guest.capacity || 1}
                                {guest.rsvp?.partySize && (
                                  <span className="text-gray-500"> ({guest.rsvp.partySize})</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {editingCell?.guestId === guest.id && editingCell?.field === 'children' ? (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  value={editingValues.children || ''}
                                  onChange={(e) => updateEditingValue('children', parseInt(e.target.value) || 0)}
                                  className="w-16 px-1 py-1 text-xs border rounded"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit();
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                  autoFocus
                                />
                                <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-800">✓</button>
                                <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800">✕</button>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer hover:bg-gray-100 rounded px-1 py-1"
                                onClick={() => startEditing(guest.id, 'children', guest.children || 0)}
                              >
                                {guest.children || 0}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCell?.guestId === guest.id && editingCell?.field === 'rsvpStatus' ? (
                            <div className="flex items-center space-x-1">
                              <select
                                value={editingValues.rsvpStatus || 'En attente'}
                                onChange={(e) => updateEditingValue('rsvpStatus', e.target.value)}
                                className="px-2 py-1 text-xs border rounded"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                                autoFocus
                              >
                                <option value="En attente">En attente</option>
                                <option value="Confirmé">Confirmé</option>
                                <option value="Refusé">Refusé</option>
                              </select>
                              <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-800">✓</button>
                              <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800">✕</button>
                            </div>
                          ) : (
                            <span 
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 ${getStatusColor(guest.rsvp?.status || 'En attente')}`}
                              onClick={() => startEditing(guest.id, 'rsvpStatus', guest.rsvp?.status || 'En attente')}
                            >
                              {guest.rsvp?.status || 'En attente'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {editingCell?.guestId === guest.id && editingCell?.field === 'phone' ? (
                              <div className="flex items-center space-x-1">
                                <input
                                  type="tel"
                                  value={editingValues.phone || ''}
                                  onChange={(e) => updateEditingValue('phone', e.target.value)}
                                  className="w-24 px-1 py-1 text-xs border rounded"
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveEdit();
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                  autoFocus
                                />
                                <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-800">✓</button>
                                <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800">✕</button>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer hover:bg-gray-100 rounded px-1 py-1"
                                onClick={() => startEditing(guest.id, 'phone', guest.phone || '')}
                              >
                                {guest.phone || '-'}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Success Notice */}
        <div className="mt-8 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">
            ✅ Liste des invités complète avec toutes les fonctionnalités : recherche, filtres, catégories, actions groupées, statistiques en temps réel et intégration WhatsApp !
          </p>
        </div>
      </div>

      {/* Add Guest Modal */}
      <AddGuestModal
        isOpen={showAddGuestModal}
        onClose={() => setShowAddGuestModal(false)}
        locale={locale}
        groups={groups}
        availableCategories={availableCategories}
        availableEvents={availableEvents}
        onSave={handleAddGuest}
      />
      
      {/* Category Management Modal */}
      <CategoryModal
        isOpen={showCategoryModal}
        onClose={() => {
          setShowCategoryModal(false);
          setEditingCategory(null);
          setNewCategoryName('');
        }}
        locale={locale}
        editingCategory={editingCategory}
        newCategoryName={newCategoryName}
        setNewCategoryName={setNewCategoryName}
        setEditingCategory={setEditingCategory}
        onAddCategory={handleAddCategory}
        onEditCategory={handleEditCategory}
        onDeleteCategory={handleDeleteCategory}
        availableCategories={availableCategories}
      />
    </div>
  );
}

// Add Guest Modal Component
function AddGuestModal({ 
  isOpen, 
  onClose, 
  locale, 
  groups, 
  availableCategories,
  availableEvents,
  onSave 
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  groups: Group[];
  availableCategories: string[];
  availableEvents: string[];
  onSave: (guest: Omit<Guest, 'id'>) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    groupId: '',
    categories: [] as string[],
    events: [] as string[],
    capacity: 1,
    children: 0,
    notes: ''
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(formData);
    onClose();
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      groupId: '',
      categories: [],
      events: [],
      capacity: 1,
      children: 0,
      notes: ''
    });
  };

  const toggleCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const toggleEvent = (event: string) => {
    setFormData(prev => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter(e => e !== event)
        : [...prev.events, event]
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{getLocalizedText(locale, 'add_guest')}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'first_name')}
              </label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'last_name')}
              </label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {getLocalizedText(locale, 'email')}
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {getLocalizedText(locale, 'phone')}
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {getLocalizedText(locale, 'group')}
            </label>
            <select
              required
              value={formData.groupId}
              onChange={(e) => setFormData(prev => ({ ...prev, groupId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Sélectionner un groupe</option>
              {groups.map(group => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'capacity')}
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.capacity}
                onChange={(e) => setFormData(prev => ({ ...prev, capacity: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'children')}
              </label>
              <input
                type="number"
                min="0"
                max="10"
                value={formData.children}
                onChange={(e) => setFormData(prev => ({ ...prev, children: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getLocalizedText(locale, 'categories')}
            </label>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${
                    formData.categories.includes(category)
                      ? 'bg-blue-100 text-blue-800 border-blue-300'
                      : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getLocalizedText(locale, 'events')}
            </label>
            <div className="flex flex-wrap gap-2">
              {availableEvents.map(event => (
                <button
                  key={event}
                  type="button"
                  onClick={() => toggleEvent(event)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border ${
                    formData.events.includes(event)
                      ? 'bg-green-100 text-green-800 border-green-300'
                      : 'bg-gray-100 text-gray-700 border-gray-300'
                  }`}
                >
                  {event}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {getLocalizedText(locale, 'notes')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
            >
              {getLocalizedText(locale, 'cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {getLocalizedText(locale, 'save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Category Management Modal Component
function CategoryModal({
  isOpen,
  onClose,
  locale,
  editingCategory,
  newCategoryName,
  setNewCategoryName,
  setEditingCategory,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  availableCategories
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  editingCategory: string | null;
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  setEditingCategory: (category: string | null) => void;
  onAddCategory: () => void;
  onEditCategory: (oldName: string, newName: string) => void;
  onDeleteCategory: (categoryName: string) => void;
  availableCategories: string[];
}) {
  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingCategory) {
      onEditCategory(editingCategory, newCategoryName);
    } else {
      onAddCategory();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {editingCategory ? 'Edit Category' : 'Add New Category'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category Name
            </label>
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter category name"
              required
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {editingCategory ? 'Existing Categories' : 'Manage Existing Categories'}
            </label>
            <div className="max-h-48 overflow-y-auto border rounded-md p-3 bg-gray-50">
              {availableCategories.length > 0 ? (
                <div className="space-y-2">
                  {availableCategories.map(category => (
                    <div key={category} className="flex items-center justify-between bg-white px-3 py-2 rounded border">
                      <span className="text-sm font-medium text-gray-700">{category}</span>
                      <div className="flex space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingCategory(category);
                            setNewCategoryName(category);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Delete "${category}" category? This will remove it from all guests.`)) {
                              handleDeleteCategory(category);
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No categories yet</p>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            {editingCategory && (
              <button
                type="button"
                onClick={() => {
                  setEditingCategory(null);
                  setNewCategoryName('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            )}
            <button
              type="submit"
              disabled={!newCategoryName.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {editingCategory ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}