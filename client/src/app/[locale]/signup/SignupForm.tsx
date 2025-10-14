'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService, db } from '@ume/shared';
import { doc, setDoc, Timestamp, collection, addDoc } from 'firebase/firestore';
import Link from 'next/link';
import { filterUndefined } from '@/utils/firestore';

interface SignupFormProps {
  locale: string;
}

interface CoupleData {
  partner1Name: string;
  partner2Name: string;
  email: string;
  password: string;
  confirmPassword: string;
  weddingDate: string;
  budget: string;
  guestCount: string;
  venue: string;
  phone: string;
  selectedLocale: string;
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
      signup: 'Create Your Wedding Account',
      signin: 'Sign Up',
      already_have_account: 'Already have an account?',
      login_here: 'Sign in here',
      partner1_name: "Partner 1 Name",
      partner2_name: "Partner 2 Name",
      email: 'Email Address',
      password: 'Password',
      confirm_password: 'Confirm Password',
      wedding_date: 'Wedding Date',
      estimated_budget: 'Estimated Budget (Optional)',
      guest_count: 'Estimated Guest Count (Optional)',
      venue_name: 'Venue Name (Optional)',
      phone: 'Phone Number (Optional)',
      create_account: 'Create Account',
      creating_account: 'Creating Account...',
      back_home: '← Back to Home',
      welcome_text: 'Join thousands of couples planning their perfect wedding',
      free_forever: '100% Free Forever',
      language: 'Language',
      english: 'English',
      french: 'Français',
      spanish: 'Español',
      terms_text: 'By signing up, you agree to our Terms of Service and Privacy Policy',
      error_occurred: 'An error occurred',
      passwords_dont_match: 'Passwords do not match',
      password_min_length: 'Password must be at least 6 characters',
      email_required: 'Email is required',
      names_required: 'Both partner names are required',
      success_message: 'Account created successfully! Redirecting...',
      email_already_in_use: 'This email is already registered. Try signing in instead.',
      invalid_email: 'Please enter a valid email address.',
      weak_password: 'Password is too weak. Please choose a stronger password.'
    },
    fr: {
      signup: 'Créez votre compte de mariage',
      signin: 'S\'inscrire',
      already_have_account: 'Vous avez déjà un compte?',
      login_here: 'Connectez-vous ici',
      partner1_name: "Nom du partenaire 1",
      partner2_name: "Nom du partenaire 2",
      email: 'Adresse e-mail',
      password: 'Mot de passe',
      confirm_password: 'Confirmer le mot de passe',
      wedding_date: 'Date du mariage',
      estimated_budget: 'Budget estimé (Optionnel)',
      guest_count: 'Nombre d\'invités estimé (Optionnel)',
      venue_name: 'Nom du lieu (Optionnel)',
      phone: 'Numéro de téléphone (Optionnel)',
      create_account: 'Créer un compte',
      creating_account: 'Création du compte...',
      back_home: '← Retour à l\'accueil',
      welcome_text: 'Rejoignez des milliers de couples qui planifient leur mariage parfait',
      free_forever: '100% Gratuit pour toujours',
      language: 'Langue',
      english: 'English',
      french: 'Français',
      spanish: 'Español',
      terms_text: 'En vous inscrivant, vous acceptez nos Conditions d\'utilisation et notre Politique de confidentialité',
      error_occurred: 'Une erreur est survenue',
      passwords_dont_match: 'Les mots de passe ne correspondent pas',
      password_min_length: 'Le mot de passe doit contenir au moins 6 caractères',
      email_required: 'L\'e-mail est requis',
      names_required: 'Les noms des deux partenaires sont requis',
      success_message: 'Compte créé avec succès! Redirection...',
      email_already_in_use: 'Cet e-mail est déjà enregistré. Essayez de vous connecter.',
      invalid_email: 'Veuillez entrer une adresse e-mail valide.',
      weak_password: 'Le mot de passe est trop faible. Veuillez choisir un mot de passe plus fort.'
    },
    es: {
      signup: 'Crea tu cuenta de boda',
      signin: 'Registrarse',
      already_have_account: '¿Ya tienes una cuenta?',
      login_here: 'Inicia sesión aquí',
      partner1_name: "Nombre de la pareja 1",
      partner2_name: "Nombre de la pareja 2",
      email: 'Dirección de correo electrónico',
      password: 'Contraseña',
      confirm_password: 'Confirmar contraseña',
      wedding_date: 'Fecha de la boda',
      estimated_budget: 'Presupuesto estimado (Opcional)',
      guest_count: 'Número estimado de invitados (Opcional)',
      venue_name: 'Nombre del lugar (Opcional)',
      phone: 'Número de teléfono (Opcional)',
      create_account: 'Crear cuenta',
      creating_account: 'Creando cuenta...',
      back_home: '← Volver al inicio',
      welcome_text: 'Únete a miles de parejas que planifican su boda perfecta',
      free_forever: '100% Gratis para siempre',
      language: 'Idioma',
      english: 'English',
      french: 'Français',
      spanish: 'Español',
      terms_text: 'Al registrarte, aceptas nuestros Términos de servicio y Política de privacidad',
      error_occurred: 'Ocurrió un error',
      passwords_dont_match: 'Las contraseñas no coinciden',
      password_min_length: 'La contraseña debe tener al menos 6 caracteres',
      email_required: 'El correo electrónico es requerido',
      names_required: 'Se requieren los nombres de ambos miembros de la pareja',
      success_message: '¡Cuenta creada exitosamente! Redirigiendo...',
      email_already_in_use: 'Este correo ya está registrado. Intenta iniciar sesión.',
      invalid_email: 'Por favor ingresa una dirección de correo válida.',
      weak_password: 'La contraseña es muy débil. Por favor elige una contraseña más fuerte.'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default function SignupForm({ locale }: SignupFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState<CoupleData>({
    partner1Name: '',
    partner2Name: '',
    email: '',
    password: '',
    confirmPassword: '',
    weddingDate: '',
    budget: '',
    guestCount: '',
    venue: '',
    phone: '',
    selectedLocale: locale
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const validateForm = (): string | null => {
    if (!formData.email.trim()) {
      return getLocalizedText(locale, 'email_required');
    }
    
    if (!formData.partner1Name.trim() || !formData.partner2Name.trim()) {
      return getLocalizedText(locale, 'names_required');
    }
    
    if (formData.password.length < 6) {
      return getLocalizedText(locale, 'password_min_length');
    }
    
    if (formData.password !== formData.confirmPassword) {
      return getLocalizedText(locale, 'passwords_dont_match');
    }
    
    return null;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(''); // Clear error when user starts typing
  };

  const createCoupleProfile = async (userId: string) => {
    const coupleProfile = {
      id: userId,
      owners: [userId],
      profile: {
        names: {
          partner1: formData.partner1Name.trim(),
          partner2: formData.partner2Name.trim()
        },
        slug: `${formData.partner1Name.trim().toLowerCase().replace(/\s+/g, '-')}-and-${formData.partner2Name.trim().toLowerCase().replace(/\s+/g, '-')}`,
        locale: formData.selectedLocale,
        currency: 'EUR',
        theme: {
          primaryColor: '#e91e63',
          secondaryColor: '#f8bbd9',
          accentColor: '#ff5722',
          backgroundColor: '#ffffff',
          textColor: '#333333',
          fontFamily: 'Inter, sans-serif'
        },
        rsvpMode: 'password',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      email: formData.email.trim(),
      weddingDate: formData.weddingDate ? createWeddingDateTimestamp(formData.weddingDate) : null,
      estimatedBudget: formData.budget ? parseFloat(formData.budget) : null,
      estimatedGuestCount: formData.guestCount ? parseInt(formData.guestCount) : null,
      venue: formData.venue.trim() || null,
      phone: formData.phone.trim() || null,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
      // Default settings
      settings: {
        notifications: {
          email: true,
          tasks: true,
          budget: true,
          guests: true
        }
      },
      // Initialize empty arrays for various wedding components
      events: [],
      vendors: [],
      timeline: [],
      notes: ''
    };

    const coupleRef = doc(db, 'couples', userId);
    await setDoc(coupleRef, filterUndefined(coupleProfile));
    
    // Create initial welcome task
    const welcomeTask = {
      title: 'Welcome to U&Me! 👋',
      description: 'Explore your wedding dashboard and start planning your perfect day.',
      category: 'general',
      priority: 'medium',
      status: 'pending',
      dueDate: null,
      assignedTo: null,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date()),
      completed: false,
      completedAt: null,
      notes: 'This is your first task to get you started. Feel free to mark it as complete once you\'ve explored the platform!',
      attachments: []
    };
    
    const tasksRef = collection(db, 'couples', userId, 'tasks');
    await addDoc(tasksRef, filterUndefined(welcomeTask));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate form
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setLoading(false);
      return;
    }

    try {
      // Create Firebase Auth account
      const user = await authService.signUp(formData.email.trim(), formData.password);
      
      // Create couple profile in Firestore
      await createCoupleProfile(user.uid);
      
      setSuccess(true);
      
      // Redirect to dashboard after short delay
      setTimeout(() => {
        router.push(`/${formData.selectedLocale}/dashboard`);
      }, 2000);
      
    } catch (error: any) {
      console.error('Signup error:', error);
      let errorMessage = getLocalizedText(locale, 'error_occurred');
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = getLocalizedText(locale, 'email_already_in_use');
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = getLocalizedText(locale, 'invalid_email');
      } else if (error.code === 'auth/weak-password') {
        errorMessage = getLocalizedText(locale, 'weak_password');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4 text-center">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="text-green-600 text-6xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              {getLocalizedText(locale, 'success_message')}
            </h1>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-8">
      <div className="max-w-2xl mx-4 lg:mx-auto">

        {/* Signup Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {getLocalizedText(locale, 'signup')}
            </h1>
            <p className="text-gray-600 mb-4">
              {getLocalizedText(locale, 'welcome_text')}
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-full text-sm font-medium">
              ✨ {getLocalizedText(locale, 'free_forever')}
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSignup} className="space-y-6">
            {/* Partner Names */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getLocalizedText(locale, 'partner1_name')} *
                </label>
                <input
                  type="text"
                  name="partner1Name"
                  value={formData.partner1Name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getLocalizedText(locale, 'partner2_name')} *
                </label>
                <input
                  type="text"
                  name="partner2Name"
                  value={formData.partner2Name}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                />
              </div>
            </div>

            {/* Language Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLocalizedText(locale, 'language')} *
              </label>
              <select
                name="selectedLocale"
                value={formData.selectedLocale}
                onChange={(e) => setFormData(prev => ({ ...prev, selectedLocale: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                required
              >
                <option value="en">{getLocalizedText(locale, 'english')}</option>
                <option value="fr">{getLocalizedText(locale, 'french')}</option>
                <option value="es">{getLocalizedText(locale, 'spanish')}</option>
              </select>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLocalizedText(locale, 'email')} *
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                required
              />
            </div>

            {/* Passwords */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getLocalizedText(locale, 'password')} *
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getLocalizedText(locale, 'confirm_password')} *
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  required
                />
              </div>
            </div>

            {/* Wedding Details */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Wedding Details</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLocalizedText(locale, 'wedding_date')}
                  </label>
                  <input
                    type="date"
                    name="weddingDate"
                    value={formData.weddingDate}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLocalizedText(locale, 'guest_count')}
                  </label>
                  <input
                    type="number"
                    name="guestCount"
                    value={formData.guestCount}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                    min="1"
                    max="1000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLocalizedText(locale, 'estimated_budget')}
                  </label>
                  <input
                    type="number"
                    name="budget"
                    value={formData.budget}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                    min="0"
                    step="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {getLocalizedText(locale, 'phone')}
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getLocalizedText(locale, 'venue_name')}
                </label>
                <input
                  type="text"
                  name="venue"
                  value={formData.venue}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pink-600 text-white py-3 px-4 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50 font-medium"
            >
              {loading ? getLocalizedText(locale, 'creating_account') : getLocalizedText(locale, 'create_account')}
            </button>
          </form>

          {/* Terms */}
          <p className="mt-6 text-xs text-gray-500 text-center">
            {getLocalizedText(locale, 'terms_text')}
          </p>

          {/* Sign in link */}
          <div className="mt-8 text-center border-t pt-6">
            <p className="text-sm text-gray-600">
              {getLocalizedText(locale, 'already_have_account')}{' '}
              <Link href={`/${locale}/login`} className="text-pink-600 hover:text-pink-800 font-medium">
                {getLocalizedText(locale, 'login_here')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}