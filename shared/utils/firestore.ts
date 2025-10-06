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
import { Couple, Guest, Event, Task, BudgetItem, Vendor } from '../types';

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
}