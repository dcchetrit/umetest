'use client';

import { Guest, Group } from '@ume/shared';
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, writeBatch } from 'firebase/firestore';
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
    hero: { enabled: boolean; name: string; };
    story: { enabled: boolean; name: string; };
    events: { enabled: boolean; name: string; };
    accommodations: { enabled: boolean; name: string; };
    rsvp: { enabled: boolean; name: string; };
    gallery: { enabled: boolean; name: string; };
    registry: { enabled: boolean; name: string; };
  };
  layout: {
    template: 'classic' | 'modern' | 'elegant' | 'minimal';
    navigation: 'top';
  };
  content: {
    heroMessage?: string;
    storyText?: string;
    additionalInfo?: string;
  };
  events: WebsiteEvent[];
  accommodations: any[];
  registry?: {
    message?: string;
    links: Array<{
      store: string;
      url: string;
    }>;
  };
}

interface MinimalInviteTemplateProps {
  guest: Guest;
  guestGroup: Group | null;
  settings: WebsiteSettings;
  personalizedEvents: WebsiteEvent[];
  coupleId: string;
}

export default function MinimalInviteTemplate({
  guest,
  guestGroup,
  settings,
  personalizedEvents,
  coupleId
}: MinimalInviteTemplateProps) {
  const [eventResponses, setEventResponses] = useState<{[eventName: string]: {[guestId: string]: boolean}}>(
    guest.rsvp?.events || {}
  );
  const [comments, setComments] = useState(guest.rsvp?.comments || '');
  const [subGuests, setSubGuests] = useState<Guest[]>([]);
  const [loadingSubGuests, setLoadingSubGuests] = useState(false);
  const [submittingRSVP, setSubmittingRSVP] = useState(false);
  
  // Use firstName from guest data
  const firstName = guest.firstName;
  const fullName = `${guest.firstName} ${guest.lastName}`;
  const welcomeMessage = `Hello ${firstName}!`;
  
  // Fetch sub-guests from Firestore using the subGuests array
  const fetchSubGuests = useCallback(async () => {
    if (!guest.isMainGuest || guest.totalGuests <= 1) return;
    
    // Check if guest has subGuests array
    if (!guest.subGuests || guest.subGuests.length === 0) return;
    
    setLoadingSubGuests(true);
    try {
      const fetchedSubGuests: Guest[] = [];
      
      // Fetch each sub-guest document by ID from the couples/{coupleId}/guests subcollection
      for (const subGuestId of guest.subGuests) {
        const subGuestDoc = await getDoc(doc(db, 'couples', coupleId, 'guests', subGuestId));
        if (subGuestDoc.exists()) {
          fetchedSubGuests.push({ 
            id: subGuestDoc.id, 
            ...subGuestDoc.data() 
          } as Guest);
        }
      }
      
      setSubGuests(fetchedSubGuests);
    } catch (error) {
      console.error('Error fetching sub-guests:', error);
    } finally {
      setLoadingSubGuests(false);
    }
  }, [guest.subGuests, guest.isMainGuest, guest.totalGuests, coupleId]);
  
  // Fetch sub-guests on component mount
  useEffect(() => {
    fetchSubGuests();
  }, [fetchSubGuests]);
  
  // Create guest list (main guest + fetched sub-guests)
  const allGuests = guest.isMainGuest && guest.totalGuests > 1 ? [
    { id: guest.id, name: `${guest.firstName} ${guest.lastName}` },
    ...subGuests.map(subGuest => ({
      id: subGuest.id,
      name: `${subGuest.firstName} ${subGuest.lastName}`
    }))
  ] : [{ id: guest.id, name: `${guest.firstName} ${guest.lastName}` }];
  
  // Optimized event response handlers for individual guests
  const handleEventResponse = useCallback((eventName: string, guestId: string, attending: boolean) => {
    setEventResponses(prev => ({
      ...prev,
      [eventName]: {
        ...prev[eventName],
        [guestId]: attending
      }
    }));
  }, []);

  // Helper function to determine RSVP status from event responses
  const determineRSVPStatus = useCallback((guestEventResponses: {[eventName: string]: boolean}) => {
    const responses = Object.values(guestEventResponses);
    if (responses.length === 0) return 'declined'; // No responses = declined
    
    const hasAccepted = responses.some(response => response === true);
    
    // If attending ANY event = accepted, otherwise declined
    return hasAccepted ? 'accepted' : 'declined';
  }, []);

  // Handle RSVP submission
  const handleRSVPSubmit = useCallback(async () => {
    if (submittingRSVP) return; // Prevent double submission
    
    setSubmittingRSVP(true);
    try {
      const submissionDate = new Date();
      const batch = writeBatch(db);

      // Get all guests that need to be updated (main guest + sub-guests)
      const allGuestsToUpdate = allGuests;

      // Process each guest's RSVP data
      for (const guestToUpdate of allGuestsToUpdate) {
        // Extract this guest's event responses
        const guestEventResponses: {[eventName: string]: boolean} = {};
        
        Object.keys(eventResponses).forEach(eventName => {
          const guestResponse = eventResponses[eventName]?.[guestToUpdate.id];
          if (guestResponse !== undefined) {
            guestEventResponses[eventName] = guestResponse;
          }
        });

        // Determine RSVP status for this guest
        const status = determineRSVPStatus(guestEventResponses);

        // Prepare RSVP data for this guest
        const rsvpData: any = {
          status,
          submittedAt: submissionDate,
          events: guestEventResponses
        };

        // For main guest, include comments
        if (guestToUpdate.id === guest.id) {
          rsvpData.comments = comments;
        }

        // Add update to batch
        const guestDocRef = doc(db, 'couples', coupleId, 'guests', guestToUpdate.id);
        batch.update(guestDocRef, { rsvp: rsvpData });
      }

      // Execute batch update
      await batch.commit();
      
      alert('RSVP submitted successfully! Thank you for responding.');
      
    } catch (error) {
      console.error('Error submitting RSVP:', error);
      alert('Error submitting RSVP. Please try again.');
    } finally {
      setSubmittingRSVP(false);
    }
  }, [guest.id, eventResponses, comments, coupleId, allGuests, determineRSVPStatus, submittingRSVP]);
  
  // Helper function to get section titles
  const getSectionTitle = (sectionKey: string): string => {
    const section = settings.sections[sectionKey as keyof typeof settings.sections];
    if (section?.name) return section.name;
    
    const defaults: { [key: string]: string } = {
      hero: 'Home',
      story: 'Our Story', 
      events: 'Events',
      accommodations: 'Accommodations',
      rsvp: 'RSVP',
      gallery: 'Gallery',
      registry: 'Registry'
    };
    return defaults[sectionKey] || sectionKey;
  };
  
  const [activeSection, setActiveSection] = useState('hero');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const smoothScrollTo = (elementId: string) => {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ 
        behavior: 'auto', 
        block: 'start',
        inline: 'nearest'
      });
    }
  };

  return (
    <>
      {/* Head section with favicon and title */}
      <Head>
        <title>{settings.branding.coupleName} - Wedding Invitation</title>
        <meta name="description" content={`You're invited to ${settings.branding.coupleName}'s wedding${settings.branding.tagline ? ` - ${settings.branding.tagline}` : ''}`} />
        {settings.branding.favicon && <link rel="icon" href={settings.branding.favicon} />}
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      
      <style jsx>{`
        :global(*) {
          box-sizing: border-box;
        }

        :global(html) {
          scroll-behavior: auto;
          overflow-x: hidden;
        }

        :global(.template-minimal) {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-weight: 300;
          line-height: 1.7;
          letter-spacing: 0.02em;
        }

        :global(.template-minimal h1), :global(.template-minimal h2), :global(.template-minimal h3), :global(.template-minimal h4) {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          font-weight: 200;
          line-height: 1.1;
          color: ${settings.colors.text};
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: linear-gradient(135deg, ${settings.colors.text} 0%, ${settings.colors.primary} 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        :global(.template-minimal h1) {
          font-size: clamp(2rem, 6vw, 5rem);
          font-weight: 100;
          margin-bottom: 2rem;
        }

        :global(.template-minimal h2) {
          font-size: clamp(1.5rem, 4vw, 2.5rem);
          margin-bottom: 1.5rem;
        }

        :global(.template-minimal h3) {
          font-size: clamp(1.125rem, 2vw, 1.5rem);
          margin-bottom: 1rem;
        }





        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .container {
            padding: 0 2rem;
          }
          .section {
            padding: 6rem 0;
          }
          .hero-content {
            padding: 2rem;
            margin: 0 1rem;
          }
        }

        @media (max-width: 768px) {
          .container {
            padding: 0 1.5rem;
          }
          .section {
            padding: 4rem 0;
          }
          .hero-content {
            padding: 1.5rem;
            margin: 0 0.5rem;
          }
          .hero-section {
            padding: 4rem 0;
          }
          :global(.template-minimal h1) {
            font-size: clamp(1.75rem, 8vw, 3.5rem);
          }
          :global(.template-minimal h2) {
            font-size: clamp(1.25rem, 6vw, 2rem);
          }
          .section-title {
            font-size: clamp(1.5rem, 6vw, 2.25rem);
            margin-bottom: 3rem;
          }
        }

        @media (max-width: 480px) {
          .container {
            padding: 0 1rem;
          }
          .section {
            padding: 3rem 0;
          }
          .hero-content {
            padding: 1rem;
          }
          .card {
            padding: 1.5rem;
            border-radius: 16px;
          }
          .btn-minimal {
            padding: 0.75rem 2rem;
            font-size: 0.8rem;
          }
        }

        .minimal-line {
          width: 80px;
          height: 2px;
          background: linear-gradient(90deg, transparent, ${settings.colors.primary}, transparent);
          margin: 3rem auto;
          position: relative;
          border-radius: 1px;
          background-size: 200% 100%;
        }

        .minimal-line::before,
        .minimal-line::after {
          content: '';
          position: absolute;
          top: -2px;
          width: 4px;
          height: 4px;
          background: ${settings.colors.primary};
          border-radius: 50%;
        }

        .minimal-line::before {
          left: -12px;
        }

        .minimal-line::after {
          right: -12px;
        }

        .minimal-divider {
          width: 100%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.1), transparent);
          margin: 4rem 0;
          position: relative;
        }

        .minimal-divider::after {
          content: '';
          position: absolute;
          top: -2px;
          left: 50%;
          transform: translateX(-50%);
          width: 6px;
          height: 6px;
          background: ${settings.colors.primary};
          border-radius: 50%;
        }

        .hero-minimal-line {
          width: 100px;
          height: 2px;
          background: linear-gradient(90deg, transparent, ${settings.colors.primary}, ${settings.colors.accent}, ${settings.colors.primary}, transparent);
          margin: 3rem auto;
          position: relative;
          border-radius: 1px;
          background-size: 200% 100%;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }

        .hero-minimal-line::before,
        .hero-minimal-line::after {
          content: '';
          position: absolute;
          top: -3px;
          width: 8px;
          height: 8px;
          background: radial-gradient(circle, ${settings.colors.primary}, transparent);
          border-radius: 50%;
        }

        .hero-minimal-line::before {
          left: -16px;
          animation-delay: 0s;
        }

        .hero-minimal-line::after {
          right: -16px;
          animation-delay: 1.5s;
        }

        .nav-top {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px) saturate(150%);
          -webkit-backdrop-filter: blur(20px) saturate(150%);
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 1px 40px rgba(0, 0, 0, 0.08);
          z-index: 50;
          padding: 1.5rem 1rem;
        }

        .nav-item {
          position: relative;
          padding: 0.5rem 1rem;
          border-radius: 25px;
          overflow: hidden;
        }

        .nav-item::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, ${settings.colors.primary}20, ${settings.colors.accent}20);
          border-radius: 25px;
          opacity: 0;
          transform: scale(0.8);
          z-index: -1;
        }

        .nav-item:hover::before,
        .nav-item.active::before {
          opacity: 1;
          transform: scale(1);
        }

        .nav-item.active {
          background: linear-gradient(135deg, ${settings.colors.primary}10, ${settings.colors.accent}10);
        }

        .nav-item:hover {
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .burger-menu {
          display: none;
          flex-direction: column;
          cursor: pointer;
          padding: 0.5rem;
          z-index: 60;
        }

        .burger-line {
          width: 25px;
          height: 2px;
          background: ${settings.colors.text};
          margin: 3px 0;
          border-radius: 2px;
        }

        .burger-menu.active .burger-line:nth-child(1) {
          transform: rotate(-45deg) translate(-6px, 6px);
        }

        .burger-menu.active .burger-line:nth-child(2) {
          opacity: 0;
        }

        .burger-menu.active .burger-line:nth-child(3) {
          transform: rotate(45deg) translate(-6px, -6px);
        }

        .mobile-menu {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          z-index: 55;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2rem;
          transform: translateX(${isMobileMenuOpen ? '0' : '100%'});
        }

        .mobile-nav-item {
          font-size: 1.25rem;
          font-weight: 300;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: ${settings.colors.text};
          background: none;
          border: none;
          cursor: pointer;
          padding: 1rem 2rem;
          border-radius: 25px;
          opacity: ${isMobileMenuOpen ? 1 : 0};
          transform: translateY(${isMobileMenuOpen ? '0' : '20px'});
        }

        .mobile-nav-item:hover,
        .mobile-nav-item.active {
          background: linear-gradient(135deg, ${settings.colors.primary}15, ${settings.colors.accent}15);
          color: ${settings.colors.primary};
        }

        @media (max-width: 768px) {
          .nav-top .container > div:last-child {
            display: none;
          }
          .burger-menu {
            display: flex;
          }
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem;
        }

        .hero-section {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 6rem 0;
          margin-top: 0;
          background: ${settings.branding.heroPicture ? 
            `linear-gradient(135deg, rgba(255, 255, 255, 0.15) 0%, rgba(255, 255, 255, 0.8) 100%), url(${settings.branding.heroPicture})` :
            `linear-gradient(135deg, ${settings.colors.background} 0%, ${settings.colors.primary}05 50%, ${settings.colors.background} 100%)`
          };
          background-size: cover;
          background-position: center;
          background-repeat: no-repeat;
          background-attachment: fixed;
          position: relative;
          overflow: hidden;
        }

        .hero-section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.05) 100%);
          z-index: 1;
        }


        
        .hero-content {
          position: relative;
          z-index: 2;
          max-width: 48rem;
          margin: 0 auto;
          backdrop-filter: blur(10px);
          padding: 3rem;
          border-radius: 30px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          box-shadow: 
            0 25px 45px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
        }

        .hero-title {
          font-size: clamp(2.5rem, 8vw, 6rem);
          font-weight: 100;
          color: ${settings.colors.primary};
          margin-bottom: 2rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          text-shadow: 0 0 40px rgba(0,0,0,0.1);
        }

        .hero-subtitle {
          font-size: clamp(1.25rem, 3vw, 2rem);
          font-weight: 200;
          color: ${settings.colors.text};
          margin-bottom: 3rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          opacity: 0.8;
        }

        .hero-date {
          font-size: 1.125rem;
          font-weight: 300;
          color: ${settings.colors.secondary};
          margin-bottom: 3rem;
          padding: 1rem 2rem;
          border: 1px solid rgba(0,0,0,0.1);
          border-radius: 50px;
          display: inline-block;
          backdrop-filter: blur(10px);
          background: rgba(255,255,255,0.2);
        }

        .hero-description {
          font-size: 1.125rem;
          font-weight: 300;
          color: ${settings.colors.text};
          line-height: 1.7;
          margin-bottom: 3rem;
          opacity: 0.9;
        }

        .btn-minimal {
          background: linear-gradient(135deg, transparent, rgba(255,255,255,0.1));
          color: ${settings.colors.primary};
          border: 2px solid ${settings.colors.primary};
          padding: 1rem 3rem;
          font-weight: 400;
          text-transform: uppercase;
          letter-spacing: 0.15em;
          font-size: 0.875rem;
          border-radius: 50px;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          backdrop-filter: blur(10px);
        }

        .btn-minimal::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
        }

        .btn-minimal:hover::before {
          left: 100%;
        }

        .btn-minimal:hover {
          background: ${settings.colors.primary};
          color: ${settings.colors.background};
          box-shadow: 0 15px 35px rgba(0,0,0,0.2);
          border-color: ${settings.colors.primary};
        }

        .section {
          padding: 8rem 0;
          position: relative;
          overflow: hidden;
        }

        .section::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.1), transparent);
        }

        .section-title {
          font-size: clamp(1.75rem, 5vw, 3rem);
          font-weight: 200;
          color: ${settings.colors.primary};
          text-align: center;
          margin-bottom: 4rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          position: relative;
          z-index: 2;
        }

        .section-title::after {
          content: '';
          position: absolute;
          bottom: -1rem;
          left: 50%;
          transform: translateX(-50%);
          width: 60px;
          height: 2px;
          background: linear-gradient(90deg, transparent, ${settings.colors.primary}, transparent);
          border-radius: 1px;
        }

        .card {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 20px;
          padding: 2rem;
          box-shadow: 
            0 10px 40px rgba(0, 0, 0, 0.1),
            inset 0 1px 0 rgba(255, 255, 255, 0.2);
          position: relative;
          overflow: hidden;
        }

        .card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, ${settings.colors.primary}05, transparent);
          opacity: 0;
          border-radius: 20px;
        }

        .card:hover::before {
          opacity: 1;
        }


        .event-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: 2.5rem;
          margin-top: 3rem;
        }

        @media (max-width: 768px) {
          .event-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
        }

        .event-card {
          position: relative;
          overflow: hidden;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }


        .event-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
        }


        .event-content {
          padding: 2rem;
          text-align: center;
        }

        .event-date-badge {
          display: inline-block;
          background: ${settings.colors.primary};
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 1rem;
        }

        .event-title {
          font-size: 1.5rem;
          font-weight: 300;
          color: ${settings.colors.text};
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .event-details {
          font-size: 0.9rem;
          color: #6b7280;
          line-height: 1.6;
          margin-bottom: 1rem;
        }

        .event-location {
          font-size: 1rem;
          font-weight: 400;
          color: ${settings.colors.secondary};
          margin-bottom: 0.5rem;
        }

        .event-address {
          font-size: 0.85rem;
          color: #9ca3af;
          margin-bottom: 1.5rem;
        }

        .event-description {
          font-size: 0.9rem;
          color: ${settings.colors.text};
          line-height: 1.7;
          font-style: italic;
          opacity: 0.8;
        }


        .update-btn {
          margin-top: 2rem;
          font-size: 0.75rem;
          padding: 0.5rem 1rem;
          border: 1px solid ${settings.colors.primary};
          background: transparent;
          color: ${settings.colors.primary};
          text-transform: uppercase;
          letter-spacing: 0.1em;
          font-weight: 300;
          cursor: pointer;
        }

        .update-btn:hover {
          background: #f9fafb;
        }
      `}</style>
      
      <div className="template-minimal" style={{ color: settings.colors.text, background: settings.colors.background }}>
        {/* Navigation */}
        {settings.layout.navigation === 'top' && (
          <nav className="nav-top" style={{ position: 'sticky', top: 0, zIndex: 1000, backgroundColor: settings.colors.background, backdropFilter: 'blur(10px)', padding: '1rem 0', borderBottom: `1px solid ${settings.colors.text}20`, boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div className="container">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {settings.branding.logo && (
                  <img
                    src={settings.branding.logo}
                    alt={`${settings.branding.coupleName} Logo`}
                    style={{
                      height: '40px',
                      width: 'auto',
                      objectFit: 'contain'
                    }}
                  />
                )}
                <div style={{ 
                  fontSize: '0.875rem',
                  fontWeight: 200,
                  letterSpacing: '0.3em',
                  textTransform: 'uppercase',
                  color: settings.colors.primary 
                }}>
                  {settings.branding.coupleName}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {settings.sections.hero.enabled && (
                  <button 
                    onClick={() => smoothScrollTo('hero')}
                    className={`nav-item ${activeSection === 'hero' ? 'active' : ''}`}
                    style={{ 
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: activeSection === 'hero' ? settings.colors.primary : settings.colors.text,
                      textDecoration: 'none',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {getSectionTitle('hero')}
                  </button>
                )}
                {settings.sections.story.enabled && (
                  <button 
                    onClick={() => smoothScrollTo('story')}
                    className={`nav-item ${activeSection === 'story' ? 'active' : ''}`}
                    style={{ 
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: activeSection === 'story' ? settings.colors.primary : settings.colors.text,
                      textDecoration: 'none',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {getSectionTitle('story')}
                  </button>
                )}
                {settings.sections.events.enabled && (
                  <button 
                    onClick={() => smoothScrollTo('events')}
                    className={`nav-item ${activeSection === 'events' ? 'active' : ''}`}
                    style={{ 
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: activeSection === 'events' ? settings.colors.primary : settings.colors.text,
                      textDecoration: 'none',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {getSectionTitle('events')}
                  </button>
                )}
                {settings.sections.accommodations.enabled && (
                  <button 
                    onClick={() => smoothScrollTo('accommodations')}
                    className={`nav-item ${activeSection === 'accommodations' ? 'active' : ''}`}
                    style={{ 
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: activeSection === 'accommodations' ? settings.colors.primary : settings.colors.text,
                      textDecoration: 'none',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {getSectionTitle('accommodations')}
                  </button>
                )}
                {settings.sections.rsvp.enabled && (
                  <button 
                    onClick={() => smoothScrollTo('rsvp')}
                    className={`nav-item ${activeSection === 'rsvp' ? 'active' : ''}`}
                    style={{ 
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: activeSection === 'rsvp' ? settings.colors.primary : settings.colors.text,
                      textDecoration: 'none',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {getSectionTitle('rsvp')}
                  </button>
                )}
                {settings.sections.gallery.enabled && (
                  <button 
                    onClick={() => smoothScrollTo('gallery')}
                    className={`nav-item ${activeSection === 'gallery' ? 'active' : ''}`}
                    style={{ 
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: activeSection === 'gallery' ? settings.colors.primary : settings.colors.text,
                      textDecoration: 'none',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {getSectionTitle('gallery')}
                  </button>
                )}
                {settings.sections.registry.enabled && (
                  <button 
                    onClick={() => smoothScrollTo('registry')}
                    className={`nav-item ${activeSection === 'registry' ? 'active' : ''}`}
                    style={{ 
                      fontSize: '0.75rem',
                      fontWeight: 300,
                      letterSpacing: '0.2em',
                      textTransform: 'uppercase',
                      color: activeSection === 'registry' ? settings.colors.primary : settings.colors.text,
                      textDecoration: 'none',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    {getSectionTitle('registry')}
                  </button>
                )}
              </div>

              {/* Mobile Burger Menu */}
              <div 
                className={`burger-menu ${isMobileMenuOpen ? 'active' : ''}`}
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <div className="burger-line"></div>
                <div className="burger-line"></div>
                <div className="burger-line"></div>
              </div>
            </div>
          </div>
          </nav>
        )}

        {/* Mobile Menu Overlay */}
        <div className="mobile-menu">
          {settings.sections.hero.enabled && (
            <button 
              onClick={() => {
                smoothScrollTo('hero');
                setIsMobileMenuOpen(false);
              }}
              className={`mobile-nav-item ${activeSection === 'hero' ? 'active' : ''}`}
              style={{ transitionDelay: '0.1s' }}
            >
              {getSectionTitle('hero')}
            </button>
          )}
          {settings.sections.story.enabled && (
            <button 
              onClick={() => {
                smoothScrollTo('story');
                setIsMobileMenuOpen(false);
              }}
              className={`mobile-nav-item ${activeSection === 'story' ? 'active' : ''}`}
              style={{ transitionDelay: '0.2s' }}
            >
              {getSectionTitle('story')}
            </button>
          )}
          {settings.sections.events.enabled && (
            <button 
              onClick={() => {
                smoothScrollTo('events');
                setIsMobileMenuOpen(false);
              }}
              className={`mobile-nav-item ${activeSection === 'events' ? 'active' : ''}`}
              style={{ transitionDelay: '0.3s' }}
            >
              {getSectionTitle('events')}
            </button>
          )}
          {settings.sections.accommodations.enabled && (
            <button 
              onClick={() => {
                smoothScrollTo('accommodations');
                setIsMobileMenuOpen(false);
              }}
              className={`mobile-nav-item ${activeSection === 'accommodations' ? 'active' : ''}`}
              style={{ transitionDelay: '0.4s' }}
            >
              {getSectionTitle('accommodations')}
            </button>
          )}
          {settings.sections.rsvp.enabled && (
            <button 
              onClick={() => {
                smoothScrollTo('rsvp');
                setIsMobileMenuOpen(false);
              }}
              className={`mobile-nav-item ${activeSection === 'rsvp' ? 'active' : ''}`}
              style={{ transitionDelay: '0.5s' }}
            >
              {getSectionTitle('rsvp')}
            </button>
          )}
          {settings.sections.gallery.enabled && (
            <button 
              onClick={() => {
                smoothScrollTo('gallery');
                setIsMobileMenuOpen(false);
              }}
              className={`mobile-nav-item ${activeSection === 'gallery' ? 'active' : ''}`}
              style={{ transitionDelay: '0.6s' }}
            >
              {getSectionTitle('gallery')}
            </button>
          )}
          {settings.sections.registry.enabled && (
            <button 
              onClick={() => {
                smoothScrollTo('registry');
                setIsMobileMenuOpen(false);
              }}
              className={`mobile-nav-item ${activeSection === 'registry' ? 'active' : ''}`}
              style={{ transitionDelay: '0.7s' }}
            >
              {getSectionTitle('registry')}
            </button>
          )}
        </div>

        {/* Hero Section */}
        {settings.sections.hero.enabled && (
          <section id="hero" className="hero-section">
            {settings.branding.heroPicture && <div className="hero-overlay"></div>}
            <div className="hero-content">
              <div style={{ 
                fontSize: '0.75rem',
                fontWeight: 200,
                letterSpacing: '0.3em',
                textTransform: 'uppercase',
                color: settings.colors.text,
                marginBottom: '3rem'
              }}>
                Wedding Invitation
              </div>
              
              <div className="hero-minimal-line"></div>
              
              <h1 className="hero-title">{welcomeMessage}</h1>
              
              <h2 className="hero-subtitle">{settings.branding.coupleName}</h2>
              
              {settings.branding.tagline && (
                <p style={{
                  fontSize: '1rem',
                  fontWeight: 200,
                  color: settings.colors.secondary,
                  marginBottom: '3rem',
                  letterSpacing: '0.05em'
                }}>
                  {settings.branding.tagline}
                </p>
              )}
              
              <div className="hero-date">{settings.branding.weddingDate}</div>
              
              {settings.content.heroMessage && (
                <p className="hero-description">{settings.content.heroMessage}</p>
              )}
              
              <div className="hero-minimal-line"></div>
            </div>
          </section>
        )}

        {/* Story Section */}
        {settings.sections.story.enabled && (
          <section id="story" className="section">
            <div className="container">
              <h2 className="section-title">{getSectionTitle('story')}</h2>
              <div className="minimal-divider"></div>
              <div className="card" style={{ 
                maxWidth: '60rem',
                margin: '0 auto',
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 300,
                  lineHeight: '1.8',
                  letterSpacing: '0.02em',
                  color: settings.colors.text,
                  position: 'relative'
                }}>
                  <div style={{
                    fontSize: '4rem',
                    color: settings.colors.primary,
                    opacity: 0.2,
                    position: 'absolute',
                    top: '-1rem',
                    left: '2rem',
                    fontFamily: 'Georgia, serif'
                  }}>
                    "
                  </div>
                  <div style={{ position: 'relative', zIndex: 2, padding: '0 2rem' }}>
                    {settings.content.storyText ? (
                      <p>{settings.content.storyText}</p>
                    ) : (
                      <p>Join us as we celebrate our love story and the beginning of our new journey together. This is where two hearts become one, and two lives intertwine to create something beautiful and lasting.</p>
                    )}
                  </div>
                  <div style={{
                    fontSize: '4rem',
                    color: settings.colors.primary,
                    opacity: 0.2,
                    position: 'absolute',
                    bottom: '-3rem',
                    right: '2rem',
                    fontFamily: 'Georgia, serif',
                    transform: 'rotate(180deg)'
                  }}>
                    "
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Events Section */}
        {settings.sections.events.enabled && personalizedEvents.length > 0 && (
          <section id="events" className="section">
            <div className="container">
              <h2 className="section-title">
                {getSectionTitle('events')}
                {guestGroup && (
                  <div style={{ 
                    fontSize: '0.875rem',
                    fontWeight: 300,
                    color: '#6b7280',
                    marginTop: '1rem',
                    textTransform: 'none',
                    letterSpacing: 'normal'
                  }}>
                    You're invited to attend
                  </div>
                )}
              </h2>
              <div className="event-grid">
                {personalizedEvents.map((event, index) => (
                  <div key={event.id} className="event-card" style={{ animationDelay: `${index * 0.1}s` }}>
                    {event.picture && (
                      <img
                        src={event.picture}
                        alt={event.name}
                        className="event-image"
                      />
                    )}
                    <div className="event-content">
                      <div className="event-date-badge">
                        {event.date} • {event.time}
                      </div>
                      <h3 className="event-title">{event.name}</h3>
                      <div className="event-location">{event.location}</div>
                      <div className="event-address">{event.address}</div>
                      {event.dresscode && (
                        <div className="event-details">
                          <strong>Dress Code:</strong> {event.dresscode}
                        </div>
                      )}
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

        {/* Accommodations Section */}
        {settings.sections.accommodations.enabled && settings.accommodations && settings.accommodations.length > 0 && (
          <section id="accommodations" className="section">
            <div className="container">
              <h2 className="section-title">{getSectionTitle('accommodations')}</h2>
              <div className="minimal-divider"></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
                {settings.accommodations.map((accommodation: any, index: number) => (
                  <div key={accommodation.id} className="card" style={{
                    animationDelay: `${index * 0.1}s`
                  }}>
                    {accommodation.picture && (
                      <img
                        src={accommodation.picture}
                        alt={accommodation.name}
                        style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                      />
                    )}
                    <div style={{ padding: '1.5rem' }}>
                      <h3 style={{
                        fontSize: '1.25rem',
                        fontWeight: 200,
                        color: settings.colors.primary,
                        marginBottom: '1rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        {accommodation.name}
                      </h3>
                      <div style={{
                        fontSize: '0.875rem',
                        color: '#6b7280',
                        lineHeight: 1.6,
                        marginBottom: '1rem'
                      }}>
                        <p><strong>Type:</strong> {accommodation.type}</p>
                        <p><strong>Address:</strong> {accommodation.address}</p>
                        {accommodation.distance && <p><strong>Distance:</strong> {accommodation.distance}</p>}
                        {accommodation.priceRange && <p><strong>Price Range:</strong> {accommodation.priceRange}</p>}
                        {accommodation.phone && <p><strong>Phone:</strong> {accommodation.phone}</p>}
                      </div>
                      {accommodation.description && (
                        <p style={{
                          fontSize: '0.875rem',
                          color: settings.colors.text,
                          lineHeight: 1.6,
                          marginBottom: '1rem',
                          fontStyle: 'italic'
                        }}>
                          {accommodation.description}
                        </p>
                      )}
                      {accommodation.website && (
                        <a
                          href={accommodation.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-minimal"
                          style={{ display: 'inline-block', marginTop: '1rem' }}
                        >
                          Book Now
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* RSVP Section */}
        {settings.sections.rsvp.enabled && (
          <section id="rsvp" className="section">
            <div className="container">
              <h2 className="section-title">{getSectionTitle('rsvp')}</h2>
              <div className="minimal-divider"></div>
              <div className="card" style={{ 
                maxWidth: '50rem', 
                margin: '0 auto', 
                padding: '3rem 2rem'
              }}>
                {/* Personalized Greeting */}
                <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
                  <div style={{
                    fontSize: '2.5rem',
                    color: settings.colors.primary,
                    opacity: 0.3,
                    marginBottom: '2rem'
                  }}>
                    💌
                  </div>
                  {guest.isMainGuest && guest.totalGuests > 1 ? (
                    <p style={{
                      fontSize: '1.25rem',
                      fontWeight: 300,
                      lineHeight: '1.7',
                      color: settings.colors.text,
                      marginBottom: '1rem'
                    }}>
                      Hello {firstName}, you are responsible for the RSVP of your group ({guest.totalGuests} guests)
                    </p>
                  ) : guest.parentGuestId ? (
                    <p style={{
                      fontSize: '1.25rem',
                      fontWeight: 300,
                      lineHeight: '1.7',
                      color: settings.colors.text,
                      marginBottom: '1rem'
                    }}>
                      Hello {firstName}, please answer the RSVP
                    </p>
                  ) : (
                    <p style={{
                      fontSize: '1.25rem',
                      fontWeight: 300,
                      lineHeight: '1.7',
                      color: settings.colors.text,
                      marginBottom: '1rem'
                    }}>
                      Please {firstName}, answer the RSVP
                    </p>
                  )}
                </div>

                {/* Event-specific RSVP Form */}
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ 
                    fontSize: '1.1rem', 
                    fontWeight: 400,
                    color: settings.colors.text,
                    marginBottom: '1rem',
                    textAlign: 'center'
                  }}>
                    Please indicate your attendance for each event
                  </h3>
                  
                  {(() => {
                    const invitedEvents = personalizedEvents.filter(event => guest.events?.includes(event.name));
                    if (invitedEvents.length === 0) {
                      return (
                        <div style={{
                          textAlign: 'center',
                          padding: '2rem',
                          color: settings.colors.text,
                          opacity: 0.7
                        }}>
                          No events available for RSVP
                        </div>
                      );
                    }
                    return invitedEvents.map((event, index) => {
                    return (
                      <div key={event.id} style={{
                        background: 'rgba(0,0,0,0.02)',
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1rem',
                        border: `1px solid ${settings.colors.text}10`
                      }}>
                        {/* Event Header */}
                        <div style={{ marginBottom: '1rem' }}>
                          <h4 style={{
                            fontSize: '1rem',
                            fontWeight: 500,
                            color: settings.colors.text,
                            marginBottom: '0.25rem'
                          }}>
                            {event.name}
                          </h4>
                          <p style={{
                            fontSize: '0.8rem',
                            color: settings.colors.text,
                            opacity: 0.7,
                            marginBottom: '0.1rem'
                          }}>
                            {event.date} • {event.time}
                          </p>
                          <p style={{
                            fontSize: '0.75rem',
                            color: settings.colors.text,
                            opacity: 0.6
                          }}>
                            {event.location}
                          </p>
                        </div>

                        {/* Guest Attendance List */}
                        <div style={{ marginTop: '0.75rem' }}>
                          <p style={{
                            fontSize: '0.85rem',
                            fontWeight: 500,
                            color: settings.colors.text,
                            marginBottom: '0.5rem'
                          }}>
                            Who's attending?
                          </p>
                          {loadingSubGuests && guest.isMainGuest && guest.totalGuests > 1 && (
                            <div style={{
                              fontSize: '0.75rem',
                              color: settings.colors.text,
                              opacity: 0.6,
                              fontStyle: 'italic',
                              marginBottom: '0.5rem'
                            }}>
                              Loading family members...
                            </div>
                          )}
                          {allGuests.map((guestItem) => {
                            const isAttending = eventResponses[event.name]?.[guestItem.id];
                            return (
                              <div key={guestItem.id} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '0.4rem 0',
                                borderBottom: guestItem.id !== allGuests[allGuests.length - 1].id ? `1px solid ${settings.colors.text}05` : 'none'
                              }}>
                                <span style={{
                                  fontSize: '0.8rem',
                                  color: settings.colors.text,
                                  fontWeight: guestItem.id === guest.id ? 500 : 400
                                }}>
                                  {guestItem.name} {guestItem.id === guest.id ? '(you)' : ''}
                                </span>
                                
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                  <button
                                    onClick={() => handleEventResponse(event.name, guestItem.id, true)}
                                    style={{
                                      background: isAttending === true ? settings.colors.primary : 'transparent',
                                      color: isAttending === true ? 'white' : settings.colors.text,
                                      border: `1px solid ${settings.colors.primary}`,
                                      borderRadius: '10px',
                                      padding: '0.15rem 0.4rem',
                                      fontSize: '0.65rem',
                                      cursor: 'pointer',
                                      minWidth: '28px',
                                      position: 'relative',
                                      zIndex: 10,
                                      pointerEvents: 'auto'
                                    }}
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => handleEventResponse(event.name, guestItem.id, false)}
                                    style={{
                                      background: isAttending === false ? '#EF4444' : 'transparent',
                                      color: isAttending === false ? 'white' : settings.colors.text,
                                      border: '1px solid #EF4444',
                                      borderRadius: '10px',
                                      padding: '0.15rem 0.4rem',
                                      fontSize: '0.65rem',
                                      cursor: 'pointer',
                                      minWidth: '28px',
                                      position: 'relative',
                                      zIndex: 10,
                                      pointerEvents: 'auto'
                                    }}
                                  >
                                    ✗
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                    });
                  })()}


                  {/* Additional Comments */}
                  <div style={{ marginTop: '2rem' }}>
                    <label style={{
                      fontSize: '1rem',
                      fontWeight: 400,
                      color: settings.colors.text,
                      marginBottom: '0.5rem',
                      display: 'block'
                    }}>
                      Additional Comments
                    </label>
                    <textarea
                      placeholder="Any message for the happy couple?"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '100px',
                        padding: '1rem',
                        border: `1px solid ${settings.colors.text}30`,
                        borderRadius: '10px',
                        fontSize: '1rem',
                        fontFamily: 'inherit',
                        resize: 'vertical',
                        background: 'white',
                        position: 'relative',
                        zIndex: 5,
                        pointerEvents: 'auto'
                      }}
                    />
                  </div>

                  {/* Submit Button */}
                  <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                    <button 
                      onClick={handleRSVPSubmit}
                      disabled={submittingRSVP}
                      className="btn-minimal"
                      style={{
                        background: submittingRSVP ? '#ccc' : settings.colors.primary,
                        color: 'white',
                        padding: '1rem 3rem',
                        fontSize: '1.1rem',
                        fontWeight: 500,
                        cursor: submittingRSVP ? 'not-allowed' : 'pointer',
                        position: 'relative',
                        zIndex: 10,
                        pointerEvents: 'auto',
                        border: 'none',
                        borderRadius: '25px',
                        opacity: submittingRSVP ? 0.7 : 1
                      }}
                    >
                      {submittingRSVP ? 'Submitting...' : (guest.rsvp?.status === 'pending' || !guest.rsvp ? 'Submit RSVP' : 'Update RSVP')}
                    </button>
                  </div>

                  {/* Status Display if already submitted */}
                  {guest.rsvp && guest.rsvp.status !== 'pending' && (
                    <div style={{
                      marginTop: '2rem',
                      padding: '1.5rem',
                      background: 'rgba(16, 185, 129, 0.1)',
                      borderRadius: '15px',
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '1.5rem',
                        marginBottom: '1rem'
                      }}>
                        {guest.rsvp.status === 'accepted' ? '🎉' : '💝'}
                      </div>
                      <p style={{
                        fontSize: '1.1rem',
                        color: settings.colors.text,
                        fontWeight: 500
                      }}>
                        Thank you for your response!
                      </p>
                      {guest.rsvp.submittedAt && (
                        <p style={{
                          fontSize: '0.9rem',
                          color: settings.colors.text,
                          opacity: 0.7,
                          marginTop: '0.5rem'
                        }}>
                          Submitted on {new Date(guest.rsvp.submittedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Gallery Section */}
        {settings.sections.gallery.enabled && (
          <section id="gallery" className="section">
            <div className="container">
              <h2 className="section-title">{getSectionTitle('gallery')}</h2>
              <div className="minimal-divider"></div>
              <div className="card" style={{ 
                maxWidth: '60rem',
                margin: '0 auto',
                textAlign: 'center',
                padding: '4rem 2rem'
              }}>
                <div style={{
                  fontSize: '3rem',
                  color: settings.colors.primary,
                  opacity: 0.3,
                  marginBottom: '2rem'
                }}>
                  📸
                </div>
                <div style={{
                  fontSize: '1.125rem',
                  fontWeight: 300,
                  lineHeight: '1.8',
                  color: settings.colors.text,
                  marginBottom: '2rem'
                }}>
                  Our beautiful moments together will be displayed here.
                </div>
                <div style={{
                  fontSize: '0.9rem',
                  color: settings.colors.secondary,
                  opacity: 0.7,
                  fontStyle: 'italic'
                }}>
                  Coming soon - A collection of our favorite memories
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Registry Section */}
        {settings.sections.registry.enabled && settings.registry && (
          <section id="registry" className="section">
            <div className="container">
              <h2 className="section-title">{getSectionTitle('registry')}</h2>
              <div className="minimal-divider"></div>
              <div className="card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
                {settings.registry.message && (
                  <p style={{
                    fontSize: '1rem',
                    color: settings.colors.text,
                    lineHeight: 1.7,
                    marginBottom: '2rem'
                  }}>
                    {settings.registry.message}
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  {settings.registry.links && settings.registry.links.map((link: any, index: number) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-minimal"
                      style={{ minWidth: '200px' }}
                    >
                      {link.store}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}


        {/* Additional Info */}
        {settings.content.additionalInfo && (
          <section className="section">
            <div className="container">
              <div style={{ 
                maxWidth: '48rem',
                margin: '0 auto',
                textAlign: 'center',
                fontSize: '1rem',
                fontWeight: 300,
                lineHeight: '1.8',
                letterSpacing: '0.02em'
              }}>
                <p>{settings.content.additionalInfo}</p>
              </div>
            </div>
          </section>
        )}

        {/* Footer spacing */}
        <div style={{ paddingBottom: '6rem' }}></div>
      </div>
    </>
  );
}