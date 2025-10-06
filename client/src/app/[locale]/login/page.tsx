import LoginForm from './LoginForm';

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      login: 'Login',
      email: 'Email',
      password: 'Password',
      signin: 'Sign In',
      demo_credentials: 'Demo Credentials',
      demo_email: 'demo@test.com',
      demo_password: 'riririri',
      use_demo: 'Use Demo Credentials',
      back_home: '← Back to Home',
      signing_in: 'Signing in...',
      error_occurred: 'An error occurred'
    },
    fr: {
      login: 'Connexion',
      email: 'Email',
      password: 'Mot de passe',
      signin: 'Se connecter',
      demo_credentials: 'Identifiants de démonstration',
      demo_email: 'demo@test.com',
      demo_password: 'riririri',
      use_demo: 'Utiliser les identifiants de démonstration',
      back_home: '← Retour à l\'accueil',
      signing_in: 'Connexion en cours...',
      error_occurred: 'Une erreur est survenue'
    },
    es: {
      login: 'Iniciar sesión',
      email: 'Correo',
      password: 'Contraseña',
      signin: 'Iniciar sesión',
      demo_credentials: 'Credenciales de demostración',
      demo_email: 'demo@test.com',
      demo_password: 'riririri',
      use_demo: 'Usar credenciales de demostración',
      back_home: '← Volver al inicio',
      signing_in: 'Iniciando sesión...',
      error_occurred: 'Ocurrió un error'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default async function LoginPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const { locale } = await params;

  return (
    <LoginForm locale={locale} />
  );
}