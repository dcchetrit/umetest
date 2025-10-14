'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  getBenchmarkVendors,
  saveBenchmarkVendor,
  updateBenchmarkVendor,
  deleteBenchmarkVendor,
  getBenchmarkCriteria,
  saveBenchmarkCriterion,
  deleteBenchmarkCriterion,
  migrateBenchmarkDataFromLocalStorage,
  initializeDefaultCriteria,
  VendorOption as FirestoreVendorOption,
  CriteriaItem as FirestoreCriteriaItem
} from '@/services/benchmarkService';

interface BenchmarkClientProps {
  locale: string;
}

// Use types from service with local extensions
type VendorOption = Omit<FirestoreVendorOption, 'createdAt' | 'updatedAt'> & {
  createdAt: string;
  updatedAt: string;
};

type CriteriaItem = FirestoreCriteriaItem;

interface VendorCategory {
  id: string;
  name: string;
  criteria: CriteriaItem[];
  vendors: VendorOption[];
}

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      benchmark: 'Vendor Benchmarking',
      welcome: 'Compare Wedding Vendors',
      overview: 'Add vendors and use your own criteria to make the best choice for your wedding',
      add_vendor: 'Add New Vendor',
      vendor_name: 'Vendor Name',
      category: 'Category',
      contact: 'Contact Person',
      email: 'Email',
      phone: 'Phone',
      website: 'Website',
      price: 'Price',
      notes: 'Notes',
      overall_score: 'Overall Score',
      back_home: '← Back to Home',
      login_required: 'Please log in to view vendor benchmarks',
      compare_vendors: 'Vendor Comparison',
      no_vendors: 'No vendors added yet',
      add_first_vendor: 'Add your first vendor to get started',
      select_category: 'Select Category',
      photography: 'Photography',
      catering: 'Catering',
      venue: 'Venue',
      music_dj: 'Music/DJ',
      florist: 'Florist',
      videography: 'Videography',
      wedding_planner: 'Wedding Planner',
      transportation: 'Transportation',
      other: 'Other',
      save: 'Save Vendor',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      criteria_setup: 'Setup Criteria',
      add_criteria: 'Add Criteria',
      criteria_name: 'Criteria Name',
      criteria_weight: 'Weight (1-10)',
      criteria_type: 'Type',
      number_type: 'Number',
      rating_type: 'Rating (1-5)',
      text_type: 'Text',
      confirm_delete: 'Are you sure you want to delete this vendor?',
      vendor_added: 'Vendor added successfully',
      vendor_updated: 'Vendor updated successfully',
      vendor_deleted: 'Vendor deleted successfully'
    },
    fr: {
      benchmark: 'Comparaison de prestataires',
      welcome: 'Comparer les prestataires de mariage',
      overview: 'Ajoutez des prestataires et utilisez vos propres critères pour faire le meilleur choix',
      add_vendor: 'Ajouter un prestataire',
      vendor_name: 'Nom du prestataire',
      category: 'Catégorie',
      contact: 'Contact',
      email: 'Email',
      phone: 'Téléphone',
      website: 'Site web',
      price: 'Prix',
      notes: 'Notes',
      overall_score: 'Score global',
      back_home: '← Retour à l\'accueil',
      login_required: 'Veuillez vous connecter pour voir les comparaisons',
      compare_vendors: 'Comparaison de prestataires',
      no_vendors: 'Aucun prestataire ajouté',
      add_first_vendor: 'Ajoutez votre premier prestataire pour commencer',
      select_category: 'Sélectionner la catégorie',
      photography: 'Photographie',
      catering: 'Traiteur',
      venue: 'Lieu',
      music_dj: 'Musique/DJ',
      florist: 'Fleuriste',
      videography: 'Vidéographie',
      wedding_planner: 'Organisateur de mariage',
      transportation: 'Transport',
      other: 'Autre',
      save: 'Enregistrer',
      cancel: 'Annuler',
      edit: 'Modifier',
      delete: 'Supprimer',
      criteria_setup: 'Configuration des critères',
      add_criteria: 'Ajouter un critère',
      criteria_name: 'Nom du critère',
      criteria_weight: 'Poids (1-10)',
      criteria_type: 'Type',
      number_type: 'Nombre',
      rating_type: 'Note (1-5)',
      text_type: 'Texte',
      confirm_delete: 'Êtes-vous sûr de vouloir supprimer ce prestataire?',
      vendor_added: 'Prestataire ajouté avec succès',
      vendor_updated: 'Prestataire mis à jour avec succès',
      vendor_deleted: 'Prestataire supprimé avec succès'
    },
    es: {
      benchmark: 'Comparación de proveedores',
      welcome: 'Comparar proveedores de boda',
      overview: 'Agrega proveedores y usa tus propios criterios para elegir lo mejor para tu boda',
      add_vendor: 'Agregar proveedor',
      vendor_name: 'Nombre del proveedor',
      category: 'Categoría',
      contact: 'Contacto',
      email: 'Email',
      phone: 'Teléfono',
      website: 'Sitio web',
      price: 'Precio',
      notes: 'Notas',
      overall_score: 'Puntuación general',
      back_home: '← Volver al inicio',
      login_required: 'Por favor inicia sesión para ver comparaciones',
      compare_vendors: 'Comparación de proveedores',
      no_vendors: 'No hay proveedores agregados',
      add_first_vendor: 'Agrega tu primer proveedor para comenzar',
      select_category: 'Seleccionar categoría',
      photography: 'Fotografía',
      catering: 'Catering',
      venue: 'Lugar',
      music_dj: 'Música/DJ',
      florist: 'Florista',
      videography: 'Videografía',
      wedding_planner: 'Planificador de bodas',
      transportation: 'Transporte',
      other: 'Otro',
      save: 'Guardar',
      cancel: 'Cancelar',
      edit: 'Editar',
      delete: 'Eliminar',
      criteria_setup: 'Configuración de criterios',
      add_criteria: 'Agregar criterio',
      criteria_name: 'Nombre del criterio',
      criteria_weight: 'Peso (1-10)',
      criteria_type: 'Tipo',
      number_type: 'Número',
      rating_type: 'Calificación (1-5)',
      text_type: 'Texto',
      confirm_delete: '¿Estás seguro de que quieres eliminar este proveedor?',
      vendor_added: 'Proveedor agregado exitosamente',
      vendor_updated: 'Proveedor actualizado exitosamente',
      vendor_deleted: 'Proveedor eliminado exitosamente'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

const DEFAULT_CATEGORIES = [
  'photography',
  'catering',
  'venue',
  'music_dj',
  'florist',
  'videography',
  'wedding_planner',
  'transportation',
  'other'
];

const DEFAULT_CRITERIA: CriteriaItem[] = [
  { id: '1', name: 'Quality', type: 'rating', weight: 8, description: 'Overall service quality' },
  { id: '2', name: 'Price Value', type: 'rating', weight: 7, description: 'Value for money' },
  { id: '3', name: 'Communication', type: 'rating', weight: 6, description: 'Responsiveness and communication' },
  { id: '4', name: 'Experience', type: 'number', weight: 5, description: 'Years of experience' }
];

function calculateOverallScore(vendor: VendorOption, criteria: CriteriaItem[]): number {
  let totalScore = 0;
  let totalWeight = 0;

  criteria.forEach(criterion => {
    const value = vendor.customCriteria[criterion.id];
    if (typeof value === 'number' && value > 0) {
      const normalizedScore = criterion.type === 'rating' ? (value / 5) * 10 : Math.min(value / 10, 1) * 10;
      totalScore += normalizedScore * criterion.weight;
      totalWeight += criterion.weight;
    }
  });

  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 10) / 10 : 0;
}

function getScoreColor(score: number): string {
  if (score >= 8.5) return 'text-green-600';
  if (score >= 7.0) return 'text-yellow-600';
  return 'text-red-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 8.5) return 'bg-green-100';
  if (score >= 7.0) return 'bg-yellow-100';
  return 'bg-red-100';
}

export default function BenchmarkClient({ locale }: BenchmarkClientProps) {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [criteria, setCriteria] = useState<CriteriaItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddVendorModal, setShowAddVendorModal] = useState(false);
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<VendorOption | null>(null);
  const [newVendor, setNewVendor] = useState<Partial<VendorOption>>({});
  const [newCriterion, setNewCriterion] = useState<Partial<CriteriaItem>>({});
  const [loading, setLoading] = useState(true);

  // Early return if no authenticated user
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

  // Use authenticated user's ID as couple ID
  const coupleId = user.uid;

  // Load data from Firestore and handle migration
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        // Try to migrate any existing localStorage data first
        await migrateBenchmarkDataFromLocalStorage(coupleId);
        
        // Initialize default criteria if none exist
        await initializeDefaultCriteria(coupleId);
        
        // Load vendors and criteria from Firestore
        const [vendorsData, criteriaData] = await Promise.all([
          getBenchmarkVendors(coupleId),
          getBenchmarkCriteria(coupleId)
        ]);
        
        // Convert Firestore vendors to display format
        const displayVendors: VendorOption[] = vendorsData.map(vendor => ({
          ...vendor,
          createdAt: vendor.createdAt.toISOString(),
          updatedAt: vendor.updatedAt.toISOString()
        }));
        
        setCriteria(criteriaData);
        
        // Calculate scores for vendors with current criteria
        const vendorsWithScores = displayVendors.map(vendor => ({
          ...vendor,
          overallScore: calculateOverallScore(vendor, criteriaData)
        }));
        
        setVendors(vendorsWithScores);
      } catch (error) {
        console.error('Error loading benchmark data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (coupleId) {
      loadData();
    }
  }, [coupleId]);

  const filteredVendors = selectedCategory === 'all' 
    ? vendors 
    : vendors.filter(v => v.category === selectedCategory);

  const handleAddVendor = async () => {
    if (!newVendor.name || !newVendor.category) return;
    
    try {
      const customCriteria: Record<string, number | string> = {};
      criteria.forEach(criterion => {
        customCriteria[criterion.id] = 0;
      });
      
      const vendorData = {
        name: newVendor.name,
        category: newVendor.category,
        contact: newVendor.contact || '',
        email: newVendor.email,
        phone: newVendor.phone,
        website: newVendor.website,
        price: newVendor.price || 0,
        notes: newVendor.notes,
        customCriteria,
        overallScore: 0
      };
      
      const vendorId = await saveBenchmarkVendor(coupleId, vendorData);
      
      // Add to local state
      const displayVendor: VendorOption = {
        id: vendorId,
        ...vendorData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        overallScore: calculateOverallScore({...vendorData, id: vendorId, createdAt: '', updatedAt: ''}, criteria)
      };
      
      setVendors(prev => [...prev, displayVendor]);
      setNewVendor({});
      setShowAddVendorModal(false);
    } catch (error) {
      console.error('Error adding vendor:', error);
      alert('Failed to add vendor. Please try again.');
    }
  };

  const handleEditVendor = (vendor: VendorOption) => {
    setEditingVendor(vendor);
    setNewVendor(vendor);
    setShowAddVendorModal(true);
  };

  const handleUpdateVendor = async () => {
    if (!editingVendor || !newVendor.name || !newVendor.category) return;
    
    try {
      const updates = {
        name: newVendor.name,
        category: newVendor.category,
        contact: newVendor.contact || '',
        email: newVendor.email,
        phone: newVendor.phone,
        website: newVendor.website,
        price: newVendor.price || 0,
        notes: newVendor.notes,
        customCriteria: newVendor.customCriteria || editingVendor.customCriteria
      };
      
      await updateBenchmarkVendor(coupleId, editingVendor.id, updates);
      
      // Update local state
      const updatedVendor = {
        ...editingVendor,
        ...updates,
        updatedAt: new Date().toISOString(),
        overallScore: calculateOverallScore({ ...editingVendor, ...updates }, criteria)
      };
      
      setVendors(prev => prev.map(v => v.id === editingVendor.id ? updatedVendor : v));
      setNewVendor({});
      setEditingVendor(null);
      setShowAddVendorModal(false);
    } catch (error) {
      console.error('Error updating vendor:', error);
      alert('Failed to update vendor. Please try again.');
    }
  };

  const handleDeleteVendor = async (vendorId: string) => {
    if (confirm(getLocalizedText(locale, 'confirm_delete'))) {
      try {
        await deleteBenchmarkVendor(coupleId, vendorId);
        setVendors(prev => prev.filter(v => v.id !== vendorId));
      } catch (error) {
        console.error('Error deleting vendor:', error);
        alert('Failed to delete vendor. Please try again.');
      }
    }
  };

  const handleUpdateVendorCriteria = async (vendorId: string, criterionId: string, value: number | string) => {
    try {
      // Update local state optimistically
      setVendors(prev => prev.map(vendor => {
        if (vendor.id === vendorId) {
          const updatedVendor = {
            ...vendor,
            customCriteria: {
              ...vendor.customCriteria,
              [criterionId]: value
            }
          };
          updatedVendor.overallScore = calculateOverallScore(updatedVendor, criteria);
          return updatedVendor;
        }
        return vendor;
      }));

      // Update in Firestore
      const vendor = vendors.find(v => v.id === vendorId);
      if (vendor) {
        const updatedCriteria = {
          ...vendor.customCriteria,
          [criterionId]: value
        };
        await updateBenchmarkVendor(coupleId, vendorId, { 
          customCriteria: updatedCriteria,
          overallScore: calculateOverallScore({ ...vendor, customCriteria: updatedCriteria }, criteria)
        });
      }
    } catch (error) {
      console.error('Error updating vendor criteria:', error);
      // Note: We don't revert optimistic update here to maintain UX
      // but in a production app, you might want to implement rollback
    }
  };

  const handleAddCriterion = async () => {
    if (!newCriterion.name || !newCriterion.type) return;
    
    try {
      const criterionData = {
        name: newCriterion.name,
        type: newCriterion.type,
        weight: newCriterion.weight || 5,
        description: newCriterion.description
      };
      
      const criterionId = await saveBenchmarkCriterion(coupleId, criterionData);
      
      const criterion: CriteriaItem = {
        id: criterionId,
        ...criterionData
      };
      
      setCriteria(prev => [...prev, criterion]);
      
      // Add the new criterion to all existing vendors with default value 0
      const updatedVendors = vendors.map(vendor => ({
        ...vendor,
        customCriteria: {
          ...vendor.customCriteria,
          [criterionId]: 0
        }
      }));
      
      setVendors(updatedVendors);
      
      // Update all vendors in Firestore
      for (const vendor of updatedVendors) {
        await updateBenchmarkVendor(coupleId, vendor.id, {
          customCriteria: vendor.customCriteria
        });
      }
      
      setNewCriterion({});
      setShowCriteriaModal(false);
    } catch (error) {
      console.error('Error adding criterion:', error);
      alert('Failed to add criterion. Please try again.');
    }
  };

  const handleDeleteCriterion = async (criterionId: string) => {
    try {
      await deleteBenchmarkCriterion(coupleId, criterionId);
      
      setCriteria(prev => prev.filter(c => c.id !== criterionId));
      
      const updatedCriteria = criteria.filter(c => c.id !== criterionId);
      
      // Update all vendors to remove the deleted criterion
      const updatedVendors = vendors.map(vendor => {
        const { [criterionId]: removed, ...remainingCriteria } = vendor.customCriteria;
        const updatedVendor = {
          ...vendor,
          customCriteria: remainingCriteria,
          overallScore: calculateOverallScore({ ...vendor, customCriteria: remainingCriteria }, updatedCriteria)
        };
        return updatedVendor;
      });
      
      setVendors(updatedVendors);
      
      // Update all vendors in Firestore
      for (const vendor of updatedVendors) {
        await updateBenchmarkVendor(coupleId, vendor.id, {
          customCriteria: vendor.customCriteria,
          overallScore: vendor.overallScore
        });
      }
    } catch (error) {
      console.error('Error deleting criterion:', error);
      alert('Failed to delete criterion. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading benchmark data...</p>
        </div>
      </div>
    );
  }

  const categoryOptions = DEFAULT_CATEGORIES.map(cat => ({
    value: cat,
    label: getLocalizedText(locale, cat)
  }));

  return (
    <>
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {getLocalizedText(locale, 'welcome')}
            </h1>
            <p className="text-gray-600">{getLocalizedText(locale, 'overview')}</p>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => setShowCriteriaModal(true)}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
            >
              {getLocalizedText(locale, 'criteria_setup')}
            </button>
            <button 
              onClick={() => {
                setEditingVendor(null);
                setNewVendor({});
                setShowAddVendorModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {getLocalizedText(locale, 'add_vendor')}
            </button>
          </div>
        </div>

        {/* Category Filter and Stats */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {getLocalizedText(locale, 'compare_vendors')}
              </h3>
              <div className="text-sm text-gray-600">
                {filteredVendors.length} vendors {selectedCategory !== 'all' && `in ${getLocalizedText(locale, selectedCategory)}`}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="all">All Categories</option>
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Empty State */}
        {filteredVendors.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center mb-8">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">{getLocalizedText(locale, 'no_vendors')}</h3>
            <p className="text-gray-500 mb-6">{getLocalizedText(locale, 'add_first_vendor')}</p>
            <button 
              onClick={() => {
                setEditingVendor(null);
                setNewVendor({});
                setShowAddVendorModal(true);
              }}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
            >
              {getLocalizedText(locale, 'add_vendor')}
            </button>
          </div>
        )}

        {/* Vendor Cards Grid */}
        {filteredVendors.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
            {filteredVendors.map((vendor) => (
              <div key={vendor.id} className="bg-white rounded-lg shadow p-6 relative">
                <div className="absolute top-4 right-4 flex gap-2">
                  <button
                    onClick={() => handleEditVendor(vendor)}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    {getLocalizedText(locale, 'edit')}
                  </button>
                  <button
                    onClick={() => handleDeleteVendor(vendor.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    {getLocalizedText(locale, 'delete')}
                  </button>
                </div>
                
                <div className="pr-20 mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 mb-1">{vendor.name}</h4>
                  <p className="text-sm text-gray-500 mb-2">{getLocalizedText(locale, vendor.category)}</p>
                  <div className="text-sm space-y-1">
                    <p><strong>Contact:</strong> {vendor.contact}</p>
                    {vendor.email && <p><strong>Email:</strong> {vendor.email}</p>}
                    {vendor.phone && <p><strong>Phone:</strong> {vendor.phone}</p>}
                    <p><strong>{getLocalizedText(locale, 'price')}:</strong> ${vendor.price.toLocaleString()}</p>
                  </div>
                </div>

                {/* Criteria Scores */}
                <div className="mb-4">
                  <div className="text-sm text-gray-600 mb-2">Custom Criteria:</div>
                  <div className="space-y-2">
                    {criteria.map((criterion) => (
                      <div key={criterion.id} className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">{criterion.name}:</span>
                        {criterion.type === 'rating' ? (
                          <select
                            value={vendor.customCriteria[criterion.id] || 0}
                            onChange={(e) => handleUpdateVendorCriteria(vendor.id, criterion.id, Number(e.target.value))}
                            className="text-xs border border-gray-200 rounded px-1 py-0.5"
                          >
                            <option value={0}>--</option>
                            <option value={1}>⭐</option>
                            <option value={2}>⭐⭐</option>
                            <option value={3}>⭐⭐⭐</option>
                            <option value={4}>⭐⭐⭐⭐</option>
                            <option value={5}>⭐⭐⭐⭐⭐</option>
                          </select>
                        ) : (
                          <input
                            type="number"
                            value={vendor.customCriteria[criterion.id] || 0}
                            onChange={(e) => handleUpdateVendorCriteria(vendor.id, criterion.id, Number(e.target.value))}
                            className="text-xs border border-gray-200 rounded px-2 py-0.5 w-16 text-center"
                            min="0"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Overall Score */}
                <div className={`text-center py-3 rounded-lg ${getScoreBgColor(vendor.overallScore || 0)}`}>
                  <div className="text-sm text-gray-600 mb-1">{getLocalizedText(locale, 'overall_score')}:</div>
                  <div className={`text-2xl font-bold ${getScoreColor(vendor.overallScore || 0)}`}>
                    {vendor.overallScore?.toFixed(1) || '0.0'}/10
                  </div>
                </div>

                {vendor.notes && (
                  <div className="mt-4 p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-600 mb-1">Notes:</div>
                    <div className="text-sm text-gray-800">{vendor.notes}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Detailed Comparison Table */}
        {filteredVendors.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">{getLocalizedText(locale, 'compare_vendors')}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'vendor_name')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'category')}
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'price')}
                    </th>
                    {criteria.map(criterion => (
                      <th key={criterion.id} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {criterion.name}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {getLocalizedText(locale, 'overall_score')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredVendors.map((vendor) => (
                    <tr key={vendor.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getLocalizedText(locale, vendor.category)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        ${vendor.price.toLocaleString()}
                      </td>
                      {criteria.map(criterion => (
                        <td key={criterion.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {criterion.type === 'rating' 
                            ? `${vendor.customCriteria[criterion.id] || 0}/5`
                            : vendor.customCriteria[criterion.id] || 0
                          }
                        </td>
                      ))}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-semibold ${getScoreColor(vendor.overallScore || 0)}`}>
                          {vendor.overallScore?.toFixed(1) || '0.0'}/10
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Info Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-blue-800">
            💡 Vendor benchmarking tool - Add your own vendors and customize criteria to make data-driven decisions for your wedding
          </p>
        </div>
      </div>
    </div>

    {/* Add/Edit Vendor Modal */}
    {showAddVendorModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-screen overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">
            {editingVendor ? 'Edit Vendor' : getLocalizedText(locale, 'add_vendor')}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'vendor_name')} *
              </label>
              <input
                type="text"
                value={newVendor.name || ''}
                onChange={(e) => setNewVendor(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'category')} *
              </label>
              <select
                value={newVendor.category || ''}
                onChange={(e) => setNewVendor(prev => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">{getLocalizedText(locale, 'select_category')}</option>
                {categoryOptions.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'contact')}
              </label>
              <input
                type="text"
                value={newVendor.contact || ''}
                onChange={(e) => setNewVendor(prev => ({ ...prev, contact: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'email')}
              </label>
              <input
                type="email"
                value={newVendor.email || ''}
                onChange={(e) => setNewVendor(prev => ({ ...prev, email: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'phone')}
              </label>
              <input
                type="tel"
                value={newVendor.phone || ''}
                onChange={(e) => setNewVendor(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'website')}
              </label>
              <input
                type="url"
                value={newVendor.website || ''}
                onChange={(e) => setNewVendor(prev => ({ ...prev, website: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="https://"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'price')}
              </label>
              <input
                type="number"
                value={newVendor.price || 0}
                onChange={(e) => setNewVendor(prev => ({ ...prev, price: Number(e.target.value) }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {getLocalizedText(locale, 'notes')}
              </label>
              <textarea
                value={newVendor.notes || ''}
                onChange={(e) => setNewVendor(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => {
                setShowAddVendorModal(false);
                setEditingVendor(null);
                setNewVendor({});
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              {getLocalizedText(locale, 'cancel')}
            </button>
            <button
              onClick={editingVendor ? handleUpdateVendor : handleAddVendor}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {getLocalizedText(locale, 'save')}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Criteria Setup Modal */}
    {showCriteriaModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-screen overflow-y-auto">
          <h3 className="text-lg font-semibold mb-4">{getLocalizedText(locale, 'criteria_setup')}</h3>
          
          {/* Current Criteria */}
          <div className="mb-6">
            <h4 className="font-medium mb-3">Current Criteria:</h4>
            <div className="space-y-2">
              {criteria.map((criterion) => (
                <div key={criterion.id} className="flex items-center justify-between bg-gray-50 p-3 rounded">
                  <div>
                    <div className="font-medium">{criterion.name}</div>
                    <div className="text-sm text-gray-600">
                      {getLocalizedText(locale, `${criterion.type}_type`)} • Weight: {criterion.weight}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteCriterion(criterion.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    {getLocalizedText(locale, 'delete')}
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Add New Criterion */}
          <div className="border-t pt-6">
            <h4 className="font-medium mb-3">{getLocalizedText(locale, 'add_criteria')}</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'criteria_name')} *
                </label>
                <input
                  type="text"
                  value={newCriterion.name || ''}
                  onChange={(e) => setNewCriterion(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Quality, Experience, Response Time"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getLocalizedText(locale, 'criteria_type')} *
                  </label>
                  <select
                    value={newCriterion.type || ''}
                    onChange={(e) => setNewCriterion(prev => ({ ...prev, type: e.target.value as 'number' | 'rating' | 'text' }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">{getLocalizedText(locale, 'criteria_type')}</option>
                    <option value="rating">{getLocalizedText(locale, 'rating_type')}</option>
                    <option value="number">{getLocalizedText(locale, 'number_type')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {getLocalizedText(locale, 'criteria_weight')}
                  </label>
                  <input
                    type="number"
                    value={newCriterion.weight || 5}
                    onChange={(e) => setNewCriterion(prev => ({ ...prev, weight: Number(e.target.value) }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                    min="1"
                    max="10"
                  />
                </div>
              </div>
              <button
                onClick={handleAddCriterion}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                {getLocalizedText(locale, 'add_criteria')}
              </button>
            </div>
          </div>
          
          <div className="flex justify-end mt-6">
            <button
              onClick={() => {
                setShowCriteriaModal(false);
                setNewCriterion({});
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              {getLocalizedText(locale, 'cancel')}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}