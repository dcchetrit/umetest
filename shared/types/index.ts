export interface Couple {
  id: string;
  owners: string[]; // User IDs of the couple
  profile: CoupleProfile;
  createdAt: Date;
  updatedAt: Date;
}

export interface CoupleProfile {
  names: {
    partner1: string;
    partner2: string;
  };
  slug: string; // URL-friendly identifier for public pages
  locale: 'en' | 'fr' | 'es';
  currency: string;
  theme: ThemeConfig;
  rsvpMode: 'token' | 'password';
  timezone: string;
}

export interface ThemeConfig {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
}

export interface Guest {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  groupId: string;
  tags: string[];
  rsvp: RSVPResponse;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface RSVPResponse {
  status: 'pending' | 'accepted' | 'declined' | 'maybe';
  events: { [eventId: string]: boolean }; // Which events they're attending
  dietaryRestrictions?: string;
  mealChoice?: string;
  plusOnes: PlusOne[];
  comments?: string;
  submittedAt?: Date;
}

export interface PlusOne {
  name: string;
  dietaryRestrictions?: string;
  mealChoice?: string;
}

export interface Group {
  id: string;
  name: string;
  allowedEvents: string[]; // Event IDs this group can RSVP for
  password?: string; // For password-based RSVP access
  createdAt: Date;
}

export interface Event {
  id: string;
  name: string;
  type: 'ceremony' | 'reception' | 'brunch' | 'other';
  date: Date;
  location: Location;
  description?: string;
  mealOptions?: string[];
}

export interface Location {
  name: string;
  address: Address;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'not-started' | 'in-progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate?: Date;
  assignedTo?: string;
  eventId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetItem {
  id: string;
  category: string;
  description: string;
  plannedAmount: number;
  actualAmount?: number;
  vendorId?: string;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  contact: {
    email?: string;
    phone?: string;
    website?: string;
  };
  location?: Address;
  services: string[];
  quotes: VendorQuote[];
  rating?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorQuote {
  id: string;
  amount: number;
  description: string;
  validUntil?: Date;
  accepted?: boolean;
  createdAt: Date;
}

export interface RSVPLink {
  id: string;
  token: string;
  guestIds: string[]; // Can be per-guest or household
  expiresAt: Date;
  revoked: boolean;
  usedAt?: Date;
  createdAt: Date;
}

export interface Analytics {
  rsvpStats: {
    total: number;
    accepted: number;
    declined: number;
    pending: number;
  };
  eventStats: { [eventId: string]: number };
  lastUpdated: Date;
}