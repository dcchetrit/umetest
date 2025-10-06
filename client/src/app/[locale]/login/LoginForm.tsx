'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@ume/shared';
import Link from 'next/link';

interface LoginFormProps {
  locale: string;
}

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      login: 'Login',
      email: 'Email',
      password: 'Password',
      signin: 'Sign In',
      back_home: '← Back to Home',
      signing_in: 'Signing in...',
      error_occurred: 'An error occurred',
      no_account: 'Don\'t have an account?',
      sign_up: 'Sign up here',
      create_account: 'Create Account'
    },
    fr: {
      login: 'Connexion',
      email: 'Email',
      password: 'Mot de passe',
      signin: 'Se connecter',
      back_home: '← Retour à l\'accueil',
      signing_in: 'Connexion en cours...',
      error_occurred: 'Une erreur est survenue',
      no_account: 'Vous n\'avez pas de compte?',
      sign_up: 'Créer un compte',
      create_account: 'Créer un Compte'
    },
    es: {
      login: 'Iniciar sesión',
      email: 'Correo',
      password: 'Contraseña',
      signin: 'Iniciar sesión',
      back_home: '← Volver al inicio',
      signing_in: 'Iniciando sesión...',
      error_occurred: 'Ocurrió un error',
      no_account: '¿No tienes cuenta?',
      sign_up: 'Regístrate aquí',
      create_account: 'Crear Cuenta'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default function LoginForm({ locale }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await authService.signIn(email, password);
      router.push(`/${locale}/app/dashboard`);
    } catch (error: any) {
      setError(error.message || getLocalizedText(locale, 'error_occurred'));
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
      <div className="max-w-md w-full mx-4">
        {/* Navigation */}
        <div className="mb-8">
          <Link href={`/${locale}`} className="text-pink-600 hover:text-pink-800 flex items-center gap-2">
            {getLocalizedText(locale, 'back_home')}
          </Link>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            {getLocalizedText(locale, 'login')}
          </h1>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLocalizedText(locale, 'email')}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLocalizedText(locale, 'password')}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-pink-600 text-white py-2 px-4 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 disabled:opacity-50"
            >
              {loading ? getLocalizedText(locale, 'signing_in') : getLocalizedText(locale, 'signin')}
            </button>
          </form>


          {/* Signup Link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600 mb-2">
              {getLocalizedText(locale, 'no_account')}
            </p>
            <Link 
              href={`/${locale}/signup`} 
              className="inline-block bg-purple-600 text-white px-6 py-2 rounded-md hover:bg-purple-700 font-medium transition-colors"
            >
              {getLocalizedText(locale, 'create_account')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}