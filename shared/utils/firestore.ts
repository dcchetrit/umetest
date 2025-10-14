import { 
  doc, 
  collection, 
  getDocs, 
  getDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { Couple, Guest, Event, Task, BudgetItem, Vendor, Analytics } from '../types';

export class FirestoreService {
  
  // Couples
  static async getCouple(coupleId: string): Promise<Couple | null> {
    const docRef = doc(db, 'couples', coupleId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as Couple : null;
  }

  static async updateCouple(coupleId: string, data: Partial<Couple>) {
    const docRef = doc(db, 'couples', coupleId);
    await updateDoc(docRef, { ...data, updatedAt: new Date() });
  }

  // Guests
  static async getGuests(coupleId: string): Promise<Guest[]> {
    const collectionRef = collection(db, 'couples', coupleId, 'guests');
    const snapshot = await getDocs(query(collectionRef, orderBy('name')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Guest));
  }

  static async addGuest(coupleId: string, guestData: Omit<Guest, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const collectionRef = collection(db, 'couples', coupleId, 'guests');
    const docRef = await addDoc(collectionRef, {
      ...guestData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  }

  static async updateGuest(coupleId: string, guestId: string, data: Partial<Guest>) {
    const docRef = doc(db, 'couples', coupleId, 'guests', guestId);
    await updateDoc(docRef, { ...data, updatedAt: new Date() });
  }

  static async deleteGuest(coupleId: string, guestId: string) {
    const docRef = doc(db, 'couples', coupleId, 'guests', guestId);
    await deleteDoc(docRef);
  }

  static async getGuestByToken(coupleId: string, token: string): Promise<Guest | null> {
    const collectionRef = collection(db, 'couples', coupleId, 'guests');
    const q = query(collectionRef, where('inviteToken', '==', token), limit(1));
    const snapshot = await getDocs(q);
    return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Guest;
  }

  static async getGuestBySlug(coupleId: string, guestSlug: string): Promise<Guest | null> {
    const collectionRef = collection(db, 'couples', coupleId, 'guests');
    const q = query(collectionRef, where('inviteLink', '>=', ''), limit(100)); // Get all guests with invite links
    const snapshot = await getDocs(q);
    
    for (const doc of snapshot.docs) {
      const guestData = doc.data();
      if (guestData.inviteLink) {
        // Extract slug from invite link (last part after /)
        const linkSlug = guestData.inviteLink.split('/').pop();
        if (linkSlug === guestSlug) {
          return { id: doc.id, ...guestData } as Guest;
        }
      }
    }
    return null;
  }

  static async generateGuestToken(coupleId: string, guestId: string): Promise<string> {
    const token = this.generateUniqueToken();
    await this.updateGuest(coupleId, guestId, { inviteToken: token });
    return token;
  }

  static async generateTokensForAllGuests(coupleId: string): Promise<void> {
    const guests = await this.getGuests(coupleId);
    for (const guest of guests) {
      if (!guest.inviteToken) {
        await this.generateGuestToken(coupleId, guest.id);
      }
    }
  }

  // Events
  static async getEvents(coupleId: string): Promise<Event[]> {
    const collectionRef = collection(db, 'couples', coupleId, 'events');
    const snapshot = await getDocs(query(collectionRef, orderBy('date')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
  }

  static async addEvent(coupleId: string, eventData: Omit<Event, 'id'>): Promise<string> {
    const collectionRef = collection(db, 'couples', coupleId, 'events');
    const docRef = await addDoc(collectionRef, eventData);
    return docRef.id;
  }

  // Tasks
  static async getTasks(coupleId: string, filters?: { eventId?: string, status?: string }): Promise<Task[]> {
    const collectionRef = collection(db, 'couples', coupleId, 'tasks');
    const constraints: QueryConstraint[] = [orderBy('dueDate')];
    
    if (filters?.eventId) {
      constraints.push(where('eventId', '==', filters.eventId));
    }
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }

    const snapshot = await getDocs(query(collectionRef, ...constraints));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
  }

  static async addTask(coupleId: string, taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const collectionRef = collection(db, 'couples', coupleId, 'tasks');
    const docRef = await addDoc(collectionRef, {
      ...taskData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  }

  static async updateTask(coupleId: string, taskId: string, data: Partial<Task>) {
    const docRef = doc(db, 'couples', coupleId, 'tasks', taskId);
    await updateDoc(docRef, { ...data, updatedAt: new Date() });
  }

  // Budget Items
  static async getBudgetItems(coupleId: string): Promise<BudgetItem[]> {
    const collectionRef = collection(db, 'couples', coupleId, 'budget');
    const snapshot = await getDocs(query(collectionRef, orderBy('category')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetItem));
  }

  static async addBudgetItem(coupleId: string, budgetData: Omit<BudgetItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const collectionRef = collection(db, 'couples', coupleId, 'budget');
    const docRef = await addDoc(collectionRef, {
      ...budgetData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  }

  // Vendors
  static async getVendors(coupleId: string): Promise<Vendor[]> {
    const collectionRef = collection(db, 'couples', coupleId, 'vendors');
    const snapshot = await getDocs(query(collectionRef, orderBy('name')));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor));
  }

  static async addVendor(coupleId: string, vendorData: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const collectionRef = collection(db, 'couples', coupleId, 'vendors');
    const docRef = await addDoc(collectionRef, {
      ...vendorData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return docRef.id;
  }

  // Generic utility methods
  static async exists(path: string): Promise<boolean> {
    const docRef = doc(db, path);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  }

  static async getCollection(path: string, constraints?: QueryConstraint[]): Promise<any[]> {
    const collectionRef = collection(db, path);
    const q = constraints ? query(collectionRef, ...constraints) : collectionRef;
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Token generation utility
  private static generateUniqueToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Analytics
  static async calculateRSVPAnalytics(coupleId: string, eventIds: string[]): Promise<Analytics> {
    const guests = await this.getGuests(coupleId);
    
    // Initialize analytics
    const analytics: Analytics = {
      rsvpStats: {
        total: guests.length,
        accepted: 0,
        declined: 0,
        pending: 0
      },
      eventStats: {},
      lastUpdated: new Date()
    };

    // Initialize event stats
    eventIds.forEach(eventId => {
      analytics.eventStats[eventId] = {
        attending: 0,
        absent: 0,
        total: guests.length
      };
    });

    // Calculate stats from all guests
    guests.forEach(guest => {
      // RSVP status stats
      if (!guest.rsvp || guest.rsvp.status === 'pending') {
        analytics.rsvpStats.pending++;
      } else if (guest.rsvp.status === 'accepted') {
        analytics.rsvpStats.accepted++;
      } else if (guest.rsvp.status === 'declined') {
        analytics.rsvpStats.declined++;
      }

      // Per-event stats
      if (guest.rsvp?.events) {
        eventIds.forEach(eventId => {
          const isAttending = guest.rsvp.events[eventId];
          if (isAttending === true) {
            analytics.eventStats[eventId].attending++;
          } else if (isAttending === false) {
            analytics.eventStats[eventId].absent++;
          }
          // If undefined, neither attending nor explicitly absent (pending)
        });
      }
    });

    return analytics;
  }
}