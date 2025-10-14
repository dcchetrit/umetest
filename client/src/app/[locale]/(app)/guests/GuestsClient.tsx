'use client';

import React, { useState, useEffect } from 'react';
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
  // Calculated totals (automatically computed)
  totalGuests?: number; // Total number of people in this guest's party (main guest + sub-guests)
  totalAdults?: number; // Number of adults in the party
  totalChildren?: number; // Number of children in the party
  notes?: string;
  // Hierarchical guest management
  parentGuestId?: string; // Reference to parent guest if this is a sub-guest
  isMainGuest?: boolean; // True for main guests, false for sub-guests
  guestType?: 'Adult' | 'Child'; // Type of guest (Adult or Child)
  subGuests?: string[]; // Array of sub-guest IDs for main guests
  // Personalized invite system
  inviteLink?: string; // Full personalized invite link
  rsvp?: {
    status: 'accepted' | 'declined' | 'pending';
    submittedAt?: any;
    partySize?: number;
    comments?: string;
    dietaryRestrictions?: string;
  };
}

interface SubGuestFormData {
  firstName: string;
  lastName: string;
  guestType: 'Adult' | 'Child';
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
    
    // Handle nested keys like "filters.search_placeholder"
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

// Helper function to get RSVP display text
function getRSVPDisplayText(locale: string, status: string): string {
  switch (status) {
    case 'accepted':
      return getLocalizedText(locale, 'guests', 'confirmed');
    case 'declined':
      return getLocalizedText(locale, 'guests', 'declined');
    case 'pending':
    default:
      return getLocalizedText(locale, 'guests', 'pending');
  }
}

// Helper function to format guest count display
function formatGuestCount(totalAdults: number = 0, totalChildren: number = 0): string {
  const total = totalAdults + totalChildren;
  
  // Single adult
  if (totalAdults === 1 && totalChildren === 0) {
    return '1 Adult';
  }
  
  // Single child
  if (totalAdults === 0 && totalChildren === 1) {
    return '1 Child';
  }
  
  // Multiple guests - format as "total (adults-children)"
  if (total > 1) {
    return `${total} (${totalAdults}-${totalChildren})`;
  }
  
  // Fallback
  return total.toString();
}

function getStatusColor(status: string) {
  switch (status) {
    case 'accepted':
      return 'bg-green-100 text-green-800';
    case 'declined':
      return 'bg-red-100 text-red-800';
    case 'pending':
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
          <h1 className="text-2xl font-bold mb-4">{getLocalizedText(locale, 'guests', 'login_required')}</h1>
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
  const [coupleSlug, setCoupleSlug] = useState<string>('demo-couple');
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
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [showAddGuestModal, setShowAddGuestModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);

  // Initialize event-guest sync service
  const syncService = createEventGuestSyncService(coupleId);

  // Function to toggle family expansion
  const toggleFamilyExpansion = (guestId: string) => {
    setExpandedFamilies(prev => {
      const newSet = new Set(prev);
      if (newSet.has(guestId)) {
        newSet.delete(guestId);
      } else {
        newSet.add(guestId);
      }
      return newSet;
    });
  };

  // Initialize all families with sub-guests as expanded by default
  useEffect(() => {
    const familiesWithSubGuests = guests.filter(guest => 
      guest.isMainGuest !== false && guest.subGuests && guest.subGuests.length > 0
    );
    
    if (familiesWithSubGuests.length > 0) {
      setExpandedFamilies(new Set(familiesWithSubGuests.map(guest => guest.id)));
    }
  }, [guests]);
  
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
            totalGuests: data.totalGuests || data.capacity || data.plusOnesAllowed || 1,
            totalAdults: data.totalAdults || 1,
            totalChildren: data.totalChildren || data.children || 0,
            parentGuestId: data.parentGuestId,
            isMainGuest: data.isMainGuest !== false, // Default to true for backward compatibility
            guestType: data.guestType || 'Adult',
            subGuests: data.subGuests || [],
            notes: data.notes,
            rsvp: data.rsvp ? {
              status: data.rsvp.status || 'pending',
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
        
        // Get couple slug for invite links
        if (coupleData?.profile?.slug) {
          setCoupleSlug(coupleData.profile.slug);
        }
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
      : guest.firstName || '';
    
    const matchesSearch = !filters.search || 
      guestName.toLowerCase().includes(filters.search.toLowerCase()) ||
      guest.email?.toLowerCase().includes(filters.search.toLowerCase()) ||
      guest.phone?.toLowerCase().includes(filters.search.toLowerCase());
    
    // Group filter
    const matchesGroup = !filters.group || guest.groupId === filters.group;
    
    // Status filter
    const matchesStatus = !filters.status || (guest.rsvp?.status || 'pending') === filters.status;
    
    // Event filter - check if guest's group events include the filter event name
    const guestGroup = groups.find(g => g.id === guest.groupId);
    const groupEvents = guestGroup?.events || [];
    const matchesEvent = !filters.event || groupEvents.includes(filters.event);
    
    // Category filter with logic - include sub-guests' categories
    let matchesCategories = true;
    if (filters.categories.length > 0) {
      // Get main guest categories
      const guestCategories = guest.categories || guest.tags || [];
      
      // Get all sub-guest categories if this is a main guest with sub-guests
      let allFamilyCategories = [...guestCategories];
      if (guest.isMainGuest !== false && guest.subGuests && guest.subGuests.length > 0) {
        guest.subGuests.forEach(subGuestId => {
          const subGuest = guests.find(g => g.id === subGuestId);
          if (subGuest) {
            const subGuestCategories = subGuest.categories || subGuest.tags || [];
            allFamilyCategories.push(...subGuestCategories);
          }
        });
      }
      
      // Remove duplicates
      allFamilyCategories = [...new Set(allFamilyCategories)];
      
      if (filters.categoryLogic === 'AND') {
        matchesCategories = filters.categories.every(cat => allFamilyCategories.includes(cat));
      } else {
        matchesCategories = filters.categories.some(cat => allFamilyCategories.includes(cat));
      }
    }
    
    return matchesSearch && matchesGroup && matchesStatus && matchesEvent && matchesCategories;
  });

  // Calculate summary statistics
  const stats = {
    totalInvited: guests.length,
    confirmed: guests.filter(g => g.rsvp?.status === 'accepted').length,
    pending: guests.filter(g => !g.rsvp?.status || g.rsvp.status === 'pending').length,
    declined: guests.filter(g => g.rsvp?.status === 'declined').length
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
    if (!guest.phone) {
      alert('No phone number available for this guest.');
      return;
    }
    
    const message = `Salut ${guest.firstName}! Vous êtes invité(e) à notre mariage. Voici le lien vers notre site de mariage: ${window.location.origin}/preview/${locale}/${coupleId}`;
    
    // Clean phone number - remove spaces, dashes, and ensure it starts with +
    let cleanPhone = guest.phone.replace(/[\s-]/g, '');
    if (!cleanPhone.startsWith('+')) {
      cleanPhone = '+' + cleanPhone;
    }
    
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
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
      ['Prénom', 'Nom', 'Email', 'Téléphone', 'Groupe', 'Catégories', 'Événements', 'Total Invités', 'Total Adultes', 'Total Enfants', 'Statut RSVP', 'Notes'].join(','),
      ...selectedGuestData.map(guest => [
        guest.firstName,
        guest.lastName,
        guest.email || '',
        guest.phone || '',
        groups.find(g => g.id === guest.groupId)?.name || '',
        guest.categories?.join(';') || '',
        guest.events?.join(';') || '',
        guest.totalGuests || '1',
        guest.totalAdults || '1',
        guest.totalChildren || '0',
        guest.rsvp?.status || 'pending',
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
  // Note: Events are now managed through groups, so these functions are disabled
  const bulkAssignToEvent = async (eventName: string) => {
    alert('Events are now managed through groups. Please change the guest\'s group to assign them to events.');
  };

  const bulkRemoveFromEvent = async (eventName: string) => {
    alert('Events are now managed through groups. Please change the guest\'s group to remove them from events.');
  };

  const handleAddGuest = async (guestData: Omit<Guest, 'id'>, subGuestsData?: SubGuestFormData[]) => {
    try {
      // Add main guest first
      const docRef = await addDoc(collection(db, 'couples', coupleId, 'guests'), filterUndefined(guestData));
      
      const newGuest: Guest = {
        id: docRef.id,
        ...guestData
      };
      
      // Generate invite link automatically for main guest
      const lastName = newGuest.lastName || newGuest.firstName || 'guest';
      const slug = generateInviteSlug(lastName);
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}/invite/en/${coupleSlug}/${slug}`;
      
      // Update the guest document with the invite link
      await updateDoc(doc(db, 'couples', coupleId, 'guests', docRef.id), {
        inviteLink: inviteLink
      });
      
      // Update the local guest object
      newGuest.inviteLink = inviteLink;
      
      const allNewGuests = [newGuest];
      const subGuestIds: string[] = [];
      
      // Add sub-guests if any
      if (subGuestsData && subGuestsData.length > 0) {
        for (const subGuestData of subGuestsData) {
          const subGuestRecord: Omit<Guest, 'id'> = {
            firstName: subGuestData.firstName,
            lastName: subGuestData.lastName,
            groupId: guestData.groupId,
            events: guestData.events,
            categories: guestData.categories,
            parentGuestId: docRef.id, // Link to main guest
            isMainGuest: false,
            guestType: subGuestData.guestType,
            totalGuests: 1, // Each sub-guest represents 1 person
            totalAdults: subGuestData.guestType === 'Adult' ? 1 : 0,
            totalChildren: subGuestData.guestType === 'Child' ? 1 : 0
          };
          
          const subGuestDocRef = await addDoc(collection(db, 'couples', coupleId, 'guests'), filterUndefined(subGuestRecord));
          
          const newSubGuest: Guest = {
            id: subGuestDocRef.id,
            ...subGuestRecord
          };
          
          allNewGuests.push(newSubGuest);
          subGuestIds.push(subGuestDocRef.id);
        }
        
        // Update main guest with sub-guest IDs
        await updateDoc(doc(db, 'couples', coupleId, 'guests', docRef.id), {
          subGuests: subGuestIds
        });
        newGuest.subGuests = subGuestIds;
      }
      
      // Update local state - add all new guests to the list
      setGuests(prev => [...prev, ...allNewGuests]);
      
      // Update available categories if new ones were added
      if (guestData.categories && guestData.categories.length > 0) {
        setAvailableCategories(prev => {
          const newCategories = guestData.categories!.filter(cat => !prev.includes(cat));
          return [...prev, ...newCategories];
        });
      }
      
      console.log('Guest family added successfully:', allNewGuests);
    } catch (err) {
      console.error('Error adding guest:', err);
      alert('Failed to add guest. Please try again.');
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
            const guestGroup = groups.find(g => g.id === guest.groupId);
            const groupEvents = guestGroup?.events || [];
            
            await rsvpSeatingService.handleRSVPChange({
              guestId: editingCell.guestId,
              oldStatus: guest.rsvp?.status,
              newStatus: editingValues.rsvpStatus,
              eventNames: groupEvents
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

  // Generate invite link with lastName-4digits format
  const generateInviteSlug = (lastName: string): string => {
    const cleanLastName = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const randomNumber = Math.floor(1000 + Math.random() * 9000); // 4 digit number
    return `${cleanLastName}-${randomNumber}`;
  };

  // Generate invite link for a specific guest
  const generateGuestInviteLink = async (guestId: string) => {
    try {
      const guest = guests.find(g => g.id === guestId);
      if (!guest) throw new Error('Guest not found');
      
      const lastName = guest.lastName || guest.firstName?.split(' ').pop() || 'guest';
      const slug = generateInviteSlug(lastName);
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}/invite/en/${coupleSlug}/${slug}`;
      
      const guestRef = doc(db, 'couples', coupleId, 'guests', guestId);
      await updateDoc(guestRef, { inviteLink });
      
      // Update local state
      setGuests(prev => prev.map(g => 
        g.id === guestId ? { ...g, inviteLink } : g
      ));
      
      return inviteLink;
    } catch (error) {
      console.error('Error generating invite link:', error);
      throw error;
    }
  };

  // Generate invite links for all guests without links
  const generateAllInviteLinks = async () => {
    try {
      const guestsWithoutLinks = guests.filter(guest => !guest.inviteLink);
      
      for (const guest of guestsWithoutLinks) {
        await generateGuestInviteLink(guest.id);
      }
      
      return true;
    } catch (error) {
      console.error('Error generating all invite links:', error);
      throw error;
    }
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
        <div className="text-xl">{getLocalizedText(locale, 'guests', 'loading')}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-red-600">{getLocalizedText(locale, 'guests', 'error')}: {error}</div>
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
            {getLocalizedText(locale, 'guests', 'page_title')}
          </h1>
          <p className="text-gray-600">{getLocalizedText(locale, 'guests', 'page_subtitle')}</p>
        </div>

        {/* 2. Top Summary Bar (Key Metrics) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalInvited}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'guests', 'total_invited')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-green-600 mb-2">{stats.confirmed}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'guests', 'confirmed')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-yellow-600 mb-2">{stats.pending}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'guests', 'pending')}</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <div className="text-3xl font-bold text-red-600 mb-2">{stats.declined}</div>
            <div className="text-sm font-medium text-gray-600">{getLocalizedText(locale, 'guests', 'declined')}</div>
          </div>
        </div>

        {/* 3. Search and Filters Panel */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          {/* Search Field */}
          <div className="mb-6">
            <input
              type="text"
              placeholder={getLocalizedText(locale, 'guests', 'search_placeholder')}
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{getLocalizedText(locale, 'guests', 'filter_group')}</label>
              <select
                value={filters.group}
                onChange={(e) => setFilters(prev => ({ ...prev, group: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{getLocalizedText(locale, 'guests', 'all_groups')}</option>
                {groups.map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{getLocalizedText(locale, 'guests', 'filter_status')}</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{getLocalizedText(locale, 'guests', 'all_statuses')}</option>
                <option value="accepted">{getLocalizedText(locale, 'guests', 'confirmed')}</option>
                <option value="pending">{getLocalizedText(locale, 'guests', 'pending')}</option>
                <option value="declined">{getLocalizedText(locale, 'guests', 'declined')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{getLocalizedText(locale, 'guests', 'filter_event')}</label>
              <select
                value={filters.event}
                onChange={(e) => setFilters(prev => ({ ...prev, event: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">{getLocalizedText(locale, 'guests', 'all_events')}</option>
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
                {getLocalizedText(locale, 'guests', 'add_guest')}
              </button>
            </div>
          </div>

          {/* Category Filters */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-medium text-gray-700">{getLocalizedText(locale, 'guests', 'categories')}</label>
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
                  <span className="text-sm text-gray-600">{getLocalizedText(locale, 'guests', 'category_logic_or')}</span>
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
                  <span className="text-sm text-gray-600">{getLocalizedText(locale, 'guests', 'category_logic_and')}</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Available Categories</span>
              <button
                onClick={() => setShowCategoryModal(true)}
                className="text-xs bg-green-600 text-white px-2 py-1 rounded-md hover:bg-green-700"
              >
                {getLocalizedText(locale, 'guests', 'manage_categories')}
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
                  {getLocalizedText(locale, 'guests', 'bulk_whatsapp')}
                </button>
                <button
                  onClick={exportToCSV}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  {getLocalizedText(locale, 'guests', 'bulk_export')}
                </button>
                <button
                  onClick={async () => {
                    try {
                      await generateAllInviteLinks();
                      alert('Invite links generated successfully!');
                    } catch (error) {
                      alert('Failed to generate invite links');
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                >
                  Generate Invite Links
                </button>
                <button
                  onClick={bulkDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium"
                >
                  {getLocalizedText(locale, 'guests', 'bulk_delete')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Guest Table (Main List) */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Invités ({(() => {
                  const isCategoryFilterActive = filters.categories.length > 0;
                  
                  if (isCategoryFilterActive) {
                    // Count actual matching individuals when filtering by category
                    let matchingCount = 0;
                    
                    filteredGuests.filter(guest => guest.isMainGuest !== false).forEach(mainGuest => {
                      // Check if main guest matches
                      const mainGuestCategories = mainGuest.categories || mainGuest.tags || [];
                      const mainGuestMatches = filters.categoryLogic === 'AND' 
                        ? filters.categories.every(cat => mainGuestCategories.includes(cat))
                        : filters.categories.some(cat => mainGuestCategories.includes(cat));
                      
                      if (mainGuestMatches) {
                        matchingCount++;
                      }
                      
                      // Check sub-guests
                      if (mainGuest.subGuests && mainGuest.subGuests.length > 0) {
                        mainGuest.subGuests.forEach(subGuestId => {
                          const subGuest = guests.find(g => g.id === subGuestId);
                          if (subGuest) {
                            const subGuestCategories = subGuest.categories || subGuest.tags || [];
                            const subGuestMatches = filters.categoryLogic === 'AND'
                              ? filters.categories.every(cat => subGuestCategories.includes(cat))
                              : filters.categories.some(cat => subGuestCategories.includes(cat));
                            
                            if (subGuestMatches) {
                              matchingCount++;
                            }
                          }
                        });
                      }
                    });
                    
                    return matchingCount;
                  } else {
                    // Normal count of family groups
                    return filteredGuests.length;
                  }
                })()})
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
              {getLocalizedText(locale, 'guests', 'no_guests')}
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
                      {getLocalizedText(locale, 'guests', 'name_email')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'guests', 'categories')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'guests', 'group')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'guests', 'notes')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'guests', 'total_guests')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'guests', 'rsvp_status')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24 min-w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(() => {
                    const isCategoryFilterActive = filters.categories.length > 0;
                    
                    if (isCategoryFilterActive) {
                      // When category filtering is active, show only matching individuals
                      const matchingIndividuals = [];
                      
                      filteredGuests.filter(guest => guest.isMainGuest !== false).forEach(mainGuest => {
                        // Check if main guest matches
                        const mainGuestCategories = mainGuest.categories || mainGuest.tags || [];
                        const mainGuestMatches = filters.categoryLogic === 'AND' 
                          ? filters.categories.every(cat => mainGuestCategories.includes(cat))
                          : filters.categories.some(cat => mainGuestCategories.includes(cat));
                        
                        if (mainGuestMatches) {
                          matchingIndividuals.push(mainGuest);
                        }
                        
                        // Check sub-guests
                        if (mainGuest.subGuests && mainGuest.subGuests.length > 0) {
                          mainGuest.subGuests.forEach(subGuestId => {
                            const subGuest = guests.find(g => g.id === subGuestId);
                            if (subGuest) {
                              const subGuestCategories = subGuest.categories || subGuest.tags || [];
                              const subGuestMatches = filters.categoryLogic === 'AND'
                                ? filters.categories.every(cat => subGuestCategories.includes(cat))
                                : filters.categories.some(cat => subGuestCategories.includes(cat));
                              
                              if (subGuestMatches) {
                                matchingIndividuals.push({
                                  ...subGuest,
                                  isSubGuest: true,
                                  parentGuest: mainGuest,
                                  groupId: mainGuest.groupId
                                });
                              }
                            }
                          });
                        }
                      });
                      
                      return matchingIndividuals.map((guest) => {
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
                                      className="cursor-pointer hover:bg-gray-100 rounded px-1 py-1 flex items-center"
                                      onClick={() => startEditing(guest.id, 'firstName', {
                                        firstName: guest.firstName || '',
                                        lastName: guest.lastName || ''
                                      })}
                                    >
                                      {guest.isSubGuest && <span className="text-gray-600 mr-2">└</span>}
                                      <span className={guest.isSubGuest ? "text-sm text-gray-700" : "font-medium text-blue-600"}>
                                        {guest.firstName && guest.lastName 
                                          ? `${guest.firstName} ${guest.lastName}`
                                          : guest.firstName || 'Nom non défini'}
                                      </span>
                                      {guest.isSubGuest && (
                                        <span className="ml-2 px-1 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                                          {guest.guestType || 'Adult'}
                                        </span>
                                      )}
                                      {guest.parentGuest && (
                                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                          Family of {guest.parentGuest.firstName || guest.parentguest.firstName}
                                        </span>
                                      )}
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
                                  !guest.isSubGuest && guest.email && (
                                    <div 
                                      className="text-sm text-gray-500 cursor-pointer hover:bg-gray-100 rounded px-1 py-1 mt-1"
                                      onClick={() => startEditing(guest.id, 'email', guest.email)}
                                    >
                                      {guest.email}
                                    </div>
                                  )
                                )}
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
                                            ? currentCategories.filter((c: string) => c !== category)
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
                              {!guest.isSubGuest ? (
                                editingCell?.guestId === guest.id && editingCell?.field === 'groupId' ? (
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
                                )
                              ) : (
                                <span className="text-xs text-gray-500">Same as main guest</span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {!guest.isSubGuest ? (
                                <div className="text-sm text-gray-900">
                                  {editingCell?.guestId === guest.id && editingCell?.field === 'notes' ? (
                                    <div className="space-y-2">
                                      <textarea
                                        value={editingValues.notes || ''}
                                        onChange={(e) => updateEditingValue('notes', e.target.value)}
                                        className="w-full px-2 py-1 text-xs border rounded resize-none"
                                        rows={3}
                                        placeholder="Add notes or comments..."
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && e.ctrlKey) {
                                            saveEdit();
                                          }
                                          if (e.key === 'Escape') cancelEditing();
                                        }}
                                        autoFocus
                                      />
                                      <div className="flex space-x-1">
                                        <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-800 font-medium">✓ Save</button>
                                        <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800 font-medium">✕ Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div 
                                      className="cursor-pointer hover:bg-gray-100 rounded p-1 min-h-[20px]"
                                      onClick={() => startEditing(guest.id, 'notes', guest.notes || '')}
                                    >
                                      {guest.notes ? (
                                        <span className="text-sm text-gray-700">{guest.notes}</span>
                                      ) : (
                                        <span className="text-xs text-gray-400 italic">Click to add notes</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900">
                                {!guest.isSubGuest 
                                  ? formatGuestCount(guest.totalAdults || 1, guest.totalChildren || 0)
                                  : (guest.guestType === 'Adult' ? '1 Adult' : '1 Child')
                                }
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {!guest.isSubGuest ? (
                                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                  guest.rsvp?.status === 'accepted' 
                                    ? 'bg-green-100 text-green-800'
                                    : guest.rsvp?.status === 'declined'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {getRSVPDisplayText(locale, guest.rsvp?.status || 'pending')}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-500">-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap w-24 min-w-24">
                              {!guest.isSubGuest ? (
                                <div className="flex items-center justify-start space-x-1 min-w-20">
                                  {/* Phone Icon */}
                                  <button
                                    onClick={() => {
                                      const phone = guest.phone || '';
                                      let countryCode = '+33';
                                      let phoneNumber = '';
                                      
                                      if (phone.startsWith('+')) {
                                        const matchingCountry = COUNTRY_CODES.find(c => phone.startsWith(c.code));
                                        if (matchingCountry) {
                                          countryCode = matchingCountry.code;
                                          phoneNumber = phone.substring(matchingCountry.code.length);
                                        } else {
                                          phoneNumber = phone.substring(1);
                                        }
                                      } else {
                                        phoneNumber = phone;
                                      }
                                      
                                      startEditing(guest.id, 'phone', {
                                        phone: phone,
                                        countryCode: countryCode,
                                        phoneNumber: phoneNumber
                                      });
                                    }}
                                    className="text-gray-600 hover:text-gray-800 flex-shrink-0"
                                    title={guest.phone ? `Edit phone: ${guest.phone}` : 'Add phone number'}
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                                    </svg>
                                  </button>
                                  
                                  {/* WhatsApp Icon */}
                                  {guest.phone && (
                                    <button
                                      onClick={() => window.open(`https://wa.me/${guest.phone.replace(/[^0-9]/g, '')}`, '_blank')}
                                      className="text-green-600 hover:text-green-800 flex-shrink-0"
                                      title={`WhatsApp: ${guest.phone}`}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.63"/>
                                      </svg>
                                    </button>
                                  )}
                                  
                                  {/* Invite Link Icon */}
                                  {guest.inviteLink ? (
                                    <button
                                      onClick={() => window.open(guest.inviteLink, '_blank')}
                                      className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                                      title="Open invite link"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M10 6v2H5v11h11v-5h2v6a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h6zm11-3v8h-2V6.413l-7.793 7.794-1.414-1.414L17.585 5H13V3h8z"/>
                                      </svg>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => generateGuestInviteLink(guest.id)}
                                      className="text-purple-600 hover:text-purple-800 flex-shrink-0"
                                      title="Generate invite link"
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M10 6v2H5v11h11v-5h2v6a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h6zm11-3v8h-2V6.413l-7.793 7.794-1.414-1.414L17.585 5H13V3h8z"/>
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      });
                    } else {
                      // Normal view with expandable dropdowns
                      return filteredGuests.filter(guest => guest.isMainGuest !== false).map((guest) => {
                    const group = groups.find(g => g.id === guest.groupId);
                    const isSelected = bulkActions.selectedGuests.includes(guest.id);
                    const hasSubGuests = guest.subGuests && guest.subGuests.length > 0;
                    const isExpanded = expandedFamilies.has(guest.id);
                    
                    return (
                      <React.Fragment key={guest.id}>
                        {/* Main Guest Row */}
                        <tr className={`group ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
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
                                <div className="flex items-center">
                                  {/* Expansion toggle for families */}
                                  {hasSubGuests && (
                                    <button
                                      onClick={() => toggleFamilyExpansion(guest.id)}
                                      className="mr-2 p-1 hover:bg-gray-200 rounded transition-colors"
                                    >
                                      <svg 
                                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                        fill="currentColor" 
                                        viewBox="0 0 20 20"
                                      >
                                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </button>
                                  )}
                                  
                                  {/* Main guest name */}
                                  <div 
                                    className="cursor-pointer hover:bg-gray-100 rounded px-1 py-1 flex-1"
                                    onClick={() => startEditing(guest.id, 'firstName', {
                                      firstName: guest.firstName || '',
                                      lastName: guest.lastName || ''
                                    })}
                                  >
                                    <div className="flex items-center">
                                      <span className="font-medium text-blue-600">
                                        {guest.firstName && guest.lastName 
                                          ? `${guest.firstName} ${guest.lastName}`
                                          : guest.firstName || 'Nom non défini'}
                                      </span>
                                      {hasSubGuests && (
                                        <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                          {getLocalizedText(locale, 'guests', 'family_group')} ({1 + guest.subGuests!.length})
                                        </span>
                                      )}
                                    </div>
                                  </div>
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
                                        ? currentCategories.filter((c: string) => c !== category)
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
                            {editingCell?.guestId === guest.id && editingCell?.field === 'notes' ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editingValues.notes || ''}
                                  onChange={(e) => updateEditingValue('notes', e.target.value)}
                                  className="w-full px-2 py-1 text-xs border rounded resize-none"
                                  rows={3}
                                  placeholder="Add notes or comments..."
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && e.ctrlKey) {
                                      saveEdit();
                                    }
                                    if (e.key === 'Escape') {
                                      cancelEditing();
                                    }
                                  }}
                                  autoFocus
                                />
                                <div className="flex space-x-1">
                                  <button onClick={saveEdit} className="text-xs text-green-600 hover:text-green-800">✓ Save</button>
                                  <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800">✕ Cancel</button>
                                  <span className="text-xs text-gray-400">Ctrl+Enter to save</span>
                                </div>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer hover:bg-gray-100 rounded p-2 min-h-[40px] max-w-xs"
                                onClick={() => startEditing(guest.id, 'notes', guest.notes || '')}
                              >
                                {guest.notes ? (
                                  <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                                    {guest.notes.length > 100 ? `${guest.notes.substring(0, 100)}...` : guest.notes}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 italic text-xs">Click to add notes...</span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                        {/* Total Guests Column */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="flex items-center">
                              <span className="font-semibold text-blue-600 text-lg">
                                {formatGuestCount(guest.totalAdults || 1, guest.totalChildren || 0)}
                              </span>
                              {guest.rsvp?.partySize && guest.rsvp.partySize !== guest.totalGuests && (
                                <span className="ml-2 text-xs text-orange-600 bg-orange-100 px-1 rounded">
                                  RSVP: {guest.rsvp.partySize}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {editingCell?.guestId === guest.id && editingCell?.field === 'rsvpStatus' ? (
                            <div className="flex items-center space-x-1">
                              <select
                                value={editingValues.rsvpStatus || 'pending'}
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
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full cursor-pointer hover:opacity-80 ${getStatusColor(guest.rsvp?.status || 'pending')}`}
                              onClick={() => startEditing(guest.id, 'rsvpStatus', guest.rsvp?.status || 'pending')}
                            >
                              {getRSVPDisplayText(locale, guest.rsvp?.status || 'pending')}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {editingCell?.guestId === guest.id && editingCell?.field === 'phone' ? (
                              <div className="space-y-2">
                                <div className="flex items-center space-x-1">
                                  <select
                                    value={editingValues.countryCode || '+33'}
                                    onChange={(e) => updateEditingValue('countryCode', e.target.value)}
                                    className="px-1 py-1 text-xs border rounded bg-white"
                                  >
                                    {COUNTRY_CODES.map(country => (
                                      <option key={country.code} value={country.code}>
                                        {country.flag} {country.code}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    type="tel"
                                    value={editingValues.phoneNumber || ''}
                                    onChange={(e) => {
                                      const cleanedValue = e.target.value.replace(/[^\d\s-]/g, '');
                                      updateEditingValue('phoneNumber', cleanedValue);
                                    }}
                                    className="w-24 px-1 py-1 text-xs border rounded"
                                    placeholder="783450923"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const fullPhone = `${editingValues.countryCode || '+33'}${editingValues.phoneNumber || ''}`;
                                        updateEditingValue('phone', fullPhone);
                                        saveEdit();
                                      }
                                      if (e.key === 'Escape') cancelEditing();
                                    }}
                                    autoFocus
                                  />
                                </div>
                                <div className="flex space-x-1">
                                  <button 
                                    onClick={() => {
                                      const fullPhone = `${editingValues.countryCode || '+33'}${editingValues.phoneNumber || ''}`;
                                      updateEditingValue('phone', fullPhone);
                                      saveEdit();
                                    }} 
                                    className="text-xs text-green-600 hover:text-green-800"
                                  >
                                    ✓
                                  </button>
                                  <button onClick={cancelEditing} className="text-xs text-red-600 hover:text-red-800">✕</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-start space-x-1 min-w-20">
                                {/* Phone Icon */}
                                <button
                                  onClick={() => {
                                    const phone = guest.phone || '';
                                    let countryCode = '+33';
                                    let phoneNumber = '';
                                    
                                    if (phone.startsWith('+')) {
                                      const matchingCountry = COUNTRY_CODES.find(c => phone.startsWith(c.code));
                                      if (matchingCountry) {
                                        countryCode = matchingCountry.code;
                                        phoneNumber = phone.substring(matchingCountry.code.length);
                                      } else {
                                        phoneNumber = phone.substring(1);
                                      }
                                    } else {
                                      phoneNumber = phone;
                                    }
                                    
                                    startEditing(guest.id, 'phone', {
                                      phone: phone,
                                      countryCode: countryCode,
                                      phoneNumber: phoneNumber
                                    });
                                  }}
                                  className="text-gray-600 hover:text-gray-800 p-1 rounded hover:bg-gray-50 transition-colors flex-shrink-0"
                                  title={guest.phone ? `Edit phone: ${guest.phone}` : 'Add phone number'}
                                >
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
                                  </svg>
                                </button>
                                
                                {/* WhatsApp Icon */}
                                {guest.phone && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sendWhatsAppRSVP(guest);
                                    }}
                                    className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors flex-shrink-0"
                                    title={`WhatsApp: ${guest.phone}`}
                                  >
                                    <svg 
                                      className="w-4 h-4" 
                                      fill="currentColor" 
                                      viewBox="0 0 24 24"
                                    >
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893A11.821 11.821 0 0020.465 3.63"/>
                                    </svg>
                                  </button>
                                )}
                                
                                {/* Invite Link Icon */}
                                {guest.inviteLink ? (
                                  <button
                                    onClick={() => window.open(guest.inviteLink, '_blank')}
                                    className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors flex-shrink-0"
                                    title="Open invite link"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M10 6v2H5v11h11v-5h2v6a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h6zm11-3v8h-2V6.413l-7.793 7.794-1.414-1.414L17.585 5H13V3h8z"/>
                                    </svg>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => generateGuestInviteLink(guest.id)}
                                    className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-50 transition-colors flex-shrink-0"
                                    title="Generate invite link"
                                  >
                                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M10 6v2H5v11h11v-5h2v6a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1h6zm11-3v8h-2V6.413l-7.793 7.794-1.414-1.414L17.585 5H13V3h8z"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Sub-guest rows when expanded */}
                      {hasSubGuests && isExpanded && guest.subGuests!.map((subGuestId, index) => {
                        const subGuest = guests.find(g => g.id === subGuestId);
                        if (!subGuest) return null;
                        
                        // Check if this sub-guest matches the category filter
                        const isCategoryFilterActive = filters.categories.length > 0;
                        const subGuestCategories = subGuest.categories || subGuest.tags || [];
                        const subGuestMatchesFilter = isCategoryFilterActive && (
                          filters.categoryLogic === 'AND'
                            ? filters.categories.every(cat => subGuestCategories.includes(cat))
                            : filters.categories.some(cat => subGuestCategories.includes(cat))
                        );
                        
                        return (
                          <tr key={subGuestId} className={`border-l-4 ${
                            subGuestMatchesFilter 
                              ? 'bg-yellow-50 border-yellow-400' 
                              : 'bg-gray-50 border-blue-200'
                          }`}>
                            <td className="w-12 px-3 py-4 whitespace-nowrap">
                              {/* Empty checkbox column for sub-guests */}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap pl-12">
                              <div className="text-sm">
                                {editingCell?.guestId === subGuestId && editingCell?.field === 'firstName' ? (
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
                                    className="cursor-pointer hover:bg-gray-100 rounded px-1 py-1 flex items-center"
                                    onClick={() => startEditing(subGuestId, 'firstName', {
                                      firstName: subGuest.firstName || '',
                                      lastName: subGuest.lastName || ''
                                    })}
                                  >
                                    <span className="text-gray-600 mr-2">└</span>
                                    <span className="text-sm text-gray-700">
                                      {subGuest.firstName && subGuest.lastName 
                                        ? `${subGuest.firstName} ${subGuest.lastName}`
                                        : subguest.firstName || 'Nom non défini'}
                                    </span>
                                    <span className="ml-2 px-1 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                                      {subGuest.guestType || 'Adult'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {editingCell?.guestId === subGuestId && editingCell?.field === 'categories' ? (
                                <div className="space-y-2">
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {availableCategories.map(category => (
                                      <button
                                        key={category}
                                        type="button"
                                        onClick={() => {
                                          const currentCategories = editingValues.categories || [];
                                          const newCategories = currentCategories.includes(category)
                                            ? currentCategories.filter((c: string) => c !== category)
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
                                  onClick={() => startEditing(subGuestId, 'categories', subGuest.categories || subGuest.tags || [])}
                                >
                                  {(subGuest.categories || subGuest.tags || []).map((category, catIndex) => (
                                    <span 
                                      key={catIndex} 
                                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getCategoryColor(category)}`}
                                    >
                                      {category}
                                    </span>
                                  ))}
                                  {!(subGuest.categories || subGuest.tags || []).length && (
                                    <span className="text-xs text-gray-400 italic">Click to add categories</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-xs text-gray-500">Same as main guest</span>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-xs text-gray-500">-</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-xs text-gray-500">-</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-xs text-gray-500">-</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-xs text-gray-500">-</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-xs text-gray-500">-</span>
                            </td>
                          </tr>
                        );
                      })}
                      </React.Fragment>
                    );
                  });
                    }
                  })()}
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

// Country codes for phone numbers
const COUNTRY_CODES = [
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+1', country: 'United States', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+39', country: 'Italy', flag: '🇮🇹' },
  { code: '+34', country: 'Spain', flag: '🇪🇸' },
  { code: '+31', country: 'Netherlands', flag: '🇳🇱' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪' },
  { code: '+41', country: 'Switzerland', flag: '🇨🇭' },
  { code: '+43', country: 'Austria', flag: '🇦🇹' },
  { code: '+351', country: 'Portugal', flag: '🇵🇹' },
  { code: '+30', country: 'Greece', flag: '🇬🇷' },
  { code: '+46', country: 'Sweden', flag: '🇸🇪' },
  { code: '+47', country: 'Norway', flag: '🇳🇴' },
  { code: '+45', country: 'Denmark', flag: '🇩🇰' },
  { code: '+358', country: 'Finland', flag: '🇫🇮' },
  { code: '+212', country: 'Morocco', flag: '🇲🇦' },
  { code: '+213', country: 'Algeria', flag: '🇩🇿' },
  { code: '+216', country: 'Tunisia', flag: '🇹🇳' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+81', country: 'Japan', flag: '🇯🇵' },
  { code: '+82', country: 'South Korea', flag: '🇰🇷' },
  { code: '+55', country: 'Brazil', flag: '🇧🇷' },
  { code: '+52', country: 'Mexico', flag: '🇲🇽' },
  { code: '+54', country: 'Argentina', flag: '🇦🇷' },
  { code: '+56', country: 'Chile', flag: '🇨🇱' },
  { code: '+57', country: 'Colombia', flag: '🇨🇴' },
  { code: '+61', country: 'Australia', flag: '🇦🇺' },
  { code: '+64', country: 'New Zealand', flag: '🇳🇿' },
  { code: '+27', country: 'South Africa', flag: '🇿🇦' },
  { code: '+20', country: 'Egypt', flag: '🇪🇬' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+7', country: 'Russia', flag: '🇷🇺' },
  { code: '+90', country: 'Turkey', flag: '🇹🇷' }
];

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
  onSave: (guest: Omit<Guest, 'id'>, subGuests?: SubGuestFormData[]) => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    countryCode: '+33', // Default to France
    groupId: '',
    categories: [] as string[],
    notes: ''
  });

  const [hasSubGuests, setHasSubGuests] = useState(false);
  const [subGuests, setSubGuests] = useState<SubGuestFormData[]>([]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Derive events from the selected group
    const selectedGroup = groups.find(g => g.id === formData.groupId);
    const groupEvents = selectedGroup?.events || [];
    
    // Combine country code with phone number
    const fullPhoneNumber = formData.phone ? `${formData.countryCode}${formData.phone}` : '';
    
    // Calculate totals based on main guest + sub-guests
    const mainGuestType: 'Adult' | 'Child' = 'Adult'; // Main guest is always an adult for invitation purposes
    const { totalGuests, totalAdults, totalChildren } = calculateTotals(mainGuestType, hasSubGuests ? subGuests : []);
    
    // Create main guest data
    const mainGuestData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: fullPhoneNumber,
      groupId: formData.groupId,
      categories: formData.categories,
      totalGuests,
      totalAdults,
      totalChildren,
      notes: formData.notes,
      events: groupEvents,
      isMainGuest: true,
      guestType: mainGuestType,
      subGuests: [] // Will be populated after creating sub-guests
    };
    
    // Save main guest and sub-guests
    await onSave(mainGuestData, hasSubGuests ? subGuests : undefined);
    
    onClose();
    // Reset form
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      countryCode: '+33',
      groupId: '',
      categories: [],
      notes: ''
    });
    setHasSubGuests(false);
    setSubGuests([]);
  };

  const toggleCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter(c => c !== category)
        : [...prev.categories, category]
    }));
  };

  const addSubGuest = () => {
    setSubGuests(prev => [...prev, {
      firstName: '',
      lastName: formData.lastName, // Pre-fill with main guest's last name
      guestType: 'Adult'
    }]);
  };

  const updateSubGuest = (index: number, field: keyof SubGuestFormData, value: string) => {
    setSubGuests(prev => prev.map((subGuest, i) => 
      i === index ? { ...subGuest, [field]: value } : subGuest
    ));
  };

  const removeSubGuest = (index: number) => {
    setSubGuests(prev => prev.filter((_, i) => i !== index));
  };

  const calculateTotals = (mainGuestType: 'Adult' | 'Child', subGuestsData: SubGuestFormData[]) => {
    const totalGuests = 1 + subGuestsData.length; // Main guest + sub-guests
    
    let totalAdults = mainGuestType === 'Adult' ? 1 : 0;
    let totalChildren = mainGuestType === 'Child' ? 1 : 0;
    
    subGuestsData.forEach(subGuest => {
      if (subGuest.guestType === 'Adult') {
        totalAdults++;
      } else {
        totalChildren++;
      }
    });
    
    return { totalGuests, totalAdults, totalChildren };
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{getLocalizedText(locale, 'guests', 'add_guest')}</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'guests', 'first_name')}
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
                {getLocalizedText(locale, 'guests', 'last_name')}
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
              {getLocalizedText(locale, 'guests', 'email')}
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
              {getLocalizedText(locale, 'guests', 'phone')}
            </label>
            <div className="flex gap-2">
              <select
                value={formData.countryCode}
                onChange={(e) => setFormData(prev => ({ ...prev, countryCode: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[120px]"
              >
                {COUNTRY_CODES.map(country => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => {
                  // Remove any non-numeric characters except spaces and dashes
                  const cleanedValue = e.target.value.replace(/[^\d\s-]/g, '');
                  setFormData(prev => ({ ...prev, phone: cleanedValue }));
                }}
                placeholder="783450923"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Example: {formData.countryCode}783450923
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {getLocalizedText(locale, 'guests', 'group')}
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

          {/* Capacity is now automatically calculated based on sub-guests */}
          {hasSubGuests && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-800 mb-2">Guest Count Preview</h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 font-medium">{getLocalizedText(locale, 'guests', 'total_guests')}:</span>
                  <div className="text-lg font-bold text-blue-800">
                    {formatGuestCount(
                      1 + subGuests.filter(sg => sg.guestType === 'Adult').length,
                      subGuests.filter(sg => sg.guestType === 'Child').length
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}


          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {getLocalizedText(locale, 'guests', 'categories')}
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

          {/* This guest has guests section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setHasSubGuests(!hasSubGuests)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  hasSubGuests 
                    ? 'bg-blue-600 text-white hover:bg-blue-700' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {getLocalizedText(locale, 'guests', 'this_guest_has_guests')}
              </button>
              {hasSubGuests && (
                <button
                  type="button"
                  onClick={addSubGuest}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                >
                  + {getLocalizedText(locale, 'guests', 'add_sub_guest')}
                </button>
              )}
            </div>

            {hasSubGuests && (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-3">
                  Add family members or companions for this guest. Their last name will be pre-filled.
                </div>
                
                {subGuests.map((subGuest, index) => (
                  <div key={index} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-gray-700">
                        {getLocalizedText(locale, 'guests', 'sub_guests')} #{index + 1}
                      </h4>
                      <button
                        type="button"
                        onClick={() => removeSubGuest(index)}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        ✕ Remove
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {getLocalizedText(locale, 'guests', 'first_name')}
                        </label>
                        <input
                          type="text"
                          value={subGuest.firstName}
                          onChange={(e) => updateSubGuest(index, 'firstName', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          {getLocalizedText(locale, 'guests', 'last_name')}
                        </label>
                        <input
                          type="text"
                          value={subGuest.lastName}
                          onChange={(e) => updateSubGuest(index, 'lastName', e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {getLocalizedText(locale, 'guests', 'guest_type')}
                      </label>
                      <select
                        value={subGuest.guestType}
                        onChange={(e) => updateSubGuest(index, 'guestType', e.target.value as 'Adult' | 'Child')}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="Adult">{getLocalizedText(locale, 'guests', 'adult')}</option>
                        <option value="Child">{getLocalizedText(locale, 'guests', 'child')}</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {getLocalizedText(locale, 'guests', 'notes')}
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
              {getLocalizedText(locale, 'guests', 'cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {getLocalizedText(locale, 'guests', 'save')}
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