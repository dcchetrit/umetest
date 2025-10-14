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

interface ElegantInviteTemplateProps {
  guest: Guest;
  guestGroup: Group | null;
  settings: WebsiteSettings;
  personalizedEvents: WebsiteEvent[];
  coupleId: string;
}

export default function ElegantInviteTemplate({
  guest,
  guestGroup,
  settings,
  personalizedEvents,
  coupleId
}: ElegantInviteTemplateProps) {
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
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');
        
        :global(.template-elegant) {
          font-family: 'Crimson Text', serif;
          font-weight: 400;
          line-height: 1.8;
          background: linear-gradient(135deg, #fdfbfb 0%, #f8f9fa 25%, #f1f3f4 50%, #e8eaf6 75%, #f3e5f5 100%);
          color: #2d3748;
          position: relative;
          scroll-behavior: smooth;
        }

        :global(.template-elegant::before) {
          content: '';
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            radial-gradient(ellipse at 20% 80%, rgba(139, 92, 246, 0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(236, 72, 153, 0.06) 0%, transparent 60%),
            radial-gradient(ellipse at 40% 40%, rgba(59, 130, 246, 0.04) 0%, transparent 60%),
            radial-gradient(ellipse at 60% 70%, rgba(168, 85, 247, 0.05) 0%, transparent 50%);
          pointer-events: none;
          z-index: -1;
          animation: gentle-float 20s ease-in-out infinite;
        }

        @keyframes gentle-float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
            opacity: 1;
          }
          25% {
            transform: translateY(-10px) rotate(0.5deg);
            opacity: 0.8;
          }
          50% {
            transform: translateY(-5px) rotate(-0.3deg);
            opacity: 0.9;
          }
          75% {
            transform: translateY(-15px) rotate(0.2deg);
            opacity: 0.85;
          }
        }

        :global(.template-elegant h1), :global(.template-elegant h2), :global(.template-elegant h3), :global(.template-elegant h4) {
          font-family: 'Playfair Display', serif;
          font-weight: 600;
          line-height: 1.3;
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        :global(.template-elegant h1) {
          font-size: clamp(2.8rem, 7vw, 5.2rem);
          font-weight: 700;
          margin-bottom: 2.5rem;
          font-style: italic;
          letter-spacing: -0.02em;
        }

        :global(.template-elegant h2) {
          font-size: clamp(2.2rem, 4.5vw, 3.5rem);
          font-weight: 600;
          margin-bottom: 2rem;
          font-style: italic;
          position: relative;
        }

        :global(.template-elegant h2::after) {
          content: '';
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          width: 60px;
          height: 2px;
          background: linear-gradient(to right, transparent, ${settings.colors.primary}80, transparent);
          border-radius: 1px;
        }

        :global(.template-elegant h3) {
          font-size: clamp(1.6rem, 3.2vw, 2.2rem);
          font-weight: 600;
          margin-bottom: 1.2rem;
          font-style: italic;
        }

        .elegant-ornament {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 4rem 0;
          font-size: 2rem;
          color: ${settings.colors.secondary};
          position: relative;
        }

        .elegant-ornament::before,
        .elegant-ornament::after {
          content: '';
          flex: 1;
          height: 2px;
          background: linear-gradient(to right, transparent, ${settings.colors.secondary}40, ${settings.colors.secondary}, ${settings.colors.secondary}40, transparent);
          margin: 0 3rem;
          border-radius: 1px;
        }

        .elegant-ornament span {
          padding: 0 1.5rem;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7));
          border-radius: 50%;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          animation: gentle-pulse 4s ease-in-out infinite;
        }

        @keyframes gentle-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
          }
        }

        .elegant-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 5rem 0;
          position: relative;
        }

        .elegant-divider::before,
        .elegant-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(to right, transparent, ${settings.colors.accent}60, ${settings.colors.accent}, ${settings.colors.accent}60, transparent);
        }

        .elegant-divider span {
          margin: 0 3rem;
          font-size: 1.8rem;
          color: ${settings.colors.accent};
          transform: rotate(45deg);
          padding: 0.5rem;
          background: radial-gradient(circle, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.6));
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: transform 0.3s ease;
        }

        .elegant-divider span:hover {
          transform: rotate(45deg) scale(1.1);
        }

        .nav-elegant {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.98);
          backdrop-filter: blur(25px) saturate(150%);
          border-bottom: 2px solid rgba(0, 0, 0, 0.06);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04);
          z-index: 1000;
          padding: 2rem 0;
          transition: all 0.3s ease;
        }

        .nav-elegant::before {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(to right, transparent, ${settings.colors.primary}30, ${settings.colors.accent}30, transparent);
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
        }

        .hero-elegant {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          position: relative;
          padding: 10rem 0;
          overflow: hidden;
        }

        .hero-elegant::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(ellipse at center, transparent 0%, rgba(255, 255, 255, 0.1) 70%);
          pointer-events: none;
        }

        .hero-content {
          max-width: 900px;
          margin: 0 auto;
          position: relative;
          z-index: 2;
          animation: hero-fade-in 1.8s ease-out;
        }

        @keyframes hero-fade-in {
          0% {
            opacity: 0;
            transform: translateY(50px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .hero-ornament {
          display: inline-flex;
          width: 120px;
          height: 120px;
          border-radius: 50%;
          border: 4px solid ${settings.colors.secondary}60;
          position: relative;
          margin-bottom: 4rem;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.8));
          backdrop-filter: blur(15px);
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
          animation: ornament-float 6s ease-in-out infinite;
        }

        @keyframes ornament-float {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08);
          }
          25% {
            transform: translateY(-5px) rotate(1deg);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
          }
          50% {
            transform: translateY(-8px) rotate(0deg);
            box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18), 0 6px 16px rgba(0, 0, 0, 0.12);
          }
          75% {
            transform: translateY(-3px) rotate(-1deg);
            box-shadow: 0 10px 36px rgba(0, 0, 0, 0.14), 0 3px 10px rgba(0, 0, 0, 0.09);
          }
        }

        .hero-ornament::before {
          content: '♥';
          font-size: 2.5rem;
          color: ${settings.colors.primary};
          text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .hero-ornament::after {
          content: '';
          position: absolute;
          top: -8px;
          right: -8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${settings.colors.accent}, ${settings.colors.primary});
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          animation: accent-pulse 3s ease-in-out infinite;
        }

        @keyframes accent-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.1);
            opacity: 0.8;
          }
        }

        .hero-label {
          font-size: 0.875rem;
          font-weight: 400;
          letter-spacing: 0.3em;
          text-transform: uppercase;
          color: ${settings.colors.secondary};
          margin-bottom: 3rem;
        }

        .hero-title {
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          font-weight: 700;
          font-style: italic;
          color: ${settings.colors.primary};
          margin-bottom: 2rem;
          line-height: 1.1;
        }

        .hero-subtitle {
          font-size: clamp(1.25rem, 3vw, 1.875rem);
          font-weight: 400;
          font-style: italic;
          color: ${settings.colors.secondary};
          margin-bottom: 3rem;
        }

        .hero-names {
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 600;
          font-style: italic;
          color: ${settings.colors.primary};
          margin-bottom: 2rem;
        }

        .hero-tagline {
          font-size: 1.25rem;
          font-weight: 400;
          font-style: italic;
          color: ${settings.colors.accent};
          margin-bottom: 3rem;
          max-width: 600px;
          margin-left: auto;
          margin-right: auto;
        }

        .hero-date {
          font-size: 1.5rem;
          font-weight: 400;
          font-style: italic;
          color: ${settings.colors.text};
          margin-bottom: 4rem;
        }

        .hero-image-container {
          margin-top: 4rem;
          position: relative;
        }

        .hero-image-frame {
          display: inline-block;
          padding: 1.5rem;
          background: rgba(255, 255, 255, 0.9);
          backdrop-filter: blur(10px);
          border-radius: 50%;
          box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
          position: relative;
        }

        .hero-image-frame::before {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          padding: 3px;
          background: linear-gradient(45deg, ${settings.colors.primary}, ${settings.colors.secondary}, ${settings.colors.accent});
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: subtract;
        }

        .hero-image {
          width: 300px;
          height: 300px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid rgba(255, 255, 255, 0.8);
        }

        .section-elegant {
          padding: 6rem 0;
          position: relative;
        }

        .section-title {
          font-size: clamp(2rem, 4vw, 3rem);
          font-weight: 600;
          font-style: italic;
          text-align: center;
          margin-bottom: 3rem;
          color: ${settings.colors.primary};
        }

        .story-content {
          max-width: 700px;
          margin: 0 auto;
          font-size: 1.25rem;
          line-height: 1.8;
          text-align: center;
          font-style: italic;
          color: ${settings.colors.text};
        }

        .event-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 2.5rem;
          margin-top: 4rem;
          max-width: 80rem;
          margin-left: auto;
          margin-right: auto;
        }

        .event-card {
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85));
          backdrop-filter: blur(15px);
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04);
          border: 2px solid rgba(255, 255, 255, 0.6);
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          position: relative;
        }

        .event-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 5px;
          background: linear-gradient(135deg, ${settings.colors.primary}, ${settings.colors.secondary}, ${settings.colors.accent});
          border-radius: 24px 24px 0 0;
        }

        .event-card::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 24px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), transparent);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .event-card:hover {
          transform: translateY(-10px) scale(1.02);
          box-shadow: 0 25px 60px rgba(0, 0, 0, 0.15), 0 10px 24px rgba(0, 0, 0, 0.08);
          border-color: ${settings.colors.primary}30;
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
          font-weight: 600;
          color: ${settings.colors.primary};
          margin-bottom: 1.5rem;
          font-style: italic;
        }

        .event-details {
          font-size: 1rem;
          line-height: 1.8;
          color: ${settings.colors.text};
        }

        .event-details strong {
          font-weight: 600;
          color: ${settings.colors.primary};
        }

        .event-description {
          margin-top: 1.5rem;
          font-style: italic;
          color: ${settings.colors.secondary};
        }

        .rsvp-content {
          text-align: center;
          max-width: 600px;
          margin: 0 auto;
        }

        .rsvp-description {
          font-size: 1.25rem;
          font-style: italic;
          color: ${settings.colors.text};
          margin-bottom: 3rem;
          line-height: 1.6;
        }

        .btn-elegant {
          background: linear-gradient(135deg, ${settings.colors.primary}, ${settings.colors.secondary});
          color: white;
          border: none;
          padding: 1.2rem 3.5rem;
          border-radius: 50px;
          font-size: 1.125rem;
          font-weight: 500;
          font-family: 'Playfair Display', serif;
          font-style: italic;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
          position: relative;
          overflow: hidden;
          box-shadow: 0 12px 35px rgba(0, 0, 0, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .btn-elegant::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
          transition: left 0.7s ease;
        }

        .btn-elegant::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 50px;
          padding: 2px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.3), transparent, rgba(255, 255, 255, 0.1));
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask-composite: subtract;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .btn-elegant:hover::before {
          left: 100%;
        }

        .btn-elegant:hover::after {
          opacity: 1;
        }

        .btn-elegant:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.2), 0 8px 20px rgba(0, 0, 0, 0.15);
          background: linear-gradient(135deg, ${settings.colors.secondary}, ${settings.colors.accent});
        }

        .btn-elegant:active {
          transform: translateY(-2px) scale(0.98);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.2);
        }

        .rsvp-status {
          display: inline-block;
          padding: 1rem 2rem;
          border-radius: 50px;
          font-size: 1.125rem;
          font-weight: 600;
          font-style: italic;
          color: white;
          margin-bottom: 2rem;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        }

        .rsvp-comments {
          font-size: 1rem;
          font-style: italic;
          color: ${settings.colors.secondary};
          margin-bottom: 2rem;
          max-width: 500px;
          margin-left: auto;
          margin-right: auto;
        }

        .update-btn {
          background: transparent;
          color: ${settings.colors.primary};
          border: 2px solid ${settings.colors.primary};
          padding: 0.75rem 2rem;
          border-radius: 50px;
          font-size: 0.875rem;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .update-btn:hover {
          background: ${settings.colors.primary};
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .additional-info {
          max-width: 700px;
          margin: 0 auto;
          font-size: 1.25rem;
          line-height: 1.8;
          text-align: center;
          font-style: italic;
          color: ${settings.colors.text};
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
          height: 2px;
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
          gap: 3rem;
        }

        .mobile-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(248, 250, 252, 0.95));
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
          font-weight: 500;
          font-style: italic;
          color: ${settings.colors.text};
          text-decoration: none;
          padding: 1rem 2rem;
          border-bottom: 2px solid transparent;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
          font-family: 'Playfair Display', serif;
        }

        .mobile-nav-link::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, ${settings.colors.primary}20, transparent);
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
          
          .hero-elegant {
            padding: 6rem 0;
          }
          
          .section-elegant {
            padding: 4rem 0;
          }
          
          .nav-elegant {
            padding: 1.5rem 0;
          }
        }

        @media (max-width: 768px) {
          .hero-elegant {
            padding: 4rem 0;
            margin-top: 4rem;
          }
          
          .container {
            padding: 0 1rem;
          }
          
          .section-elegant {
            padding: 3rem 0;
          }
          
          .event-grid {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
          
          .hero-image {
            width: 250px;
            height: 250px;
          }
          
          .nav-elegant {
            padding: 1rem 0;
          }
          
          .mobile-nav-link {
            font-size: 1.3rem;
          }
          
          .event-card {
            margin-bottom: 1rem;
          }
          
          .elegant-ornament {
            margin: 3rem 0;
          }
          
          .elegant-divider {
            margin: 3rem 0;
          }
          
          /* Gallery responsive styles */
          .gallery-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
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

        @media (max-width: 480px) {
          .container {
            padding: 0 0.75rem;
          }
          
          .hero-elegant {
            padding: 3rem 0;
            margin-top: 3rem;
          }
          
          .section-elegant {
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
          
          .nav-elegant {
            padding: 0.75rem 0;
          }
          
          .nav-elegant .container {
            padding: 0 1rem;
          }
          
          .btn-elegant {
            padding: 1rem 2.5rem;
            font-size: 1rem;
          }
          
          .event-content {
            padding: 1.5rem;
          }
          
          .gallery-grid {
            grid-template-columns: 1fr 1fr;
            gap: 0.75rem;
          }
          
          .hero-image {
            width: 200px;
            height: 200px;
          }
          
          .hero-ornament {
            width: 100px;
            height: 100px;
            margin-bottom: 3rem;
          }
          
          .hero-ornament::before {
            font-size: 2rem;
          }
          
          /* Better responsive text sizing */
          :global(.template-elegant h1) {
            font-size: clamp(2.2rem, 6vw, 4rem) !important;
            margin-bottom: 2rem !important;
          }
          
          :global(.template-elegant h2) {
            font-size: clamp(1.8rem, 4vw, 2.8rem) !important;
            margin-bottom: 1.5rem !important;
          }
          
          :global(.template-elegant h3) {
            font-size: clamp(1.3rem, 3vw, 1.8rem) !important;
            margin-bottom: 1rem !important;
          }
          
          .hero-names {
            font-size: clamp(1.5rem, 3.5vw, 2.2rem) !important;
            margin-bottom: 1.5rem !important;
          }
        }
      `}</style>
      
      <div className="template-elegant" style={{ color: settings.colors.text, background: settings.colors.background }}>
        {/* Navigation */}
        {settings.layout.navigation === 'top' && (
          <>
            <nav className="nav-elegant">
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
                        fontSize: '1.8rem',
                        fontWeight: 600,
                        fontStyle: 'italic',
                        color: settings.colors.primary,
                        fontFamily: 'Playfair Display, serif',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}>
                        {settings.branding.coupleName}
                      </div>
                    )}
                  </div>

                  {/* Desktop Navigation */}
                  <div className="desktop-nav">
                {settings.sections.hero.enabled && (
                  <a href="#hero" style={{
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: settings.colors.text,
                    textDecoration: 'none',
                    fontStyle: 'italic',
                    fontFamily: 'Playfair Display, serif',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    padding: '0.5rem 0'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = settings.colors.primary;
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = settings.colors.text;
                    e.target.style.transform = 'translateY(0)';
                  }}>
                    {getSectionTitle('hero')}
                  </a>
                )}
                {settings.sections.story.enabled && (
                  <a href="#story" style={{
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: settings.colors.text,
                    textDecoration: 'none',
                    fontStyle: 'italic',
                    fontFamily: 'Playfair Display, serif',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    padding: '0.5rem 0'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = settings.colors.primary;
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = settings.colors.text;
                    e.target.style.transform = 'translateY(0)';
                  }}>
                    {getSectionTitle('story')}
                  </a>
                )}
                {settings.sections.events.enabled && (
                  <a href="#events" style={{
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: settings.colors.text,
                    textDecoration: 'none',
                    fontStyle: 'italic',
                    fontFamily: 'Playfair Display, serif',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    padding: '0.5rem 0'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = settings.colors.primary;
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = settings.colors.text;
                    e.target.style.transform = 'translateY(0)';
                  }}>
                    {getSectionTitle('events')}
                  </a>
                )}
                {settings.sections.accommodations.enabled && (
                  <a href="#accommodations" style={{
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: settings.colors.text,
                    textDecoration: 'none',
                    fontStyle: 'italic',
                    fontFamily: 'Playfair Display, serif',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    padding: '0.5rem 0'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = settings.colors.primary;
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = settings.colors.text;
                    e.target.style.transform = 'translateY(0)';
                  }}>
                    {getSectionTitle('accommodations')}
                  </a>
                )}
                {settings.sections.rsvp.enabled && (
                  <a href="#rsvp" style={{
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: settings.colors.text,
                    textDecoration: 'none',
                    fontStyle: 'italic',
                    fontFamily: 'Playfair Display, serif',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    padding: '0.5rem 0'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = settings.colors.primary;
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = settings.colors.text;
                    e.target.style.transform = 'translateY(0)';
                  }}>
                    {getSectionTitle('rsvp')}
                  </a>
                )}
                {settings.sections.gallery.enabled && (
                  <a href="#gallery" style={{
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: settings.colors.text,
                    textDecoration: 'none',
                    fontStyle: 'italic',
                    fontFamily: 'Playfair Display, serif',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    padding: '0.5rem 0'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = settings.colors.primary;
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = settings.colors.text;
                    e.target.style.transform = 'translateY(0)';
                  }}>
                    {getSectionTitle('gallery')}
                  </a>
                )}
                {settings.sections.registry.enabled && (
                  <a href="#registry" style={{
                    fontSize: '1rem',
                    fontWeight: 500,
                    color: settings.colors.text,
                    textDecoration: 'none',
                    fontStyle: 'italic',
                    fontFamily: 'Playfair Display, serif',
                    position: 'relative',
                    transition: 'all 0.3s ease',
                    padding: '0.5rem 0'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.color = settings.colors.primary;
                    e.target.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = settings.colors.text;
                    e.target.style.transform = 'translateY(0)';
                  }}>
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
          <section id="hero" className="hero-elegant">
            <div className="hero-content">
                            
              <h1 className="hero-title">{welcomeMessage}</h1>
              
              <h2 className="hero-subtitle">You're Invited to Celebrate</h2>
              
              <div className="hero-names">{settings.branding.coupleName}</div>
              
              {settings.branding.tagline && (
                <p className="hero-tagline">{settings.branding.tagline}</p>
              )}
              
              {settings.content.heroMessage && (
                <p className="hero-tagline">{settings.content.heroMessage}</p>
              )}
              
              <div className="elegant-ornament">
                <span>❦</span>
              </div>
              
              <div className="hero-date">{settings.branding.weddingDate}</div>
              
              {settings.branding.heroPicture && (
                <div className="hero-image-container">
                  <div className="hero-image-frame">
                    <img
                      src={settings.branding.heroPicture}
                      alt={`${settings.branding.coupleName} - Wedding`}
                      className="hero-image"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Story Section */}
        {settings.sections.story.enabled && (
          <section id="story" className="section-elegant" style={{ background: 'rgba(255, 255, 255, 0.5)', backdropFilter: 'blur(10px)' }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('story')}</h2>
              <div className="elegant-divider">
                <span>❦</span>
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
          <section id="events" className="section-elegant">
            <div className="container">
              <h2 className="section-title">
                {getSectionTitle('events')}
                {guestGroup && (
                  <div style={{
                    fontSize: '1.125rem',
                    fontWeight: 400,
                    fontStyle: 'italic',
                    color: settings.colors.secondary,
                    marginTop: '1rem'
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
                        {event.description && (
                          <p className="event-description">{event.description}</p>
                        )}
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
          <section id="accommodations" className="section-elegant">
            <div className="container">
              <h2 className="section-title">{getSectionTitle('accommodations')}</h2>
              <div className="elegant-divider">
                <span>❦</span>
              </div>
              <div className="event-grid">
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
                        {accommodation.description && (
                          <p className="event-description">{accommodation.description}</p>
                        )}
                      </div>
                      {accommodation.website && (
                        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                          <a
                            href={accommodation.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-elegant"
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
          <section id="rsvp" className="section-elegant" style={{ 
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.6), rgba(248, 250, 252, 0.8))', 
            backdropFilter: 'blur(15px)' 
          }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('rsvp')}</h2>
              <div className="elegant-divider">
                <span>❦</span>
              </div>
              
              <div className="rsvp-section-container" style={{ 
                maxWidth: '55rem', 
                margin: '0 auto',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(255, 255, 255, 0.85))',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '4rem 3rem',
                boxShadow: '0 20px 60px rgba(0, 0, 0, 0.1), 0 8px 24px rgba(0, 0, 0, 0.05)',
                border: '2px solid rgba(255, 255, 255, 0.6)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Background decoration */}
                <div style={{
                  position: 'absolute',
                  top: -50,
                  right: -50,
                  width: 200,
                  height: 200,
                  background: `radial-gradient(circle, ${settings.colors.primary}10, transparent)`,
                  borderRadius: '50%',
                  pointerEvents: 'none'
                }}></div>
                
                {/* Personalized Greeting */}
                <div style={{ marginBottom: '3rem', textAlign: 'center', position: 'relative' }}>
                  <div style={{
                    fontSize: '3rem',
                    marginBottom: '1.5rem',
                    filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
                  }}>
                    💕
                  </div>
                  
                  {guest.isMainGuest && guest.totalGuests > 1 ? (
                    <p style={{
                      fontSize: '1.35rem',
                      fontWeight: 400,
                      lineHeight: '1.7',
                      color: settings.colors.text,
                      marginBottom: '1rem',
                      fontStyle: 'italic'
                    }}>
                      Dearest {firstName}, you are graciously responsible for the RSVP of your distinguished party ({guest.totalGuests} guests)
                    </p>
                  ) : guest.parentGuestId ? (
                    <p style={{
                      fontSize: '1.35rem',
                      fontWeight: 400,
                      lineHeight: '1.7',
                      color: settings.colors.text,
                      marginBottom: '1rem',
                      fontStyle: 'italic'
                    }}>
                      Dearest {firstName}, we would be honored by your gracious response
                    </p>
                  ) : (
                    <p style={{
                      fontSize: '1.35rem',
                      fontWeight: 400,
                      lineHeight: '1.7',
                      color: settings.colors.text,
                      marginBottom: '1rem',
                      fontStyle: 'italic'
                    }}>
                      Beloved {firstName}, kindly share your response with us
                    </p>
                  )}
                </div>
                
                {/* Event-specific RSVP Form */}
                <div style={{ textAlign: 'left' }}>
                  <h3 style={{ 
                    fontSize: '1.25rem', 
                    fontWeight: 600,
                    color: settings.colors.primary,
                    marginBottom: '2.5rem',
                    textAlign: 'center',
                    fontFamily: 'Playfair Display, serif',
                    fontStyle: 'italic'
                  }}>
                    Please indicate your attendance for each celebration
                  </h3>
                  
                  {(() => {
                    const invitedEvents = personalizedEvents.filter(event => guest.events?.includes(event.name));
                    if (invitedEvents.length === 0) {
                      return (
                        <div style={{
                          textAlign: 'center',
                          padding: '3rem',
                          color: settings.colors.text,
                          opacity: 0.7,
                          fontStyle: 'italic',
                          fontSize: '1.1rem'
                        }}>
                          No events available for RSVP at this time
                        </div>
                      );
                    }
                    
                    return invitedEvents.map((event, index) => {
                      return (
                        <div key={event.id} className="rsvp-event-container" style={{
                          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
                          padding: '2rem',
                          borderRadius: '16px',
                          marginBottom: '2rem',
                          border: `2px solid ${settings.colors.secondary}20`,
                          boxShadow: '0 6px 20px rgba(0, 0, 0, 0.06)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          {/* Event Header */}
                          <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                            <h4 style={{
                              fontSize: '1.3rem',
                              fontWeight: 600,
                              color: settings.colors.primary,
                              marginBottom: '0.75rem',
                              fontFamily: 'Playfair Display, serif',
                              fontStyle: 'italic'
                            }}>
                              {event.name}
                            </h4>
                            <p style={{
                              fontSize: '1rem',
                              color: settings.colors.secondary,
                              opacity: 0.9,
                              fontStyle: 'italic',
                              marginBottom: '0.5rem'
                            }}>
                              {event.date} at {event.time}
                            </p>
                            <p style={{
                              fontSize: '0.9rem',
                              color: settings.colors.text,
                              opacity: 0.8
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
                                background: 'rgba(255, 255, 255, 0.7)',
                                borderRadius: '12px',
                                border: `1px solid ${settings.colors.secondary}15`,
                                backdropFilter: 'blur(5px)'
                              }}>
                                <span style={{
                                  fontSize: '1rem',
                                  fontWeight: 500,
                                  color: settings.colors.text,
                                  fontStyle: 'italic'
                                }}>
                                  {guestItem.name} {guestItem.id === guest.id ? '(you)' : ''}
                                </span>
                                
                                <div className="rsvp-event-responses" style={{ display: 'flex', gap: '0.75rem' }}>
                                  <button
                                    onClick={() => handleEventResponse(event.name, guestItem.id, true)}
                                    style={{
                                      background: isAttending === true 
                                        ? `linear-gradient(135deg, ${settings.colors.primary}, ${settings.colors.secondary})` 
                                        : 'transparent',
                                      color: isAttending === true ? 'white' : settings.colors.primary,
                                      border: `2px solid ${settings.colors.primary}`,
                                      borderRadius: '25px',
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.9rem',
                                      cursor: 'pointer',
                                      minWidth: '70px',
                                      fontWeight: '500',
                                      fontFamily: 'Playfair Display, serif',
                                      fontStyle: 'italic',
                                      transition: 'all 0.3s ease',
                                      boxShadow: isAttending === true ? '0 4px 12px rgba(0, 0, 0, 0.15)' : 'none'
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
                                      borderRadius: '25px',
                                      padding: '0.5rem 1rem',
                                      fontSize: '0.9rem',
                                      cursor: 'pointer',
                                      minWidth: '70px',
                                      fontWeight: '500',
                                      fontFamily: 'Playfair Display, serif',
                                      fontStyle: 'italic',
                                      transition: 'all 0.3s ease',
                                      boxShadow: isAttending === false ? '0 4px 12px rgba(239, 68, 68, 0.2)' : 'none'
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
                  <div style={{ marginTop: '2.5rem' }}>
                    <h3 style={{
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      color: settings.colors.primary,
                      marginBottom: '1.5rem',
                      fontFamily: 'Playfair Display, serif',
                      fontStyle: 'italic'
                    }}>
                      Additional Messages & Special Requests
                    </h3>
                    <textarea
                      className="rsvp-textarea"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Dietary restrictions, accessibility needs, or heartfelt messages for the couple..."
                      style={{
                        width: '100%',
                        minHeight: '120px',
                        padding: '1.25rem',
                        borderRadius: '12px',
                        border: `2px solid ${settings.colors.secondary}40`,
                        background: 'rgba(255, 255, 255, 0.8)',
                        fontSize: '1rem',
                        fontFamily: 'Crimson Text, serif',
                        fontStyle: 'italic',
                        resize: 'vertical',
                        outline: 'none',
                        transition: 'all 0.3s ease',
                        backdropFilter: 'blur(5px)'
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = `${settings.colors.primary}60`;
                        e.target.style.boxShadow = `0 0 0 3px ${settings.colors.primary}20`;
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
                      className="btn-elegant rsvp-submit-button"
                      style={{
                        background: submittingRSVP ? '#ccc' : `linear-gradient(135deg, ${settings.colors.primary}, ${settings.colors.secondary})`,
                        cursor: submittingRSVP ? 'not-allowed' : 'pointer',
                        opacity: submittingRSVP ? 0.7 : 1,
                        padding: '1.3rem 4rem',
                        fontSize: '1.2rem'
                      }}
                    >
                      {submittingRSVP ? 'Submitting...' : (guest.rsvp?.status === 'pending' || !guest.rsvp ? 'Submit RSVP' : 'Update RSVP')}
                    </button>
                  </div>
                  
                  {/* Status Display if already submitted */}
                  {guest.rsvp && guest.rsvp.status !== 'pending' && (
                    <div style={{
                      marginTop: '3rem',
                      padding: '2rem',
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(16, 185, 129, 0.04))',
                      borderRadius: '16px',
                      textAlign: 'center',
                      border: `2px solid rgba(16, 185, 129, 0.2)`,
                      backdropFilter: 'blur(10px)'
                    }}>
                      <div style={{
                        fontSize: '2rem',
                        marginBottom: '1rem'
                      }}>
                        {guest.rsvp.status === 'accepted' ? '🎉' : '💝'}
                      </div>
                      <p style={{
                        fontSize: '1.2rem',
                        color: settings.colors.primary,
                        fontWeight: 600,
                        marginBottom: '0.5rem',
                        fontFamily: 'Playfair Display, serif',
                        fontStyle: 'italic'
                      }}>
                        Thank you for your gracious response!
                      </p>
                      {guest.rsvp.submittedAt && (
                        <p style={{
                          fontSize: '0.95rem',
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
          <section id="gallery" className="section-elegant" style={{ 
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.7), rgba(248, 250, 252, 0.9))', 
            backdropFilter: 'blur(15px)' 
          }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('gallery')}</h2>
              <div className="elegant-divider">
                <span>❦</span>
              </div>
              <div style={{ 
                maxWidth: '800px', 
                margin: '0 auto',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '3rem 2rem',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)',
                border: '2px solid rgba(255, 255, 255, 0.6)',
                textAlign: 'center'
              }}>
                <p style={{
                  fontSize: '1.25rem',
                  fontStyle: 'italic',
                  color: settings.colors.text,
                  marginBottom: '2rem',
                  lineHeight: 1.7
                }}>
                  Our precious moments together will grace this space
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
                      background: `linear-gradient(135deg, ${settings.colors.primary}15, ${settings.colors.secondary}10)`,
                      borderRadius: '16px',
                      border: `2px dashed ${settings.colors.secondary}40`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '2rem',
                      opacity: 0.6,
                      transition: 'all 0.3s ease'
                    }}>
                      {item === 1 ? '📸' : item === 2 ? '💕' : '🌸'}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Registry Section */}
        {settings.sections.registry.enabled && settings.registry && (
          <section id="registry" className="section-elegant" style={{ background: settings.colors.background }}>
            <div className="container">
              <h2 className="section-title">{getSectionTitle('registry')}</h2>
              <div className="elegant-divider">
                <span>❦</span>
              </div>
              <div className="rsvp-content" style={{ 
                maxWidth: '600px', 
                margin: '0 auto',
                background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(255, 255, 255, 0.7))',
                backdropFilter: 'blur(20px)',
                borderRadius: '24px',
                padding: '3rem 2rem',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.08)',
                border: '2px solid rgba(255, 255, 255, 0.6)',
                textAlign: 'center'
              }}>
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
                      className="btn-elegant"
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
          <section className="section-elegant">
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