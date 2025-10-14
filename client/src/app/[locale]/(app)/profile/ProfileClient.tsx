'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@ume/shared';
import { doc, getDoc, updateDoc, Timestamp } from 'firebase/firestore';
import Link from 'next/link';
import { filterUndefined } from '@/utils/firestore';

interface ProfileData {
  profile?: {
    names?: {
      partner1?: string;
      partner2?: string;
    };
    locale?: string;
    currency?: string;
    timezone?: string;
  };
  email?: string;
  weddingDate?: any;
  estimatedBudget?: number;
  estimatedGuestCount?: number;
  venue?: string;
  phone?: string;
}

interface ProfileFormData {
  partner1Name: string;
  partner2Name: string;
  email: string;
  weddingDate: string;
  estimatedBudget: string;
  estimatedGuestCount: string;
  venue: string;
  phone: string;
}

/**
 * Create a Firestore Timestamp for wedding date with proper timezone handling
 * Converts YYYY-MM-DD to a date at 3:00 PM in the user's timezone
 */
function createWeddingDateTimestamp(dateString: string): any {
  if (!dateString) return null;
  
  // Create date in user's local timezone at 3:00 PM (15:00)
  const date = new Date(dateString + 'T15:00:00');
  
  // If date is invalid, try alternative parsing
  if (isNaN(date.getTime())) {
    const [year, month, day] = dateString.split('-').map(Number);
    const localDate = new Date(year, month - 1, day, 15, 0, 0); // 3:00 PM local time
    return Timestamp.fromDate(localDate);
  }
  
  return Timestamp.fromDate(date);
}

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      profile: 'Profile',
      edit_profile: 'Edit Profile',
      save_changes: 'Save Changes',
      cancel: 'Cancel',
      saving: 'Saving...',
      success_message: 'Profile updated successfully!',
      error_message: 'Failed to update profile. Please try again.',
      partner1_name: 'Partner 1 Name',
      partner2_name: 'Partner 2 Name',
      email: 'Email Address',
      wedding_date: 'Wedding Date',
      estimated_budget: 'Estimated Budget',
      guest_count: 'Estimated Guest Count',
      venue_name: 'Venue Name',
      phone: 'Phone Number',
      basic_info: 'Basic Information',
      wedding_details: 'Wedding Details',
      contact_info: 'Contact Information',
      currency_symbol: '$',
      language: 'Language'
    },
    fr: {
      profile: 'Profil',
      edit_profile: 'Modifier le Profil',
      save_changes: 'Enregistrer les Modifications',
      cancel: 'Annuler',
      saving: 'Enregistrement...',
      success_message: 'Profil mis à jour avec succès !',
      error_message: 'Échec de la mise à jour du profil. Veuillez réessayer.',
      partner1_name: 'Nom du Partenaire 1',
      partner2_name: 'Nom du Partenaire 2',
      email: 'Adresse Email',
      wedding_date: 'Date du Mariage',
      estimated_budget: 'Budget Estimé',
      guest_count: 'Nombre d\'Invités Estimé',
      venue_name: 'Nom du Lieu',
      phone: 'Numéro de Téléphone',
      basic_info: 'Informations de Base',
      wedding_details: 'Détails du Mariage',
      contact_info: 'Informations de Contact',
      currency_symbol: '€',
      language: 'Langue'
    },
    es: {
      profile: 'Perfil',
      edit_profile: 'Editar Perfil',
      save_changes: 'Guardar Cambios',
      cancel: 'Cancelar',
      saving: 'Guardando...',
      success_message: '¡Perfil actualizado con éxito!',
      error_message: 'Error al actualizar el perfil. Por favor, inténtalo de nuevo.',
      partner1_name: 'Nombre del Compañero 1',
      partner2_name: 'Nombre del Compañero 2',
      email: 'Dirección de Email',
      wedding_date: 'Fecha de la Boda',
      estimated_budget: 'Presupuesto Estimado',
      guest_count: 'Número de Invitados Estimado',
      venue_name: 'Nombre del Lugar',
      phone: 'Número de Teléfono',
      basic_info: 'Información Básica',
      wedding_details: 'Detalles de la Boda',
      contact_info: 'Información de Contacto',
      currency_symbol: '€',
      language: 'Idioma'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

interface ProfileClientProps {
  locale: string;
}

export default function ProfileClient({ locale }: ProfileClientProps) {
  const { user } = useAuth();
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [formData, setFormData] = useState<ProfileFormData>({
    partner1Name: '',
    partner2Name: '',
    email: '',
    weddingDate: '',
    estimatedBudget: '',
    estimatedGuestCount: '',
    venue: '',
    phone: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const loadProfile = async () => {
      if (!user) return;
      
      try {
        const coupleRef = doc(db, 'couples', user.uid);
        const coupleSnap = await getDoc(coupleRef);
        
        if (coupleSnap.exists()) {
          const data = coupleSnap.data() as ProfileData;
          setProfileData(data);
          
          // Populate form data
          setFormData({
            partner1Name: data.profile?.names?.partner1 || '',
            partner2Name: data.profile?.names?.partner2 || '',
            email: data.email || '',
            weddingDate: data.weddingDate?.toDate ? data.weddingDate.toDate().toISOString().split('T')[0] : '',
            estimatedBudget: data.estimatedBudget?.toString() || '',
            estimatedGuestCount: data.estimatedGuestCount?.toString() || '',
            venue: data.venue || '',
            phone: data.phone || ''
          });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleInputChange = (field: keyof ProfileFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!user) return;
    
    setSaving(true);
    setMessage(null);
    
    try {
      const coupleRef = doc(db, 'couples', user.uid);
      
      const updateData: any = {
        'profile.names.partner1': formData.partner1Name.trim(),
        'profile.names.partner2': formData.partner2Name.trim(),
        email: formData.email.trim(),
        venue: formData.venue.trim() || null,
        phone: formData.phone.trim() || null,
        updatedAt: Timestamp.fromDate(new Date())
      };

      if (formData.weddingDate) {
        updateData.weddingDate = createWeddingDateTimestamp(formData.weddingDate);
      }
      
      if (formData.estimatedBudget) {
        updateData.estimatedBudget = parseFloat(formData.estimatedBudget);
      }
      
      if (formData.estimatedGuestCount) {
        updateData.estimatedGuestCount = parseInt(formData.estimatedGuestCount);
      }

      await updateDoc(coupleRef, filterUndefined(updateData));
      
      // Update local state
      setProfileData(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          names: {
            partner1: formData.partner1Name.trim(),
            partner2: formData.partner2Name.trim()
          }
        },
        email: formData.email.trim(),
        weddingDate: formData.weddingDate ? createWeddingDateTimestamp(formData.weddingDate) : prev.weddingDate,
        estimatedBudget: formData.estimatedBudget ? parseFloat(formData.estimatedBudget) : prev.estimatedBudget,
        estimatedGuestCount: formData.estimatedGuestCount ? parseInt(formData.estimatedGuestCount) : prev.estimatedGuestCount,
        venue: formData.venue.trim() || null,
        phone: formData.phone.trim() || null
      }));
      
      setIsEditing(false);
      setMessage({ type: 'success', text: getLocalizedText(locale, 'success_message') });
      
      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: getLocalizedText(locale, 'error_message') });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset form data to original values
    setFormData({
      partner1Name: profileData.profile?.names?.partner1 || '',
      partner2Name: profileData.profile?.names?.partner2 || '',
      email: profileData.email || '',
      weddingDate: profileData.weddingDate?.toDate ? profileData.weddingDate.toDate().toISOString().split('T')[0] : '',
      estimatedBudget: profileData.estimatedBudget?.toString() || '',
      estimatedGuestCount: profileData.estimatedGuestCount?.toString() || '',
      venue: profileData.venue || '',
      phone: profileData.phone || ''
    });
    setIsEditing(false);
    setMessage(null);
  };

  const handleLocaleChange = async (newLocale: string) => {
    if (!user || newLocale === locale) return;
    
    try {
      const coupleRef = doc(db, 'couples', user.uid);
      await updateDoc(coupleRef, {
        'profile.locale': newLocale,
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      // Update local state
      setProfileData(prev => ({
        ...prev,
        profile: {
          ...prev.profile,
          locale: newLocale
        }
      }));
      
      // Navigate to the new locale URL
      window.location.href = `/${newLocale}/profile`;
    } catch (error) {
      console.error('Error updating locale:', error);
      setMessage({ type: 'error', text: getLocalizedText(locale, 'error_message') });
    }
  };

  // Authentication guard
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Required</h1>
          <p className="text-gray-600 mb-4">Please log in to access your profile.</p>
          <Link 
            href={`/${locale}/login`} 
            className="bg-pink-600 text-white px-6 py-2 rounded-lg hover:bg-pink-700 transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {getLocalizedText(locale, 'profile')}
              </h1>
              <p className="text-gray-600 mt-1">
                {profileData.profile?.names?.partner1 && profileData.profile?.names?.partner2
                  ? `${profileData.profile.names.partner1} & ${profileData.profile.names.partner2}`
                  : 'Your wedding profile'
                }
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {/* Language Selector */}
              <div className="flex items-center bg-gray-100/50 rounded-lg p-1">
                <button 
                  onClick={() => handleLocaleChange('en')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    locale === 'en' 
                      ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  🇺🇸
                </button>
                <button 
                  onClick={() => handleLocaleChange('fr')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    locale === 'fr' 
                      ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  🇫🇷
                </button>
                <button 
                  onClick={() => handleLocaleChange('es')}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    locale === 'es' 
                      ? 'bg-white shadow-sm text-gray-900 border border-gray-200' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  🇪🇸
                </button>
              </div>
              
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 transition-colors duration-200"
                >
                  {getLocalizedText(locale, 'edit_profile')}
                </button>
              ) : (
                <div className="space-x-3">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                  >
                    {getLocalizedText(locale, 'cancel')}
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                  >
                    {saving ? getLocalizedText(locale, 'saving') : getLocalizedText(locale, 'save_changes')}
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {/* Success/Error Message */}
          {message && (
            <div className={`mt-4 p-4 rounded-lg ${
              message.type === 'success' 
                ? 'bg-green-50 border border-green-200 text-green-700' 
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {message.text}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {getLocalizedText(locale, 'basic_info')}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'partner1_name')}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.partner1Name}
                    onChange={(e) => handleInputChange('partner1Name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                ) : (
                  <p className="text-gray-900">{profileData.profile?.names?.partner1 || '-'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'partner2_name')}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.partner2Name}
                    onChange={(e) => handleInputChange('partner2Name', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                ) : (
                  <p className="text-gray-900">{profileData.profile?.names?.partner2 || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {getLocalizedText(locale, 'contact_info')}
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'email')}
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                ) : (
                  <p className="text-gray-900">{profileData.email || '-'}</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'phone')}
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                ) : (
                  <p className="text-gray-900">{profileData.phone || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Wedding Details */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {getLocalizedText(locale, 'wedding_details')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'wedding_date')}
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    value={formData.weddingDate}
                    onChange={(e) => handleInputChange('weddingDate', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {profileData.weddingDate?.toDate 
                      ? profileData.weddingDate.toDate().toLocaleDateString(locale)
                      : '-'
                    }
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'estimated_budget')}
                </label>
                {isEditing ? (
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-gray-500">
                      {getLocalizedText(locale, 'currency_symbol')}
                    </span>
                    <input
                      type="number"
                      value={formData.estimatedBudget}
                      onChange={(e) => handleInputChange('estimatedBudget', e.target.value)}
                      className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    />
                  </div>
                ) : (
                  <p className="text-gray-900">
                    {profileData.estimatedBudget 
                      ? `${getLocalizedText(locale, 'currency_symbol')}${profileData.estimatedBudget.toLocaleString()}`
                      : '-'
                    }
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'guest_count')}
                </label>
                {isEditing ? (
                  <input
                    type="number"
                    value={formData.estimatedGuestCount}
                    onChange={(e) => handleInputChange('estimatedGuestCount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                ) : (
                  <p className="text-gray-900">
                    {profileData.estimatedGuestCount || '-'}
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {getLocalizedText(locale, 'venue_name')}
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.venue}
                    onChange={(e) => handleInputChange('venue', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                  />
                ) : (
                  <p className="text-gray-900">{profileData.venue || '-'}</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}