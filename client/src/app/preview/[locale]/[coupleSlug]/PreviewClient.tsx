'use client';

import { useState, useEffect } from 'react';
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@ume/shared';
import Head from 'next/head';

interface WebsiteEvent {
  id: string;
  name: string;
  date: string;
  time: string;
  location: string;
  address: string;
  description?: string;
  dresscode?: string;
  picture?: string;
}

interface Accommodation {
  id: string;
  name: string;
  type: 'hotel' | 'airbnb' | 'other';
  address: string;
  phone?: string;
  website?: string;
  description?: string;
  priceRange?: string;
  distance?: string;
  picture?: string;
}

interface Contact {
  id: string;
  name: string;
  role: string;
  phone?: string;
  email?: string;
}

interface WebsiteSettings {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  branding: {
    logo?: string;
    favicon?: string;
    heroPicture?: string;
    coupleName: string;
    weddingDate: string;
    tagline?: string;
  };
  sections: {
    hero: boolean;
    story: boolean;
    gallery: boolean;
    events: boolean;
    rsvp: boolean;
    registry: boolean;
    accommodations: boolean;
    contact: boolean;
  };
  layout: {
    template: 'classic' | 'modern' | 'elegant' | 'minimal';
    navigation: 'top' | 'side' | 'overlay';
  };
  content: {
    heroMessage?: string;
    storyText?: string;
    additionalInfo?: string;
  };
  events: WebsiteEvent[];
  accommodations: Accommodation[];
  contacts: Contact[];
  registry?: {
    message?: string;
    links: Array<{
      store: string;
      url: string;
    }>;
  };
}

const defaultSettings: WebsiteSettings = {
  colors: {
    primary: '#8B5CF6',
    secondary: '#EC4899',
    accent: '#F59E0B',
    background: '#FFFFFF',
    text: '#1F2937'
  },
  branding: {
    coupleName: 'John & Jane',
    weddingDate: '2024-12-25',
    tagline: 'Two hearts, one love'
  },
  sections: {
    hero: true,
    story: true,
    gallery: true,
    events: true,
    rsvp: true,
    registry: false,
    accommodations: true,
    contact: true
  },
  layout: {
    template: 'classic',
    navigation: 'top'
  },
  content: {
    heroMessage: 'Welcome to our wedding website',
    storyText: 'Our love story begins...',
    additionalInfo: 'We can\'t wait to celebrate with you!'
  },
  events: [],
  accommodations: [],
  contacts: [],
  registry: {
    message: '',
    links: []
  }
};

export default function PreviewClient({ locale, coupleSlug }: { locale: string; coupleSlug: string }) {
  const [settings, setSettings] = useState<WebsiteSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [overlayOpen, setOverlayOpen] = useState(false);
  
  // RSVP State
  const [rsvpSubmitted, setRsvpSubmitted] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [rsvpForm, setRsvpForm] = useState({
    firstName: '',
    lastName: '',
    totalGuests: 1,
    events: {} as Record<string, { attending: boolean; guestCount: number }>,
    isNoneSelected: false,
    message: ''
  });

  // Helper function to generate placeholder based on text
  const getImagePlaceholder = (text: string, aspectRatio: string = '16/9') => {
    const initials = text
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    return (
      <div 
        className="image-placeholder" 
        style={{ aspectRatio }}
        aria-label={`Placeholder for ${text}`}
      >
        <div className="text-center">
          <div className="text-2xl font-bold mb-1">{initials}</div>
          <div className="text-xs opacity-60">Image</div>
        </div>
      </div>
    );
  };

  // Helper function to compute text color based on background
  const getContrastColor = (backgroundColor: string) => {
    // Simple luminance calculation for accessibility
    const rgb = backgroundColor.match(/\w\w/g);
    if (!rgb) return '#ffffff';
    
    const [r, g, b] = rgb.map(x => parseInt(x, 16));
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    const animatedElements = document.querySelectorAll('.animate-on-scroll');
    animatedElements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [loading]);

  useEffect(() => {
    loadSettings();
    loadEvents();
  }, [coupleSlug]);

  const loadSettings = async () => {
    try {
      const docRef = doc(db, 'couples', coupleSlug, 'settings', 'website');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setSettings({ ...defaultSettings, ...docSnap.data() });
      }
    } catch (error) {
      console.error('Error loading website settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      const eventsRef = collection(db, 'couples', coupleSlug, 'dashboard-events');
      const eventsSnap = await getDocs(eventsRef);
      
      const eventsData = eventsSnap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setEvents(eventsData);
      
      // Initialize RSVP form events structure
      const initialEvents: Record<string, { attending: boolean; guestCount: number }> = {};
      eventsData.forEach(event => {
        initialEvents[event.id] = { attending: false, guestCount: 0 };
      });
      
      setRsvpForm(prev => ({ ...prev, events: initialEvents, isNoneSelected: false }));
      
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  // RSVP submission function
  const submitRSVP = async (e: React.FormEvent) => {
    e.preventDefault();
    setRsvpLoading(true);
    
    try {
      // Create or update guest record
      // Determine overall attendance status
      const isAttending = Object.values(rsvpForm.events).some(event => event.attending);
      
      const guestData = {
        firstName: rsvpForm.firstName,
        lastName: rsvpForm.lastName,
        name: `${rsvpForm.firstName} ${rsvpForm.lastName}`,
        capacity: rsvpForm.totalGuests,
        rsvp: {
          status: isAttending ? 'Confirmé' : 'Refusé',
          totalGuests: rsvpForm.totalGuests,
          events: rsvpForm.events,
          message: rsvpForm.message,
          submittedAt: new Date()
        },
        createdAt: new Date()
      };

      // Check if guest already exists
      const guestsRef = collection(db, 'couples', coupleSlug, 'guests');
      // Simply create new guest since we don't have email for deduplication
      await addDoc(guestsRef, guestData);


      setRsvpSubmitted(true);
      
      // Reset form after short delay
      setTimeout(() => {
        setRsvpSubmitted(false);
        const resetEvents: Record<string, { attending: boolean; guestCount: number }> = {};
        events.forEach(event => {
          resetEvents[event.id] = { attending: false, guestCount: 0 };
        });
        
        setRsvpForm({
          firstName: '',
          lastName: '',
          totalGuests: 1,
          events: resetEvents,
          isNoneSelected: false,
          message: ''
        });
      }, 5000);
      
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      alert('Erreur lors de l\'envoi de votre RSVP. Veuillez réessayer.');
    } finally {
      setRsvpLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const CustomStyles = () => (
    <style jsx global>{`
      /* Import premium web fonts with optimized loading */
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Inter:wght@100;200;300;400;500;600;700;800;900&family=Space+Grotesk:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&display=swap');

      /* Cormorant Garamond Font Class */
      .cormorant-garamond {
        font-family: "Cormorant Garamond", serif;
        font-optical-sizing: auto;
        font-style: normal;
      }

      /* RSVP Form Design from formdesign.md */
      .rsvp-card {
        max-width: 600px;
        margin: 0 auto;
        background-color: var(--background);
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
        padding: 1.5rem;
      }

      .row {
        --bs-gutter-x: 1.5rem;
        --bs-gutter-y: 0;
        display: flex;
        flex-wrap: wrap;
        margin-top: calc(-1 * var(--bs-gutter-y));
        margin-right: calc(-.5 * var(--bs-gutter-x));
        margin-left: calc(-.5 * var(--bs-gutter-x));
      }

      .mb-3 {
        margin-bottom: 1rem !important;
      }

      .row > * {
        flex-shrink: 0;
        width: 100%;
        max-width: 100%;
        padding-right: calc(var(--bs-gutter-x) * .5);
        padding-left: calc(var(--bs-gutter-x) * .5);
        margin-top: var(--bs-gutter-y);
      }

      @media (min-width: 768px) {
        .col-md-6 {
          flex: 0 0 auto;
          width: 50%;
        }
        .mt-md-0 {
          margin-top: 0 !important;
        }
      }

      .mt-3 {
        margin-top: 1rem !important;
      }

      .form-label {
        font-weight: 500;
        margin-bottom: 0.25rem;
        color: #5e735b;
        display: inline-block;
      }

      .mb-2 {
        margin-bottom: .5rem !important;
      }

      .form-control {
        display: block;
        width: 100%;
        padding: .375rem .75rem;
        font-size: 1rem;
        font-weight: 400;
        line-height: 1.5;
        color: #212529;
        background-color: #fff;
        background-clip: padding-box;
        border: 1px solid #dee2e6;
        appearance: none;
        border-radius: 0.375rem;
        transition: border-color .15s ease-in-out, box-shadow .15s ease-in-out;
      }

      .g-3 {
        --bs-gutter-x: 1rem;
        --bs-gutter-y: 1rem;
      }

      .col {
        flex: 1 0 0%;
      }

      .row-cols-1 > * {
        flex: 0 0 auto;
        width: 100%;
      }

      @media (min-width: 768px) {
        .row-cols-md-2 > * {
          flex: 0 0 auto;
          width: 50%;
        }
      }

      .event-checkbox-wrapper {
        position: relative;
        transition: all 0.3s ease;
      }

      .text-center {
        text-align: center !important;
      }

      .rsvp-check {
        display: flex;
        width: 100%;
        align-items: center;
        gap: 0.5rem;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        padding: 0.75rem 0.5rem;
        background-color: #ffffff;
        cursor: pointer;
        transition: border 0.2s ease, background-color 0.2s ease;
        color: #5e735b;
        font-weight: 500;
        border: 1px solid transparent;
      }

      .guest-count-wrapper {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease, padding 0.3s ease;
        border-radius: 0 0 8px 8px;
        margin-top: -1px;
        background-color: #ffffff;
        padding: 0 0.75rem;
        border: 1px solid transparent;
        border-top: none;
      }

      .guest-count-wrapper[style*="80px"] {
        padding: 0.75rem;
        border-color: #5e735b;
      }

      .rsvp-check input[type="checkbox"] {
        appearance: none;
        -webkit-appearance: none;
        width: 1.1rem;
        height: 1.1rem;
        border: 1px solid #5e735b;
        border-radius: 4px;
        margin: 0;
        position: relative;
        cursor: pointer;
      }

      .rsvp-check input[type="checkbox"]:checked {
        background-color: #5e735b;
        border-color: #5e735b;
      }

      .rsvp-check input[type="checkbox"]:checked::after {
        content: '✓';
        position: absolute;
        color: white;
        font-size: 0.8rem;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      }

      .guest-count-label {
        font-size: 0.875rem;
        color: #333333;
        margin-bottom: 0.25rem;
        display: block;
      }

      .guest-count-input {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #D8D7D8;
        border-radius: 4px;
        text-align: center;
        font-size: 1rem;
        color: #212529
      }

      .rsvp-check:has(input[type="checkbox"]:checked) {
        border: 1px solid #5e735b;
        background-color: color-mix(in srgb, #5e735b 15%, transparent);
      }

      .me-1 {
        margin-right: .25rem !important;
      }

      .w-100 {
        width: 100% !important;
      }

      .btn {
        display: inline-block;
        padding: 0.375rem 0.75rem;
        font-size: 1rem;
        font-weight: 400;
        line-height: 1.5;
        color: #212529;
        text-align: center;
        text-decoration: none;
        vertical-align: middle;
        cursor: pointer;
        user-select: none;
        border: 1px solid transparent;
        border-radius: 0.375rem;
        transition: color .15s ease-in-out, background-color .15s ease-in-out, border-color .15s ease-in-out, box-shadow .15s ease-in-out;
      }

      .btn-submit {
        background-color: #5e735b;
        color: #ffffff;
        border: none;
        font-size: 1rem;
        padding: 0.75rem 1.5rem;
        border-radius: 4px;
        transition: background-color 0.2s ease;
      }

      .btn-submit:hover {
        background-color: #5e735b;
        filter: brightness(0.8);
        color: #ffffff;
      }

      textarea.form-control {
        min-height: calc(1.5em + .75rem + calc(1px * 2));
        resize: vertical;
      }

      /* CSS Custom Properties with enhanced color system */
      :root {
        --primary: ${settings.colors.primary};
        --secondary: ${settings.colors.secondary};
        --accent: ${settings.colors.accent};
        --background: ${settings.colors.background};
        --text: ${settings.colors.text};
        
        /* Enhanced color palette with opacity variants */
        --primary-50: ${settings.colors.primary}08;
        --primary-100: ${settings.colors.primary}15;
        --primary-200: ${settings.colors.primary}25;
        --primary-500: ${settings.colors.primary}80;
        --primary-900: ${settings.colors.primary}f0;
        
        --secondary-50: ${settings.colors.secondary}08;
        --secondary-100: ${settings.colors.secondary}15;
        --secondary-200: ${settings.colors.secondary}25;
        
        --accent-50: ${settings.colors.accent}08;
        --accent-100: ${settings.colors.accent}15;
        --accent-200: ${settings.colors.accent}25;
        
        /* Semantic grays */
        --gray-50: #fafafa;
        --gray-100: #f5f5f5;
        --gray-200: #e5e5e5;
        --gray-300: #d4d4d4;
        --gray-400: #a3a3a3;
        --gray-500: #737373;
        --gray-600: #525252;
        --gray-700: #404040;
        --gray-800: #262626;
        --gray-900: #171717;
        
        /* Elevation system */
        --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
        --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        
        /* Spacing scale */
        --space-xs: 0.25rem;
        --space-sm: 0.5rem;
        --space-md: 1rem;
        --space-lg: 1.5rem;
        --space-xl: 2rem;
        --space-2xl: 3rem;
        --space-3xl: 4rem;
        --space-4xl: 5rem;
        --space-5xl: 6rem;
        --space-6xl: 8rem;
        
        /* Border radius scale */
        --radius-sm: 0.125rem;
        --radius-md: 0.375rem;
        --radius-lg: 0.5rem;
        --radius-xl: 0.75rem;
        --radius-2xl: 1rem;
        --radius-full: 9999px;
        
        /* Animation durations */
        --duration-fast: 150ms;
        --duration-normal: 300ms;
        --duration-slow: 500ms;
        
        /* Responsive breakpoints */
        --breakpoint-sm: 640px;
        --breakpoint-md: 768px;
        --breakpoint-lg: 1024px;
        --breakpoint-xl: 1280px;
        --breakpoint-2xl: 1536px;
      }

      /* Base reset and accessibility */
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      html {
        scroll-behavior: smooth;
        text-size-adjust: 100%;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      body {
        line-height: 1.6;
        color: var(--text);
        background: var(--background);
      }

      /* Focus management for accessibility */
      *:focus {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }

      *:focus:not(:focus-visible) {
        outline: none;
      }

      /* Image optimization */
      img {
        max-width: 100%;
        height: auto;
        display: block;
      }

      /* Utility classes */
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }

      .container {
        width: 100%;
        max-width: 1280px;
        margin: 0 auto;
        padding: 0 var(--space-lg);
      }

      @media (min-width: 640px) {
        .container {
          padding: 0 var(--space-xl);
        }
      }

      /* Enhanced button system */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
        text-decoration: none;
        transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        border: none;
        outline: none;
        position: relative;
        overflow: hidden;
      }

      .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .btn-primary {
        background: var(--primary);
        color: white;
        padding: var(--space-md) var(--space-xl);
        border-radius: var(--radius-lg);
        font-size: 1rem;
        box-shadow: var(--shadow-md);
      }

      .btn-primary:hover:not(:disabled) {
        background: var(--secondary);
        transform: translateY(-1px);
        box-shadow: var(--shadow-lg);
      }

      .btn-primary:active {
        transform: translateY(0);
        box-shadow: var(--shadow-md);
      }

      /* Intersection Observer animation utility */
      .animate-on-scroll {
        opacity: 0;
        transform: translateY(24px);
        transition: all 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      }

      .animate-on-scroll.in-view {
        opacity: 1;
        transform: translateY(0);
      }

      /* Image placeholder system */
      .image-placeholder {
        background: linear-gradient(135deg, var(--gray-100), var(--gray-200));
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--gray-500);
        font-size: 0.875rem;
        position: relative;
        overflow: hidden;
      }

      .image-placeholder::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
        animation: shimmer 2s infinite;
      }

      @keyframes shimmer {
        to {
          left: 100%;
        }
      }

      /* Template: CLASSIC */
      .template-classic {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 400;
        line-height: 1.7;
      }

      .template-classic h1, .template-classic h2, .template-classic h3, .template-classic h4 {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 600;
        line-height: 1.3;
        color: var(--text);
      }

      .template-classic h1 {
        font-size: clamp(2.5rem, 8vw, 6rem);
        font-weight: 700;
        letter-spacing: -0.02em;
      }

      .template-classic h2 {
        font-size: clamp(2rem, 5vw, 3.5rem);
        margin-bottom: var(--space-lg);
      }

      .template-classic h3 {
        font-size: clamp(1.5rem, 3vw, 2rem);
        margin-bottom: var(--space-md);
      }

      .template-classic .decorative-frame {
        border: 2px solid var(--secondary);
        padding: var(--space-2xl);
        position: relative;
        background: var(--background);
      }

      .template-classic .decorative-frame::before,
      .template-classic .decorative-frame::after {
        content: '';
        position: absolute;
        width: 24px;
        height: 24px;
        border: 2px solid var(--accent);
      }

      .template-classic .decorative-frame::before {
        top: -2px;
        left: -2px;
        border-right: none;
        border-bottom: none;
      }

      .template-classic .decorative-frame::after {
        bottom: -2px;
        right: -2px;
        border-left: none;
        border-top: none;
      }

      .template-classic .ornamental-divider {
        display: flex;
        align-items: center;
        justify-content: center;
        margin: var(--space-2xl) 0;
        font-size: 1.5rem;
        color: var(--accent);
      }

      .template-classic .ornamental-divider::before,
      .template-classic .ornamental-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--gray-300);
        margin: 0 var(--space-lg);
      }

      .template-classic .card {
        background: var(--background);
        border: 1px solid var(--gray-200);
        padding: var(--space-xl);
        transition: all var(--duration-normal);
        position: relative;
      }

      .template-classic .card::before {
        content: '';
        position: absolute;
        top: var(--space-md);
        left: var(--space-md);
        right: var(--space-md);
        bottom: var(--space-md);
        border: 1px solid var(--primary-100);
        pointer-events: none;
        transition: all var(--duration-normal);
      }

      .template-classic .card:hover::before {
        border-color: var(--primary-200);
      }

      /* Template: ELEGANT */
      .template-elegant {
        font-family: 'Playfair Display', 'Georgia', serif;
        font-weight: 400;
        line-height: 1.8;
      }

      .template-elegant h1, .template-elegant h2, .template-elegant h3, .template-elegant h4 {
        font-family: 'Playfair Display', serif;
        font-weight: 500;
        font-style: italic;
        line-height: 1.2;
        color: var(--text);
      }

      .template-elegant h1 {
        font-size: clamp(3rem, 8vw, 7rem);
        font-weight: 600;
        letter-spacing: -0.03em;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .template-elegant h2 {
        font-size: clamp(2.25rem, 5vw, 4rem);
        margin-bottom: var(--space-xl);
      }

      .template-elegant h3 {
        font-size: clamp(1.75rem, 3vw, 2.5rem);
        margin-bottom: var(--space-lg);
      }

      .template-elegant .elegant-bg {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--primary-50) 25%, 
          var(--secondary-50) 75%, 
          var(--background) 100%);
        position: relative;
      }

      .template-elegant .elegant-bg::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 30% 70%, var(--primary-100), transparent 50%),
                    radial-gradient(circle at 70% 30%, var(--secondary-100), transparent 50%);
        pointer-events: none;
      }

      .template-elegant .flourish {
        display: flex;
        align-items: center;
        justify-content: center;
        margin: var(--space-3xl) 0;
        font-size: 2rem;
        color: var(--accent);
      }

      .template-elegant .flourish::before,
      .template-elegant .flourish::after {
        content: '';
        flex: 1;
        height: 1px;
        background: linear-gradient(to right, transparent, var(--accent), transparent);
        margin: 0 var(--space-xl);
      }

      .template-elegant .card {
        background: rgba(255, 255, 255, 0.7);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: var(--radius-xl);
        padding: var(--space-2xl);
        box-shadow: var(--shadow-lg);
        transition: all var(--duration-normal);
      }

      .template-elegant .card:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-2xl);
        background: rgba(255, 255, 255, 0.8);
      }

      /* Template: MODERN */
      .template-modern {
        font-family: 'Space Grotesk', 'Helvetica Neue', sans-serif;
        font-weight: 400;
        line-height: 1.6;
        letter-spacing: -0.01em;
      }

      .template-modern h1, .template-modern h2, .template-modern h3, .template-modern h4 {
        font-family: 'Space Grotesk', 'Helvetica Neue', sans-serif;
        font-weight: 700;
        line-height: 1.1;
        color: var(--text);
        text-transform: uppercase;
        letter-spacing: -0.02em;
      }

      .template-modern h1 {
        font-size: clamp(3rem, 10vw, 8rem);
        font-weight: 900;
        background: linear-gradient(135deg, var(--primary), var(--secondary), var(--accent));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        background-size: 200% 200%;
        animation: gradient-shift 4s ease-in-out infinite;
      }

      @keyframes gradient-shift {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }

      .template-modern h2 {
        font-size: clamp(2rem, 6vw, 4rem);
        margin-bottom: var(--space-xl);
      }

      .template-modern h3 {
        font-size: clamp(1.25rem, 3vw, 2rem);
        margin-bottom: var(--space-lg);
      }

      .template-modern .geometric-bg {
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        position: relative;
        overflow: hidden;
      }

      .template-modern .geometric-bg::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: 
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 20px,
            rgba(255,255,255,0.05) 20px,
            rgba(255,255,255,0.05) 40px
          );
        animation: slide 20s linear infinite;
      }

      @keyframes slide {
        to {
          transform: translateX(40px) translateY(40px);
        }
      }

      .template-modern .grid-divider {
        width: 100%;
        height: 1px;
        background: var(--primary);
        margin: var(--space-3xl) 0;
        position: relative;
      }

      .template-modern .grid-divider::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 8px;
        height: 8px;
        background: var(--accent);
        border-radius: 50%;
      }

      .template-modern .card {
        background: var(--background);
        border-radius: 0;
        padding: var(--space-2xl);
        box-shadow: 
          8px 8px 0 var(--primary-100),
          16px 16px 0 var(--primary-50);
        transition: all var(--duration-normal);
        border: 2px solid var(--gray-900);
      }

      .template-modern .card:hover {
        transform: translate(-4px, -4px);
        box-shadow: 
          12px 12px 0 var(--primary-100),
          20px 20px 0 var(--primary-50);
      }

      /* Template: MINIMAL */
      .template-minimal {
        font-family: 'Inter', 'Helvetica Neue', sans-serif;
        font-weight: 300;
        line-height: 1.7;
        letter-spacing: 0.02em;
      }

      .template-minimal h1, .template-minimal h2, .template-minimal h3, .template-minimal h4 {
        font-family: 'Inter', 'Helvetica Neue', sans-serif;
        font-weight: 200;
        line-height: 1.1;
        color: var(--text);
        text-transform: uppercase;
        letter-spacing: 0.15em;
      }

      .template-minimal h1 {
        font-size: clamp(2rem, 6vw, 5rem);
        font-weight: 100;
        margin-bottom: var(--space-xl);
      }

      .template-minimal h2 {
        font-size: clamp(1.5rem, 4vw, 2.5rem);
        margin-bottom: var(--space-lg);
      }

      .template-minimal h3 {
        font-size: clamp(1.125rem, 2vw, 1.5rem);
        margin-bottom: var(--space-md);
      }

      .template-minimal .minimal-line {
        width: 60px;
        height: 1px;
        background: var(--primary);
        margin: var(--space-2xl) auto;
        position: relative;
      }

      .template-minimal .minimal-line::before,
      .template-minimal .minimal-line::after {
        content: '';
        position: absolute;
        top: 0;
        width: 1px;
        height: 1px;
        background: var(--primary);
      }

      .template-minimal .minimal-line::before {
        left: -8px;
      }

      .template-minimal .minimal-line::after {
        right: -8px;
      }

      .template-minimal .minimal-divider {
        width: 100%;
        height: 1px;
        background: var(--gray-200);
        margin: var(--space-4xl) 0;
      }

      .template-minimal .card {
        background: var(--background);
        border: 1px solid var(--gray-200);
        padding: var(--space-2xl);
        transition: all var(--duration-normal);
      }

      .template-minimal .card:hover {
        border-color: var(--primary);
        box-shadow: 0 0 0 1px var(--primary);
      }

      .template-minimal .btn-minimal {
        background: transparent;
        color: var(--primary);
        border: 1px solid var(--primary);
        padding: var(--space-md) var(--space-2xl);
        font-weight: 400;
        letter-spacing: 0.1em;
        text-transform: uppercase;
        font-size: 0.875rem;
      }

      .template-minimal .btn-minimal:hover {
        background: var(--primary);
        color: var(--background);
      }

      /* Navigation Styles */
      .nav-side {
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        width: 80px;
        background: var(--primary);
        z-index: 1000;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: var(--space-xl) 0;
        box-shadow: var(--shadow-lg);
      }

      .nav-side ~ .main-content {
        margin-left: 80px;
      }

      .nav-overlay-trigger {
        position: fixed;
        top: var(--space-xl);
        right: var(--space-xl);
        z-index: 1001;
        background: var(--primary);
        color: white;
        border: none;
        padding: var(--space-lg);
        border-radius: var(--radius-full);
        cursor: pointer;
        box-shadow: var(--shadow-lg);
        transition: all var(--duration-normal);
      }

      .nav-overlay-trigger:hover {
        transform: scale(1.05);
        box-shadow: var(--shadow-xl);
      }

      .nav-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.95);
        backdrop-filter: blur(20px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        visibility: hidden;
        transition: all var(--duration-slow) cubic-bezier(0.4, 0, 0.2, 1);
      }

      .nav-overlay.open {
        opacity: 1;
        visibility: visible;
      }

      /* Classic Template Navigation - Beautiful & Prominent */
      .nav-top.template-classic {
        background: var(--background);
        backdrop-filter: blur(20px) saturate(130%);
        border-bottom: 2px solid rgba(0, 0, 0, 0.04);
        box-shadow: 
          0 2px 8px rgba(0, 0, 0, 0.08),
          0 4px 20px rgba(0, 0, 0, 0.04);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .nav-top.template-classic::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, 
          var(--primary) 0%, 
          var(--accent) 25%, 
          var(--secondary) 50%, 
          var(--accent) 75%, 
          var(--primary) 100%);
        opacity: 0.6;
      }

      /* Logo Circle Container */
      .nav-top.template-classic .logo-circle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary), var(--accent));
        padding: 3px;
        box-shadow: 
          0 4px 12px rgba(0, 0, 0, 0.1),
          0 2px 6px rgba(0, 0, 0, 0.06);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }

      .nav-top.template-classic .logo-circle::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .nav-top.template-classic .logo-circle:hover {
        transform: scale(1.05);
        box-shadow: 
          0 6px 20px rgba(0, 0, 0, 0.15),
          0 3px 10px rgba(0, 0, 0, 0.1);
      }

      .nav-top.template-classic .logo-circle:hover::before {
        opacity: 1;
      }

      .nav-top.template-classic .logo-circle .brand-logo {
        width: 100%;
        height: 100%;
        object-fit: cover;
        border-radius: 50%;
        background: white;
      }

      /* Monogram Circle */
      .nav-top.template-classic .brand-monogram-circle {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary), var(--accent));
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Cormorant Garamond', serif;
        color: white;
        font-weight: 600;
        font-style: italic;
        font-size: 18px;
        box-shadow: 
          0 4px 12px rgba(0, 0, 0, 0.1),
          0 2px 6px rgba(0, 0, 0, 0.06);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }

      .nav-top.template-classic .brand-monogram-circle::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: linear-gradient(45deg, transparent 30%, rgba(255,255,255,0.2) 50%, transparent 70%);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .nav-top.template-classic .brand-monogram-circle:hover {
        transform: scale(1.05);
        box-shadow: 
          0 6px 20px rgba(0, 0, 0, 0.15),
          0 3px 10px rgba(0, 0, 0, 0.1);
      }

      .nav-top.template-classic .brand-monogram-circle:hover::before {
        opacity: 1;
      }

      .nav-top.template-classic .brand-monogram-circle .initials {
        font-size: 16px;
        font-weight: 700;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
      }

      .nav-top.template-classic .brand-monogram-circle .ampersand {
        font-size: 12px;
        margin: 0 2px;
        opacity: 0.9;
        font-weight: 300;
      }

      /* Navigation Menu */
      .nav-top.template-classic .nav-menu {
        gap: 40px;
        padding: 0 20px;
      }

      .nav-top.template-classic .nav-link {
        font-family: 'Cormorant Garamond', serif;
        font-size: 18px;
        font-weight: 500;
        color: var(--text);
        text-decoration: none;
        position: relative;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        letter-spacing: 0.02em;
        text-transform: capitalize;
        padding: 8px 16px;
        border-radius: 25px;
        white-space: nowrap;
      }

      .nav-top.template-classic .nav-link::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, var(--primary), var(--accent));
        border-radius: 25px;
        opacity: 0;
        transform: scale(0.8);
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: -1;
      }

      .nav-top.template-classic .nav-link::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 2px;
        background: var(--accent);
        border-radius: 2px;
        transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .nav-top.template-classic .nav-link:hover {
        color: white;
        transform: translateY(-2px);
        text-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
      }

      .nav-top.template-classic .nav-link:hover::before {
        opacity: 1;
        transform: scale(1);
      }

      .nav-top.template-classic .nav-link:hover::after {
        width: 80%;
      }

      /* Mobile Menu Button */
      .nav-top.template-classic .mobile-menu-btn {
        width: 50px;
        height: 50px;
        background: rgba(0, 0, 0, 0.02);
        border: 2px solid rgba(0, 0, 0, 0.06);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }

      .nav-top.template-classic .mobile-menu-btn::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, var(--primary), var(--accent));
        opacity: 0;
        transition: opacity 0.3s ease;
        border-radius: 10px;
      }

      .nav-top.template-classic .mobile-menu-btn:hover {
        transform: scale(1.05);
        border-color: var(--accent);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .nav-top.template-classic .mobile-menu-btn:hover::before {
        opacity: 1;
      }

      .nav-top.template-classic .hamburger {
        display: flex;
        flex-direction: column;
        gap: 4px;
        position: relative;
        z-index: 1;
      }

      .nav-top.template-classic .hamburger span {
        width: 24px;
        height: 3px;
        background: var(--text);
        border-radius: 2px;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .nav-top.template-classic .mobile-menu-btn:hover .hamburger span {
        background: white;
        transform: scaleX(0.8);
      }

      /* Fixed Navigation Spacing */
      .template-classic .main-content {
        padding-top: 100px;
      }

      .template-classic .hero-section {
        min-height: calc(100vh - 96px);
        padding-top: 0;
      }

      .nav-side.template-classic {
        background: linear-gradient(180deg, var(--primary) 0%, var(--secondary) 100%);
        border-right: 3px solid var(--accent);
      }

      .nav-side.template-classic a {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 600;
        position: relative;
      }

      .nav-side.template-classic a::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 0;
        height: 0;
        background: var(--accent);
        border-radius: 50%;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        transform: translate(-50%, -50%);
        z-index: -1;
      }

      .nav-side.template-classic a:hover::after {
        width: 80%;
        height: 80%;
      }

      .nav-overlay-trigger.template-classic {
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
      }

      .nav-overlay-trigger.template-classic:hover {
        background: rgba(0, 0, 0, 0.5);
        border-color: var(--accent);
        transform: scale(1.05);
      }

      .nav-overlay.template-classic {
        background: linear-gradient(135deg, var(--primary)e6 0%, var(--secondary)e6 100%);
        backdrop-filter: blur(20px);
      }

      .nav-overlay.template-classic::before {
        content: '';
        position: absolute;
        inset: 0;
        background: 
          radial-gradient(circle at 20% 20%, var(--accent)15 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, var(--primary)15 0%, transparent 50%),
          radial-gradient(circle at 40% 60%, var(--secondary)15 0%, transparent 50%);
        pointer-events: none;
      }

      .nav-overlay.template-classic h2 {
        font-family: 'Cormorant Garamond', serif;
        font-style: italic;
      }

      .nav-overlay.template-classic a {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 500;
        position: relative;
        padding: 12px 24px;
        border-radius: 8px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .nav-overlay.template-classic a::before {
        content: '';
        position: absolute;
        inset: 0;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: -1;
      }

      .nav-overlay.template-classic a:hover::before {
        opacity: 1;
        background: rgba(255, 255, 255, 0.15);
        border-color: var(--accent);
      }

      /* Responsive Design */
      @media (max-width: 767px) {
        .nav-side ~ .main-content {
          margin-left: 0;
        }
        
        .nav-side {
          display: none;
        }
        
        .nav-top.template-classic .logo-circle,
        .nav-top.template-classic .brand-monogram-circle {
          width: 50px;
          height: 50px;
        }

        .nav-top.template-classic .brand-monogram-circle .initials {
          font-size: 14px;
        }

        .nav-top.template-classic .brand-monogram-circle .ampersand {
          font-size: 10px;
          margin: 0 1px;
        }

        .nav-top.template-classic .mobile-menu-btn {
          width: 44px;
          height: 44px;
        }

        .nav-top.template-classic .hamburger span {
          width: 20px;
          height: 2px;
        }

        .template-classic .main-content {
          padding-top: 96px;
        }

        .template-classic .hero-section {
          min-height: calc(100vh - 96px);
        }

        .nav-overlay-trigger.template-classic {
          padding: 12px;
        }

        .nav-overlay.template-classic {
          padding: var(--space-xl);
        }

        .nav-overlay.template-classic h2 {
          font-size: 1.25rem;
          margin-bottom: var(--space-lg);
        }

        .nav-overlay.template-classic a {
          font-size: 1.125rem;
          padding: var(--space-sm) var(--space-md);
        }
        
        .container {
          padding: 0 var(--space-md);
        }
        
        .template-classic .decorative-frame,
        .template-elegant .card,
        .template-modern .card,
        .template-minimal .card {
          padding: var(--space-lg);
        }
      }

      @media (max-width: 479px) {
        .container {
          padding: 0 var(--space-sm);
        }
      }

      /* Print styles */
      @media print {
        .nav-side,
        .nav-overlay-trigger,
        .nav-overlay {
          display: none !important;
        }
        
        .main-content {
          margin-left: 0 !important;
        }
        
        * {
          color: black !important;
          background: white !important;
        }
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .card {
          border-width: 2px;
        }
        
        .btn {
          border: 2px solid;
        }
      }

      /* Reduced motion support */
      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
        
        .animate-on-scroll {
          animation: none;
          opacity: 1;
          transform: none;
        }
      }

      /* =================================
         HERO SECTION STYLES
         ================================= */
      
      .hero-section {
        position: relative;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      }

      /* Hero Background Image */
      .hero-background {
        position: absolute;
        inset: 0;
        z-index: 0;
      }

      .hero-bg-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
      }

      .hero-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, 
          rgba(0, 0, 0, 0.4) 0%, 
          rgba(0, 0, 0, 0.2) 50%, 
          rgba(0, 0, 0, 0.4) 100%);
        backdrop-filter: blur(1px);
      }

      /* Hero Content */
      .hero-content {
        position: relative;
        z-index: 10;
        text-align: center;
        width: 100%;
        max-width: 1200px;
        padding: var(--space-2xl) var(--space-lg);
      }

      .hero-text {
        max-width: 800px;
        margin: 0 auto;
      }

      /* Hero Typography */
      .hero-title {
        margin-bottom: var(--space-xl);
        line-height: 1.1;
        font-weight: 700;
      }

      .hero-subtitle {
        font-size: clamp(1.125rem, 3vw, 1.5rem);
        margin-bottom: var(--space-lg);
        opacity: 0.9;
        line-height: 1.4;
      }

      .hero-date {
        font-size: clamp(1rem, 2.5vw, 1.25rem);
        margin-bottom: var(--space-xl);
        font-weight: 500;
      }

      .hero-description {
        font-size: clamp(1rem, 2vw, 1.125rem);
        line-height: 1.6;
        margin-bottom: var(--space-2xl);
        max-width: 600px;
        margin-left: auto;
        margin-right: auto;
        opacity: 0.85;
      }

      .hero-cta {
        font-size: 1.125rem;
        padding: var(--space-lg) var(--space-2xl);
        margin-top: var(--space-xl);
        min-width: 160px;
      }

      /* =================================
         TEMPLATE-SPECIFIC HERO STYLES
         ================================= */

      /* CLASSIC HERO */
      .hero-section.template-classic {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--primary-50) 50%, 
          var(--background) 100%);
      }

      .hero-section.template-classic .hero-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(3rem, 8vw, 7rem);
        color: var(--text);
        position: relative;
      }

      .hero-section.template-classic .hero-ornament {
        font-size: 2rem;
        color: var(--accent);
        margin-bottom: var(--space-lg);
      }

      .hero-section.template-classic .hero-subtitle {
        font-family: 'Cormorant Garamond', serif;
        font-style: italic;
        color: var(--secondary);
      }

      .hero-section.template-classic .hero-date {
        color: var(--accent);
        font-family: 'Cormorant Garamond', serif;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .hero-section.template-classic .hero-description {
        color: var(--text);
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(1.125rem, 2.5vw, 1.25rem);
      }

      /* ELEGANT HERO */
      .hero-section.template-elegant {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--primary-50) 25%, 
          var(--secondary-50) 75%, 
          var(--background) 100%);
        position: relative;
      }

      .hero-section.template-elegant::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 30% 70%, var(--primary-100), transparent 50%),
                    radial-gradient(circle at 70% 30%, var(--secondary-100), transparent 50%);
        pointer-events: none;
        z-index: 1;
      }

      .hero-section.template-elegant .hero-ornament {
        font-size: 3rem;
        color: var(--accent);
        margin-bottom: var(--space-xl);
        opacity: 0.8;
        animation: float 6s ease-in-out infinite;
      }

      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-10px); }
      }

      .hero-section.template-elegant .hero-title {
        font-family: 'Playfair Display', serif;
        font-size: clamp(3.5rem, 10vw, 8rem);
        font-weight: 600;
        font-style: italic;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        line-height: 1.1;
      }

      .hero-section.template-elegant .hero-subtitle {
        font-family: 'Playfair Display', serif;
        font-style: italic;
        color: var(--secondary);
        font-weight: 400;
      }

      .hero-section.template-elegant .hero-date {
        color: var(--accent);
        font-family: 'Playfair Display', serif;
        font-style: italic;
        font-weight: 500;
      }

      .hero-section.template-elegant .hero-description {
        color: var(--text);
        font-family: 'Playfair Display', serif;
        font-style: italic;
        opacity: 0.8;
      }

      /* MODERN HERO */
      .hero-section.template-modern {
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        position: relative;
        overflow: hidden;
      }

      .hero-section.template-modern::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: 
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 20px,
            rgba(255,255,255,0.05) 20px,
            rgba(255,255,255,0.05) 40px
          );
        animation: slide 20s linear infinite;
        z-index: 1;
      }

      .hero-section.template-modern .hero-title {
        font-family: 'Space Grotesk', sans-serif;
        font-size: clamp(3rem, 12vw, 10rem);
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: -0.05em;
        color: white;
        background: linear-gradient(135deg, white, rgba(255,255,255,0.7), white);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        background-size: 200% 200%;
        animation: gradient-shift 4s ease-in-out infinite;
      }

      .hero-section.template-modern .hero-subtitle {
        color: rgba(255, 255, 255, 0.9);
        font-family: 'Space Grotesk', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        font-weight: 500;
      }

      .hero-section.template-modern .hero-date {
        color: rgba(255, 255, 255, 0.8);
        font-family: 'Space Grotesk', sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        font-weight: 600;
      }

      .hero-section.template-modern .hero-description {
        color: rgba(255, 255, 255, 0.85);
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 400;
      }

      .hero-section.template-modern .hero-accent-line {
        width: 120px;
        height: 4px;
        background: white;
        margin: var(--space-xl) auto;
        position: relative;
        overflow: hidden;
      }

      .hero-section.template-modern .hero-accent-line::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
        animation: sweep 2s ease-in-out infinite;
      }

      @keyframes sweep {
        to {
          left: 100%;
        }
      }

      /* MINIMAL HERO */
      .hero-section.template-minimal {
        background: var(--background);
        color: var(--text);
      }

      .hero-section.template-minimal .hero-title {
        font-family: 'Inter', sans-serif;
        font-size: clamp(2.5rem, 8vw, 6rem);
        font-weight: 100;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--text);
        margin-bottom: var(--space-2xl);
      }

      .hero-section.template-minimal .hero-subtitle {
        color: var(--secondary);
        font-family: 'Inter', sans-serif;
        font-weight: 300;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .hero-section.template-minimal .hero-date {
        color: var(--primary);
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      .hero-section.template-minimal .hero-description {
        color: var(--text);
        font-family: 'Inter', sans-serif;
        font-weight: 300;
        opacity: 0.7;
      }

      .hero-section.template-minimal .hero-minimal-line {
        width: 80px;
        height: 1px;
        background: var(--primary);
        margin: var(--space-2xl) auto;
        position: relative;
      }

      .hero-section.template-minimal .hero-minimal-line::before,
      .hero-section.template-minimal .hero-minimal-line::after {
        content: '';
        position: absolute;
        top: 0;
        width: 1px;
        height: 1px;
        background: var(--primary);
      }

      .hero-section.template-minimal .hero-minimal-line::before {
        left: -12px;
      }

      .hero-section.template-minimal .hero-minimal-line::after {
        right: -12px;
      }

      .hero-section.template-minimal .hero-cta {
        background: transparent;
        color: var(--primary);
        border: 1px solid var(--primary);
        font-family: 'Inter', sans-serif;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: var(--space-md) var(--space-2xl);
      }

      .hero-section.template-minimal .hero-cta:hover {
        background: var(--primary);
        color: var(--background);
      }

      /* =================================
         HERO RESPONSIVE DESIGN
         ================================= */

      @media (max-width: 768px) {
        .hero-content {
          padding: var(--space-xl) var(--space-md);
        }

        .hero-section.template-elegant .hero-ornament {
          font-size: 2rem;
        }

        .hero-section.template-modern .hero-accent-line {
          width: 80px;
          height: 3px;
        }

        .hero-section.template-minimal .hero-minimal-line {
          width: 60px;
        }
      }

      @media (max-width: 480px) {
        .hero-content {
          padding: var(--space-lg) var(--space-sm);
        }

        .hero-cta {
          font-size: 1rem;
          padding: var(--space-md) var(--space-xl);
        }
      }

      /* Hero with background image text contrast */
      .hero-section:has(.hero-background) .hero-title,
      .hero-section:has(.hero-background) .hero-subtitle,
      .hero-section:has(.hero-background) .hero-date,
      .hero-section:has(.hero-background) .hero-description {
        color: white;
        text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
      }

      .hero-section:has(.hero-background) .hero-cta {
        background: rgba(255, 255, 255, 0.9);
        color: var(--primary);
        backdrop-filter: blur(10px);
      }

      .hero-section:has(.hero-background) .hero-cta:hover {
        background: white;
        transform: translateY(-2px);
        box-shadow: var(--shadow-xl);
      }

      /* =================================
         EVENTS SECTION STYLES
         ================================= */

      .events-section {
        padding: var(--space-6xl) 0;
        position: relative;
      }

      .events-header {
        text-align: center;
        margin-bottom: var(--space-5xl);
      }

      .section-title {
        margin-bottom: var(--space-xl);
        line-height: 1.2;
      }

      .events-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: var(--space-2xl);
        margin-top: var(--space-4xl);
      }

      .event-card {
        background: var(--background);
        border-radius: var(--radius-lg);
        overflow: hidden;
        transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: var(--shadow-md);
        position: relative;
      }

      .event-card:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-xl);
      }

      .event-image {
        position: relative;
        aspect-ratio: 16/9;
        overflow: hidden;
      }

      .event-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        transition: transform var(--duration-slow);
      }

      .event-card:hover .event-img {
        transform: scale(1.05);
      }

      .event-image-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, 
          transparent 0%, 
          rgba(0, 0, 0, 0.1) 50%, 
          rgba(0, 0, 0, 0.3) 100%);
        opacity: 0;
        transition: opacity var(--duration-normal);
      }

      .event-card:hover .event-image-overlay {
        opacity: 1;
      }

      .event-content {
        padding: var(--space-xl);
      }

      .event-title {
        font-size: clamp(1.25rem, 3vw, 1.5rem);
        margin-bottom: var(--space-lg);
        line-height: 1.3;
        font-weight: 600;
      }

      .event-divider {
        text-align: center;
        font-size: 1.5rem;
        color: var(--accent);
        margin: var(--space-lg) 0;
      }

      .event-flourish {
        text-align: center;
        font-size: 1.25rem;
        color: var(--accent);
        margin: var(--space-lg) 0;
        opacity: 0.7;
      }

      .event-details {
        display: grid;
        gap: var(--space-md);
        margin-bottom: var(--space-lg);
      }

      .event-detail {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-md);
        padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--gray-200);
      }

      .event-detail:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .detail-label {
        font-weight: 500;
        color: var(--secondary);
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        flex-shrink: 0;
      }

      .detail-value {
        text-align: right;
        color: var(--text);
        font-size: 0.875rem;
        line-height: 1.4;
      }

      .event-description {
        color: var(--text);
        font-size: 0.875rem;
        line-height: 1.6;
        opacity: 0.8;
        padding-top: var(--space-md);
        border-top: 1px solid var(--gray-100);
      }

      /* =================================
         TEMPLATE-SPECIFIC EVENTS STYLES
         ================================= */

      /* CLASSIC EVENTS */
      .events-section.template-classic {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--primary-50) 50%, 
          var(--background) 100%);
      }

      .events-section.template-classic .section-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        color: var(--text);
        font-weight: 600;
      }

      .events-section.template-classic .event-card {
        position: relative;
        border: 2px solid var(--gray-200);
      }

      .events-section.template-classic .event-card::before {
        content: '';
        position: absolute;
        top: var(--space-md);
        left: var(--space-md);
        right: var(--space-md);
        bottom: var(--space-md);
        border: 1px solid var(--primary-100);
        pointer-events: none;
        transition: all var(--duration-normal);
        z-index: 1;
      }

      .events-section.template-classic .event-card:hover::before {
        border-color: var(--primary-200);
      }

      .events-section.template-classic .event-title {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 600;
        color: var(--text);
      }

      .events-section.template-classic .detail-label {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 500;
      }

      /* ELEGANT EVENTS */
      .events-section.template-elegant {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--primary-50) 25%, 
          var(--secondary-50) 75%, 
          var(--background) 100%);
        position: relative;
      }

      .events-section.template-elegant::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 30% 70%, var(--primary-100), transparent 50%),
                    radial-gradient(circle at 70% 30%, var(--secondary-100), transparent 50%);
        pointer-events: none;
      }

      .events-section.template-elegant .section-title {
        font-family: 'Playfair Display', serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        font-weight: 500;
        font-style: italic;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .events-section.template-elegant .event-card {
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: var(--radius-xl);
      }

      .events-section.template-elegant .event-card:hover {
        background: rgba(255, 255, 255, 0.9);
      }

      .events-section.template-elegant .event-title {
        font-family: 'Playfair Display', serif;
        font-weight: 500;
        font-style: italic;
        color: var(--text);
      }

      .events-section.template-elegant .detail-label {
        font-family: 'Playfair Display', serif;
        font-style: italic;
      }

      /* MODERN EVENTS */
      .events-section.template-modern {
        background: linear-gradient(135deg, var(--gray-100), var(--gray-50));
        position: relative;
      }

      .events-section.template-modern .section-title {
        font-family: 'Space Grotesk', sans-serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: -0.02em;
        background: linear-gradient(135deg, var(--primary), var(--secondary), var(--accent));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .events-section.template-modern .event-card {
        border-radius: 0;
        border: 2px solid var(--gray-900);
        box-shadow: 
          8px 8px 0 var(--primary-100),
          16px 16px 0 var(--primary-50);
        transition: all var(--duration-normal);
      }

      .events-section.template-modern .event-card:hover {
        transform: translate(-4px, -8px);
        box-shadow: 
          12px 16px 0 var(--primary-100),
          20px 24px 0 var(--primary-50);
      }

      .events-section.template-modern .event-title {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: -0.01em;
        color: var(--text);
      }

      .events-section.template-modern .detail-label {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      /* MINIMAL EVENTS */
      .events-section.template-minimal {
        background: var(--background);
      }

      .events-section.template-minimal .section-title {
        font-family: 'Inter', sans-serif;
        font-size: clamp(2rem, 5vw, 3rem);
        font-weight: 200;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--text);
      }

      .events-section.template-minimal .event-card {
        border: 1px solid var(--gray-200);
        border-radius: 0;
        box-shadow: none;
        transition: all var(--duration-normal);
      }

      .events-section.template-minimal .event-card:hover {
        border-color: var(--primary);
        box-shadow: 0 0 0 1px var(--primary);
        transform: translateY(-2px);
      }

      .events-section.template-minimal .event-title {
        font-family: 'Inter', sans-serif;
        font-weight: 300;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text);
      }

      .events-section.template-minimal .detail-label {
        font-family: 'Inter', sans-serif;
        font-weight: 400;
        text-transform: uppercase;
        letter-spacing: 0.1em;
      }

      /* =================================
         EVENTS RESPONSIVE DESIGN
         ================================= */

      @media (max-width: 768px) {
        .events-section {
          padding: var(--space-4xl) 0;
        }

        .events-grid {
          grid-template-columns: 1fr;
          gap: var(--space-xl);
        }

        .event-content {
          padding: var(--space-lg);
        }

        .event-detail {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-xs);
        }

        .detail-value {
          text-align: left;
        }
      }

      @media (max-width: 480px) {
        .events-header {
          margin-bottom: var(--space-3xl);
        }

        .events-grid {
          gap: var(--space-lg);
        }

        .event-content {
          padding: var(--space-md);
        }
      }

      /* =================================
         ACCOMMODATIONS SECTION STYLES
         ================================= */

      .accommodations-section {
        padding: var(--space-6xl) 0;
        position: relative;
      }

      .accommodations-header {
        text-align: center;
        margin-bottom: var(--space-5xl);
      }

      .accommodations-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
        gap: var(--space-2xl);
        margin-top: var(--space-4xl);
      }

      .accommodation-card {
        background: var(--background);
        border-radius: var(--radius-lg);
        overflow: hidden;
        transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: var(--shadow-md);
        position: relative;
      }

      .accommodation-card:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-xl);
      }

      .accommodation-image {
        position: relative;
        aspect-ratio: 4/3;
        overflow: hidden;
      }

      .accommodation-img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        transition: transform var(--duration-slow);
      }

      .accommodation-card:hover .accommodation-img {
        transform: scale(1.05);
      }

      .accommodation-image-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, 
          transparent 0%, 
          rgba(0, 0, 0, 0.1) 50%, 
          rgba(0, 0, 0, 0.3) 100%);
        display: flex;
        align-items: flex-end;
        padding: var(--space-md);
      }

      .accommodation-type-badge {
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        color: var(--primary);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        padding: var(--space-xs) var(--space-md);
        border-radius: var(--radius-full);
        box-shadow: var(--shadow-sm);
      }

      .accommodation-content {
        padding: var(--space-xl);
      }

      .accommodation-title {
        font-size: clamp(1.25rem, 3vw, 1.5rem);
        margin-bottom: var(--space-lg);
        line-height: 1.3;
        font-weight: 600;
      }

      .accommodation-divider {
        text-align: center;
        font-size: 1.5rem;
        color: var(--accent);
        margin: var(--space-lg) 0;
      }

      .accommodation-flourish {
        text-align: center;
        font-size: 1.25rem;
        color: var(--accent);
        margin: var(--space-lg) 0;
        opacity: 0.7;
      }

      .accommodation-details {
        display: grid;
        gap: var(--space-md);
        margin-bottom: var(--space-lg);
      }

      .accommodation-detail {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: var(--space-md);
        padding-bottom: var(--space-sm);
        border-bottom: 1px solid var(--gray-200);
      }

      .accommodation-detail:last-child {
        border-bottom: none;
        padding-bottom: 0;
      }

      .accommodation-description {
        color: var(--text);
        font-size: 0.875rem;
        line-height: 1.6;
        opacity: 0.8;
        padding-top: var(--space-md);
        border-top: 1px solid var(--gray-100);
        margin-bottom: var(--space-lg);
      }

      .accommodation-actions {
        display: flex;
        justify-content: center;
      }

      .accommodation-cta {
        padding: var(--space-md) var(--space-xl);
        font-size: 0.875rem;
        font-weight: 600;
      }

      /* =================================
         TEMPLATE-SPECIFIC ACCOMMODATIONS STYLES
         ================================= */

      /* CLASSIC ACCOMMODATIONS */
      .accommodations-section.template-classic {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--secondary-50) 50%, 
          var(--background) 100%);
      }

      .accommodations-section.template-classic .section-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        color: var(--text);
        font-weight: 600;
      }

      .accommodations-section.template-classic .accommodation-card {
        position: relative;
        border: 2px solid var(--gray-200);
      }

      .accommodations-section.template-classic .accommodation-card::before {
        content: '';
        position: absolute;
        top: var(--space-md);
        left: var(--space-md);
        right: var(--space-md);
        bottom: var(--space-md);
        border: 1px solid var(--secondary-100);
        pointer-events: none;
        transition: all var(--duration-normal);
        z-index: 1;
      }

      .accommodations-section.template-classic .accommodation-card:hover::before {
        border-color: var(--secondary-200);
      }

      .accommodations-section.template-classic .accommodation-title {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 600;
        color: var(--text);
      }

      /* ELEGANT ACCOMMODATIONS */
      .accommodations-section.template-elegant {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--secondary-50) 25%, 
          var(--primary-50) 75%, 
          var(--background) 100%);
        position: relative;
      }

      .accommodations-section.template-elegant::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 70% 30%, var(--secondary-100), transparent 50%),
                    radial-gradient(circle at 30% 70%, var(--primary-100), transparent 50%);
        pointer-events: none;
      }

      .accommodations-section.template-elegant .section-title {
        font-family: 'Playfair Display', serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        font-weight: 500;
        font-style: italic;
        background: linear-gradient(135deg, var(--secondary), var(--primary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .accommodations-section.template-elegant .accommodation-card {
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: var(--radius-xl);
      }

      .accommodations-section.template-elegant .accommodation-card:hover {
        background: rgba(255, 255, 255, 0.9);
      }

      .accommodations-section.template-elegant .accommodation-title {
        font-family: 'Playfair Display', serif;
        font-weight: 500;
        font-style: italic;
        color: var(--text);
      }

      /* MODERN ACCOMMODATIONS */
      .accommodations-section.template-modern {
        background: linear-gradient(135deg, var(--gray-100), var(--gray-50));
        position: relative;
      }

      .accommodations-section.template-modern .section-title {
        font-family: 'Space Grotesk', sans-serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: -0.02em;
        background: linear-gradient(135deg, var(--secondary), var(--primary), var(--accent));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .accommodations-section.template-modern .accommodation-card {
        border-radius: 0;
        border: 2px solid var(--gray-900);
        box-shadow: 
          8px 8px 0 var(--secondary-100),
          16px 16px 0 var(--secondary-50);
        transition: all var(--duration-normal);
      }

      .accommodations-section.template-modern .accommodation-card:hover {
        transform: translate(-4px, -8px);
        box-shadow: 
          12px 16px 0 var(--secondary-100),
          20px 24px 0 var(--secondary-50);
      }

      .accommodations-section.template-modern .accommodation-title {
        font-family: 'Space Grotesk', sans-serif;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: -0.01em;
        color: var(--text);
      }

      /* MINIMAL ACCOMMODATIONS */
      .accommodations-section.template-minimal {
        background: var(--background);
      }

      .accommodations-section.template-minimal .section-title {
        font-family: 'Inter', sans-serif;
        font-size: clamp(2rem, 5vw, 3rem);
        font-weight: 200;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--text);
      }

      .accommodations-section.template-minimal .accommodation-card {
        border: 1px solid var(--gray-200);
        border-radius: 0;
        box-shadow: none;
        transition: all var(--duration-normal);
      }

      .accommodations-section.template-minimal .accommodation-card:hover {
        border-color: var(--secondary);
        box-shadow: 0 0 0 1px var(--secondary);
        transform: translateY(-2px);
      }

      .accommodations-section.template-minimal .accommodation-title {
        font-family: 'Inter', sans-serif;
        font-weight: 300;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--text);
      }

      /* =================================
         ACCOMMODATIONS RESPONSIVE DESIGN
         ================================= */

      @media (max-width: 768px) {
        .accommodations-section {
          padding: var(--space-4xl) 0;
        }

        .accommodations-grid {
          grid-template-columns: 1fr;
          gap: var(--space-xl);
        }

        .accommodation-content {
          padding: var(--space-lg);
        }

        .accommodation-detail {
          flex-direction: column;
          align-items: flex-start;
          gap: var(--space-xs);
        }

        .detail-value {
          text-align: left;
        }
      }

      @media (max-width: 480px) {
        .accommodations-header {
          margin-bottom: var(--space-3xl);
        }

        .accommodations-grid {
          gap: var(--space-lg);
        }

        .accommodation-content {
          padding: var(--space-md);
        }
      }

      /* =================================
         STORY SECTION STYLES
         ================================= */

      .story-section {
        padding: var(--space-6xl) 0;
        position: relative;
      }

      .story-header {
        text-align: center;
        margin-bottom: var(--space-5xl);
      }

      .story-content {
        max-width: 800px;
        margin: 0 auto;
      }

      .story-text {
        font-size: clamp(1.125rem, 2.5vw, 1.375rem);
        line-height: 1.8;
        text-align: center;
        white-space: pre-line;
        color: var(--text);
        opacity: 0.9;
      }

      /* =================================
         TEMPLATE-SPECIFIC STORY STYLES
         ================================= */

      /* CLASSIC STORY */
      .story-section.template-classic {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--primary-50) 50%, 
          var(--background) 100%);
        position: relative;
      }

      .story-section.template-classic::before {
        content: '';
        position: absolute;
        inset: 0;
        background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="classic-pattern" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="10" cy="10" r="1" fill="currentColor" opacity="0.05"/></pattern></defs><rect width="100" height="100" fill="url(%23classic-pattern)"/></svg>') repeat;
        opacity: 0.3;
        pointer-events: none;
      }

      .story-section.template-classic .section-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        color: var(--text);
        font-weight: 600;
        position: relative;
      }

      .story-section.template-classic .story-content {
        position: relative;
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(10px);
        padding: var(--space-3xl);
        border: 2px solid var(--gray-200);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-lg);
      }

      .story-section.template-classic .story-content::before {
        content: '';
        position: absolute;
        top: var(--space-lg);
        left: var(--space-lg);
        right: var(--space-lg);
        bottom: var(--space-lg);
        border: 1px solid var(--accent-100);
        pointer-events: none;
        border-radius: var(--radius-md);
      }

      .story-section.template-classic .story-text {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(1.25rem, 3vw, 1.5rem);
        font-style: italic;
        color: var(--text);
        position: relative;
        z-index: 1;
      }

      .story-section.template-classic .story-text::before,
      .story-section.template-classic .story-text::after {
        content: '"';
        font-size: 3rem;
        color: var(--accent);
        font-family: 'Cormorant Garamond', serif;
        position: absolute;
        line-height: 1;
        opacity: 0.6;
      }

      .story-section.template-classic .story-text::before {
        top: -1rem;
        left: -1rem;
      }

      .story-section.template-classic .story-text::after {
        bottom: -2rem;
        right: -1rem;
        transform: scaleX(-1);
      }

      /* ELEGANT STORY */
      .story-section.template-elegant {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--primary-50) 25%, 
          var(--secondary-50) 75%, 
          var(--background) 100%);
        position: relative;
      }

      .story-section.template-elegant::before {
        content: '';
        position: absolute;
        inset: 0;
        background: radial-gradient(circle at 40% 60%, var(--primary-100), transparent 50%),
                    radial-gradient(circle at 60% 40%, var(--secondary-100), transparent 50%);
        pointer-events: none;
      }

      .story-section.template-elegant .section-title {
        font-family: 'Playfair Display', serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        font-weight: 500;
        font-style: italic;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .story-section.template-elegant .story-content {
        background: rgba(255, 255, 255, 0.8);
        backdrop-filter: blur(15px);
        padding: var(--space-3xl);
        border-radius: var(--radius-2xl);
        border: 1px solid rgba(255, 255, 255, 0.3);
        box-shadow: var(--shadow-2xl);
      }

      .story-section.template-elegant .story-text {
        font-family: 'Playfair Display', serif;
        font-size: clamp(1.25rem, 3vw, 1.5rem);
        font-style: italic;
        color: var(--text);
        font-weight: 400;
      }

      /* MODERN STORY */
      .story-section.template-modern {
        background: linear-gradient(135deg, var(--gray-100), var(--gray-50));
        position: relative;
        overflow: hidden;
      }

      .story-section.template-modern::before {
        content: '';
        position: absolute;
        top: -50%;
        left: -50%;
        width: 200%;
        height: 200%;
        background: 
          repeating-linear-gradient(
            45deg,
            transparent,
            transparent 40px,
            rgba(0,0,0,0.02) 40px,
            rgba(0,0,0,0.02) 80px
          );
        animation: slide 30s linear infinite;
      }

      .story-section.template-modern .section-title {
        font-family: 'Space Grotesk', sans-serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: -0.02em;
        background: linear-gradient(135deg, var(--primary), var(--secondary), var(--accent));
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }

      .story-section.template-modern .story-content {
        background: var(--background);
        padding: var(--space-3xl);
        border: 2px solid var(--gray-900);
        box-shadow: 
          12px 12px 0 var(--primary-100),
          24px 24px 0 var(--primary-50);
        position: relative;
        z-index: 1;
      }

      .story-section.template-modern .story-text {
        font-family: 'Space Grotesk', sans-serif;
        font-size: clamp(1.125rem, 2.5vw, 1.25rem);
        font-weight: 400;
        color: var(--text);
        line-height: 1.7;
      }

      /* MINIMAL STORY */
      .story-section.template-minimal {
        background: var(--background);
        padding: var(--space-6xl) 0;
      }

      .story-section.template-minimal .section-title {
        font-family: 'Inter', sans-serif;
        font-size: clamp(2rem, 5vw, 3rem);
        font-weight: 200;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        color: var(--text);
      }

      .story-section.template-minimal .story-content {
        padding: var(--space-2xl) 0;
        border-top: 1px solid var(--gray-200);
        border-bottom: 1px solid var(--gray-200);
        margin: var(--space-4xl) 0;
      }

      .story-section.template-minimal .story-text {
        font-family: 'Inter', sans-serif;
        font-size: clamp(1.125rem, 2.5vw, 1.25rem);
        font-weight: 300;
        color: var(--text);
        line-height: 1.8;
        opacity: 0.8;
      }

      /* =================================
         STORY RESPONSIVE DESIGN
         ================================= */

      @media (max-width: 768px) {
        .story-section {
          padding: var(--space-4xl) 0;
        }

        .story-content {
          padding: var(--space-xl);
        }

        .story-section.template-classic .story-content {
          padding: var(--space-xl);
        }

        .story-section.template-modern .story-content {
          padding: var(--space-xl);
          box-shadow: 
            8px 8px 0 var(--primary-100),
            16px 16px 0 var(--primary-50);
        }
      }

      @media (max-width: 480px) {
        .story-section {
          padding: var(--space-3xl) 0;
        }

        .story-content {
          padding: var(--space-lg);
        }
      }

      /* =================================
         REGISTRY SECTION STYLES
         ================================= */

      .registry-section {
        padding: var(--space-6xl) 0;
        position: relative;
      }

      .registry-header {
        text-align: center;
        margin-bottom: var(--space-5xl);
      }

      .registry-content {
        max-width: 600px;
        margin: 0 auto;
        text-align: center;
      }

      .registry-message {
        font-size: clamp(1.125rem, 2.5vw, 1.375rem);
        line-height: 1.7;
        margin-bottom: var(--space-4xl);
        color: var(--text);
        opacity: 0.9;
      }

      .registry-links {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-lg);
        justify-content: center;
      }

      .registry-link {
        display: inline-flex;
        align-items: center;
        gap: var(--space-md);
        padding: var(--space-lg) var(--space-2xl);
        text-decoration: none;
        border-radius: var(--radius-lg);
        transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
        font-weight: 500;
        position: relative;
        overflow: hidden;
      }

      .registry-store-name {
        font-size: 1rem;
        color: inherit;
      }

      .registry-link-icon {
        font-size: 1.125rem;
        transition: transform var(--duration-normal);
      }

      .registry-link:hover .registry-link-icon {
        transform: translateX(4px);
      }

      /* Template-specific Registry styles */
      .registry-section.template-classic {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--secondary-50) 50%, 
          var(--background) 100%);
      }

      .registry-section.template-classic .section-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        color: var(--text);
        font-weight: 600;
      }

      .registry-section.template-classic .registry-message {
        font-family: 'Cormorant Garamond', serif;
        font-style: italic;
      }

      .registry-section.template-classic .registry-link {
        background: var(--background);
        color: var(--primary);
        border: 2px solid var(--primary);
        box-shadow: var(--shadow-md);
      }

      .registry-section.template-classic .registry-link:hover {
        background: var(--primary);
        color: var(--background);
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
      }

      /* =================================
         RSVP SECTION STYLES
         ================================= */

      .rsvp-section {
        padding: var(--space-6xl) 0;
        position: relative;
      }

      .rsvp-header {
        text-align: center;
        margin-bottom: var(--space-5xl);
      }

      .rsvp-content {
        max-width: 600px;
        margin: 0 auto;
        text-align: center;
      }

      .rsvp-message {
        font-size: clamp(1.125rem, 2.5vw, 1.375rem);
        line-height: 1.7;
        margin-bottom: var(--space-4xl);
        color: var(--text);
        opacity: 0.9;
      }

      .rsvp-actions {
        display: flex;
        justify-content: center;
      }

      .rsvp-cta {
        font-size: 1.125rem;
        padding: var(--space-lg) var(--space-3xl);
        min-width: 200px;
      }

      /* Template-specific RSVP styles */
      .rsvp-section.template-classic {
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white;
      }

      .rsvp-section.template-classic .section-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        color: white;
        font-weight: 600;
      }

      .rsvp-section.template-classic .rsvp-message {
        font-family: 'Cormorant Garamond', serif;
        color: white;
        opacity: 0.95;
      }

      .rsvp-section.template-classic .ornamental-divider span {
        color: var(--accent);
      }

      .rsvp-section.template-classic .rsvp-cta {
        background: white;
        color: var(--primary);
        border: 2px solid white;
      }

      .rsvp-section.template-classic .rsvp-cta:hover {
        background: transparent;
        color: white;
        border-color: white;
        transform: translateY(-2px);
      }

      /* =================================
         CONTACT SECTION STYLES
         ================================= */

      .contact-section {
        padding: var(--space-6xl) 0;
        position: relative;
      }

      .contact-header {
        text-align: center;
        margin-bottom: var(--space-5xl);
      }

      .contact-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--space-2xl);
        margin-top: var(--space-4xl);
      }

      .contact-card {
        background: var(--background);
        border-radius: var(--radius-lg);
        padding: var(--space-2xl);
        text-align: center;
        transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: var(--shadow-md);
        position: relative;
      }

      .contact-card:hover {
        transform: translateY(-4px);
        box-shadow: var(--shadow-xl);
      }

      .contact-name {
        font-size: clamp(1.25rem, 3vw, 1.5rem);
        font-weight: 600;
        margin-bottom: var(--space-sm);
        color: var(--text);
      }

      .contact-role {
        font-size: 0.875rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--secondary);
        margin-bottom: var(--space-lg);
        font-weight: 500;
      }

      .contact-details {
        display: grid;
        gap: var(--space-md);
      }

      .contact-detail {
        display: flex;
        flex-direction: column;
        gap: var(--space-xs);
      }

      .contact-label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--accent);
        font-weight: 600;
      }

      .contact-link {
        color: var(--text);
        text-decoration: none;
        font-size: 0.875rem;
        transition: color var(--duration-normal);
      }

      .contact-link:hover {
        color: var(--primary);
      }

      /* Template-specific Contact styles */
      .contact-section.template-classic {
        background: linear-gradient(135deg, 
          var(--background) 0%, 
          var(--accent-50) 50%, 
          var(--background) 100%);
      }

      .contact-section.template-classic .section-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: clamp(2.5rem, 6vw, 4rem);
        color: var(--text);
        font-weight: 600;
      }

      .contact-section.template-classic .contact-card {
        border: 2px solid var(--gray-200);
        position: relative;
      }

      .contact-section.template-classic .contact-card::before {
        content: '';
        position: absolute;
        top: var(--space-md);
        left: var(--space-md);
        right: var(--space-md);
        bottom: var(--space-md);
        border: 1px solid var(--accent-100);
        pointer-events: none;
        border-radius: var(--radius-md);
        transition: all var(--duration-normal);
      }

      .contact-section.template-classic .contact-card:hover::before {
        border-color: var(--accent-200);
      }

      .contact-section.template-classic .contact-name {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 600;
      }

      /* =================================
         RESPONSIVE DESIGN FOR NEW SECTIONS
         ================================= */

      @media (max-width: 768px) {
        .registry-section,
        .rsvp-section,
        .contact-section {
          padding: var(--space-4xl) 0;
        }

        .registry-links {
          flex-direction: column;
          align-items: center;
        }

        .registry-link {
          width: 100%;
          max-width: 300px;
          justify-content: center;
        }

        .contact-grid {
          grid-template-columns: 1fr;
          gap: var(--space-xl);
        }
      }

      @media (max-width: 480px) {
        .registry-content,
        .rsvp-content {
          padding: 0 var(--space-md);
        }

        .contact-card {
          padding: var(--space-xl);
        }
      }

      /* =================================
         FOOTER SECTION STYLES
         ================================= */
      
      .footer-section {
        background: linear-gradient(135deg, 
          var(--primary) 0%, 
          var(--secondary) 100%);
        color: white;
        margin-top: var(--space-4xl);
      }

      .footer-section .couple-name {
        font-size: 1.125rem;
        font-weight: 500;
        opacity: 0.95;
        margin: 0;
        letter-spacing: 0.025em;
      }

      /* =================================
         TEMPLATE-SPECIFIC FOOTER STYLES
         ================================= */

      /* CLASSIC FOOTER */
      .footer-section.template-classic {
        background: linear-gradient(135deg, 
          var(--primary) 0%, 
          var(--secondary) 50%, 
          var(--primary) 100%);
        position: relative;
      }

      .footer-section.template-classic::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 1px;
        background: linear-gradient(90deg, 
          transparent 0%, 
          rgba(255,255,255,0.3) 50%, 
          transparent 100%);
      }

      .footer-section.template-classic .couple-name {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.25rem;
        font-weight: 600;
        position: relative;
      }

      .footer-section.template-classic .couple-name::before,
      .footer-section.template-classic .couple-name::after {
        content: '♥';
        position: absolute;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.75rem;
        opacity: 0.6;
      }

      .footer-section.template-classic .couple-name::before {
        left: -2rem;
      }

      .footer-section.template-classic .couple-name::after {
        right: -2rem;
      }

      /* MODERN FOOTER */
      .footer-section.template-modern {
        background: var(--primary);
        border-top: 3px solid var(--accent);
      }

      .footer-section.template-modern .couple-name {
        font-weight: 300;
        font-size: 1rem;
        text-transform: uppercase;
        letter-spacing: 0.15em;
      }

      /* ELEGANT FOOTER */
      .footer-section.template-elegant {
        background: linear-gradient(135deg, 
          rgba(0,0,0,0.8) 0%, 
          rgba(0,0,0,0.9) 100%);
        position: relative;
      }

      .footer-section.template-elegant::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 100px;
        height: 1px;
        background: linear-gradient(90deg, 
          transparent 0%, 
          var(--accent) 50%, 
          transparent 100%);
      }

      .footer-section.template-elegant .couple-name {
        font-family: 'Playfair Display', serif;
        font-size: 1.1rem;
        font-weight: 400;
        font-style: italic;
        position: relative;
        color: var(--accent);
      }

      .footer-section.template-elegant .couple-name::before {
        content: '✦';
        position: absolute;
        left: -1.5rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.8rem;
        opacity: 0.7;
      }

      .footer-section.template-elegant .couple-name::after {
        content: '✦';
        position: absolute;
        right: -1.5rem;
        top: 50%;
        transform: translateY(-50%);
        font-size: 0.8rem;
        opacity: 0.7;
      }

      /* MINIMAL FOOTER */
      .footer-section.template-minimal {
        background: var(--background);
        color: var(--text);
        border-top: 1px solid var(--gray-200);
      }

      .footer-section.template-minimal .couple-name {
        font-size: 0.95rem;
        font-weight: 400;
        color: var(--text);
        opacity: 0.8;
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .footer-section.template-classic .couple-name::before,
        .footer-section.template-classic .couple-name::after,
        .footer-section.template-elegant .couple-name::before,
        .footer-section.template-elegant .couple-name::after {
          display: none;
        }
        
        .footer-section .couple-name {
          font-size: 1rem;
        }
      }
      
      /* =================================
         RSVP FORM STYLES
         ================================= */
      
      /* RSVP Form - Classic Template Integration */
      .template-classic .rsvp-message {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.25rem;
        font-style: italic;
        text-align: center;
        color: var(--text);
        margin-bottom: var(--space-xl);
        padding: 0 var(--space-lg);
      }
      
      .template-classic .rsvp-form {
        background: var(--background);
        border: 2px solid var(--secondary);
        border-radius: var(--radius-lg);
        padding: var(--space-2xl);
        margin: 0 auto;
        position: relative;
        box-shadow: var(--shadow-lg);
      }
      
      .template-classic .rsvp-form::before {
        content: '';
        position: absolute;
        top: var(--space-md);
        left: var(--space-md);
        right: var(--space-md);
        bottom: var(--space-md);
        border: 1px solid var(--primary-100);
        border-radius: var(--radius-md);
        pointer-events: none;
      }
      
      .template-classic .rsvp-form label {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 600;
        color: var(--text);
        display: block;
        margin-bottom: var(--space-sm);
        font-size: 1.1rem;
      }
      
      .template-classic .rsvp-input {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1rem;
        border: 2px solid var(--gray-200);
        border-radius: var(--radius-md);
        padding: var(--space-md) var(--space-lg);
        font-display: swap;
        background: var(--background);
        color: var(--text);
        transition: all var(--duration-normal);
        width: 100%;
      }
      
      .template-classic .rsvp-input:focus {
        border-color: var(--primary);
        outline: none;
        box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.1);
      }
      
      .template-classic .rsvp-input::placeholder {
        color: var(--gray-400);
        font-style: italic;
      }
      
      /* Force font consistency for all input elements in classic template */
      .template-classic input,
      .template-classic textarea,
      .template-classic select {
        font-family: 'Times New Roman', serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }
      
      /* Ensure labels and text maintain consistent fonts */
      .template-classic label,
      .template-classic .rsvp-form * {
        font-family: 'Cormorant Garamond', serif;
        font-display: swap;
      }
      
      /* RSVP Status Cards */
      .template-classic .rsvp-status-options {
        display: flex;
        flex-direction: column;
        gap: var(--space-md);
      }
      
      @media (min-width: 768px) {
        .template-classic .rsvp-status-options {
          flex-direction: row;
        }
      }
      
      .template-classic .rsvp-status-option {
        flex: 1;
      }
      
      .template-classic .status-card {
        background: var(--background);
        border: 2px solid var(--gray-200);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        text-align: center;
        cursor: pointer;
        transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        min-height: 120px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      
      .template-classic .status-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        opacity: 0;
        transition: opacity var(--duration-normal);
        border-radius: var(--radius-lg);
      }
      
      .template-classic .status-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-lg);
        border-color: var(--primary);
      }
      
      .template-classic .status-card:hover::before {
        opacity: 0.05;
      }
      
      .template-classic .rsvp-status-option input:checked + .status-card {
        border-color: var(--primary);
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white;
        transform: translateY(-2px);
        box-shadow: var(--shadow-xl);
      }
      
      .template-classic .rsvp-status-option input:checked + .status-card .status-card-emoji {
        transform: scale(1.1);
      }
      
      .template-classic .status-card-emoji {
        font-size: 2.5rem;
        margin-bottom: var(--space-sm);
        transition: transform var(--duration-normal);
      }
      
      .template-classic .status-card-label {
        font-family: 'Cormorant Garamond', serif;
        font-weight: 600;
        font-size: 1.1rem;
        position: relative;
        z-index: 1;
      }
      
      /* RSVP Submit Button */
      .template-classic .rsvp-submit-btn {
        background: linear-gradient(135deg, var(--primary), var(--secondary));
        color: white;
        border: none;
        border-radius: var(--radius-lg);
        padding: var(--space-lg) var(--space-2xl);
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.2rem;
        font-weight: 600;
        min-width: 200px;
        min-height: 56px;
        cursor: pointer;
        transition: all var(--duration-normal) cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }
      
      .template-classic .rsvp-submit-btn::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        transition: left 0.6s ease;
      }
      
      .template-classic .rsvp-submit-btn:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: var(--shadow-xl);
      }
      
      .template-classic .rsvp-submit-btn:hover:not(:disabled)::before {
        left: 100%;
      }
      
      .template-classic .rsvp-submit-btn:active:not(:disabled) {
        transform: translateY(0);
      }
      
      .template-classic .rsvp-submit-btn:disabled {
        opacity: 0.7;
        cursor: not-allowed;
        transform: none !important;
      }
      
      /* RSVP Success State */
      .template-classic .rsvp-success {
        text-align: center;
        background: linear-gradient(135deg, var(--primary-50), var(--secondary-50));
        border: 2px solid var(--primary);
        border-radius: var(--radius-xl);
        padding: var(--space-2xl);
        position: relative;
      }
      
      .template-classic .rsvp-success::before {
        content: '';
        position: absolute;
        top: var(--space-md);
        left: var(--space-md);
        right: var(--space-md);
        bottom: var(--space-md);
        border: 1px solid var(--primary-200);
        border-radius: var(--radius-lg);
        pointer-events: none;
      }
      
      .template-classic .rsvp-success-icon {
        font-size: 3rem;
        margin-bottom: var(--space-lg);
        color: var(--primary);
      }
      
      .template-classic .rsvp-success-title {
        font-family: 'Cormorant Garamond', serif;
        font-size: 2rem;
        font-weight: 700;
        color: var(--primary);
        margin-bottom: var(--space-md);
      }
      
      .template-classic .rsvp-success-message {
        font-family: 'Cormorant Garamond', serif;
        font-size: 1.2rem;
        font-style: italic;
        color: var(--text);
        line-height: 1.6;
      }
      
      /* RSVP Event Options */
      .template-classic .rsvp-event-option {
        background: var(--background);
        border: 2px solid var(--gray-200);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        transition: all var(--duration-normal);
      }
      
      .template-classic .rsvp-event-option:hover {
        border-color: var(--primary);
        box-shadow: 0 0 0 1px var(--primary-100);
      }
      
      .template-classic .rsvp-checkbox {
        width: 20px;
        height: 20px;
        border: 2px solid var(--gray-300);
        border-radius: 4px;
        cursor: pointer;
        transition: all var(--duration-normal);
        accent-color: var(--primary);
      }
      
      .template-classic .rsvp-checkbox:checked {
        border-color: var(--primary);
        background-color: var(--primary);
      }
      
      .template-classic .rsvp-checkbox:hover {
        border-color: var(--primary);
      }
      
      .template-classic .rsvp-none-option {
        background: linear-gradient(135deg, var(--gray-50), var(--gray-100));
        border: 2px solid var(--gray-200);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        transition: all var(--duration-normal);
      }
      
      .template-classic .rsvp-none-option:hover {
        border-color: var(--gray-400);
        background: linear-gradient(135deg, var(--gray-100), var(--gray-200));
      }
      
      .template-classic .rsvp-none-option input:checked + label {
        color: var(--text);
        font-weight: 600;
      }
      
      /* Responsive adjustments for RSVP */
      @media (max-width: 768px) {
        .template-classic .rsvp-form {
          padding: var(--space-xl);
          margin: 0 var(--space-md);
        }
        
        .template-classic .rsvp-status-options {
          flex-direction: column;
        }
        
        .template-classic .status-card {
          min-height: 100px;
        }
        
        .template-classic .status-card-emoji {
          font-size: 2rem;
        }
        
        .template-classic .rsvp-submit-btn {
          width: 100%;
          padding: var(--space-lg) var(--space-xl);
          font-size: 1.1rem;
        }
        
        .template-classic .rsvp-event-option,
        .template-classic .rsvp-none-option {
          padding: var(--space-md);
        }
      }
    `}</style>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const navItems = [
    { id: 'hero', label: 'Home', enabled: settings.sections.hero },
    { id: 'story', label: 'Our Story', enabled: settings.sections.story },
    { id: 'events', label: 'Events', enabled: settings.sections.events },
    { id: 'accommodations', label: 'Stay', enabled: settings.sections.accommodations },
    { id: 'registry', label: 'Registry', enabled: settings.sections.registry },
    { id: 'rsvp', label: 'RSVP', enabled: settings.sections.rsvp },
    { id: 'contact', label: 'Contact', enabled: settings.sections.contact }
  ].filter(item => item.enabled);

  return (
    <>
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300..700;1,300..700&display=swap" rel="stylesheet" />
      </Head>
      <CustomStyles />
      <div className={`wedding-bg wedding-text min-h-screen template-${settings.layout.template}`}>
        {/* Navigation */}
        {settings.layout.navigation === 'top' && (
          <nav className={`fixed top-0 left-0 right-0 z-50 nav-top template-${settings.layout.template}`}>
            <div className="max-w-7xl mx-auto px-8">
              <div className="flex items-center justify-between h-24">
                {/* Logo Section */}
                <div className="flex items-center">
                  {settings.branding.logo ? (
                    <div className="logo-circle">
                      <img 
                        src={settings.branding.logo} 
                        alt={`${settings.branding.coupleName} Wedding`} 
                        className="brand-logo"
                      />
                    </div>
                  ) : (
                    <div className="brand-monogram-circle">
                      <span className="initials">{settings.branding.coupleName.split('&')[0]?.trim()?.charAt(0) || 'W'}</span>
                      <span className="ampersand">&</span>
                      <span className="initials">{settings.branding.coupleName.split('&')[1]?.trim()?.charAt(0) || 'E'}</span>
                    </div>
                  )}
                </div>

                {/* Desktop Navigation Links */}
                <div className="hidden lg:flex items-center nav-menu">
                  {navItems.map((item, index) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="nav-link"
                      style={{ '--delay': `${index * 0.1}s` } as React.CSSProperties}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>

                {/* Mobile Menu Button */}
                <div className="lg:hidden">
                  <button className="mobile-menu-btn" aria-label="Open menu">
                    <div className="hamburger">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </nav>
        )}

        {settings.layout.navigation === 'side' && (
          <nav className={`nav-side template-${settings.layout.template}`}>
            <div className="text-white text-base font-semibold mb-8 transform -rotate-90 whitespace-nowrap">
              {settings.branding.coupleName.split('&')[0]?.trim()?.charAt(0) || 'J'}
              &
              {settings.branding.coupleName.split('&')[1]?.trim()?.charAt(0) || 'J'}
            </div>
            <div className="flex flex-col space-y-6">
              {navItems.map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  className="text-white hover:text-gray-200 text-sm font-medium text-center py-3 px-2 transition-colors duration-300 transform -rotate-90 whitespace-nowrap hover:bg-white hover:bg-opacity-10 rounded"
                  title={item.label}
                >
                  {item.label.charAt(0)}
                </a>
              ))}
            </div>
          </nav>
        )}

        {settings.layout.navigation === 'overlay' && (
          <>
            <button 
              className={`nav-overlay-trigger template-${settings.layout.template}`}
              onClick={() => setOverlayOpen(true)}
            >
              <div className="flex flex-col space-y-1.5">
                <div className="w-7 h-0.5 bg-white transition-all duration-300"></div>
                <div className="w-7 h-0.5 bg-white transition-all duration-300"></div>
                <div className="w-7 h-0.5 bg-white transition-all duration-300"></div>
              </div>
            </button>
            <div className={`nav-overlay template-${settings.layout.template} ${overlayOpen ? 'open' : ''}`}>
              <div className="text-center">
                <button 
                  className="absolute top-8 right-8 text-white text-3xl hover:text-gray-300 transition-colors duration-300"
                  onClick={() => setOverlayOpen(false)}
                >
                  ×
                </button>
                <div className="mb-16">
                  <div className="w-16 h-16 border-2 border-white rounded-full mx-auto mb-6 flex items-center justify-center">
                    <span className="text-white text-xl font-light">
                      {settings.branding.coupleName.split('&')[0]?.trim()?.charAt(0) || 'J'}
                      &
                      {settings.branding.coupleName.split('&')[1]?.trim()?.charAt(0) || 'J'}
                    </span>
                  </div>
                  <h2 className="text-white text-xl font-light tracking-wide">{settings.branding.coupleName}</h2>
                </div>
                <div className="space-y-6">
                  {navItems.map((item, index) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className="block text-white hover:text-gray-200 text-xl font-light tracking-wider transition-all duration-300 hover:transform hover:scale-105"
                      onClick={() => setOverlayOpen(false)}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        <div className={`main-content ${settings.layout.navigation === 'side' ? 'ml-20' : ''}`}>

        {/* Enhanced Hero Section with template-specific styling */}
        {settings.sections.hero && (
          <section 
            id="hero" 
            className={`hero-section template-${settings.layout.template} animate-on-scroll`}
          >
            {/* Hero Background Image with Overlay */}
            {settings.branding.heroPicture && (
              <div className="hero-background">
                <img 
                  src={settings.branding.heroPicture} 
                  alt="Hero"
                  className="hero-bg-image"
                  loading="eager"
                />
                <div className="hero-overlay"></div>
              </div>
            )}
            
            {/* Template-specific background patterns */}
            {!settings.branding.heroPicture && (
              <div className={`hero-pattern ${
                settings.layout.template === 'elegant' ? 'elegant-bg' : 
                settings.layout.template === 'modern' ? 'geometric-bg' : ''
              }`}></div>
            )}

            <div className="hero-content container">
              <div className="hero-text">
                {/* Template-specific decorative elements */}
                {settings.layout.template === 'elegant' && (
                  <div className="hero-ornament">✦</div>
                )}

                <h1 className="hero-title">
                  {settings.branding.coupleName}
                </h1>

                {/* Classic template decorative divider */}
                {settings.layout.template === 'classic' && (
                  <div className="ornamental-divider">
                    <span>♥</span>
                  </div>
                )}

                {settings.branding.tagline && (
                  <p className="hero-subtitle">
                    {settings.branding.tagline}
                  </p>
                )}

                <div className="hero-date">
                  {formatDate(settings.branding.weddingDate)}
                </div>

                {settings.content.heroMessage && (
                  <p className="hero-description">
                    {settings.content.heroMessage}
                  </p>
                )}

                {/* Modern template accent line */}
                {settings.layout.template === 'modern' && (
                  <div className="hero-accent-line"></div>
                )}

                {/* Minimal template divider */}
                {settings.layout.template === 'minimal' && (
                  <div className="hero-minimal-line"></div>
                )}

                {settings.sections.rsvp && (
                  <button className="btn btn-primary hero-cta">
                    RSVP Now
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Enhanced Story Section */}
        {settings.sections.story && settings.content.storyText && (
          <section 
            id="story" 
            className={`story-section template-${settings.layout.template} animate-on-scroll`}
          >
            <div className="container">
              <div className="story-header">
                <h2 className="section-title">Our Story</h2>
                
                {/* Template-specific section decorations */}
                {settings.layout.template === 'classic' && (
                  <div className="ornamental-divider">
                    <span>♥</span>
                  </div>
                )}
                
                {settings.layout.template === 'elegant' && (
                  <div className="flourish">
                    <span>✧</span>
                  </div>
                )}
                
                {settings.layout.template === 'modern' && (
                  <div className="grid-divider"></div>
                )}
                
                {settings.layout.template === 'minimal' && (
                  <div className="minimal-line"></div>
                )}
              </div>

              <div className="story-content">
                <div className="story-text">
                  {settings.content.storyText}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Enhanced Events Section */}
        {settings.sections.events && settings.events.length > 0 && (
          <section 
            id="events" 
            className={`events-section template-${settings.layout.template} animate-on-scroll`}
          >
            <div className="container">
              <div className="events-header">
                <h2 className="section-title">Wedding Events</h2>
                
                {/* Template-specific section decorations */}
                {settings.layout.template === 'classic' && (
                  <div className="ornamental-divider">
                    <span>✦</span>
                  </div>
                )}
                
                {settings.layout.template === 'elegant' && (
                  <div className="flourish">
                    <span>❋</span>
                  </div>
                )}
                
                {settings.layout.template === 'modern' && (
                  <div className="grid-divider"></div>
                )}
                
                {settings.layout.template === 'minimal' && (
                  <div className="minimal-line"></div>
                )}
              </div>

              <div className="events-grid">
                {settings.events.map((event, index) => (
                  <div 
                    key={event.id} 
                    className={`event-card template-${settings.layout.template} animate-on-scroll`}
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    {/* Event Image (only if exists) */}
                    {event.picture && (
                      <div className="event-image">
                        <img 
                          src={event.picture} 
                          alt={event.name}
                          className="event-img"
                          loading="lazy"
                        />
                        <div className="event-image-overlay"></div>
                      </div>
                    )}

                    <div className="event-content">
                      <h3 className="event-title">{event.name}</h3>
                      
                      {/* Template-specific event decorations */}
                      {settings.layout.template === 'classic' && (
                        <div className="event-divider">♦</div>
                      )}
                      
                      {settings.layout.template === 'elegant' && (
                        <div className="event-flourish">✧</div>
                      )}

                      <div className="event-details">
                        <div className="event-detail">
                          <span className="detail-label">Date</span>
                          <span className="detail-value">{formatDate(event.date)}</span>
                        </div>
                        
                        <div className="event-detail">
                          <span className="detail-label">Time</span>
                          <span className="detail-value">{event.time}</span>
                        </div>
                        
                        <div className="event-detail">
                          <span className="detail-label">Location</span>
                          <span className="detail-value">{event.location}</span>
                        </div>
                        
                        <div className="event-detail">
                          <span className="detail-label">Address</span>
                          <span className="detail-value">{event.address}</span>
                        </div>
                        
                        {event.dresscode && (
                          <div className="event-detail">
                            <span className="detail-label">Dress Code</span>
                            <span className="detail-value">{event.dresscode}</span>
                          </div>
                        )}
                      </div>

                      {event.description && (
                        <div className="event-description">
                          {event.description}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Enhanced Accommodations Section */}
        {settings.sections.accommodations && settings.accommodations.length > 0 && (
          <section 
            id="accommodations" 
            className={`accommodations-section template-${settings.layout.template} animate-on-scroll`}
          >
            <div className="container">
              <div className="accommodations-header">
                <h2 className="section-title">Where to Stay</h2>
                
                {/* Template-specific section decorations */}
                {settings.layout.template === 'classic' && (
                  <div className="ornamental-divider">
                    <span>♦</span>
                  </div>
                )}
                
                {settings.layout.template === 'elegant' && (
                  <div className="flourish">
                    <span>✧</span>
                  </div>
                )}
                
                {settings.layout.template === 'modern' && (
                  <div className="grid-divider"></div>
                )}
                
                {settings.layout.template === 'minimal' && (
                  <div className="minimal-line"></div>
                )}
              </div>

              <div className="accommodations-grid">
                {settings.accommodations.map((accommodation, index) => (
                  <div 
                    key={accommodation.id} 
                    className={`accommodation-card template-${settings.layout.template} animate-on-scroll`}
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    {/* Accommodation Image (only if exists) */}
                    {accommodation.picture && (
                      <div className="accommodation-image">
                        <img 
                          src={accommodation.picture} 
                          alt={accommodation.name}
                          className="accommodation-img"
                          loading="lazy"
                        />
                        <div className="accommodation-image-overlay">
                          <div className="accommodation-type-badge">
                            {accommodation.type}
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="accommodation-content">
                      <h3 className="accommodation-title">{accommodation.name}</h3>
                      
                      {/* Template-specific accommodation decorations */}
                      {settings.layout.template === 'classic' && (
                        <div className="accommodation-divider">❖</div>
                      )}
                      
                      {settings.layout.template === 'elegant' && (
                        <div className="accommodation-flourish">✦</div>
                      )}

                      <div className="accommodation-details">
                        <div className="accommodation-detail">
                          <span className="detail-label">Address</span>
                          <span className="detail-value">{accommodation.address}</span>
                        </div>
                        
                        {accommodation.distance && (
                          <div className="accommodation-detail">
                            <span className="detail-label">Distance</span>
                            <span className="detail-value">{accommodation.distance}</span>
                          </div>
                        )}
                        
                        {accommodation.priceRange && (
                          <div className="accommodation-detail">
                            <span className="detail-label">Price Range</span>
                            <span className="detail-value">{accommodation.priceRange}</span>
                          </div>
                        )}
                        
                        {accommodation.phone && (
                          <div className="accommodation-detail">
                            <span className="detail-label">Phone</span>
                            <span className="detail-value">{accommodation.phone}</span>
                          </div>
                        )}
                      </div>

                      {accommodation.description && (
                        <div className="accommodation-description">
                          {accommodation.description}
                        </div>
                      )}

                      {accommodation.website && (
                        <div className="accommodation-actions">
                          <a 
                            href={accommodation.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="btn btn-primary accommodation-cta"
                          >
                            Book Now
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Enhanced Registry Section */}
        {settings.sections.registry && settings.registry && (
          <section 
            id="registry" 
            className={`registry-section template-${settings.layout.template} animate-on-scroll`}
          >
            <div className="container">
              <div className="registry-header">
                <h2 className="section-title">Gift Registry</h2>
                
                {/* Template-specific section decorations */}
                {settings.layout.template === 'classic' && (
                  <div className="ornamental-divider">
                    <span>♦</span>
                  </div>
                )}
                
                {settings.layout.template === 'elegant' && (
                  <div className="flourish">
                    <span>✦</span>
                  </div>
                )}
                
                {settings.layout.template === 'modern' && (
                  <div className="grid-divider"></div>
                )}
                
                {settings.layout.template === 'minimal' && (
                  <div className="minimal-line"></div>
                )}
              </div>

              <div className="registry-content">
                {settings.registry.message && (
                  <div className="registry-message">
                    {settings.registry.message}
                  </div>
                )}
                
                {settings.registry.links && settings.registry.links.length > 0 && (
                  <div className="registry-links">
                    {settings.registry.links.map((link, index) => (
                      <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`registry-link template-${settings.layout.template} animate-on-scroll`}
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <span className="registry-store-name">{link.store}</span>
                        <span className="registry-link-icon">→</span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Enhanced RSVP Section */}
        {settings.sections.rsvp && (
          <section 
            id="rsvp" 
            className={`rsvp-section template-${settings.layout.template} animate-on-scroll`}
          >
            <div className="container">
              <div className="rsvp-header">
                <h2 className="section-title">RSVP</h2>
                
                {/* Template-specific section decorations */}
                {settings.layout.template === 'classic' && (
                  <div className="ornamental-divider">
                    <span>♥</span>
                  </div>
                )}
                
                {settings.layout.template === 'elegant' && (
                  <div className="flourish">
                    <span>✧</span>
                  </div>
                )}
                
                {settings.layout.template === 'modern' && (
                  <div className="grid-divider"></div>
                )}
                
                {settings.layout.template === 'minimal' && (
                  <div className="minimal-line"></div>
                )}
              </div>

              <div className="rsvp-content">
                {!rsvpSubmitted ? (
                  <>
                    <div className="rsvp-message">
                      Please let us know if you'll be joining us for our special day
                    </div>
                    
                    <div className="rsvp-card">
                      <form onSubmit={submitRSVP}>
                        {/* First Name and Last Name */}
                        <div className="row mb-3">
                          <div className="col-md-6">
                            <label htmlFor="firstName" className="form-label">Prénom</label>
                            <input
                              type="text"
                              className="form-control"
                              name="firstName"
                              id="firstName"
                              placeholder="Votre prénom"
                              required
                              value={rsvpForm.firstName}
                              onChange={(e) => setRsvpForm(prev => ({ ...prev, firstName: e.target.value }))}
                            />
                          </div>
                          <div className="col-md-6">
                            <label htmlFor="lastName" className="form-label">Nom</label>
                            <input
                              type="text"
                              className="form-control"
                              name="lastName"
                              id="lastName"
                              placeholder="Votre nom"
                              required
                              value={rsvpForm.lastName}
                              onChange={(e) => setRsvpForm(prev => ({ ...prev, lastName: e.target.value }))}
                            />
                          </div>
                        </div>

                        {/* Total number of guests */}
                        <div className="mb-3">
                          <label htmlFor="guestsNumber" className="form-label">Nombre d'invités</label>
                          <input
                            type="number"
                            className="form-control"
                            name="guestsNumber"
                            id="guestsNumber"
                            placeholder="Ex: 2"
                            min="1"
                            required
                            value={rsvpForm.totalGuests}
                            onChange={(e) => {
                              const value = parseInt(e.target.value);
                              if (value > 0) {
                                setRsvpForm(prev => ({ ...prev, totalGuests: value }))
                              }
                            }}
                          />
                        </div>

                        {/* Event selection */}
                        <div className="mb-3">
                          <label className="form-label mb-2">Je serai présent(e) à :</label>
                          <div className="row row-cols-1 row-cols-md-2 g-3">
                            {/* Dynamic Events */}
                            {events.map((event, index) => (
                              <div key={event.id} className="col">
                                <div className="event-checkbox-wrapper">
                                  <label className="rsvp-check text-center" htmlFor={`event_${index}`}>
                                    <input
                                      type="checkbox"
                                      id={`event_${index}`}
                                      name="presence[]"
                                      value={event.name}
                                      checked={rsvpForm.events[event.id]?.attending || false}
                                      onChange={() => {
                                        const isCurrentlySelected = rsvpForm.events[event.id]?.attending || false;
                                        setRsvpForm(prev => ({
                                          ...prev,
                                          isNoneSelected: false,
                                          events: {
                                            ...prev.events,
                                            [event.id]: {
                                              attending: !isCurrentlySelected,
                                              guestCount: !isCurrentlySelected ? 1 : 0
                                            }
                                          }
                                        }))
                                      }}
                                    />
                                    {event.name}
                                  </label>
                                  <div 
                                    className="guest-count-wrapper" 
                                    id={`guestCount_${index}`}
                                    style={{
                                      maxHeight: rsvpForm.events[event.id]?.attending ? '80px' : '0px'
                                    }}
                                  >
                                    <label className="guest-count-label" htmlFor={`eventGuests_${index}`}>Nombre d'invités:</label>
                                    <input
                                      type="number"
                                      className="guest-count-input"
                                      id={`eventGuests_${index}`}
                                      name={`eventGuests[${event.name}]`}
                                      min="1"
                                      value={rsvpForm.events[event.id]?.guestCount || 1}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        if (value > 0) {
                                          setRsvpForm(prev => ({
                                            ...prev,
                                            events: {
                                              ...prev.events,
                                              [event.id]: {
                                                ...prev.events[event.id],
                                                guestCount: value
                                              }
                                            }
                                          }))
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}

                            {/* mairie checkbox (if not already in events) */}
                            {!events.some(event => event.name.toLowerCase().includes('mairie')) && (
                              <div className="col">
                                <div className="event-checkbox-wrapper">
                                  <label className="rsvp-check text-center" htmlFor="event_mairie">
                                    <input
                                      type="checkbox"
                                      id="event_mairie"
                                      name="presence[]"
                                      value="mairie"
                                      checked={rsvpForm.events['mairie']?.attending || false}
                                      onChange={() => {
                                        const isCurrentlySelected = rsvpForm.events['mairie']?.attending || false;
                                        setRsvpForm(prev => ({
                                          ...prev,
                                          isNoneSelected: false,
                                          events: {
                                            ...prev.events,
                                            mairie: {
                                              attending: !isCurrentlySelected,
                                              guestCount: !isCurrentlySelected ? 1 : 0
                                            }
                                          }
                                        }))
                                      }}
                                    />
                                    mairie
                                  </label>
                                  <div 
                                    className="guest-count-wrapper" 
                                    id="guestCount_mairie"
                                    style={{
                                      maxHeight: rsvpForm.events['mairie']?.attending ? '80px' : '0px'
                                    }}
                                  >
                                    <label className="guest-count-label" htmlFor="eventGuests_mairie">Nombre d'invités:</label>
                                    <input
                                      type="number"
                                      className="guest-count-input"
                                      id="eventGuests_mairie"
                                      name="eventGuests[mairie]"
                                      min="1"
                                      value={rsvpForm.events['mairie']?.guestCount || 1}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        if (value > 0) {
                                          setRsvpForm(prev => ({
                                            ...prev,
                                            events: {
                                              ...prev.events,
                                              mairie: {
                                                ...prev.events['mairie'],
                                                guestCount: value
                                              }
                                            }
                                          }))
                                        }
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* AUCUN option */}
                            <div className="col">
                              <div className="event-checkbox-wrapper">
                                <label className="rsvp-check text-center" htmlFor="event_aucun">
                                  <input
                                    type="checkbox"
                                    id="event_aucun"
                                    name="presence[]"
                                    value="AUCUN"
                                    checked={rsvpForm.isNoneSelected}
                                    onChange={() => {
                                      if (!rsvpForm.isNoneSelected) {
                                        const resetEvents: Record<string, { attending: boolean; guestCount: number }> = {};
                                        events.forEach(event => {
                                          resetEvents[event.id] = { attending: false, guestCount: 0 };
                                        });
                                        resetEvents['mairie'] = { attending: false, guestCount: 0 };
                                        setRsvpForm(prev => ({
                                          ...prev,
                                          isNoneSelected: true,
                                          events: resetEvents
                                        }))
                                      } else {
                                        setRsvpForm(prev => ({
                                          ...prev,
                                          isNoneSelected: false
                                        }))
                                      }
                                    }}
                                  />
                                  <span className="me-1">😞</span> AUCUN
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Message for the couple */}
                        <div className="mb-3">
                          <label htmlFor="message" className="form-label">Un message pour les mariés ?</label>
                          <textarea
                            className="form-control"
                            name="message"
                            id="message"
                            rows={3}
                            placeholder="Votre message (optionnel)"
                            value={rsvpForm.message}
                            onChange={(e) => setRsvpForm(prev => ({ ...prev, message: e.target.value }))}
                          />
                        </div>

                        <button 
                          type="submit" 
                          className="btn btn-submit w-100 mt-3"
                          disabled={rsvpLoading}
                        >
                          {rsvpLoading ? 'Envoi en cours...' : 'Envoyer ma réponse'}
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  <div className="rsvp-success">
                    <div className="rsvp-success-icon">✓</div>
                    <h3 className="rsvp-success-title">Merci pour votre réponse!</h3>
                    <p className="rsvp-success-message">
                      Nous avons bien reçu votre RSVP. À bientôt !
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Enhanced Contact Section */}
        {settings.sections.contact && settings.contacts.length > 0 && (
          <section 
            id="contact" 
            className={`contact-section template-${settings.layout.template} animate-on-scroll`}
          >
            <div className="container">
              <div className="contact-header">
                <h2 className="section-title">Contact</h2>
                
                {/* Template-specific section decorations */}
                {settings.layout.template === 'classic' && (
                  <div className="ornamental-divider">
                    <span>♦</span>
                  </div>
                )}
                
                {settings.layout.template === 'elegant' && (
                  <div className="flourish">
                    <span>✦</span>
                  </div>
                )}
                
                {settings.layout.template === 'modern' && (
                  <div className="grid-divider"></div>
                )}
                
                {settings.layout.template === 'minimal' && (
                  <div className="minimal-line"></div>
                )}
              </div>

              <div className="contact-grid">
                {settings.contacts.map((contact, index) => (
                  <div 
                    key={contact.id} 
                    className={`contact-card template-${settings.layout.template} animate-on-scroll`}
                    style={{ animationDelay: `${index * 150}ms` }}
                  >
                    <div className="contact-content">
                      <h3 className="contact-name">{contact.name}</h3>
                      <div className="contact-role">{contact.role}</div>
                      
                      <div className="contact-details">
                        {contact.phone && (
                          <div className="contact-detail">
                            <span className="contact-label">Phone</span>
                            <a href={`tel:${contact.phone}`} className="contact-link">
                              {contact.phone}
                            </a>
                          </div>
                        )}
                        {contact.email && (
                          <div className="contact-detail">
                            <span className="contact-label">Email</span>
                            <a href={`mailto:${contact.email}`} className="contact-link">
                              {contact.email}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Additional Info Section */}
        {settings.content.additionalInfo && (
          <section className="py-20 px-4 text-center" style={{ backgroundColor: `${settings.colors.accent}10` }}>
            <div className="max-w-4xl mx-auto">
              <div className="text-lg md:text-xl wedding-text leading-relaxed whitespace-pre-line">
                {settings.content.additionalInfo}
              </div>
            </div>
          </section>
        )}

        {/* Footer */}
        <footer className={`footer-section template-${settings.layout.template} py-6 px-4 text-center`}>
          <div className="container">
            <p className="couple-name">{settings.branding.coupleName}</p>
          </div>
        </footer>
        
        </div>
      </div>
    </>
  );
}