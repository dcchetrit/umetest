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

interface ClassicInviteTemplateProps {
  guest: Guest;
  guestGroup: Group | null;
  settings: WebsiteSettings;
  personalizedEvents: WebsiteEvent[];
  coupleId: string;
}

export default function ClassicInviteTemplate({
  guest,
  guestGroup,
  settings,
  personalizedEvents,
  coupleId
}: ClassicInviteTemplateProps) {
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
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,500&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        
        :global(.template-classic) {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 400;
          line-height: 1.7;
          scroll-behavior: smooth;
        }

        :global(.template-classic h1), :global(.template-classic h2), :global(.template-classic h3), :global(.template-classic h4) {
          font-family: 'Playfair Display', serif;
          font-weight: 600;
          line-height: 1.3;
          color: ${settings.colors.text};
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        :global(.template-classic h1) {
          font-size: clamp(2.5rem, 8vw, 6rem);
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        :global(.template-classic h2) {
          font-size: clamp(2rem, 5vw, 3.5rem);
          margin-bottom: 2rem;
          position: relative;
        }

        :global(.template-classic h2::after) {
          content: '';
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 3px;
          background: linear-gradient(to right, transparent, ${settings.colors.accent}, transparent);
          border-radius: 2px;
        }

        :global(.template-classic h3) {
          font-size: clamp(1.5rem, 3vw, 2rem);
          margin-bottom: 1.5rem;
        }

        .ornamental-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 3rem 0;
          font-size: 1.8rem;
          color: ${settings.colors.secondary};
          position: relative;
        }

        .ornamental-divider::before,
        .ornamental-divider::after {
          content: '';
          flex: 1;
          height: 2px;
          background: linear-gradient(to right, transparent, ${settings.colors.secondary}40, transparent);
          margin: 0 2rem;
          border-radius: 1px;
        }

        .ornamental-divider span {
          padding: 0 1rem;
          background: ${settings.colors.background};
          border-radius: 50%;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
          position: relative;
          z-index: 1;
        }

        .flourish-divider {
          text-align: center;
          font-size: 1.5rem;
          color: ${settings.colors.secondary};
          margin: 1.5rem 0;
          opacity: 0.8;
        }

        .nav-top {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(25px) saturate(150%);
          border-bottom: 3px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
          z-index: 50;
          padding: 1.5rem 1rem;
          transition: all 0.3s ease;
        }

        .nav-top::before {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(to right, transparent, ${settings.colors.primary}30, transparent);
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 1rem;
        }

        .hero-section {
          min-height: calc(100vh - 96px);
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 8rem 0;
          margin-top: 6rem;
          background: ${settings.branding.heroPicture ? 
            `linear-gradient(135deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.88) 100%), url(${settings.branding.heroPicture})` :
            'linear-gradient(135deg, rgba(255, 248, 248, 0.8) 0%, rgba(255, 255, 255, 1) 25%, rgba(248, 250, 252, 0.8) 100%)'};
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
          background: radial-gradient(circle at center, transparent 0%, rgba(255, 255, 255, 0.1) 70%);
          pointer-events: none;
        }

        .hero-section::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="20" cy="20" r="0.5" fill="%23000" opacity="0.02"/><circle cx="80" cy="40" r="0.3" fill="%23000" opacity="0.03"/><circle cx="40" cy="80" r="0.4" fill="%23000" opacity="0.015"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          opacity: 0.6;
          pointer-events: none;
          animation: grain-animation 20s linear infinite;
        }

        @keyframes grain-animation {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-5%, -10%); }
          20% { transform: translate(-15%, 5%); }
          30% { transform: translate(7%, -25%); }
          40% { transform: translate(-5%, 25%); }
          50% { transform: translate(-15%, 10%); }
          60% { transform: translate(15%, 0%); }
          70% { transform: translate(0%, 15%); }
          80% { transform: translate(3%, -10%); }
          90% { transform: translate(-10%, 5%); }
        }

        .hero-content {
          max-width: 64rem;
          margin: 0 auto;
          position: relative;
          z-index: 2;
          animation: hero-fade-in 1.5s ease-out;
        }

        @keyframes hero-fade-in {
          0% {
            opacity: 0;
            transform: translateY(40px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .hero-ornament {
          font-size: 2.5rem;
          color: ${settings.colors.secondary};
          margin-bottom: 2rem;
          animation: ornament-pulse 3s ease-in-out infinite;
        }

        @keyframes ornament-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.05);
            opacity: 1;
          }
        }

        .hero-title {
          font-size: clamp(2.5rem, 8vw, 6rem);
          font-weight: 700;
          color: ${settings.colors.primary};
          margin-bottom: 1.5rem;
          letter-spacing: -0.02em;
        }

        .hero-subtitle {
          font-size: clamp(1.25rem, 3vw, 2rem);
          font-weight: 400;
          color: ${settings.colors.secondary};
          margin-bottom: 2rem;
          font-style: italic;
        }

        .hero-date {
          font-size: 1.5rem;
          font-weight: 500;
          color: ${settings.colors.text};
          margin-bottom: 2rem;
        }

        .hero-description {
          font-size: 1.125rem;
          font-weight: 400;
          color: ${settings.colors.text};
          line-height: 1.7;
          margin-bottom: 3rem;
          max-width: 48rem;
          margin-left: auto;
          margin-right: auto;
        }

        .btn-classic {
          background: linear-gradient(135deg, ${settings.colors.primary}, ${settings.colors.secondary});
          color: white;
          border: none;
          padding: 1.2rem 2.5rem;
          font-family: 'Playfair Display', serif;
          font-weight: 600;
          font-size: 1.125rem;
          border-radius: 50px;
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          cursor: pointer;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15), 0 3px 10px rgba(0, 0, 0, 0.1);
          position: relative;
          overflow: hidden;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-size: 0.95rem;
        }

        .btn-classic::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
          transition: left 0.6s ease;
        }

        .btn-classic:hover::before {
          left: 100%;
        }

        .btn-classic:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.2), 0 5px 15px rgba(0, 0, 0, 0.15);
          background: linear-gradient(135deg, ${settings.colors.secondary}, ${settings.colors.accent});
        }

        .btn-classic:active {
          transform: translateY(-1px) scale(0.98);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
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
          bottom: 0;
          background: radial-gradient(ellipse at center, transparent 0%, rgba(255, 255, 255, 0.3) 70%);
          pointer-events: none;
          opacity: 0.7;
        }

        .section-title {
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          font-weight: 600;
          color: ${settings.colors.primary};
          text-align: center;
          margin-bottom: 3rem;
          position: relative;
          z-index: 1;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .decorative-frame {
          border: 3px solid ${settings.colors.secondary};
          padding: 4rem;
          position: relative;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.95));
          margin: 3rem 0;
          border-radius: 2px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.6);
          backdrop-filter: blur(10px);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .decorative-frame:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 50px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.6);
        }

        .decorative-frame::before,
        .decorative-frame::after {
          content: '';
          position: absolute;
          width: 30px;
          height: 30px;
          border: 3px solid ${settings.colors.accent};
          transition: all 0.3s ease;
        }

        .decorative-frame::before {
          top: -3px;
          left: -3px;
          border-right: none;
          border-bottom: none;
          border-top-left-radius: 2px;
        }

        .decorative-frame::after {
          bottom: -3px;
          right: -3px;
          border-left: none;
          border-top: none;
          border-bottom-right-radius: 2px;
        }

        .decorative-frame:hover::before,
        .decorative-frame:hover::after {
          border-color: ${settings.colors.primary};
          width: 35px;
          height: 35px;
        }

        .event-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.98));
          border: 2px solid rgba(0, 0, 0, 0.08);
          border-radius: 12px;
          padding: 2.5rem;
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          position: relative;
          margin-bottom: 2.5rem;
          overflow: hidden;
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08), 0 3px 10px rgba(0, 0, 0, 0.05);
          backdrop-filter: blur(10px);
        }

        .event-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .event-card::after {
          content: '';
          position: absolute;
          top: 1.5rem;
          left: 1.5rem;
          right: 1.5rem;
          bottom: 1.5rem;
          border: 2px solid rgba(0, 0, 0, 0.03);
          border-radius: 8px;
          transition: all 0.3s ease;
          pointer-events: none;
        }

        .event-card:hover {
          transform: translateY(-8px) scale(1.02);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15), 0 8px 20px rgba(0, 0, 0, 0.1);
          border-color: ${settings.colors.secondary}40;
        }

        .event-card:hover::before {
          opacity: 1;
        }

        .event-card:hover::after {
          border-color: ${settings.colors.primary}20;
          top: 1rem;
          left: 1rem;
          right: 1rem;
          bottom: 1rem;
        }

        .event-title {
          font-size: 1.5rem;
          font-weight: 600;
          color: ${settings.colors.primary};
          margin-bottom: 1rem;
        }

        .event-details {
          font-size: 1rem;
          line-height: 1.7;
          color: #6b7280;
        }

        .rsvp-description {
          font-size: 1.125rem;
          font-weight: 400;
          line-height: 1.7;
          margin-bottom: 3rem;
        }

        .rsvp-status {
          display: inline-flex;
          align-items: center;
          padding: 0.75rem 1.5rem;
          font-size: 1.125rem;
          font-weight: 500;
          border-radius: 0.5rem;
          border: 2px solid white;
          box-shadow: 0 4px 14px 0 rgba(0, 0, 0, 0.15);
        }

        .rsvp-comments {
          margin-top: 1rem;
          font-size: 1rem;
          font-weight: 400;
          color: #6b7280;
          font-style: italic;
        }

        .update-btn {
          margin-top: 1rem;
          font-size: 0.875rem;
          padding: 0.5rem 1rem;
          border: 2px solid ${settings.colors.primary};
          background: transparent;
          color: ${settings.colors.primary};
          border-radius: 0.5rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .update-btn:hover {
          background: rgba(139, 92, 246, 0.05);
        }

        .brand-logo {
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          color: ${settings.colors.primary};
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          letter-spacing: -0.5px;
        }

        .nav-link {
          font-family: 'Cormorant Garamond', serif;
          font-size: 1.125rem;
          font-weight: 500;
          color: ${settings.colors.text};
          text-decoration: none;
          position: relative;
          padding: 0.8rem 1.5rem;
          border-radius: 30px;
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          overflow: hidden;
        }

        .nav-link::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, ${settings.colors.primary}, ${settings.colors.secondary});
          border-radius: 30px;
          opacity: 0;
          transform: scale(0.3) rotate(45deg);
          transition: all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          z-index: -1;
        }

        .nav-link::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.3), transparent);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          transition: all 0.3s ease;
          z-index: -1;
        }

        .nav-link:hover {
          color: white;
          transform: translateY(-3px);
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .nav-link:hover::before {
          opacity: 1;
          transform: scale(1) rotate(0deg);
        }

        .nav-link:hover::after {
          width: 100px;
          height: 100px;
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
          border-radius: 2px;
        }

        .mobile-menu-toggle.active .mobile-menu-bar:nth-child(1) {
          transform: rotate(45deg) translate(6px, 6px);
        }

        .mobile-menu-toggle.active .mobile-menu-bar:nth-child(2) {
          opacity: 0;
        }

        .mobile-menu-toggle.active .mobile-menu-bar:nth-child(3) {
          transform: rotate(-45deg) translate(6px, -6px);
        }

        .desktop-nav {
          display: flex;
          gap: 2.5rem;
        }

        .mobile-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(255, 248, 250, 0.95));
          backdrop-filter: blur(25px);
          z-index: 999;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          gap: 2rem;
          transform: translateX(${isMobileMenuOpen ? '0' : '100%'});
          transition: transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          border-left: 3px solid ${settings.colors.primary};
        }

        .mobile-nav-link {
          font-size: 1.5rem;
          font-weight: 500;
          color: ${settings.colors.text};
          text-decoration: none;
          padding: 1rem 2rem;
          border-bottom: 2px solid transparent;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          font-family: 'Cormorant Garamond', serif;
          text-transform: capitalize;
        }

        .mobile-nav-link::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, ${settings.colors.primary}15, transparent);
          transition: left 0.5s ease;
        }

        .mobile-nav-link:hover::before {
          left: 100%;
        }

        .mobile-nav-link:hover {
          color: ${settings.colors.primary};
          border-bottom-color: ${settings.colors.primary};
          transform: translateY(-2px);
        }

        /* Responsive breakpoints */
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
          
          .hero-section {
            padding: 6rem 0;
            margin-top: 5rem;
          }
          
          .section {
            padding: 5rem 0;
          }
          
          .nav-top {
            padding: 1.2rem 1rem;
          }
          
          .decorative-frame {
            padding: 3rem;
            margin: 2rem 0;
          }
        }

        @media (max-width: 768px) {
          .container {
            padding: 0 1rem;
          }
          
          .hero-section {
            padding: 4rem 0;
            margin-top: 4rem;
            background-attachment: scroll;
          }
          
          .section {
            padding: 3rem 0;
          }
          
          .nav-top {
            padding: 1rem;
          }
          
          .mobile-nav-link {
            font-size: 1.3rem;
          }
          
          .decorative-frame {
            padding: 2rem;
            margin: 1.5rem 0;
          }
          
          .ornamental-divider {
            margin: 2rem 0;
          }
          
          /* Gallery responsive styles */
          .gallery-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
          }
          
          .gallery-placeholder {
            flex-direction: column;
            gap: 1rem;
          }
          
          .gallery-item {
            width: 60px;
            height: 60px;
          }
          
          /* Contact section responsive styles */
          .contact-grid {
            grid-template-columns: 1fr !important;
            gap: 1.5rem;
          }
          
          /* Registry section responsive styles */
          .registry-links {
            flex-direction: column;
            width: 100%;
          }
          
          .registry-links a {
            width: 100%;
            text-align: center;
          }
          
          /* RSVP section responsive styles */
          .rsvp-section-container {
            padding: 2.5rem 1.5rem !important;
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
          }
          
          .rsvp-guest-row span {
            margin-bottom: 0.5rem;
            width: 100%;
          }
          
          .rsvp-event-container {
            padding: 1.2rem !important;
          }
          
          .rsvp-textarea {
            min-height: 80px !important;
            padding: 1rem !important;
          }
          
          .rsvp-submit-button {
            padding: 1rem 2.5rem !important;
            font-size: 1rem !important;
            width: 100%;
          }
          
          /* Accommodations responsive styles */
          .accommodations-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
          
          /* Events grid responsive */
          .events-grid {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
          }
        }

        @media (max-width: 480px) {
          .container {
            padding: 0 0.75rem;
          }
          
          .hero-section {
            padding: 3rem 0;
            margin-top: 3rem;
          }
          
          .section {
            padding: 2.5rem 0;
          }
          
          .mobile-nav {
            padding: 2rem 1rem;
          }
          
          .mobile-nav-link {
            width: 100%;
            text-align: center;
            font-size: 1.2rem;
            padding: 1rem;
            margin: 0.25rem 0;
          }
          
          .nav-top {
            padding: 0.75rem;
          }
          
          .nav-top .container {
            padding: 0 1rem;
          }
          
          .btn-classic {
            padding: 1rem 2rem;
            font-size: 1rem;
          }
          
          .decorative-frame {
            padding: 1.5rem;
            margin: 1rem 0;
          }
          
          .hero-content {
            padding: 0 1rem;
          }
          
          .gallery-item {
            width: 50px;
            height: 50px;
            font-size: 1.5rem;
          }
          
          .ornamental-divider {
            margin: 1.5rem 0;
            font-size: 1.5rem;
          }
          
          .ornamental-divider::before,
          .ornamental-divider::after {
            margin: 0 1rem;
          }
          
          /* Better responsive text sizing */
          :global(.template-classic h1) {
            font-size: clamp(2rem, 6vw, 4rem) !important;
            margin-bottom: 1.5rem !important;
          }
          
          :global(.template-classic h2) {
            font-size: clamp(1.5rem, 4vw, 2.8rem) !important;
            margin-bottom: 1.5rem !important;
          }
          
          :global(.template-classic h3) {
            font-size: clamp(1.2rem, 3vw, 1.6rem) !important;
            margin-bottom: 1rem !important;
          }
          
          .section-title {
            font-size: clamp(1.8rem, 4vw, 3rem) !important;
            margin-bottom: 2rem !important;
          }
          
          .hero-title {
            font-size: clamp(2rem, 6vw, 4rem) !important;
          }
          
          .hero-subtitle {
            font-size: clamp(1rem, 2.5vw, 1.5rem) !important;
            margin-bottom: 1.5rem !important;
          }
          
          .hero-date {
            font-size: 1.2rem !important;
            margin-bottom: 1.5rem !important;
          }
        }
      `}</style>
      
      <div className="template-classic" style={{ color: settings.colors.text, background: settings.colors.background }}>
        {/* Navigation */}
        {settings.layout.navigation === 'top' && (
          <>
            <nav className="nav-top">
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
                      <div className="brand-logo">
                        {settings.branding.coupleName}
                      </div>
                    )}
                  </div>

                  {/* Desktop Navigation */}
                  <div className="desktop-nav">
                  {settings.sections.hero.enabled && (
                    <a href="#hero" className="nav-link">{getSectionTitle('hero')}</a>
                  )}
                  {settings.sections.story.enabled && (
                    <a href="#story" className="nav-link">{getSectionTitle('story')}</a>
                  )}
                  {settings.sections.events.enabled && (
                    <a href="#events" className="nav-link">{getSectionTitle('events')}</a>
                  )}
                  {settings.sections.accommodations.enabled && (
                    <a href="#accommodations" className="nav-link">{getSectionTitle('accommodations')}</a>
                  )}
                  {settings.sections.rsvp.enabled && (
                    <a href="#rsvp" className="nav-link">{getSectionTitle('rsvp')}</a>
                  )}
                  {settings.sections.gallery.enabled && (
                    <a href="#gallery" className="nav-link">{getSectionTitle('gallery')}</a>
                  )}
                  {settings.sections.registry.enabled && (
                    <a href="#registry" className="nav-link">{getSectionTitle('registry')}</a>
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
          <section id="hero" className="hero-section">
            <div className="hero-content">
              <h1 className="hero-title">{welcomeMessage}</h1>
              
              <div className="ornamental-divider">
                <span>♥</span>
              </div>
              
              <h2 className="hero-subtitle">
                "You're Invited to {settings.branding.coupleName}'s Wedding"
              </h2>
              
              {settings.branding.tagline && (
                <p style={{
                  fontSize: '1.25rem',
                  fontWeight: 400,
                  color: settings.colors.accent,
                  marginBottom: '2rem',
                  fontStyle: 'italic'
                }}>
                  {settings.branding.tagline}
                </p>
              )}
              
              <div className="hero-date">{settings.branding.weddingDate}</div>
              
              {settings.content.heroMessage && (
                <p className="hero-description">{settings.content.heroMessage}</p>
              )}
              
              <div style={{ marginTop: '3rem', marginBottom: '3rem' }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  gap: '1.5rem' 
                }}>
                  <div style={{ 
                    width: '6rem', 
                    height: '2px', 
                    background: `linear-gradient(to right, transparent, ${settings.colors.accent}, transparent)`,
                    borderRadius: '1px'
                  }}></div>
                  <div style={{ 
                    width: '16px', 
                    height: '16px', 
                    borderRadius: '50%', 
                    background: `linear-gradient(135deg, ${settings.colors.secondary}, ${settings.colors.primary})`,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                    border: '2px solid rgba(255, 255, 255, 0.8)'
                  }}></div>
                  <div style={{ 
                    width: '6rem', 
                    height: '2px', 
                    background: `linear-gradient(to left, transparent, ${settings.colors.accent}, transparent)`,
                    borderRadius: '1px'
                  }}></div>
                </div>
              </div>
              
              {settings.branding.heroPicture && (
                <div style={{ 
                  marginTop: '3rem',
                  position: 'relative',
                  display: 'inline-block'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-10px',
                    left: '-10px',
                    right: '-10px',
                    bottom: '-10px',
                    background: `linear-gradient(135deg, ${settings.colors.primary}20, ${settings.colors.secondary}20)`,
                    borderRadius: '12px',
                    filter: 'blur(20px)',
                    opacity: 0.6
                  }}></div>
                  <img
                    src={settings.branding.heroPicture}
                    alt={`${settings.branding.coupleName} - Wedding`}
                    style={{ 
                      width: '100%',
                      maxWidth: '36rem',
                      height: 'auto',
                      margin: '0 auto',
                      borderRadius: '8px',
                      boxShadow: '0 30px 60px rgba(0, 0, 0, 0.3), 0 12px 25px rgba(0, 0, 0, 0.2)',
                      border: '12px solid rgba(255, 255, 255, 0.95)',
                      position: 'relative',
                      zIndex: 1,
                      transition: 'transform 0.3s ease'
                    }}
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Story Section */}
        {settings.sections.story.enabled && (
          <section id="story" className="section" style={{ 
            background: 'linear-gradient(135deg, rgba(255, 248, 250, 0.6) 0%, rgba(255, 255, 255, 1) 30%, rgba(248, 250, 255, 0.6) 100%)'
          }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('story')}</h2>
              <div className="ornamental-divider">
                <span>♥</span>
              </div>
              <div className="decorative-frame">
                <div style={{ 
                  fontSize: '1.2rem',
                  lineHeight: '1.8',
                  textAlign: 'center',
                  maxWidth: '48rem',
                  margin: '0 auto',
                  color: settings.colors.text,
                  position: 'relative'
                }}>
                  <div style={{
                    position: 'absolute',
                    top: '-20px',
                    left: '20px',
                    fontSize: '4rem',
                    color: `${settings.colors.secondary}20`,
                    fontFamily: 'Playfair Display, serif',
                    lineHeight: 1,
                    pointerEvents: 'none'
                  }}>"</div>
                  {settings.content.storyText ? (
                    <p style={{ fontStyle: 'italic', position: 'relative', zIndex: 1 }}>{settings.content.storyText}</p>
                  ) : (
                    <p style={{ fontStyle: 'italic', position: 'relative', zIndex: 1 }}>Join us as we celebrate our love story and the beginning of our new journey together.</p>
                  )}
                  <div style={{
                    position: 'absolute',
                    bottom: '-40px',
                    right: '20px',
                    fontSize: '4rem',
                    color: `${settings.colors.secondary}20`,
                    fontFamily: 'Playfair Display, serif',
                    lineHeight: 1,
                    transform: 'rotate(180deg)',
                    pointerEvents: 'none'
                  }}>"</div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Events Section */}
        {settings.sections.events.enabled && personalizedEvents.length > 0 && (
          <section id="events" className="section" style={{ 
            background: 'linear-gradient(135deg, rgba(251, 191, 191, 0.1) 0%, rgba(255, 255, 255, 1) 25%, rgba(251, 191, 191, 0.1) 100%)' 
          }}>
            <div className="container">
              <h2 className="section-title">
                {getSectionTitle('events')}
                {guestGroup && (
                  <div style={{ 
                    fontSize: '1.125rem',
                    fontWeight: 400,
                    color: '#6b7280',
                    marginTop: '0.5rem',
                    fontStyle: 'italic'
                  }}>
                    Events you're invited to attend
                  </div>
                )}
              </h2>
              <div className="events-grid" style={{ 
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '2rem',
                maxWidth: '80rem',
                margin: '0 auto'
              }}>
                {personalizedEvents.map((event) => (
                  <div key={event.id} className="event-card">
                    {event.picture && (
                      <img
                        src={event.picture}
                        alt={event.name}
                        style={{ 
                          width: '100%',
                          height: '12rem',
                          objectFit: 'cover',
                          borderRadius: '0.25rem',
                          marginBottom: '1.5rem'
                        }}
                      />
                    )}
                    <h3 className="event-title">{event.name}</h3>
                    <div className="event-details">
                      <p><strong>Date:</strong> {event.date}</p>
                      <p><strong>Time:</strong> {event.time}</p>
                      <p><strong>Location:</strong> {event.location}</p>
                      <p><strong>Address:</strong> {event.address}</p>
                      {event.dresscode && <p><strong>Dress Code:</strong> {event.dresscode}</p>}
                      {event.description && (
                        <p style={{ marginTop: '1rem', fontStyle: 'italic' }}>{event.description}</p>
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
          <section id="accommodations" className="section" style={{ 
            background: 'linear-gradient(135deg, rgba(139, 69, 19, 0.05) 0%, rgba(255, 255, 255, 1) 25%, rgba(139, 69, 19, 0.05) 100%)' 
          }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('accommodations')}</h2>
              <div className="ornamental-divider">
                <span>♦</span>
              </div>
              <div className="accommodations-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2.5rem' }}>
                {settings.accommodations.map((accommodation: any) => (
                  <div key={accommodation.id} className="decorative-frame" style={{ 
                    background: 'rgba(255, 255, 255, 0.95)',
                    overflow: 'hidden'
                  }}>
                    {accommodation.picture && (
                      <img
                        src={accommodation.picture}
                        alt={accommodation.name}
                        style={{ 
                          width: '100%', 
                          height: '200px', 
                          objectFit: 'cover',
                          borderBottom: `3px solid ${settings.colors.secondary}`
                        }}
                      />
                    )}
                    <div style={{ padding: '2rem' }}>
                      <h3 style={{
                        fontSize: '1.5rem',
                        fontWeight: 400,
                        color: settings.colors.primary,
                        marginBottom: '0.5rem',
                        textAlign: 'center'
                      }}>
                        {accommodation.name}
                      </h3>
                      <div className="flourish-divider">❖</div>
                      <div style={{
                        fontSize: '1rem',
                        color: settings.colors.text,
                        lineHeight: 1.7,
                        marginBottom: '1.5rem'
                      }}>
                        <p><strong>Type:</strong> {accommodation.type}</p>
                        <p><strong>Address:</strong> {accommodation.address}</p>
                        {accommodation.distance && <p><strong>Distance:</strong> {accommodation.distance}</p>}
                        {accommodation.priceRange && <p><strong>Price Range:</strong> {accommodation.priceRange}</p>}
                        {accommodation.phone && <p><strong>Phone:</strong> {accommodation.phone}</p>}
                      </div>
                      {accommodation.description && (
                        <p style={{
                          fontSize: '1rem',
                          color: settings.colors.text,
                          lineHeight: 1.7,
                          marginBottom: '1.5rem',
                          fontStyle: 'italic',
                          textAlign: 'center'
                        }}>
                          {accommodation.description}
                        </p>
                      )}
                      {accommodation.website && (
                        <div style={{ textAlign: 'center' }}>
                          <a
                            href={accommodation.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-classic"
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
          <section id="rsvp" className="section" style={{ 
            background: 'linear-gradient(135deg, rgba(255, 248, 250, 0.4) 0%, rgba(255, 255, 255, 1) 50%, rgba(248, 250, 255, 0.4) 100%)'
          }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('rsvp')}</h2>
              <div className="ornamental-divider">
                <span>💌</span>
              </div>
              
              <div className="decorative-frame rsvp-section-container" style={{ 
                maxWidth: '50rem', 
                margin: '0 auto', 
                padding: '3rem 2rem'
              }}>
                {/* Personalized Greeting */}
                <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
                  <div style={{
                    fontSize: '2.5rem',
                    marginBottom: '1rem'
                  }}>
                    💕
                  </div>
                  
                  {guest.isMainGuest && guest.totalGuests > 1 ? (
                    <p style={{
                      fontSize: '1.25rem',
                      fontWeight: 400,
                      lineHeight: '1.7',
                      color: settings.colors.text,
                      marginBottom: '1rem'
                    }}>
                      Hello {firstName}, you are responsible for the RSVP of your group ({guest.totalGuests} guests)
                    </p>
                  ) : guest.parentGuestId ? (
                    <p style={{
                      fontSize: '1.25rem',
                      fontWeight: 400,
                      lineHeight: '1.7',
                      color: settings.colors.text,
                      marginBottom: '1rem'
                    }}>
                      Hello {firstName}, please answer the RSVP
                    </p>
                  ) : (
                    <p style={{
                      fontSize: '1.25rem',
                      fontWeight: 400,
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
                    fontWeight: 500,
                    color: settings.colors.text,
                    marginBottom: '2rem',
                    textAlign: 'center',
                    fontFamily: 'Playfair Display, serif'
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
                          opacity: 0.7,
                          fontStyle: 'italic'
                        }}>
                          No events available for RSVP
                        </div>
                      );
                    }
                    
                    return invitedEvents.map((event, index) => {
                      return (
                        <div key={event.id} className="rsvp-event-container" style={{
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.9))',
                          padding: '1.5rem',
                          borderRadius: '12px',
                          marginBottom: '1.5rem',
                          border: `2px solid ${settings.colors.secondary}20`,
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)'
                        }}>
                          {/* Event Header */}
                          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
                            <h4 style={{
                              fontSize: '1.1rem',
                              fontWeight: 600,
                              color: settings.colors.primary,
                              marginBottom: '0.5rem',
                              fontFamily: 'Playfair Display, serif'
                            }}>
                              {event.name}
                            </h4>
                            <p style={{
                              fontSize: '0.9rem',
                              color: settings.colors.secondary,
                              opacity: 0.8,
                              fontStyle: 'italic'
                            }}>
                              {event.date} at {event.time}
                            </p>
                            <p style={{
                              fontSize: '0.85rem',
                              color: settings.colors.text,
                              opacity: 0.7
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
                                padding: '0.75rem',
                                marginBottom: '0.5rem',
                                background: 'rgba(255, 255, 255, 0.6)',
                                borderRadius: '8px',
                                border: `1px solid ${settings.colors.secondary}10`
                              }}>
                                <span style={{
                                  fontSize: '0.9rem',
                                  fontWeight: 500,
                                  color: settings.colors.text
                                }}>
                                  {guestItem.name} {guestItem.id === guest.id ? '(you)' : ''}
                                </span>
                                
                                <div className="rsvp-event-responses" style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    onClick={() => handleEventResponse(event.name, guestItem.id, true)}
                                    style={{
                                      background: isAttending === true ? settings.colors.primary : 'transparent',
                                      color: isAttending === true ? 'white' : settings.colors.primary,
                                      border: `2px solid ${settings.colors.primary}`,
                                      borderRadius: '20px',
                                      padding: '0.4rem 0.8rem',
                                      fontSize: '0.8rem',
                                      cursor: 'pointer',
                                      minWidth: '60px',
                                      fontWeight: '500',
                                      transition: 'all 0.3s ease'
                                    }}
                                  >
                                    Yes ✓
                                  </button>
                                  <button
                                    onClick={() => handleEventResponse(event.name, guestItem.id, false)}
                                    style={{
                                      background: isAttending === false ? '#EF4444' : 'transparent',
                                      color: isAttending === false ? 'white' : '#EF4444',
                                      border: '2px solid #EF4444',
                                      borderRadius: '20px',
                                      padding: '0.4rem 0.8rem',
                                      fontSize: '0.8rem',
                                      cursor: 'pointer',
                                      minWidth: '60px',
                                      fontWeight: '500',
                                      transition: 'all 0.3s ease'
                                    }}
                                  >
                                    No ✗
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
                  <div style={{ marginTop: '2rem' }}>
                    <h3 style={{
                      fontSize: '1rem',
                      fontWeight: 500,
                      color: settings.colors.text,
                      marginBottom: '1rem',
                      fontFamily: 'Playfair Display, serif'
                    }}>
                      Additional Comments (Optional)
                    </h3>
                    <textarea
                      className="rsvp-textarea"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Any message for the happy couple?"
                      style={{
                        width: '100%',
                        minHeight: '100px',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: `2px solid ${settings.colors.secondary}30`,
                        background: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '1rem',
                        fontFamily: 'Cormorant Garamond, serif',
                        resize: 'vertical',
                        outline: 'none',
                        transition: 'border-color 0.3s ease'
                      }}
                    />
                  </div>
                  
                  {/* Submit Button */}
                  <div style={{ textAlign: 'center', marginTop: '3rem' }}>
                    <button 
                      onClick={handleRSVPSubmit}
                      disabled={submittingRSVP}
                      className="btn-classic rsvp-submit-button"
                      style={{
                        background: submittingRSVP ? '#ccc' : `linear-gradient(135deg, ${settings.colors.primary}, ${settings.colors.secondary})`,
                        cursor: submittingRSVP ? 'not-allowed' : 'pointer',
                        opacity: submittingRSVP ? 0.7 : 1,
                        padding: '1.2rem 3rem',
                        fontSize: '1.1rem'
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
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(16, 185, 129, 0.05))',
                      borderRadius: '15px',
                      textAlign: 'center',
                      border: `2px solid rgba(16, 185, 129, 0.2)`
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
                        fontWeight: 500,
                        marginBottom: '0.5rem'
                      }}>
                        Thank you for your response!
                      </p>
                      {guest.rsvp.submittedAt && (
                        <p style={{
                          fontSize: '0.9rem',
                          color: settings.colors.text,
                          opacity: 0.7,
                          fontStyle: 'italic'
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
          <section id="gallery" className="section" style={{ 
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 1) 0%, rgba(250, 248, 255, 0.8) 50%, rgba(255, 255, 255, 1) 100%)'
          }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('gallery')}</h2>
              <div className="ornamental-divider">
                <span>♥</span>
              </div>
              <div className="decorative-frame">
                <div style={{ 
                  fontSize: '1.2rem',
                  lineHeight: '1.8',
                  textAlign: 'center',
                  maxWidth: '48rem',
                  margin: '0 auto',
                  color: settings.colors.text,
                  position: 'relative'
                }}>
                  <div style={{
                    marginBottom: '2rem',
                    padding: '2rem',
                    background: `linear-gradient(135deg, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.9))`,
                    borderRadius: '8px',
                    border: `1px solid ${settings.colors.secondary}30`
                  }}>
                    <p style={{ margin: 0, fontStyle: 'italic' }}>Our beautiful moments together will be displayed here.</p>
                    <div className="gallery-placeholder" style={{
                      marginTop: '1.5rem',
                      display: 'flex',
                      justifyContent: 'center',
                      gap: '1rem'
                    }}>
                      <div className="gallery-item" style={{
                        width: '80px',
                        height: '80px',
                        background: `linear-gradient(135deg, ${settings.colors.secondary}10, ${settings.colors.primary}10)`,
                        borderRadius: '8px',
                        border: `2px dashed ${settings.colors.secondary}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        opacity: 0.6
                      }}>📷</div>
                      <div className="gallery-item" style={{
                        width: '80px',
                        height: '80px',
                        background: `linear-gradient(135deg, ${settings.colors.secondary}10, ${settings.colors.primary}10)`,
                        borderRadius: '8px',
                        border: `2px dashed ${settings.colors.secondary}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        opacity: 0.6
                      }}>💝</div>
                      <div className="gallery-item" style={{
                        width: '80px',
                        height: '80px',
                        background: `linear-gradient(135deg, ${settings.colors.secondary}10, ${settings.colors.primary}10)`,
                        borderRadius: '8px',
                        border: `2px dashed ${settings.colors.secondary}40`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '2rem',
                        opacity: 0.6
                      }}>💒</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Registry Section */}
        {settings.sections.registry.enabled && settings.registry && (
          <section id="registry" className="section" style={{ 
            background: 'linear-gradient(135deg, rgba(251, 191, 191, 0.1) 0%, rgba(255, 255, 255, 1) 25%, rgba(251, 191, 191, 0.1) 100%)' 
          }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('registry')}</h2>
              <div className="ornamental-divider">
                <span>♦</span>
              </div>
              <div className="decorative-frame" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
                {settings.registry.message && (
                  <p style={{
                    fontSize: '1.125rem',
                    color: settings.colors.text,
                    lineHeight: 1.7,
                    marginBottom: '2rem'
                  }}>
                    {settings.registry.message}
                  </p>
                )}
                <div className="flourish-divider">❖</div>
                <div className="registry-links" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                  {settings.registry.links && settings.registry.links.map((link: any, index: number) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-classic"
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
          <section className="section" style={{ 
            background: 'linear-gradient(135deg, rgba(251, 191, 191, 0.1) 0%, rgba(255, 255, 255, 1) 25%, rgba(251, 191, 191, 0.1) 100%)' 
          }}>
            <div className="container">
              <div className="decorative-frame">
                <div style={{ 
                  fontSize: '1.125rem',
                  lineHeight: '1.7',
                  textAlign: 'center',
                  maxWidth: '48rem',
                  margin: '0 auto'
                }}>
                  <p>{settings.content.additionalInfo}</p>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}