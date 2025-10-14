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
  accommodations: Accommodation[];
  registry?: {
    message?: string;
    links: Array<{
      store: string;
      url: string;
    }>;
  };
}

interface ModernInviteTemplateProps {
  guest: Guest;
  guestGroup: Group | null;
  settings: WebsiteSettings;
  personalizedEvents: WebsiteEvent[];
  coupleId: string;
}

export default function ModernInviteTemplate({
  guest,
  guestGroup,
  settings,
  personalizedEvents,
  coupleId
}: ModernInviteTemplateProps) {
  const [eventResponses, setEventResponses] = useState<{[eventName: string]: {[guestId: string]: boolean}}>(
    guest.rsvp?.events || {}
  );
  
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
  const [comments, setComments] = useState(guest.rsvp?.comments || '');
  const [subGuests, setSubGuests] = useState<Guest[]>([]);
  const [loadingSubGuests, setLoadingSubGuests] = useState(false);
  const [submittingRSVP, setSubmittingRSVP] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Use firstName from guest data
  const firstName = guest.firstName;
  const welcomeMessage = `Hello ${firstName || 'Guest'}!`;
  
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
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        
        :global(.template-modern) {
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          font-weight: 400;
          line-height: 1.6;
          color: #ffffff;
          background: linear-gradient(135deg, #000000 0%, #0a0a0a 25%, #111111 50%, #0d0d0d 75%, #000000 100%);
          scroll-behavior: smooth;
        }

        :global(.template-modern h1), :global(.template-modern h2), :global(.template-modern h3), :global(.template-modern h4) {
          font-family: 'Space Grotesk', 'Inter', sans-serif;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        :global(.template-modern h1) {
          font-size: clamp(3rem, 8vw, 6rem);
          font-weight: 900;
          line-height: 0.9;
          margin-bottom: 2rem;
        }

        :global(.template-modern h2) {
          font-size: clamp(2rem, 5vw, 3.5rem);
          font-weight: 800;
          margin-bottom: 1.5rem;
        }

        :global(.template-modern h3) {
          font-size: clamp(1.25rem, 3vw, 1.75rem);
          font-weight: 700;
          margin-bottom: 1rem;
        }

        .geometric-bg {
          background: linear-gradient(135deg, #000 0%, #0f0f0f 25%, #1a1a1a 50%, #0f0f0f 75%, #000 100%);
          position: relative;
          overflow: hidden;
        }

        .geometric-bg::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%),
            linear-gradient(-45deg, transparent 40%, rgba(255,255,255,0.03) 50%, transparent 60%),
            radial-gradient(circle at 20% 80%, ${settings.colors.primary}08 0%, transparent 50%),
            radial-gradient(circle at 80% 20%, ${settings.colors.secondary}06 0%, transparent 50%),
            radial-gradient(circle at 40% 40%, ${settings.colors.accent}04 0%, transparent 50%);
          background-size: 120px 120px, 120px 120px, 800px 800px, 800px 800px, 600px 600px;
          opacity: 0.4;
          animation: geometric-drift 20s ease-in-out infinite;
        }

        @keyframes geometric-drift {
          0%, 100% {
            transform: translateX(0) translateY(0);
            opacity: 0.4;
          }
          25% {
            transform: translateX(10px) translateY(-10px);
            opacity: 0.5;
          }
          50% {
            transform: translateX(-5px) translateY(-5px);
            opacity: 0.3;
          }
          75% {
            transform: translateX(-10px) translateY(5px);
            opacity: 0.45;
          }
        }

        .modern-accent {
          width: 4px;
          height: 60px;
          background: ${settings.colors.primary};
          display: inline-block;
          margin-right: 1rem;
        }

        .geometric-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 4rem 0;
        }

        .geometric-divider::before,
        .geometric-divider::after {
          content: '';
          flex: 1;
          height: 2px;
          background: ${settings.colors.secondary};
        }

        .geometric-divider span {
          width: 20px;
          height: 20px;
          background: ${settings.colors.primary};
          margin: 0 2rem;
          transform: rotate(45deg);
        }

        .nav-modern {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(0, 0, 0, 0.98);
          backdrop-filter: blur(25px) saturate(120%);
          border-bottom: 3px solid ${settings.colors.primary};
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.8), 0 1px 4px rgba(0, 0, 0, 0.6);
          z-index: 1000;
          padding: 1.2rem 0;
          transition: all 0.3s ease;
        }

        .nav-modern::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(to right, transparent, ${settings.colors.accent}, transparent);
        }

        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        .mobile-menu-toggle {
          display: none;
          flex-direction: column;
          gap: 4px;
          cursor: pointer;
          padding: 0.5rem;
          transition: all 0.3s ease;
        }

        .mobile-menu-bar {
          width: 25px;
          height: 3px;
          background: ${settings.colors.primary};
          transition: all 0.3s ease;
          transform-origin: center;
        }

        .mobile-menu-toggle.active .mobile-menu-bar:nth-child(1) {
          transform: rotate(45deg) translate(7px, 7px);
        }

        .mobile-menu-toggle.active .mobile-menu-bar:nth-child(2) {
          opacity: 0;
        }

        .mobile-menu-toggle.active .mobile-menu-bar:nth-child(3) {
          transform: rotate(-45deg) translate(7px, -7px);
        }

        .desktop-nav {
          display: flex;
          gap: 3rem;
        }

        .mobile-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.98);
          backdrop-filter: blur(25px);
          z-index: 999;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 2rem;
          transform: translateX(${isMobileMenuOpen ? '0' : '100%'});
          transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }

        .mobile-nav-link {
          font-size: 1.5rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          color: #ffffff;
          text-decoration: none;
          padding: 1rem;
          border-bottom: 2px solid transparent;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .mobile-nav-link::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, ${settings.colors.primary}30, transparent);
          transition: left 0.5s ease;
        }

        .mobile-nav-link:hover::before {
          left: 100%;
        }

        .mobile-nav-link:hover {
          color: ${settings.colors.primary};
          border-bottom-color: ${settings.colors.primary};
          transform: translateX(10px);
        }

        .hero-modern {
          min-height: 100vh;
          display: flex;
          align-items: center;
          position: relative;
          padding: 8rem 0;
        }

        .hero-content {
          position: relative;
          z-index: 2;
        }

        .hero-label {
          font-size: 0.875rem;
          font-weight: 700;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: ${settings.colors.secondary};
          margin-bottom: 3rem;
          display: flex;
          align-items: center;
        }

        .hero-label::before {
          content: '';
          width: 40px;
          height: 2px;
          background: ${settings.colors.primary};
          margin-right: 1rem;
        }

        .hero-title {
          font-size: clamp(3rem, 8vw, 6rem);
          font-weight: 900;
          line-height: 0.9;
          margin-bottom: 2rem;
          color: #ffffff;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .hero-title .primary-text {
          color: ${settings.colors.primary};
        }

        .hero-subtitle {
          font-size: clamp(1.5rem, 4vw, 2.5rem);
          font-weight: 800;
          color: ${settings.colors.secondary};
          margin-bottom: 3rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .hero-date {
          font-size: 1.5rem;
          font-weight: 300;
          font-family: 'Courier New', monospace;
          color: ${settings.colors.accent};
          margin-bottom: 3rem;
          letter-spacing: 0.2em;
        }

        .hero-tagline {
          font-size: 1.25rem;
          font-weight: 300;
          color: #cccccc;
          margin-bottom: 4rem;
          max-width: 600px;
        }

        .color-bars {
          display: flex;
          gap: 8px;
          margin-bottom: 4rem;
        }

        .color-bar {
          width: 60px;
          height: 4px;
        }

        .section-modern {
          padding: 8rem 0;
          position: relative;
        }

        .section-title {
          font-size: clamp(2rem, 5vw, 3.5rem);
          font-weight: 800;
          text-align: center;
          margin-bottom: 4rem;
          color: ${settings.colors.primary};
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .event-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 3rem;
          margin-top: 4rem;
          max-width: 85rem;
          margin-left: auto;
          margin-right: auto;
        }

        .event-card {
          background: linear-gradient(135deg, #1a1a1a 0%, #1f1f1f 100%);
          border: 2px solid #333;
          position: relative;
          overflow: hidden;
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          border-radius: 0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
        }

        .event-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 5px;
          background: linear-gradient(90deg, ${settings.colors.primary}, ${settings.colors.secondary}, ${settings.colors.accent});
          transform: scaleX(0);
          transform-origin: left;
          transition: transform 0.4s ease;
        }

        .event-card::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.02) 50%, transparent 60%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .event-card:hover {
          border-color: ${settings.colors.primary}80;
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7), 0 4px 20px ${settings.colors.primary}20;
        }

        .event-card:hover::before {
          transform: scaleX(1);
        }

        .event-card:hover::after {
          opacity: 1;
        }

        .event-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
        }

        .event-content {
          padding: 2rem;
        }

        .event-title {
          font-size: 1.5rem;
          font-weight: 700;
          color: ${settings.colors.primary};
          margin-bottom: 1.5rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }

        .event-details {
          font-size: 1rem;
          line-height: 1.8;
          color: #cccccc;
        }

        .event-details strong {
          color: #ffffff;
          font-weight: 700;
        }

        .rsvp-content {
          text-align: center;
          max-width: 600px;
          margin: 0 auto;
        }

        .rsvp-description {
          font-size: 1.25rem;
          font-weight: 300;
          color: #cccccc;
          margin-bottom: 3rem;
          line-height: 1.6;
        }

        .btn-modern {
          background: linear-gradient(45deg, ${settings.colors.primary}, ${settings.colors.secondary});
          color: #000000;
          border: none;
          padding: 1.2rem 3.5rem;
          font-size: 1rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          position: relative;
          overflow: hidden;
          clip-path: polygon(0 0, calc(100% - 15px) 0, 100% 100%, 15px 100%);
          box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        }

        .btn-modern::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(0,0,0,0.2), transparent);
          transition: left 0.6s ease;
          z-index: 1;
        }

        .btn-modern::after {
          content: '';
          position: absolute;
          inset: 2px;
          background: linear-gradient(45deg, ${settings.colors.secondary}, ${settings.colors.accent});
          opacity: 0;
          transition: opacity 0.3s ease;
          clip-path: polygon(0 0, calc(100% - 13px) 0, 100% 100%, 13px 100%);
          z-index: -1;
        }

        .btn-modern:hover::before {
          left: 100%;
        }

        .btn-modern:hover::after {
          opacity: 1;
        }

        .btn-modern:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 15px 40px rgba(0,0,0,0.6), 0 5px 15px ${settings.colors.primary}30;
        }

        .btn-modern:active {
          transform: translateY(-2px) scale(0.98);
          box-shadow: 0 8px 20px rgba(0,0,0,0.4);
        }

        .rsvp-status {
          display: inline-block;
          padding: 1rem 2rem;
          font-size: 1.125rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border: 2px solid;
          color: #000000;
          margin-bottom: 2rem;
        }

        .rsvp-comments {
          font-size: 1rem;
          font-style: italic;
          color: #999999;
          margin-bottom: 2rem;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        .update-btn {
          background: transparent;
          color: ${settings.colors.primary};
          border: 1px solid ${settings.colors.primary};
          padding: 0.75rem 2rem;
          font-size: 0.875rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.2em;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .update-btn:hover {
          background: ${settings.colors.primary};
          color: #000000;
        }

        .story-content {
          max-width: 800px;
          margin: 0 auto;
          font-size: 1.125rem;
          line-height: 1.8;
          color: #cccccc;
          text-align: center;
        }

        .additional-info {
          max-width: 800px;
          margin: 0 auto;
          font-size: 1.125rem;
          line-height: 1.8;
          color: #cccccc;
          text-align: center;
        }

        @media (max-width: 1024px) {
          .desktop-nav {
            display: none;
          }
          
          .mobile-menu-toggle {
            display: flex;
          }
          
          .event-grid {
            grid-template-columns: 1fr;
            gap: 2rem;
          }
          
          .hero-modern {
            padding: 6rem 0;
          }
          
          .hero-modern .container > div {
            grid-template-columns: 1fr !important;
            gap: 2rem !important;
            text-align: center;
          }
          
          .section-modern {
            padding: 4rem 0;
          }
        }

        @media (max-width: 768px) {
          .container {
            padding: 0 1rem;
          }
          
          .nav-modern {
            padding: 1rem 0;
          }
          
          .hero-modern {
            padding: 4rem 0;
            margin-top: 4rem;
          }
          
          .section-modern {
            padding: 3rem 0;
          }
          
          .event-card {
            margin-bottom: 1.5rem;
          }
          
          .color-bars {
            justify-content: center;
          }
          
          .mobile-nav-link {
            font-size: 1.25rem;
          }
          
          .geometric-bg::before {
            background-size: 80px 80px, 80px 80px, 600px 600px, 600px 600px, 400px 400px;
          }
        }

        @media (max-width: 480px) {
          .container {
            padding: 0 0.75rem;
          }
          
          .hero-modern {
            padding: 3rem 0;
            margin-top: 3rem;
          }
          
          .section-modern {
            padding: 2rem 0;
          }
          
          .mobile-nav-link {
            font-size: 1.1rem;
            padding: 0.75rem;
          }
          
          .btn-modern {
            padding: 1rem 2.5rem;
            font-size: 0.9rem;
          }
          
          .event-content {
            padding: 1.5rem;
          }
          
          .gallery-grid {
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
          }
        }

        /* Gallery responsive styles */
        @media (max-width: 1024px) {
          .gallery-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1.5rem;
          }
        }

        @media (max-width: 768px) {
          .gallery-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }
        }

        @media (max-width: 480px) {
          .gallery-grid {
            grid-template-columns: 1fr 1fr;
            gap: 1rem;
          }
        }

        /* Contact section responsive styles */
        @media (max-width: 768px) {
          .contact-grid {
            grid-template-columns: 1fr !important;
            gap: 1.5rem;
          }
        }

        /* Registry section responsive styles */
        @media (max-width: 768px) {
          .registry-links {
            flex-direction: column;
            width: 100%;
          }
          
          .registry-links a {
            width: 100%;
            text-align: center;
          }
        }

        /* Mobile-specific RSVP styles */
        @media (max-width: 768px) {
          .rsvp-section-container {
            padding: 2rem 1.5rem !important;
          }
          
          .rsvp-event-responses {
            flex-direction: column;
            gap: 0.5rem;
          }
          
          .rsvp-event-responses button {
            width: 100%;
            min-width: auto;
          }
          
          .rsvp-guest-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
            padding: 1rem !important;
          }
          
          .rsvp-guest-row span {
            margin-bottom: 0.5rem;
            width: 100%;
          }
          
          .rsvp-event-container {
            padding: 1.5rem !important;
          }
          
          .rsvp-textarea {
            min-height: 100px !important;
            padding: 1rem !important;
          }
          
          .rsvp-submit-button {
            padding: 1.2rem 3rem !important;
            font-size: 1rem !important;
            width: 100%;
          }
        }

        /* Accommodations responsive styles */
        @media (max-width: 768px) {
          .accommodations-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
        }

        /* Additional mobile navigation improvements */
        @media (max-width: 480px) {
          .mobile-nav {
            padding: 2rem 1rem;
          }
          
          .mobile-nav-link {
            width: 100%;
            text-align: center;
            padding: 1rem;
            margin: 0.25rem 0;
          }
          
          .nav-modern {
            padding: 0.75rem 0;
          }
          
          .nav-modern .container {
            padding: 0 1rem;
          }
        }

        /* Better responsive text sizing */
        @media (max-width: 480px) {
          .hero-title {
            font-size: clamp(2.5rem, 7vw, 4rem) !important;
            margin-bottom: 1.5rem !important;
          }
          
          .hero-subtitle {
            font-size: clamp(1.2rem, 3.5vw, 2rem) !important;
            margin-bottom: 2rem !important;
          }
          
          .section-title {
            font-size: clamp(1.5rem, 4vw, 2.5rem) !important;
            margin-bottom: 3rem !important;
          }
          
          .event-title {
            font-size: 1.2rem !important;
          }
        }
      `}</style>
      
      <div className="template-modern" style={{ color: settings.colors.text, background: settings.colors.background }}>
        {/* Navigation */}
        {settings.layout.navigation === 'top' && (
          <>
            <nav className="nav-modern">
              <div className="container">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    {settings.branding.logo ? (
                      <img
                        src={settings.branding.logo}
                        alt={`${settings.branding.coupleName} Logo`}
                        style={{
                          height: '50px',
                          width: 'auto',
                          objectFit: 'contain'
                        }}
                      />
                    ) : (
                      <div style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        color: settings.colors.primary,
                        textShadow: '0 0 10px rgba(255, 255, 255, 0.1)'
                      }}>
                        {settings.branding.coupleName}
                      </div>
                    )}
                  </div>

                  {/* Desktop Navigation */}
                  <div className="desktop-nav">
                    {settings.sections.hero.enabled && (
                      <a href="#hero" style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        color: '#ffffff',
                        textDecoration: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.color = settings.colors.primary}
                      onMouseLeave={(e) => e.target.style.color = '#ffffff'}>
                        {getSectionTitle('hero')}
                      </a>
                    )}
                    {settings.sections.story.enabled && (
                      <a href="#story" style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        color: '#ffffff',
                        textDecoration: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.color = settings.colors.primary}
                      onMouseLeave={(e) => e.target.style.color = '#ffffff'}>
                        {getSectionTitle('story')}
                      </a>
                    )}
                    {settings.sections.events.enabled && (
                      <a href="#events" style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        color: '#ffffff',
                        textDecoration: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.color = settings.colors.primary}
                      onMouseLeave={(e) => e.target.style.color = '#ffffff'}>
                        {getSectionTitle('events')}
                      </a>
                    )}
                    {settings.sections.accommodations.enabled && (
                      <a href="#accommodations" style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        color: '#ffffff',
                        textDecoration: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.color = settings.colors.primary}
                      onMouseLeave={(e) => e.target.style.color = '#ffffff'}>
                        {getSectionTitle('accommodations')}
                      </a>
                    )}
                    {settings.sections.rsvp.enabled && (
                      <a href="#rsvp" style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        color: '#ffffff',
                        textDecoration: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.color = settings.colors.primary}
                      onMouseLeave={(e) => e.target.style.color = '#ffffff'}>
                        {getSectionTitle('rsvp')}
                      </a>
                    )}
                    {settings.sections.gallery.enabled && (
                      <a href="#gallery" style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        color: '#ffffff',
                        textDecoration: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.color = settings.colors.primary}
                      onMouseLeave={(e) => e.target.style.color = '#ffffff'}>
                        {getSectionTitle('gallery')}
                      </a>
                    )}
                    {settings.sections.registry.enabled && (
                      <a href="#registry" style={{
                        fontSize: '0.875rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.2em',
                        color: '#ffffff',
                        textDecoration: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onMouseEnter={(e) => e.target.style.color = settings.colors.primary}
                      onMouseLeave={(e) => e.target.style.color = '#ffffff'}>
                        {getSectionTitle('registry')}
                      </a>
                    )}
                  </div>

                  {/* Mobile Menu Toggle */}
                  <div 
                    className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  >
                    <div className="mobile-menu-bar"></div>
                    <div className="mobile-menu-bar"></div>
                    <div className="mobile-menu-bar"></div>
                  </div>
                </div>
              </div>
            </nav>

            {/* Mobile Navigation Menu */}
            <div className="mobile-nav">
              {settings.sections.hero.enabled && (
                <a 
                  href="#hero" 
                  className="mobile-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {getSectionTitle('hero')}
                </a>
              )}
              {settings.sections.story.enabled && (
                <a 
                  href="#story" 
                  className="mobile-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {getSectionTitle('story')}
                </a>
              )}
              {settings.sections.events.enabled && (
                <a 
                  href="#events" 
                  className="mobile-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {getSectionTitle('events')}
                </a>
              )}
              {settings.sections.accommodations.enabled && (
                <a 
                  href="#accommodations" 
                  className="mobile-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {getSectionTitle('accommodations')}
                </a>
              )}
              {settings.sections.rsvp.enabled && (
                <a 
                  href="#rsvp" 
                  className="mobile-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {getSectionTitle('rsvp')}
                </a>
              )}
              {settings.sections.gallery.enabled && (
                <a 
                  href="#gallery" 
                  className="mobile-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {getSectionTitle('gallery')}
                </a>
              )}
              {settings.sections.registry.enabled && (
                <a 
                  href="#registry" 
                  className="mobile-nav-link"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  {getSectionTitle('registry')}
                </a>
              )}
            </div>
          </>
        )}

        {/* Hero Section */}
        {settings.sections.hero.enabled && (
          <section id="hero" className="hero-modern geometric-bg">
            <div className="container">
              <div style={{ display: 'grid', gridTemplateColumns: settings.branding.heroPicture ? '1fr 1fr' : '1fr', gap: '4rem', alignItems: 'center' }}>
                <div className="hero-content">
                  <div className="hero-label">
                    Wedding Invitation
                  </div>
                  
                  <h1 className="hero-title">
                    <span className="primary-text">{welcomeMessage.split(' ')[0]}</span>
                    <br />
                    {welcomeMessage.split(' ').slice(1).join(' ')}
                  </h1>
                  
                  <h2 className="hero-subtitle">{settings.branding.coupleName}</h2>
                  
                  <div className="hero-date">{settings.branding.weddingDate}</div>
                  
                  {settings.branding.tagline && (
                    <p className="hero-tagline">{settings.branding.tagline}</p>
                  )}
                  
                  {settings.content.heroMessage && (
                    <p className="hero-tagline">{settings.content.heroMessage}</p>
                  )}
                  
                  <div className="color-bars">
                    <div className="color-bar" style={{ backgroundColor: settings.colors.primary }}></div>
                    <div className="color-bar" style={{ backgroundColor: settings.colors.secondary }}></div>
                    <div className="color-bar" style={{ backgroundColor: settings.colors.accent }}></div>
                    <div className="color-bar" style={{ backgroundColor: '#ffffff' }}></div>
                  </div>
                </div>
                
                {settings.branding.heroPicture && (
                  <div>
                    <img
                      src={settings.branding.heroPicture}
                      alt={`${settings.branding.coupleName} - Wedding`}
                      style={{
                        width: '100%',
                        height: 'auto',
                        border: `4px solid ${settings.colors.primary}`,
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Story Section */}
        {settings.sections.story.enabled && (
          <section id="story" className="section-modern" style={{ background: '#111111' }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('story')}</h2>
              <div className="geometric-divider">
                <span></span>
              </div>
              <div className="story-content">
                {settings.content.storyText ? (
                  <p>{settings.content.storyText}</p>
                ) : (
                  <p>Join us as we celebrate our love story and the beginning of our new journey together.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Events Section */}
        {settings.sections.events.enabled && personalizedEvents.length > 0 && (
          <section id="events" className="section-modern geometric-bg">
            <div className="container">
              <h2 className="section-title">
                {getSectionTitle('events')}
                {guestGroup && (
                  <div style={{
                    fontSize: '1.125rem',
                    fontWeight: 300,
                    color: '#999999',
                    marginTop: '1rem',
                    textTransform: 'none',
                    letterSpacing: 'normal'
                  }}>
                    Events you're invited to attend
                  </div>
                )}
              </h2>
              <div className="event-grid">
                {personalizedEvents.map((event) => (
                  <div key={event.id} className="event-card">
                    {event.picture && (
                      <img
                        src={event.picture}
                        alt={event.name}
                        className="event-image"
                      />
                    )}
                    <div className="event-content">
                      <h3 className="event-title">{event.name}</h3>
                      <div className="event-details">
                        <p><strong>Date:</strong> {event.date}</p>
                        <p><strong>Time:</strong> {event.time}</p>
                        <p><strong>Location:</strong> {event.location}</p>
                        <p><strong>Address:</strong> {event.address}</p>
                        {event.dresscode && <p><strong>Dress Code:</strong> {event.dresscode}</p>}
                        {event.description && <p style={{ marginTop: '1rem' }}>{event.description}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Accommodations Section */}
        {settings.sections.accommodations.enabled && settings.accommodations && settings.accommodations.length > 0 && (
          <section id="accommodations" className="section-modern" style={{ background: '#111111' }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('accommodations')}</h2>
              <div className="geometric-divider">
                <span></span>
              </div>
              <div className="event-grid accommodations-grid">
                {settings.accommodations.map((accommodation: any) => (
                  <div key={accommodation.id} className="event-card">
                    {accommodation.picture && (
                      <img
                        src={accommodation.picture}
                        alt={accommodation.name}
                        className="event-image"
                      />
                    )}
                    <div className="event-content">
                      <h3 className="event-title">{accommodation.name}</h3>
                      <div className="event-details">
                        <p><strong>Type:</strong> {accommodation.type}</p>
                        <p><strong>Address:</strong> {accommodation.address}</p>
                        {accommodation.distance && <p><strong>Distance:</strong> {accommodation.distance}</p>}
                        {accommodation.priceRange && <p><strong>Price Range:</strong> {accommodation.priceRange}</p>}
                        {accommodation.phone && <p><strong>Phone:</strong> {accommodation.phone}</p>}
                        {accommodation.description && <p style={{ marginTop: '1rem' }}>{accommodation.description}</p>}
                      </div>
                      {accommodation.website && (
                        <div style={{ marginTop: '1.5rem' }}>
                          <a
                            href={accommodation.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-modern"
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

        {/* RSVP Section */}
        {settings.sections.rsvp.enabled && (
          <section id="rsvp" className="section-modern" style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #111111 100%)' }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('rsvp')}</h2>
              <div className="geometric-divider">
                <span></span>
              </div>
              
              <div className="rsvp-section-container" style={{ 
                maxWidth: '60rem', 
                margin: '0 auto',
                background: 'linear-gradient(135deg, #1a1a1a 0%, #1f1f1f 100%)',
                border: `2px solid ${settings.colors.primary}40`,
                padding: '4rem 3rem',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Modern grid background */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundImage: `
                    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px',
                  opacity: 0.3,
                  pointerEvents: 'none'
                }}></div>
                
                {/* Top accent bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: `linear-gradient(90deg, ${settings.colors.primary}, ${settings.colors.secondary}, ${settings.colors.accent})`
                }}></div>
                
                {/* Personalized Greeting */}
                <div style={{ marginBottom: '3rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
                  <div style={{
                    fontSize: '3rem',
                    marginBottom: '1.5rem',
                    filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.1))'
                  }}>
                    ⚡
                  </div>
                  
                  {guest.isMainGuest && guest.totalGuests > 1 ? (
                    <p style={{
                      fontSize: '1.4rem',
                      fontWeight: 400,
                      lineHeight: '1.6',
                      color: '#cccccc',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {firstName}, you are responsible for your group RSVP ({guest.totalGuests} guests)
                    </p>
                  ) : guest.parentGuestId ? (
                    <p style={{
                      fontSize: '1.4rem',
                      fontWeight: 400,
                      lineHeight: '1.6',
                      color: '#cccccc',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {firstName}, please submit your RSVP response
                    </p>
                  ) : (
                    <p style={{
                      fontSize: '1.4rem',
                      fontWeight: 400,
                      lineHeight: '1.6',
                      color: '#cccccc',
                      marginBottom: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {firstName}, confirm your attendance
                    </p>
                  )}
                </div>
                
                {/* Event-specific RSVP Form */}
                <div style={{ textAlign: 'left', position: 'relative', zIndex: 1 }}>
                  <h3 style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 700,
                    color: settings.colors.primary,
                    marginBottom: '2.5rem',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em'
                  }}>
                    SELECT YOUR EVENT ATTENDANCE
                  </h3>
                  
                  {(() => {
                    const invitedEvents = personalizedEvents.filter(event => guest.events?.includes(event.name));
                    if (invitedEvents.length === 0) {
                      return (
                        <div style={{
                          textAlign: 'center',
                          padding: '3rem',
                          color: '#666666',
                          fontSize: '1.1rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.1em'
                        }}>
                          No events available for RSVP
                        </div>
                      );
                    }
                    
                    return invitedEvents.map((event, index) => {
                      return (
                        <div key={event.id} className="rsvp-event-container" style={{
                          background: 'linear-gradient(135deg, #222222 0%, #2a2a2a 100%)',
                          padding: '2rem',
                          marginBottom: '2rem',
                          border: `1px solid ${settings.colors.secondary}30`,
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          {/* Event accent bar */}
                          <div style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '3px',
                            background: `linear-gradient(90deg, ${settings.colors.primary}, ${settings.colors.secondary})`
                          }}></div>
                          
                          {/* Event Header */}
                          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                            <h4 style={{
                              fontSize: '1.3rem',
                              fontWeight: 700,
                              color: settings.colors.primary,
                              marginBottom: '0.5rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.1em'
                            }}>
                              {event.name}
                            </h4>
                            <p style={{
                              fontSize: '1rem',
                              color: '#999999',
                              marginBottom: '0.5rem',
                              fontFamily: 'JetBrains Mono, monospace'
                            }}>
                              {event.date} // {event.time}
                            </p>
                            <p style={{
                              fontSize: '0.9rem',
                              color: '#777777',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              {event.location}
                            </p>
                          </div>
                          
                          {/* Guest Responses */}
                          {allGuests.map((guestItem, guestIndex) => {
                            const isAttending = eventResponses[event.name]?.[guestItem.id];
                            
                            return (
                              <div key={guestItem.id} className="rsvp-guest-row" style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '1rem',
                                marginBottom: '0.75rem',
                                background: 'linear-gradient(135deg, #1a1a1a 0%, #1f1f1f 100%)',
                                border: `1px solid ${settings.colors.secondary}20`
                              }}>
                                <span style={{
                                  fontSize: '1rem',
                                  fontWeight: 600,
                                  color: '#ffffff',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.05em'
                                }}>
                                  {guestItem.name} {guestItem.id === guest.id ? '[YOU]' : ''}
                                </span>
                                
                                <div className="rsvp-event-responses" style={{ display: 'flex', gap: '0.75rem' }}>
                                  <button
                                    onClick={() => handleEventResponse(event.name, guestItem.id, true)}
                                    style={{
                                      background: isAttending === true 
                                        ? `linear-gradient(45deg, ${settings.colors.primary}, ${settings.colors.secondary})` 
                                        : 'transparent',
                                      color: isAttending === true ? '#000000' : settings.colors.primary,
                                      border: `2px solid ${settings.colors.primary}`,
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.875rem',
                                      cursor: 'pointer',
                                      minWidth: '80px',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.1em',
                                      transition: 'all 0.3s ease',
                                      clipPath: isAttending === true ? 'polygon(0 0, calc(100% - 8px) 0, 100% 100%, 8px 100%)' : 'none'
                                    }}
                                  >
                                    YES
                                  </button>
                                  <button
                                    onClick={() => handleEventResponse(event.name, guestItem.id, false)}
                                    style={{
                                      background: isAttending === false ? '#EF4444' : 'transparent',
                                      color: isAttending === false ? '#ffffff' : '#EF4444',
                                      border: '2px solid #EF4444',
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.875rem',
                                      cursor: 'pointer',
                                      minWidth: '80px',
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      letterSpacing: '0.1em',
                                      transition: 'all 0.3s ease',
                                      clipPath: isAttending === false ? 'polygon(0 0, calc(100% - 8px) 0, 100% 100%, 8px 100%)' : 'none'
                                    }}
                                  >
                                    NO
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    });
                  })()}
                  
                  {/* Comments Section */}
                  <div style={{ marginTop: '2.5rem' }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: settings.colors.primary,
                      marginBottom: '1.5rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em'
                    }}>
                      ADDITIONAL NOTES & REQUIREMENTS
                    </h3>
                    <textarea
                      className="rsvp-textarea"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Dietary restrictions, accessibility needs, special requests..."
                      style={{
                        width: '100%',
                        minHeight: '120px',
                        padding: '1.25rem',
                        background: 'linear-gradient(135deg, #222222 0%, #2a2a2a 100%)',
                        border: `2px solid ${settings.colors.secondary}40`,
                        fontSize: '1rem',
                        fontFamily: 'Space Grotesk, sans-serif',
                        color: '#ffffff',
                        resize: 'vertical',
                        outline: 'none',
                        transition: 'all 0.3s ease'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = `${settings.colors.primary}`;
                        e.target.style.boxShadow = `0 0 0 2px ${settings.colors.primary}20`;
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = `${settings.colors.secondary}40`;
                        e.target.style.boxShadow = 'none';
                      }}
                    />
                  </div>
                  
                  {/* Submit Button */}
                  <div style={{ textAlign: 'center', marginTop: '3.5rem' }}>
                    <button 
                      onClick={handleRSVPSubmit}
                      disabled={submittingRSVP}
                      className="btn-modern rsvp-submit-button"
                      style={{
                        background: submittingRSVP ? '#666' : `linear-gradient(45deg, ${settings.colors.primary}, ${settings.colors.secondary})`,
                        cursor: submittingRSVP ? 'not-allowed' : 'pointer',
                        opacity: submittingRSVP ? 0.6 : 1,
                        padding: '1.3rem 4rem',
                        fontSize: '1.1rem'
                      }}
                    >
                      {submittingRSVP ? 'SUBMITTING...' : (guest.rsvp?.status === 'pending' || !guest.rsvp ? 'SUBMIT RSVP' : 'UPDATE RSVP')}
                    </button>
                  </div>
                  
                  {/* Status Display if already submitted */}
                  {guest.rsvp && guest.rsvp.status !== 'pending' && (
                    <div style={{
                      marginTop: '3rem',
                      padding: '2rem',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
                      border: `2px solid rgba(16, 185, 129, 0.3)`,
                      textAlign: 'center',
                      position: 'relative'
                    }}>
                      <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: 'linear-gradient(90deg, #10B981, #059669)'
                      }}></div>
                      
                      <div style={{
                        fontSize: '2rem',
                        marginBottom: '1rem'
                      }}>
                        {guest.rsvp.status === 'accepted' ? '⚡' : '📱'}
                      </div>
                      <p style={{
                        fontSize: '1.2rem',
                        color: '#10B981',
                        fontWeight: 700,
                        marginBottom: '0.5rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em'
                      }}>
                        RSVP SUBMITTED SUCCESSFULLY
                      </p>
                      {guest.rsvp.submittedAt && (
                        <p style={{
                          fontSize: '0.9rem',
                          color: '#999999',
                          fontFamily: 'JetBrains Mono, monospace'
                        }}>
                          SUBMITTED: {new Date(guest.rsvp.submittedAt).toLocaleDateString().toUpperCase()}
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
          <section id="gallery" className="section-modern geometric-bg">
            <div className="container">
              <h2 className="section-title">{getSectionTitle('gallery')}</h2>
              <div className="geometric-divider">
                <span></span>
              </div>
              <div style={{ 
                maxWidth: '900px', 
                margin: '0 auto',
                background: 'linear-gradient(135deg, #1a1a1a 0%, #1f1f1f 100%)',
                border: `2px solid ${settings.colors.primary}40`,
                padding: '3rem 2rem',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Top accent bar */}
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '4px',
                  background: `linear-gradient(90deg, ${settings.colors.primary}, ${settings.colors.secondary}, ${settings.colors.accent})`
                }}></div>
                
                <p style={{
                  fontSize: '1.25rem',
                  color: '#cccccc',
                  marginBottom: '2rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 300
                }}>
                  Our moments will be showcased here
                </p>
                
                <div className="gallery-grid" style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '1.5rem',
                  marginTop: '2rem'
                }}>
                  {[1, 2, 3].map((item) => (
                    <div key={item} style={{
                      aspectRatio: '1',
                      background: `linear-gradient(135deg, ${settings.colors.primary}10, ${settings.colors.secondary}10)`,
                      border: `2px dashed ${settings.colors.secondary}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      opacity: 0.6,
                      transition: 'all 0.3s ease',
                      position: 'relative'
                    }}>
                      <div style={{
                        position: 'absolute',
                        inset: '4px',
                        background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.02) 50%, transparent 60%)',
                      }}></div>
                      {item === 1 ? '📸' : item === 2 ? '⚡' : '🖤'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Registry Section */}
        {settings.sections.registry.enabled && settings.registry && (
          <section id="registry" className="section-modern geometric-bg">
            <div className="container">
              <h2 className="section-title">{getSectionTitle('registry')}</h2>
              <div className="geometric-divider">
                <span></span>
              </div>
              <div className="rsvp-content">
                {settings.registry.message && (
                  <p className="rsvp-description">
                    {settings.registry.message}
                  </p>
                )}
                <div className="registry-links" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  {settings.registry.links && settings.registry.links.map((link: any, index: number) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-modern"
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
          <section className="section-modern geometric-bg">
            <div className="container">
              <div className="additional-info">
                <p>{settings.content.additionalInfo}</p>
              </div>
            </div>
          </section>
        )}

        {/* Footer spacing */}
        <div style={{ paddingBottom: '4rem' }}></div>
      </div>
    </>
  );
}