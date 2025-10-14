'use client';

import { Guest, Group } from '@ume/shared';
import ClassicInviteTemplate from './ClassicInviteTemplate';
import ModernInviteTemplate from './ModernInviteTemplate';
import ElegantInviteTemplate from './ElegantInviteTemplate';
import MinimalInviteTemplate from './MinimalInviteTemplate';

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
    navigation: 'top';
  };
  content: {
    heroMessage?: string;
    storyText?: string;
    additionalInfo?: string;
  };
  events: WebsiteEvent[];
  accommodations: any[];
  contacts: any[];
  registry?: {
    message?: string;
    links: Array<{
      store: string;
      url: string;
    }>;
  };
}

interface TemplateRouterProps {
  guest: Guest;
  guestGroup: Group | null;
  settings: WebsiteSettings;
  personalizedEvents: WebsiteEvent[];
  coupleId: string;
}

export default function TemplateRouter({
  guest,
  guestGroup,
  settings,
  personalizedEvents,
  coupleId
}: TemplateRouterProps) {
  const templateStyle = settings.layout.template || 'classic';

  const commonProps = {
    guest,
    guestGroup,
    settings,
    personalizedEvents,
    coupleId
  };

  switch (templateStyle) {
    case 'modern':
      return <ModernInviteTemplate {...commonProps} />;
    case 'elegant':
      return <ElegantInviteTemplate {...commonProps} />;
    case 'minimal':
      return <MinimalInviteTemplate {...commonProps} />;
    case 'classic':
    default:
      return <ClassicInviteTemplate {...commonProps} />;
  }
}