'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { db } from '@ume/shared';
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { filterUndefined } from '@/utils/firestore';

interface VendorsClientProps {
  locale: string;
}

interface Vendor {
  id: string;
  name: string;
  category: string;
  contact: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  price?: number;
  estimatedCost?: number;
  finalCost?: number;
  status: 'researching' | 'contacted' | 'meeting-scheduled' | 'proposal-received' | 'booked' | 'paid' | 'declined';
  priority: 'low' | 'medium' | 'high';
  notes?: string;
  contractSigned?: boolean;
  depositPaid?: number;
  finalPaymentDue?: string;
  createdAt: string;
  updatedAt: string;
  rating?: number;
  tags?: string[];
}

interface VendorCategory {
  id: string;
  name: string;
  essential: boolean;
  averageCost: number;
  description: string;
}

const vendorCategories: VendorCategory[] = [
  { id: 'venue', name: 'Venue', essential: true, averageCost: 8000, description: 'Reception and ceremony locations' },
  { id: 'catering', name: 'Catering', essential: true, averageCost: 4000, description: 'Food and beverage services' },
  { id: 'photography', name: 'Photography', essential: true, averageCost: 2500, description: 'Wedding photography and videography' },
  { id: 'florals', name: 'Florals', essential: true, averageCost: 1500, description: 'Flowers and decorations' },
  { id: 'music', name: 'Music & Entertainment', essential: true, averageCost: 1200, description: 'DJ, band, or entertainment' },
  { id: 'transportation', name: 'Transportation', essential: false, averageCost: 800, description: 'Wedding day transportation' },
  { id: 'beauty', name: 'Beauty Services', essential: false, averageCost: 600, description: 'Hair and makeup' },
  { id: 'bakery', name: 'Wedding Cake', essential: false, averageCost: 500, description: 'Wedding cake and desserts' },
  { id: 'stationery', name: 'Stationery', essential: false, averageCost: 400, description: 'Invitations and paper goods' },
  { id: 'rentals', name: 'Rentals', essential: false, averageCost: 1000, description: 'Tables, chairs, linens, etc.' }
];

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      vendors: 'Wedding Vendors',
      welcome: 'Manage Wedding Vendors',
      overview: 'Keep track of your wedding vendors and service providers',
      add_vendor: 'Add Vendor',
      vendor_name: 'Vendor Name',
      category: 'Category',
      contact: 'Contact Person',
      phone: 'Phone',
      email: 'Email',
      website: 'Website',
      address: 'Address',
      price: 'Price',
      estimated_cost: 'Estimated Cost',
      final_cost: 'Final Cost',
      status: 'Status',
      priority: 'Priority',
      notes: 'Notes',
      rating: 'Rating',
      tags: 'Tags',
      back_home: '← Back to Home',
      researching: 'Researching',
      contacted: 'Contacted',
      meeting_scheduled: 'Meeting Scheduled',
      proposal_received: 'Proposal Received',
      booked: 'Booked',
      paid: 'Paid',
      declined: 'Declined',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      login_required: 'Please log in to view vendors',
      total_vendors: 'Total Vendors',
      booked_vendors: 'Booked',
      total_cost: 'Total Budget',
      filter_by_category: 'Filter by Category',
      filter_by_status: 'Filter by Status',
      sort_by: 'Sort by',
      all_categories: 'All Categories',
      all_statuses: 'All Statuses',
      name: 'Name',
      created_date: 'Created Date',
      cost: 'Cost',
      save: 'Save Vendor',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      confirm_delete: 'Are you sure you want to delete this vendor?',
      contract_signed: 'Contract Signed',
      deposit_paid: 'Deposit Paid',
      final_payment_due: 'Final Payment Due',
      edit_vendor: 'Edit Vendor',
      view_details: 'View Details',
      vendor_details: 'Vendor Details',
      close: 'Close'
    },
    fr: {
      vendors: 'Prestataires de mariage',
      welcome: 'Gérer les prestataires de mariage',
      overview: 'Suivez vos prestataires et fournisseurs de services de mariage',
      add_vendor: 'Ajouter un prestataire',
      vendor_name: 'Nom du prestataire',
      category: 'Catégorie',
      contact: 'Personne de contact',
      phone: 'Téléphone',
      email: 'Email',
      website: 'Site web',
      address: 'Adresse',
      price: 'Prix',
      estimated_cost: 'Coût estimé',
      final_cost: 'Coût final',
      status: 'Statut',
      priority: 'Priorité',
      notes: 'Notes',
      rating: 'Évaluation',
      tags: 'Étiquettes',
      back_home: '← Retour à l\'accueil',
      researching: 'Recherche',
      contacted: 'Contacté',
      meeting_scheduled: 'Rendez-vous programmé',
      proposal_received: 'Proposition reçue',
      booked: 'Réservé',
      paid: 'Payé',
      declined: 'Refusé',
      low: 'Faible',
      medium: 'Moyen',
      high: 'Élevé',
      login_required: 'Veuillez vous connecter pour voir les prestataires',
      total_vendors: 'Total prestataires',
      booked_vendors: 'Réservés',
      total_cost: 'Budget total',
      filter_by_category: 'Filtrer par catégorie',
      filter_by_status: 'Filtrer par statut',
      sort_by: 'Trier par',
      all_categories: 'Toutes catégories',
      all_statuses: 'Tous statuts',
      name: 'Nom',
      created_date: 'Date de création',
      cost: 'Coût',
      save: 'Sauvegarder',
      cancel: 'Annuler',
      edit: 'Modifier',
      delete: 'Supprimer',
      confirm_delete: 'Êtes-vous sûr de vouloir supprimer ce prestataire?',
      contract_signed: 'Contrat signé',
      deposit_paid: 'Acompte payé',
      final_payment_due: 'Paiement final dû',
      edit_vendor: 'Modifier le prestataire',
      view_details: 'Voir les détails',
      vendor_details: 'Détails du prestataire',
      close: 'Fermer'
    },
    es: {
      vendors: 'Proveedores de boda',
      welcome: 'Gestionar proveedores de boda',
      overview: 'Mantén un seguimiento de tus proveedores y servicios de boda',
      add_vendor: 'Agregar proveedor',
      vendor_name: 'Nombre del proveedor',
      category: 'Categoría',
      contact: 'Persona de contacto',
      phone: 'Teléfono',
      email: 'Correo',
      website: 'Sitio web',
      address: 'Dirección',
      price: 'Precio',
      estimated_cost: 'Costo estimado',
      final_cost: 'Costo final',
      status: 'Estado',
      priority: 'Prioridad',
      notes: 'Notas',
      rating: 'Calificación',
      tags: 'Etiquetas',
      back_home: '← Volver al inicio',
      researching: 'Investigando',
      contacted: 'Contactado',
      meeting_scheduled: 'Reunión programada',
      proposal_received: 'Propuesta recibida',
      booked: 'Reservado',
      paid: 'Pagado',
      declined: 'Rechazado',
      low: 'Bajo',
      medium: 'Medio',
      high: 'Alto',
      login_required: 'Por favor inicia sesión para ver proveedores',
      total_vendors: 'Total proveedores',
      booked_vendors: 'Reservados',
      total_cost: 'Presupuesto total',
      filter_by_category: 'Filtrar por categoría',
      filter_by_status: 'Filtrar por estado',
      sort_by: 'Ordenar por',
      all_categories: 'Todas las categorías',
      all_statuses: 'Todos los estados',
      name: 'Nombre',
      created_date: 'Fecha de creación',
      cost: 'Costo',
      save: 'Guardar',
      cancel: 'Cancelar',
      edit: 'Editar',
      delete: 'Eliminar',
      confirm_delete: '¿Estás seguro de que quieres eliminar este proveedor?',
      contract_signed: 'Contrato firmado',
      deposit_paid: 'Depósito pagado',
      final_payment_due: 'Pago final vence',
      edit_vendor: 'Editar proveedor',
      view_details: 'Ver detalles',
      vendor_details: 'Detalles del proveedor',
      close: 'Cerrar'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}


function getStatusColor(status: string) {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'booked':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'proposal_received':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'meeting_scheduled':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'contacted':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'researching':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'declined':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high':
      return 'text-red-600';
    case 'medium':
      return 'text-yellow-600';
    case 'low':
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
}

export default function VendorsClient({ locale }: VendorsClientProps) {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [sortBy, setSortBy] = useState('created_date');
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState<Partial<Vendor>>({
    name: '',
    category: '',
    contact: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    estimatedCost: 0,
    finalCost: 0,
    status: 'researching',
    priority: 'medium',
    notes: '',
    rating: 0,
    contractSigned: false,
    depositPaid: 0,
    finalPaymentDue: '',
    tags: []
  });

  useEffect(() => {
    if (user) {
      loadVendors();
    }
  }, [user]);

  const loadVendors = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const vendorsRef = collection(db, 'couples', user.uid, 'vendors');
      const vendorsSnapshot = await getDocs(vendorsRef);
      const vendorsData = vendorsSnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as Vendor[];
      
      setVendors(vendorsData);
    } catch (error) {
      console.error('Error loading vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let filtered = vendors.filter(vendor => {
      const matchesSearch = vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          vendor.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          vendor.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || vendor.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || vendor.status === selectedStatus;
      
      return matchesSearch && matchesCategory && matchesStatus;
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'cost':
          return (b.finalCost || b.estimatedCost || 0) - (a.finalCost || a.estimatedCost || 0);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          return priorityOrder[b.priority as keyof typeof priorityOrder] - priorityOrder[a.priority as keyof typeof priorityOrder];
        case 'created_date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    setFilteredVendors(filtered);
  }, [vendors, selectedCategory, selectedStatus, sortBy, searchTerm]);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    try {
      const now = Timestamp.now();
      
      if (editingVendor) {
        // Update existing vendor
        const vendorRef = doc(db, 'couples', user.uid, 'vendors', editingVendor.id);
        await updateDoc(vendorRef, filterUndefined({
          ...formData,
          updatedAt: now
        }));
        setEditingVendor(null);
        setShowEditModal(false);
      } else {
        // Add new vendor
        const vendorsRef = collection(db, 'couples', user.uid, 'vendors');
        await addDoc(vendorsRef, filterUndefined({
          ...formData,
          createdAt: now,
          updatedAt: now
        }));
        setShowAddModal(false);
      }
      
      // Reload vendors from Firestore
      await loadVendors();
      resetForm();
    } catch (error) {
      console.error('Error saving vendor:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      contact: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      estimatedCost: 0,
      finalCost: 0,
      status: 'researching',
      priority: 'medium',
      notes: '',
      rating: 0,
      contractSigned: false,
      depositPaid: 0,
      finalPaymentDue: '',
      tags: []
    });
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData(vendor);
    setShowEditModal(true);
  };

  const handleDelete = async (vendorId: string) => {
    if (!user) return;
    
    if (confirm(getLocalizedText(locale, 'confirm_delete'))) {
      try {
        const vendorRef = doc(db, 'couples', user.uid, 'vendors', vendorId);
        await deleteDoc(vendorRef);
        // Reload vendors from Firestore
        await loadVendors();
      } catch (error) {
        console.error('Error deleting vendor:', error);
      }
    }
  };

  const handleViewDetails = (vendor: Vendor) => {
    setViewingVendor(vendor);
    setShowDetailsModal(true);
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading vendors...</p>
        </div>
      </div>
    );
  }

  const bookedVendors = vendors.filter(v => v.status === 'booked' || v.status === 'paid').length;
  const totalBudget = vendors.reduce((sum, v) => sum + (v.finalCost || v.estimatedCost || 0), 0);
  const paidAmount = vendors.filter(v => v.status === 'paid').reduce((sum, v) => sum + (v.finalCost || v.estimatedCost || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">

      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {getLocalizedText(locale, 'welcome')}
            </h1>
            <p className="text-gray-600">{getLocalizedText(locale, 'overview')}</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {getLocalizedText(locale, 'add_vendor')}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-blue-600">{vendors.length}</div>
            <div className="text-sm text-gray-600">{getLocalizedText(locale, 'total_vendors')}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-green-600">{bookedVendors}</div>
            <div className="text-sm text-gray-600">{getLocalizedText(locale, 'booked_vendors')}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-purple-600">${totalBudget.toLocaleString()}</div>
            <div className="text-sm text-gray-600">{getLocalizedText(locale, 'total_cost')}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-2xl font-bold text-emerald-600">${paidAmount.toLocaleString()}</div>
            <div className="text-sm text-gray-600">Paid</div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <input
              type="text"
              placeholder="Search vendors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{getLocalizedText(locale, 'all_categories')}</option>
              {vendorCategories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">{getLocalizedText(locale, 'all_statuses')}</option>
              <option value="researching">{getLocalizedText(locale, 'researching')}</option>
              <option value="contacted">{getLocalizedText(locale, 'contacted')}</option>
              <option value="meeting_scheduled">{getLocalizedText(locale, 'meeting_scheduled')}</option>
              <option value="proposal_received">{getLocalizedText(locale, 'proposal_received')}</option>
              <option value="booked">{getLocalizedText(locale, 'booked')}</option>
              <option value="paid">{getLocalizedText(locale, 'paid')}</option>
              <option value="declined">{getLocalizedText(locale, 'declined')}</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="created_date">{getLocalizedText(locale, 'created_date')}</option>
              <option value="name">{getLocalizedText(locale, 'name')}</option>
              <option value="cost">{getLocalizedText(locale, 'cost')}</option>
              <option value="status">{getLocalizedText(locale, 'status')}</option>
              <option value="priority">{getLocalizedText(locale, 'priority')}</option>
            </select>

            <div className="text-sm text-gray-600 flex items-center">
              {filteredVendors.length} of {vendors.length} vendors
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {filteredVendors.map((vendor) => (
            <div key={vendor.id} className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{vendor.name}</h3>
                  <p className="text-sm text-gray-500">{vendor.category}</p>
                  <div className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full mt-2 ${getPriorityColor(vendor.priority)}`}>
                    <span className={`w-2 h-2 rounded-full mr-1 ${vendor.priority === 'high' ? 'bg-red-500' : vendor.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                    {getLocalizedText(locale, vendor.priority)}
                  </div>
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(vendor.status)}`}>
                  {getLocalizedText(locale, vendor.status)}
                </span>
              </div>

              <div className="space-y-2 text-sm mb-4">
                <p><strong>Contact:</strong> {vendor.contact}</p>
                {vendor.phone && <p><strong>Phone:</strong> {vendor.phone}</p>}
                {vendor.email && <p><strong>Email:</strong> {vendor.email}</p>}
                {(vendor.finalCost || vendor.estimatedCost) && (
                  <p><strong>Cost:</strong> ${(vendor.finalCost || vendor.estimatedCost)?.toLocaleString()}</p>
                )}
                {vendor.rating && (
                  <div className="flex items-center">
                    <strong className="mr-2">Rating:</strong>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={`text-sm ${i < vendor.rating! ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {vendor.tags && vendor.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {vendor.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-gray-200">
                <button 
                  onClick={() => handleViewDetails(vendor)}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {getLocalizedText(locale, 'view_details')}
                </button>
                <div className="space-x-2">
                  <button 
                    onClick={() => handleEdit(vendor)}
                    className="text-sm text-green-600 hover:text-green-800"
                  >
                    {getLocalizedText(locale, 'edit')}
                  </button>
                  <button 
                    onClick={() => handleDelete(vendor.id)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    {getLocalizedText(locale, 'delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <p className="text-purple-800">
            🏪 Complete vendor management system - {bookedVendors} of {vendors.length} vendors secured, ${totalBudget.toLocaleString()} total budget
          </p>
        </div>
      </div>

      {(showAddModal || showEditModal) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {editingVendor ? getLocalizedText(locale, 'edit_vendor') : getLocalizedText(locale, 'add_vendor')}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'vendor_name')}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'category')}
                    </label>
                    <select
                      required
                      value={formData.category || ''}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select category</option>
                      {vendorCategories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'contact')}
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.contact || ''}
                      onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'phone')}
                    </label>
                    <input
                      type="tel"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'email')}
                    </label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'website')}
                    </label>
                    <input
                      type="url"
                      value={formData.website || ''}
                      onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getLocalizedText(locale, 'address')}
                  </label>
                  <input
                    type="text"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'estimated_cost')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.estimatedCost || ''}
                      onChange={(e) => setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'final_cost')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.finalCost || ''}
                      onChange={(e) => setFormData({ ...formData, finalCost: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'deposit_paid')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.depositPaid || ''}
                      onChange={(e) => setFormData({ ...formData, depositPaid: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'status')}
                    </label>
                    <select
                      value={formData.status || 'researching'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as Vendor['status'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="researching">{getLocalizedText(locale, 'researching')}</option>
                      <option value="contacted">{getLocalizedText(locale, 'contacted')}</option>
                      <option value="meeting_scheduled">{getLocalizedText(locale, 'meeting_scheduled')}</option>
                      <option value="proposal_received">{getLocalizedText(locale, 'proposal_received')}</option>
                      <option value="booked">{getLocalizedText(locale, 'booked')}</option>
                      <option value="paid">{getLocalizedText(locale, 'paid')}</option>
                      <option value="declined">{getLocalizedText(locale, 'declined')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'priority')}
                    </label>
                    <select
                      value={formData.priority || 'medium'}
                      onChange={(e) => setFormData({ ...formData, priority: e.target.value as Vendor['priority'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">{getLocalizedText(locale, 'low')}</option>
                      <option value="medium">{getLocalizedText(locale, 'medium')}</option>
                      <option value="high">{getLocalizedText(locale, 'high')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'rating')}
                    </label>
                    <select
                      value={formData.rating || 0}
                      onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value={0}>No rating</option>
                      {[1, 2, 3, 4, 5].map(num => (
                        <option key={num} value={num}>{num} star{num > 1 ? 's' : ''}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.contractSigned || false}
                        onChange={(e) => setFormData({ ...formData, contractSigned: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                      />
                      <span className="ml-2 text-sm font-medium text-gray-700">
                        {getLocalizedText(locale, 'contract_signed')}
                      </span>
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {getLocalizedText(locale, 'final_payment_due')}
                    </label>
                    <input
                      type="date"
                      value={formData.finalPaymentDue || ''}
                      onChange={(e) => setFormData({ ...formData, finalPaymentDue: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getLocalizedText(locale, 'notes')}
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Additional notes and comments..."
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setShowEditModal(false);
                      setEditingVendor(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
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
        </div>
      )}

      {showDetailsModal && viewingVendor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">{getLocalizedText(locale, 'vendor_details')}</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <strong>Name:</strong> {viewingVendor.name}
                  </div>
                  <div>
                    <strong>Category:</strong> {viewingVendor.category}
                  </div>
                  <div>
                    <strong>Contact:</strong> {viewingVendor.contact}
                  </div>
                  <div>
                    <strong>Status:</strong> 
                    <span className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getStatusColor(viewingVendor.status)}`}>
                      {getLocalizedText(locale, viewingVendor.status)}
                    </span>
                  </div>
                </div>
                
                {viewingVendor.phone && (
                  <div><strong>Phone:</strong> {viewingVendor.phone}</div>
                )}
                {viewingVendor.email && (
                  <div><strong>Email:</strong> {viewingVendor.email}</div>
                )}
                {viewingVendor.website && (
                  <div><strong>Website:</strong> <a href={viewingVendor.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{viewingVendor.website}</a></div>
                )}
                {viewingVendor.address && (
                  <div><strong>Address:</strong> {viewingVendor.address}</div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  {viewingVendor.estimatedCost && (
                    <div><strong>Estimated Cost:</strong> ${viewingVendor.estimatedCost.toLocaleString()}</div>
                  )}
                  {viewingVendor.finalCost && (
                    <div><strong>Final Cost:</strong> ${viewingVendor.finalCost.toLocaleString()}</div>
                  )}
                  {viewingVendor.depositPaid && (
                    <div><strong>Deposit Paid:</strong> ${viewingVendor.depositPaid.toLocaleString()}</div>
                  )}
                  {viewingVendor.contractSigned && (
                    <div><strong>Contract:</strong> <span className="text-green-600">Signed ✓</span></div>
                  )}
                </div>

                {viewingVendor.rating && (
                  <div className="flex items-center">
                    <strong className="mr-2">Rating:</strong>
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <span key={i} className={`${i < viewingVendor.rating! ? 'text-yellow-400' : 'text-gray-300'}`}>★</span>
                      ))}
                    </div>
                    <span className="ml-2 text-sm text-gray-600">({viewingVendor.rating}/5)</span>
                  </div>
                )}

                {viewingVendor.tags && viewingVendor.tags.length > 0 && (
                  <div>
                    <strong>Tags:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {viewingVendor.tags.map((tag, index) => (
                        <span key={index} className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {viewingVendor.notes && (
                  <div>
                    <strong>Notes:</strong>
                    <p className="mt-1 text-gray-600">{viewingVendor.notes}</p>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  <div>Created: {new Date(viewingVendor.createdAt).toLocaleDateString()}</div>
                  <div>Updated: {new Date(viewingVendor.updatedAt).toLocaleDateString()}</div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-6">
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    setViewingVendor(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  {getLocalizedText(locale, 'close')}
                </button>
                <button
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleEdit(viewingVendor);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  {getLocalizedText(locale, 'edit')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}