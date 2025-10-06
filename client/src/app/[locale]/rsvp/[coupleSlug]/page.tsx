import Link from 'next/link';

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      rsvp: 'RSVP',
      welcome: 'You\'re Invited!',
      couple_wedding: 'Sarah & Michael\'s Wedding',
      wedding_date: 'June 15, 2024',
      wedding_location: 'Sunset Gardens, California',
      rsvp_deadline: 'Please respond by May 1, 2024',
      attending_question: 'Will you be attending?',
      yes_attending: 'Yes, I\'ll be there!',
      no_attending: 'Sorry, can\'t make it',
      guest_name: 'Your Name',
      guest_email: 'Email Address',
      dietary_restrictions: 'Dietary Restrictions (Optional)',
      special_requests: 'Special Requests or Comments',
      submit_rsvp: 'Submit RSVP',
      back_home: '← Back to Home',
      thank_you: 'Thank you for your response!',
      demo_notice: 'This is a demo RSVP page. Connect Firebase to manage real RSVPs.'
    },
    fr: {
      rsvp: 'RSVP',
      welcome: 'Vous êtes invité !',
      couple_wedding: 'Mariage de Sarah et Michael',
      wedding_date: '15 juin 2024',
      wedding_location: 'Sunset Gardens, Californie',
      rsvp_deadline: 'Veuillez répondre avant le 1er mai 2024',
      attending_question: 'Serez-vous présent ?',
      yes_attending: 'Oui, je serai là !',
      no_attending: 'Désolé, je ne peux pas venir',
      guest_name: 'Votre nom',
      guest_email: 'Adresse email',
      dietary_restrictions: 'Restrictions alimentaires (Optionnel)',
      special_requests: 'Demandes spéciales ou commentaires',
      submit_rsvp: 'Envoyer RSVP',
      back_home: '← Retour à l\'accueil',
      thank_you: 'Merci pour votre réponse !',
      demo_notice: 'Ceci est une page RSVP de démonstration. Connectez Firebase pour gérer les vrais RSVPs.'
    },
    es: {
      rsvp: 'RSVP',
      welcome: '¡Estás invitado!',
      couple_wedding: 'Boda de Sarah y Michael',
      wedding_date: '15 de junio, 2024',
      wedding_location: 'Sunset Gardens, California',
      rsvp_deadline: 'Por favor responde antes del 1 de mayo, 2024',
      attending_question: '¿Asistirás?',
      yes_attending: '¡Sí, estaré ahí!',
      no_attending: 'Lo siento, no puedo asistir',
      guest_name: 'Tu nombre',
      guest_email: 'Dirección de correo',
      dietary_restrictions: 'Restricciones dietéticas (Opcional)',
      special_requests: 'Peticiones especiales o comentarios',
      submit_rsvp: 'Enviar RSVP',
      back_home: '← Volver al inicio',
      thank_you: '¡Gracias por tu respuesta!',
      demo_notice: 'Esta es una página RSVP de demostración. Conecta Firebase para gestionar RSVPs reales.'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default async function RSVPPage({ 
  params 
}: { 
  params: Promise<{ locale: string; coupleSlug: string }> 
}) {
  const { locale, coupleSlug } = await params;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100">
      {/* Navigation */}
      <nav className="bg-white shadow-sm p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">{getLocalizedText(locale, 'rsvp')}</h1>
          <Link href={`/${locale}`} className="text-pink-600 hover:text-pink-800">
            {getLocalizedText(locale, 'back_home')}
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Wedding Header */}
        <div className="text-center mb-8">
          <div className="mb-6">
            <div className="text-pink-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              {getLocalizedText(locale, 'welcome')}
            </h1>
            <h2 className="text-2xl font-elegant text-pink-600 mb-4">
              {getLocalizedText(locale, 'couple_wedding')}
            </h2>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-800 mb-2">
                {getLocalizedText(locale, 'wedding_date')}
              </p>
              <p className="text-gray-600 mb-4">
                {getLocalizedText(locale, 'wedding_location')}
              </p>
              <p className="text-sm text-pink-600 font-medium">
                {getLocalizedText(locale, 'rsvp_deadline')}
              </p>
            </div>
          </div>
        </div>

        {/* RSVP Form */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <form className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLocalizedText(locale, 'guest_name')}
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLocalizedText(locale, 'guest_email')}
              </label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                {getLocalizedText(locale, 'attending_question')}
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="attending"
                    value="yes"
                    className="text-pink-600 focus:ring-pink-500"
                  />
                  <span className="ml-2 text-green-700 font-medium">
                    {getLocalizedText(locale, 'yes_attending')}
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="attending"
                    value="no"
                    className="text-pink-600 focus:ring-pink-500"
                  />
                  <span className="ml-2 text-red-700 font-medium">
                    {getLocalizedText(locale, 'no_attending')}
                  </span>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLocalizedText(locale, 'dietary_restrictions')}
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="e.g., Vegetarian, Gluten-free, None"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {getLocalizedText(locale, 'special_requests')}
              </label>
              <textarea
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                placeholder="Any special accommodations or messages for the couple..."
              />
            </div>

            <button
              type="submit"
              className="w-full bg-pink-600 text-white py-3 px-4 rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500 font-medium"
            >
              {getLocalizedText(locale, 'submit_rsvp')}
            </button>
          </form>
        </div>

        {/* Demo Notice */}
        <div className="mt-8 bg-pink-50 border border-pink-200 rounded-lg p-4">
          <p className="text-pink-800">
            💕 {getLocalizedText(locale, 'demo_notice')}
          </p>
        </div>
      </div>
    </div>
  );
}