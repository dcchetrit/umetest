'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@ume/shared';
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import { filterUndefined } from '@/utils/firestore';
import { Stage, Layer, Circle, Rect, Text, Group } from 'react-konva';
import Konva from 'konva';
import { jsPDF } from 'jspdf';


interface SeatingClientProps {
  locale: string;
}

interface Guest {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  groupId?: string;
  tableAssignment?: string;
  tags?: any[];
  rsvp?: {
    status: 'accepted' | 'declined' | 'pending';
  };
}

interface Table {
  id: string;
  name: string;
  capacity: number;
  guests: Guest[];
  x: number;
  y: number;
  shape: 'round' | 'rectangle' | 'square';
  width?: number;
  height?: number;
  radius?: number;
  size?: number; // For square tables
  rotation?: number; // Rotation in degrees (0, 45, 90, 135)
}

interface SeatingArrangement {
  eventId: string;
  eventName: string;
  tables: Table[];
  createdAt: Date;
  updatedAt: Date;
}

interface Event {
  name: string;
  date?: string;
  time?: string;
  location?: string;
  showOnWebsite?: boolean;
}

interface Group {
  id: string;
  name: string;
  events: string[];
  description?: string;
}

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      seating: 'Seating Arrangements',
      welcome: 'Manage Seating Arrangements',
      overview: 'Organize your wedding seating chart and table assignments',
      add_table: 'Add New Table',
      add_round_table: 'Add Round Table',
      add_rect_table: 'Add Rectangle Table',
      add_square_table: 'Add Square Table',
      table_name_placeholder: 'Table name',
      table_capacity_placeholder: 'Capacity',
      create_table: 'Create Table',
      cancel: 'Cancel',
      delete_table: 'Delete Table',
      remove_guest: 'Remove from table',
      confirm_delete_table: 'Are you sure you want to delete this table?',
      seats: 'seats',
      table_name: 'Table',
      capacity: 'Capacity',
      assigned_guests: 'Assigned Guests',
      back_home: '← Back to Home',
      loading: 'Loading seating arrangements...',
      error: 'Error loading seating data',
      login_required: 'Please log in to view seating arrangements',
      no_tables: 'No tables configured yet',
      unassigned_guests: 'Unassigned Guests',
      total_tables: 'Total Tables',
      total_seated: 'Seated Guests',
      drag_drop_hint: 'Drag guests from the left panel onto tables',
      guests_per_table: 'guests',
      search_guests: 'Search guests...',
      filter_unassigned: 'Show unassigned only',
      filter_category: 'Filter by category',
      all_categories: 'All categories',
      export_pdf: 'Export to PDF',
      guest_list: 'Guest List',
      seating_canvas: 'Seating Canvas'
    },
    fr: {
      seating: 'Plans de table',
      welcome: 'Gérer les plans de table',
      overview: 'Organisez votre plan de table et les attributions de places',
      add_table: 'Ajouter une nouvelle table',
      add_round_table: 'Ajouter table ronde',
      add_rect_table: 'Ajouter table rectangulaire',
      add_square_table: 'Ajouter table carrée',
      table_name_placeholder: 'Nom de la table',
      table_capacity_placeholder: 'Capacité',
      create_table: 'Créer la table',
      cancel: 'Annuler',
      delete_table: 'Supprimer la table',
      remove_guest: 'Retirer de la table',
      confirm_delete_table: 'Êtes-vous sûr de vouloir supprimer cette table?',
      seats: 'places',
      table_name: 'Table',
      capacity: 'Capacité',
      assigned_guests: 'Invités assignés',
      back_home: '← Retour à l\'accueil',
      loading: 'Chargement des plans de table...',
      error: 'Erreur lors du chargement des données',
      login_required: 'Veuillez vous connecter pour voir les plans de table',
      no_tables: 'Aucune table configurée',
      unassigned_guests: 'Invités non assignés',
      total_tables: 'Total des tables',
      total_seated: 'Invités placés',
      drag_drop_hint: 'Glisser les invités du panneau vers les tables',
      guests_per_table: 'invités',
      search_guests: 'Rechercher invités...',
      filter_unassigned: 'Afficher non assignés seulement',
      filter_category: 'Filtrer par catégorie',
      all_categories: 'Toutes catégories',
      export_pdf: 'Exporter en PDF',
      guest_list: 'Liste des invités',
      seating_canvas: 'Plan de table'
    },
    es: {
      seating: 'Disposición de asientos',
      welcome: 'Gestionar disposición de asientos',
      overview: 'Organiza tu diagrama de asientos y asignaciones de mesa',
      add_table: 'Agregar nueva mesa',
      add_round_table: 'Agregar mesa redonda',
      add_rect_table: 'Agregar mesa rectangular',
      add_square_table: 'Agregar mesa cuadrada',
      table_name_placeholder: 'Nombre de la mesa',
      table_capacity_placeholder: 'Capacidad',
      create_table: 'Crear mesa',
      cancel: 'Cancelar',
      delete_table: 'Eliminar mesa',
      remove_guest: 'Quitar de la mesa',
      confirm_delete_table: '¿Estás seguro de que quieres eliminar esta mesa?',
      seats: 'asientos',
      table_name: 'Mesa',
      capacity: 'Capacidad',
      assigned_guests: 'Invitados asignados',
      back_home: '← Volver al inicio',
      loading: 'Cargando disposición de asientos...',
      error: 'Error al cargar datos de asientos',
      login_required: 'Por favor inicia sesión para ver la disposición',
      no_tables: 'No hay mesas configuradas',
      unassigned_guests: 'Invitados sin asignar',
      total_tables: 'Total de mesas',
      total_seated: 'Invitados sentados',
      drag_drop_hint: 'Arrastra invitados del panel hacia las mesas',
      guests_per_table: 'invitados',
      search_guests: 'Buscar invitados...',
      filter_unassigned: 'Mostrar solo sin asignar',
      filter_category: 'Filtrar por categoría',
      all_categories: 'Todas las categorías',
      export_pdf: 'Exportar a PDF',
      guest_list: 'Lista de invitados',
      seating_canvas: 'Lienzo de asientos'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default function SeatingClient({ locale }: SeatingClientProps) {
  const { user } = useAuth();

  // Authentication guard
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to manage seating arrangements</h1>
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
  const [tables, setTables] = useState<Table[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [seatingArrangements, setSeatingArrangements] = useState<Record<string, SeatingArrangement>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [showUnassignedOnly, setShowUnassignedOnly] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [draggedGuest, setDraggedGuest] = useState<Guest | null>(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [modalTableShape, setModalTableShape] = useState<'round' | 'rectangle' | 'square'>('round');
  const [tableName, setTableName] = useState('');
  const [tableCapacity, setTableCapacity] = useState(8);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const stageRef = useRef<Konva.Stage>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Fetch all guests (not just accepted ones for seating planning)
        const guestsQuery = query(
          collection(db, 'couples', coupleId, 'guests')
        );
        const guestsSnapshot = await getDocs(guestsQuery);
        
        const guestsData: Guest[] = [];
        guestsSnapshot.forEach((doc) => {
          const data = doc.data();
          guestsData.push({
            id: doc.id,
            name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Unknown Guest',
            firstName: data.firstName,
            lastName: data.lastName,
            groupId: data.groupId,
            tags: data.tags || data.categories || [],
            rsvp: data.rsvp || { status: 'pending' },
            tableAssignment: data.tableAssignment,
            ...data
          } as Guest);
        });
        
        console.log('Fetched guests:', guestsData.length, guestsData);

        setGuests(guestsData);

        // Fetch events and groups from couple document
        const coupleDocRef = doc(db, 'couples', coupleId);
        const coupleDoc = await getDoc(coupleDocRef);
        
        let eventsData: Event[] = [];
        let groupsData: Record<string, Group> = {};
        if (coupleDoc.exists()) {
          const coupleData = coupleDoc.data();
          eventsData = coupleData.events || [];
          
          // Convert groups object to Record<string, Group> format
          const rawGroups = coupleData.groups || {};
          Object.entries(rawGroups).forEach(([groupId, groupData]: [string, any]) => {
            groupsData[groupId] = {
              id: groupId,
              name: groupData.name || 'Unnamed Group',
              events: groupData.events || [],
              description: groupData.description
            };
          });
          
          console.log('Fetched events:', eventsData);
          console.log('Fetched groups:', groupsData);
          setEvents(eventsData);
          setGroups(groupsData);
          
          // Set first event as selected by default
          if (eventsData.length > 0) {
            setSelectedEvent(eventsData[0].name);
          }
        }

        // Fetch seating arrangements for all events
        const seatingArrangementsData: Record<string, SeatingArrangement> = {};
        
        for (const event of eventsData) {
          const seatingDocRef = doc(db, 'couples', coupleId, 'seating-arrangements', event.name);
          const seatingDoc = await getDoc(seatingDocRef);
          
          if (seatingDoc.exists()) {
            const seatingData = seatingDoc.data();
            seatingArrangementsData[event.name] = {
              eventId: event.name,
              eventName: event.name,
              tables: seatingData.tables || [],
              createdAt: seatingData.createdAt?.toDate() || new Date(),
              updatedAt: seatingData.updatedAt?.toDate() || new Date()
            };
          } else {
            // Create default arrangement with sample tables for new events
            const defaultTables: Table[] = [
              {
                id: '1',
                name: 'Head Table',
                capacity: 10,
                guests: [],
                x: 400,
                y: 100,
                shape: 'rectangle' as const,
                width: 140,
                height: 60,
                rotation: 0
              },
              {
                id: '2', 
                name: 'Family Table',
                capacity: 12,
                guests: [],
                x: 200,
                y: 250,
                shape: 'round' as const,
                radius: 70
              },
              {
                id: '3',
                name: 'Friends Table',
                capacity: 6,
                guests: [],
                x: 600,
                y: 250,
                shape: 'square' as const,
                size: 90
              }
            ];
            
            seatingArrangementsData[event.name] = {
              eventId: event.name,
              eventName: event.name,
              tables: defaultTables,
              createdAt: new Date(),
              updatedAt: new Date()
            };
          }
        }
        
        setSeatingArrangements(seatingArrangementsData);
        
        // Set tables for the selected event
        if (eventsData.length > 0) {
          setTables(seatingArrangementsData[eventsData[0].name]?.tables || []);
        }
      } catch (err: unknown) {
        console.error('Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // Helper functions
  const calculateTableSize = (capacity: number, shape: 'round' | 'rectangle' | 'square') => {
    // Base size calculations relative to capacity
    const baseSize = Math.max(50, Math.min(150, 40 + (capacity * 8)));
    
    switch (shape) {
      case 'round':
        return { radius: Math.round(baseSize / 2) };
      case 'rectangle':
        return { 
          width: Math.round(baseSize * 1.4), 
          height: Math.round(baseSize * 0.6) 
        };
      case 'square':
        return { size: Math.round(baseSize) };
      default:
        return { radius: 50 };
    }
  };

  const openTableModal = (shape: 'round' | 'rectangle' | 'square') => {
    setModalTableShape(shape);
    setTableName('');
    setTableCapacity(8);
    setShowTableModal(true);
  };

  const createTable = () => {
    if (!tableName.trim() || tableCapacity < 1) return;
    
    const sizeProps = calculateTableSize(tableCapacity, modalTableShape);
    const newTable: Table = {
      id: `table-${Date.now()}`,
      name: tableName.trim(),
      capacity: tableCapacity,
      guests: [],
      x: 300 + (tables.length * 50),
      y: 200 + (tables.length * 50),
      shape: modalTableShape,
      rotation: modalTableShape === 'rectangle' ? 0 : undefined,
      ...sizeProps
    };
    
    setTables([...tables, newTable]);
    setShowTableModal(false);
    
    // Auto-save the arrangement when a new table is added
    setTimeout(() => {
      saveCurrentArrangement();
    }, 100);
  };

  const closeTableModal = () => {
    setShowTableModal(false);
    setTableName('');
    setTableCapacity(8);
  };

  // Event selection and management
  const handleEventChange = async (eventName: string) => {
    // Save current arrangement before switching if there are changes
    if (selectedEvent && tables.length > 0) {
      const shouldSave = window.confirm('Save changes to the current event before switching?');
      if (shouldSave) {
        await saveCurrentArrangement();
      }
    }
    
    setSelectedEvent(eventName);
    
    // Load tables for the selected event
    const eventArrangement = seatingArrangements[eventName];
    if (eventArrangement) {
      setTables(eventArrangement.tables);
    } else {
      setTables([]);
    }
  };

  const saveCurrentArrangement = async () => {
    if (!selectedEvent) return;
    
    setSaveStatus('saving');
    try {
      const arrangement: SeatingArrangement = {
        eventId: selectedEvent,
        eventName: selectedEvent,
        tables: tables,
        createdAt: seatingArrangements[selectedEvent]?.createdAt || new Date(),
        updatedAt: new Date()
      };

      // Update local state
      setSeatingArrangements(prev => ({
        ...prev,
        [selectedEvent]: arrangement
      }));

      // Clean tables data before saving - remove any undefined values
      const cleanTables = tables.map(table => {
        const cleanTable: any = {
          id: table.id || `table-${Date.now()}`,
          name: table.name || 'Unnamed Table',
          capacity: table.capacity || 8,
          guests: (table.guests || []).map(guest => ({
            id: guest.id,
            name: guest.name || `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || 'Unknown Guest',
            firstName: guest.firstName || '',
            lastName: guest.lastName || '',
            groupId: guest.groupId || null,
            tags: guest.tags || [],
            rsvp: guest.rsvp || { status: 'pending' }
          })),
          x: table.x || 0,
          y: table.y || 0,
          shape: table.shape || 'round'
        };

        // Add shape-specific properties only if they exist
        if (table.radius !== undefined) cleanTable.radius = table.radius;
        if (table.width !== undefined) cleanTable.width = table.width;
        if (table.height !== undefined) cleanTable.height = table.height;
        if (table.size !== undefined) cleanTable.size = table.size;
        if (table.rotation !== undefined) cleanTable.rotation = table.rotation;

        return cleanTable;
      });

      // Save to Firestore with clean data
      const seatingDocRef = doc(db, 'couples', coupleId, 'seating-arrangements', selectedEvent);
      const dataToSave = {
        eventId: selectedEvent,
        eventName: selectedEvent,
        tables: cleanTables,
        createdAt: arrangement.createdAt,
        updatedAt: arrangement.updatedAt
      };

      await setDoc(seatingDocRef, dataToSave);

      setSaveStatus('saved');
      console.log(`Seating arrangement saved for event: ${selectedEvent}`);
      
      // Reset save status after 2 seconds
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Error saving seating arrangement:', error);
      
      // Show more specific error message
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        if (error.message.includes('undefined')) {
          console.error('Data being saved contains undefined values:', {
            eventId: selectedEvent,
            tablesCount: tables.length,
            tables: tables
          });
        }
      }
      
      setSaveStatus('error');
      // Reset save status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const removeTable = (tableId: string) => {
    if (window.confirm(getLocalizedText(locale, 'confirm_delete_table'))) {
      setTables(prevTables => prevTables.filter(table => table.id !== tableId));
      // Auto-save after removing table
      setTimeout(() => {
        saveCurrentArrangement();
      }, 100);
    }
  };

  const removeGuestFromTable = (guestId: string, tableId: string) => {
    setTables(prevTables => 
      prevTables.map(table => 
        table.id === tableId 
          ? { ...table, guests: table.guests.filter(g => g.id !== guestId) }
          : table
      )
    );
    // Auto-save after removing guest
    setTimeout(() => {
      saveCurrentArrangement();
    }, 100);
  };

  // ---- Geometry helpers ----
  type Pt = { x: number; y: number };

  function circleSeats(
    n: number,
    center: Pt,
    tableRadius: number,
    seatGap: number // distance from table edge to seat center
  ): Pt[] {
    const r = tableRadius + seatGap;
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2; // start at top
      pts.push({ x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
    }
    return pts;
  }

  /**
   * Seats evenly along the perimeter of a rectangle, offset outward from edges.
   * x,y = rect top-left in the table Group's local coords.
   */
  function rectSeats(
    n: number,
    x: number,
    y: number,
    w: number,
    h: number,
    offset: number,     // outward distance from edge to seat center
    cornerClear = 12    // skip this many px from each corner to avoid crowding
  ): Pt[] {
    const P = 2 * (w + h);
    const usable = P - 8 * cornerClear; // 2 corners per side
    const step = usable / n;

    // Walk the perimeter starting at middle of top edge
    let d = cornerClear + step / 2;
    const pts: Pt[] = [];

    for (let i = 0; i < n; i++) {
      // map distance -> side
      let t = d;

      // top edge (left->right)
      if (t <= w - 2 * cornerClear) {
        const X = x + cornerClear + t;
        pts.push({ x: X, y: y - offset }); // outward normal = -Y
      } else {
        t -= w - 2 * cornerClear;

        // right edge (top->bottom)
        if (t <= h - 2 * cornerClear) {
          const Y = y + cornerClear + t;
          pts.push({ x: x + w + offset, y: Y }); // outward normal = +X
        } else {
          t -= h - 2 * cornerClear;

          // bottom edge (right->left)
          if (t <= w - 2 * cornerClear) {
            const X = x + w - cornerClear - t;
            pts.push({ x: X, y: y + h + offset }); // outward normal = +Y
          } else {
            t -= w - 2 * cornerClear;

            // left edge (bottom->top)
            const Y = y + h - cornerClear - t;
            pts.push({ x: x - offset, y: Y }); // outward normal = -X
          }
        }
      }
      d += step;
    }
    return pts;
  }

  // Helper function to rotate a point around the origin
  const rotatePoint = (x: number, y: number, angleDegrees: number): Pt => {
    const angleRad = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    
    return {
      x: x * cos - y * sin,
      y: x * sin + y * cos
    };
  };

  // Calculate seat positions around tables using proper geometric algorithms
  const calculateSeatPositions = (table: Table) => {
    const { capacity, shape } = table;
    const seatGap = 20; // Distance from table edge for circular tables
    const edgeOffset = 18; // Outward distance from edge for rectangular tables
    
    let positions: Pt[] = [];
    
    if (shape === 'round') {
      // Circular table: use polar placement
      const tableRadius = table.radius || 70;
      positions = circleSeats(capacity, { x: 0, y: 0 }, tableRadius, seatGap);
    } else {
      // Rectangular/square table: use perimeter-along-edges placement
      const width = shape === 'square' ? (table.size || 100) : (table.width || 200);
      const height = shape === 'square' ? (table.size || 100) : (table.height || 80);
      positions = rectSeats(capacity, -width/2, -height/2, width, height, edgeOffset);
      
      // Apply rotation if it's a rectangle table
      if (shape === 'rectangle' && table.rotation) {
        positions = positions.map(pos => rotatePoint(pos.x, pos.y, table.rotation || 0));
      }
    }
    
    // Convert to seat objects with occupation status
    return positions.map((pos, index) => ({
      x: pos.x,
      y: pos.y,
      occupied: index < table.guests.length
    }));
  };

  const addGuestToTable = (guest: Guest, tableId: string) => {
    setTables(prevTables => 
      prevTables.map(table => {
        // Remove guest from all tables first
        const cleanedGuests = table.guests.filter(g => g.id !== guest.id);
        
        // Add to target table if it's not full
        if (table.id === tableId && cleanedGuests.length < table.capacity) {
          return { ...table, guests: [...cleanedGuests, guest] };
        }
        
        return { ...table, guests: cleanedGuests };
      })
    );
    // Auto-save after assigning guest
    setTimeout(() => {
      saveCurrentArrangement();
    }, 100);
  };

  const exportToPDF = async () => {
    if (!stageRef.current) return;
    
    // Get canvas image data
    const uri = stageRef.current.toDataURL({ pixelRatio: 2 });
    
    // Create PDF
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    // Add title
    pdf.setFontSize(20);
    pdf.text('Wedding Seating Chart', 20, 20);
    
    // Add image to PDF
    const imgWidth = 250;
    const imgHeight = 150;
    pdf.addImage(uri, 'PNG', 20, 30, imgWidth, imgHeight);
    
    // Add table summary
    pdf.setFontSize(12);
    let yPos = 190;
    pdf.text('Table Summary:', 20, yPos);
    
    tables.forEach((table) => {
      yPos += 10;
      pdf.text(`${table.name}: ${table.guests.length}/${table.capacity} guests`, 20, yPos);
      if (table.guests.length > 0) {
        yPos += 5;
        const guestNames = table.guests.map(g => g.name).join(', ');
        pdf.text(`  Guests: ${guestNames}`, 25, yPos);
      }
    });
    
    // Save PDF
    pdf.save('seating-chart.pdf');
  };

  const handleDragStart = (e: React.DragEvent, guest: Guest) => {
    console.log('Drag start for guest:', guest.firstName, guest.id);
    setDraggedGuest(guest);
    e.dataTransfer.setData('text/plain', guest.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    console.log('Drag end - clearing dragged guest');
    setDraggedGuest(null);
  };

  const handleDrop = (e: React.DragEvent, tableId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Drop event triggered for table:', tableId);
    
    const guestId = e.dataTransfer.getData('text/plain');
    const guest = draggedGuest || guests.find(g => g.id === guestId);
    
    console.log('Dropped guest:', guest, 'draggedGuest:', draggedGuest);
    
    if (guest) {
      console.log('Adding guest to table:', guest.firstName, '->', tableId);
      addGuestToTable(guest, tableId);
      setDraggedGuest(null);
    }
  };

  const handleTableDragEnd = (tableId: string, newPos: { x: number; y: number }) => {
    setTables(prevTables => 
      prevTables.map(table => 
        table.id === tableId ? { ...table, x: newPos.x, y: newPos.y } : table
      )
    );
  };

  const rotateTable = (tableId: string) => {
    setTables(prevTables => 
      prevTables.map(table => {
        if (table.id === tableId && table.shape === 'rectangle') {
          const currentRotation = table.rotation || 0;
          const newRotation = (currentRotation + 45) % 180; // Rotate 45 degrees, max 180 (4 clicks)
          return { ...table, rotation: newRotation };
        }
        return table;
      })
    );
    
    // Auto-save after rotation
    setTimeout(() => {
      saveCurrentArrangement();
    }, 100);
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

  // Helper function to check if guest is attending the selected event
  const isGuestAttendingEvent = (guest: Guest, eventName: string) => {
    // Check if guest's group is invited to the event
    const guestGroup = guest.groupId ? groups[guest.groupId] : null;
    const isInvitedToEvent = guestGroup && guestGroup.events.includes(eventName);
    
    if (!isInvitedToEvent) return false;
    
    // Check if guest has accepted RSVP for this specific event
    const hasAcceptedRSVP = guest.rsvp?.status === 'accepted' || guest.rsvp?.status === 'Confirmé';
    if (!hasAcceptedRSVP) return false;
    
    // Check if guest has accepted this specific event in their RSVP
    const eventRSVPResponse = guest.rsvp?.events?.[eventName];
    return eventRSVPResponse === true;
  };

  // Get guests attending the selected event
  const attendingGuests = guests.filter(guest => 
    selectedEvent ? isGuestAttendingEvent(guest, selectedEvent) : true
  );

  const assignedGuests = tables.reduce((total, table) => total + table.guests.length, 0);
  const unassignedGuests = attendingGuests.filter(guest => {
    const isNotAssignedToTable = !tables.some(table => table.guests.some(tGuest => tGuest.id === guest.id));
    return isNotAssignedToTable;
  });

  // Get unique categories for filter dropdown from attending guests only
  const categories = Array.from(new Set(
    attendingGuests.flatMap(g => 
      (g.tags || []).map(tag => typeof tag === 'string' ? tag : tag.name || tag.title || 'Uncategorized')
    ).filter(Boolean)
  ));

  const filteredGuests = attendingGuests.filter(guest => {
    const guestName = guest.firstName || guest.name || '';
    const matchesSearch = guestName.toLowerCase().includes(searchTerm.toLowerCase());
    const isUnassigned = unassignedGuests.some(ug => ug.id === guest.id);
    
    // Check if guest has matching category in their tags
    const guestCategories = (guest.tags || []).map(tag => 
      typeof tag === 'string' ? tag : tag.name || tag.title || 'Uncategorized'
    );
    const matchesCategory = selectedCategory === '' || guestCategories.includes(selectedCategory);
    
    if (showUnassignedOnly) {
      return matchesSearch && isUnassigned && matchesCategory;
    }
    
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with Event Selection */}
      <div className="bg-white shadow-sm border-b">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{getLocalizedText(locale, 'seating')}</h1>
              <p className="text-gray-600 mt-1">{getLocalizedText(locale, 'overview')}</p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Event Selection Dropdown */}
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Event:</label>
                <select
                  value={selectedEvent}
                  onChange={(e) => handleEventChange(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-48"
                >
                  {events.map((event) => (
                    <option key={event.name} value={event.name}>
                      {event.name} {event.date && `(${event.date})`}
                    </option>
                  ))}
                </select>
              </div>
              
              {/* Export Button */}
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
              >
                📄 {getLocalizedText(locale, 'export_pdf')}
              </button>
              
              {/* Save Button */}
              <button
                onClick={saveCurrentArrangement}
                disabled={saveStatus === 'saving'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                  saveStatus === 'saving' 
                    ? 'bg-gray-400 text-white cursor-not-allowed'
                    : saveStatus === 'saved'
                    ? 'bg-green-600 text-white'
                    : saveStatus === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {saveStatus === 'saving' && '⏳ Saving...'}
                {saveStatus === 'saved' && '✅ Saved!'}
                {saveStatus === 'error' && '❌ Error'}
                {saveStatus === 'idle' && '💾 Save Layout'}
              </button>
            </div>
          </div>
          
          {/* Event Stats */}
          {selectedEvent && (
            <div className="mt-4 grid grid-cols-4 gap-4">
              <div className="bg-blue-50 px-4 py-2 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{tables.length}</div>
                <div className="text-sm text-gray-600">{getLocalizedText(locale, 'total_tables')}</div>
              </div>
              <div className="bg-green-50 px-4 py-2 rounded-lg">
                <div className="text-lg font-bold text-green-600">{assignedGuests}</div>
                <div className="text-sm text-gray-600">{getLocalizedText(locale, 'total_seated')}</div>
              </div>
              <div className="bg-orange-50 px-4 py-2 rounded-lg">
                <div className="text-lg font-bold text-orange-600">{unassignedGuests.length}</div>
                <div className="text-sm text-gray-600">{getLocalizedText(locale, 'unassigned_guests')}</div>
              </div>
              <div className="bg-purple-50 px-4 py-2 rounded-lg">
                <div className="text-lg font-bold text-purple-600">
                  {attendingGuests.length}
                </div>
                <div className="text-sm text-gray-600">Attending Event</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex" style={{ height: 'calc(100vh - 140px)' }}>
        {/* Left Panel - Guest List */}
        <div className="w-80 bg-white shadow-lg overflow-hidden flex flex-col">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold mb-2">{getLocalizedText(locale, 'guest_list')}</h2>
            {selectedEvent && (
              <p className="text-sm text-gray-600 mb-4">
                Showing guests attending "{selectedEvent}"
              </p>
            )}
            
            {/* Search */}
            <input
              type="text"
              placeholder={getLocalizedText(locale, 'search_guests')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
            />
            
            {/* Category Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3 text-sm"
            >
              <option value="">{getLocalizedText(locale, 'all_categories')}</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            
            {/* Filter */}
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={showUnassignedOnly}
                onChange={(e) => setShowUnassignedOnly(e.target.checked)}
                className="mr-2"
              />
              {getLocalizedText(locale, 'filter_unassigned')}
            </label>
          </div>
          
          {/* Guest List */}
          <div className="flex-1 overflow-y-auto p-4">
            {filteredGuests.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {selectedEvent ? (
                  <div>
                    <p className="font-medium">No guests attending "{selectedEvent}"</p>
                    <p className="text-sm mt-1">
                      Guests need to RSVP and accept this specific event to appear here.
                    </p>
                  </div>
                ) : (
                  <p>No events selected</p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGuests.map((guest) => {
                const isAssigned = !unassignedGuests.some(ug => ug.id === guest.id);
                const assignedTable = tables.find(table => 
                  table.guests.some(tGuest => tGuest.id === guest.id)
                );
                
                return (
                  <div
                    key={guest.id}
                    draggable={true}
                    onDragStart={(e) => {
                      if (isAssigned) {
                        e.preventDefault();
                        return false;
                      }
                      handleDragStart(e, guest);
                    }}
                    onDragEnd={handleDragEnd}
                    className={`p-3 rounded-lg border transition-colors relative ${
                      isAssigned 
                        ? 'bg-green-50 border-green-200 text-green-800 cursor-default' 
                        : 'bg-yellow-50 border-yellow-200 text-yellow-800 cursor-move'
                    } hover:shadow-md`}
                  >
                    <div className="font-medium pr-6">{guest.firstName}</div>
                    <div className="text-xs opacity-75 space-x-2">
                      {guest.tags && guest.tags.length > 0 && guest.tags.map((tag, index) => {
                        const tagName = typeof tag === 'string' ? tag : tag.name || tag.title || 'Uncategorized';
                        return (
                          <span key={index} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs mr-1">
                            {tagName}
                          </span>
                        );
                      })}
                      {assignedTable && (
                        <span className="text-gray-600">Table: {assignedTable.name}</span>
                      )}
                    </div>
                    {isAssigned && assignedTable && (
                      <button
                        onClick={() => removeGuestFromTable(guest.id, assignedTable.id)}
                        className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600 transition-colors"
                        title={getLocalizedText(locale, 'remove_guest')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
              </div>
            )}
          </div>
          
          {/* Stats */}
          <div className="border-t p-4 bg-gray-50">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-green-600">{assignedGuests}</div>
                <div className="text-xs text-gray-600">{getLocalizedText(locale, 'total_seated')}</div>
              </div>
              <div>
                <div className="text-lg font-bold text-orange-600">{unassignedGuests.length}</div>
                <div className="text-xs text-gray-600">{getLocalizedText(locale, 'unassigned_guests')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Canvas */}
        <div className="flex-1 flex flex-col">
          <div className="p-4 bg-white border-b flex justify-between items-center">
            <h2 className="text-lg font-semibold">{getLocalizedText(locale, 'seating_canvas')}</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => openTableModal('round')}
                className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
              >
                {getLocalizedText(locale, 'add_round_table')}
              </button>
              <button 
                onClick={() => openTableModal('rectangle')}
                className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
              >
                {getLocalizedText(locale, 'add_rect_table')}
              </button>
              <button 
                onClick={() => openTableModal('square')}
                className="bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 text-sm"
              >
                {getLocalizedText(locale, 'add_square_table')}
              </button>
            </div>
          </div>
          
          <div className="flex-1 bg-gray-100 overflow-hidden relative">
            {/* Drop zones for tables */}
            {tables.map((table) => {
              let width, height;
              if (table.shape === 'round') {
                width = height = (table.radius || 70) * 2 + 20;
              } else if (table.shape === 'square') {
                width = height = (table.size || 100) + 20;
              } else {
                width = (table.width || 200) + 20;
                height = (table.height || 80) + 20;
              }
              
              return (
                <div
                  key={`drop-${table.id}`}
                  className="absolute border-2 border-dashed border-transparent hover:border-blue-300 rounded-lg transition-colors"
                  style={{
                    left: table.x - 10,
                    top: table.y - 10,
                    width,
                    height,
                    zIndex: 5,
                    pointerEvents: draggedGuest ? 'auto' : 'none'
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleDrop(e, table.id);
                    e.currentTarget.style.borderColor = 'transparent';
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = '#3b82f6';
                    e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                />
              );
            })}
            
            <Stage
              ref={stageRef}
              width={typeof window !== 'undefined' ? window.innerWidth - 320 : 800}
              height={typeof window !== 'undefined' ? window.innerHeight - 120 : 600}
              draggable={false}
            >
              <Layer>
                {tables.map((table) => {
                  const seatPositions = calculateSeatPositions(table);
                  
                  return (
                    <Group
                      key={table.id}
                      x={table.x}
                      y={table.y}
                      rotation={table.shape === 'rectangle' ? (table.rotation || 0) : 0}
                      draggable={true}
                      onDragEnd={(e) => {
                        handleTableDragEnd(table.id, {
                          x: e.target.x(),
                          y: e.target.y()
                        });
                      }}
                    >
                    {/* Table Shape */}
                    {table.shape === 'round' ? (
                      <Circle
                        radius={table.radius || 70}
                        fill="#fff"
                        stroke="#2e3a3f"
                        strokeWidth={3}
                      />
                    ) : table.shape === 'square' ? (
                      <Rect
                        x={-(table.size || 100) / 2}
                        y={-(table.size || 100) / 2}
                        width={table.size || 100}
                        height={table.size || 100}
                        fill="#fff"
                        stroke="#2e3a3f"
                        strokeWidth={3}
                        cornerRadius={12}
                      />
                    ) : (
                      <Rect
                        x={-(table.width || 200) / 2}
                        y={-(table.height || 80) / 2}
                        width={table.width || 200}
                        height={table.height || 80}
                        fill="#fff"
                        stroke="#2e3a3f"
                        strokeWidth={3}
                        cornerRadius={12}
                      />
                    )}
                    
                    {/* Table Name */}
                    <Text
                      text={table.name}
                      fontSize={14}
                      fontStyle="bold"
                      fill="#374151"
                      x={table.shape === 'round' ? -(table.radius || 70) / 2 : table.shape === 'square' ? 10 : 10}
                      y={table.shape === 'round' ? -7 : table.shape === 'square' ? 10 : 10}
                      width={table.shape === 'round' ? (table.radius || 70) : table.shape === 'square' ? (table.size || 100) - 20 : (table.width || 200) - 20}
                      align="center"
                    />
                    
                    {/* Capacity Info */}
                    <Text
                      text={`${table.guests.length}/${table.capacity}`}
                      fontSize={12}
                      fill="#6b7280"
                      x={table.shape === 'round' ? -(table.radius || 70) / 2 : table.shape === 'square' ? 10 : 10}
                      y={table.shape === 'round' ? 10 : table.shape === 'square' ? 30 : 30}
                      width={table.shape === 'round' ? (table.radius || 70) : table.shape === 'square' ? (table.size || 100) - 20 : (table.width || 200) - 20}
                      align="center"
                    />
                    
                    {/* Guest Names */}
                    {table.guests.slice(0, 3).map((guest, index) => {
                      const getTextProps = () => {
                        if (table.shape === 'round') {
                          return {
                            x: -(table.radius || 70) / 2,
                            y: 25 + (index * 12),
                            width: (table.radius || 70)
                          };
                        } else if (table.shape === 'square') {
                          return {
                            x: 10,
                            y: 45 + (index * 12),
                            width: (table.size || 100) - 20
                          };
                        } else {
                          return {
                            x: 10,
                            y: 45 + (index * 12),
                            width: (table.width || 200) - 20
                          };
                        }
                      };
                      
                      const textProps = getTextProps();
                      
                      return (
                        <Text
                          key={guest.id}
                          text={guest.firstName}
                          fontSize={10}
                          fill="#059669"
                          x={textProps.x}
                          y={textProps.y}
                          width={textProps.width}
                          align="center"
                        />
                      );
                    })}
                    
                    {table.guests.length > 3 && (() => {
                      const getMoreTextProps = () => {
                        if (table.shape === 'round') {
                          return {
                            x: -(table.radius || 70) / 2,
                            y: 25 + (3 * 12),
                            width: (table.radius || 70)
                          };
                        } else if (table.shape === 'square') {
                          return {
                            x: 10,
                            y: 45 + (3 * 12),
                            width: (table.size || 100) - 20
                          };
                        } else {
                          return {
                            x: 10,
                            y: 45 + (3 * 12),
                            width: (table.width || 200) - 20
                          };
                        }
                      };
                      
                      const moreTextProps = getMoreTextProps();
                      
                      return (
                        <Text
                          text={`+${table.guests.length - 3} more`}
                          fontSize={10}
                          fill="#6b7280"
                          fontStyle="italic"
                          x={moreTextProps.x}
                          y={moreTextProps.y}
                          width={moreTextProps.width}
                          align="center"
                        />
                      );
                    })()}
                    
                    {/* Seat Dots */}
                    {seatPositions.map((seat, index) => (
                      <Circle
                        key={`seat-${table.id}-${index}`}
                        x={seat.x}
                        y={seat.y}
                        radius={6}
                        fill={seat.occupied ? '#059669' : '#c9d2dc'}
                        stroke={seat.occupied ? '#047857' : '#9ca3af'}
                        strokeWidth={1}
                      />
                    ))}
                    
                    {/* Rotation Button (only for rectangles) */}
                    {table.shape === 'rectangle' && (
                      <>
                        <Circle
                          x={(table.width || 200) / 2 - 30}
                          y={-(table.height || 80) / 2 + 10}
                          radius={8}
                          fill="#3b82f6"
                          stroke="#2563eb"
                          strokeWidth={1}
                          onClick={() => rotateTable(table.id)}
                          onTap={() => rotateTable(table.id)}
                        />
                        <Text
                          text="↻"
                          fontSize={12}
                          fontStyle="bold"
                          fill="white"
                          x={(table.width || 200) / 2 - 35}
                          y={-(table.height || 80) / 2 + 5}
                          width={10}
                          align="center"
                          onClick={() => rotateTable(table.id)}
                          onTap={() => rotateTable(table.id)}
                        />
                      </>
                    )}
                    
                    {/* Delete Button */}
                    <Circle
                      x={table.shape === 'round' ? (table.radius || 70) - 10 : 
                        table.shape === 'square' ? (table.size || 100) / 2 - 10 : 
                        (table.width || 200) / 2 - 10}
                      y={table.shape === 'round' ? -(table.radius || 70) + 10 : 
                        table.shape === 'square' ? -(table.size || 100) / 2 + 10 : 
                        -(table.height || 80) / 2 + 10}
                      radius={8}
                      fill="#ef4444"
                      stroke="#dc2626"
                      strokeWidth={1}
                      onClick={() => removeTable(table.id)}
                      onTap={() => removeTable(table.id)}
                    />
                    <Text
                      text="×"
                      fontSize={12}
                      fontStyle="bold"
                      fill="white"
                      x={table.shape === 'round' ? (table.radius || 70) - 15 : 
                        table.shape === 'square' ? (table.size || 100) / 2 - 15 : 
                        (table.width || 200) / 2 - 15}
                      y={table.shape === 'round' ? -(table.radius || 70) + 5 : 
                        table.shape === 'square' ? -(table.size || 100) / 2 + 5 : 
                        -(table.height || 80) / 2 + 5}
                      width={10}
                      align="center"
                      onClick={() => removeTable(table.id)}
                      onTap={() => removeTable(table.id)}
                    />
                  </Group>
                  );
                })}
              </Layer>
            </Stage>
          </div>
          
          {/* Instructions */}
          <div className="p-4 bg-white border-t">
            <p className="text-sm text-gray-600">
              💡 {getLocalizedText(locale, 'drag_drop_hint')} • Drag tables to reposition them on the canvas
            </p>
          </div>
        </div>
      </div>

      {/* Table Creation Modal */}
      {showTableModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">
              {modalTableShape === 'round' ? getLocalizedText(locale, 'add_round_table') :
               modalTableShape === 'square' ? getLocalizedText(locale, 'add_square_table') :
               getLocalizedText(locale, 'add_rect_table')}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'table_name')}
                </label>
                <input
                  type="text"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder={getLocalizedText(locale, 'table_name_placeholder')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'capacity')}
                </label>
                <input
                  type="number"
                  value={tableCapacity}
                  onChange={(e) => setTableCapacity(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder={getLocalizedText(locale, 'table_capacity_placeholder')}
                  min="1"
                  max="20"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={closeTableModal}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {getLocalizedText(locale, 'cancel')}
              </button>
              <button
                onClick={createTable}
                disabled={!tableName.trim() || tableCapacity < 1}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {getLocalizedText(locale, 'create_table')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}