import { db } from '@ume/shared';
import { filterUndefined } from '@/utils/firestore';
import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  query, 
  orderBy,
  Timestamp
} from 'firebase/firestore';

const COUPLES_COLLECTION = 'couples';
const BENCHMARK_SUBCOLLECTION = 'benchmark';

export interface VendorOption {
  id: string;
  name: string;
  category: string;
  contact: string;
  email?: string;
  phone?: string;
  website?: string;
  price: number;
  notes?: string;
  customCriteria: Record<string, number | string>;
  overallScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CriteriaItem {
  id: string;
  name: string;
  type: 'number' | 'rating' | 'text';
  weight: number;
  description?: string;
}

// Note: Using shared filterUndefined utility from @/utils/firestore

// Vendor CRUD Functions
export async function getBenchmarkVendors(coupleId: string): Promise<VendorOption[]> {
  try {
    const vendorsRef = collection(db, COUPLES_COLLECTION, coupleId, BENCHMARK_SUBCOLLECTION, 'vendors', 'items');
    const q = query(vendorsRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    })) as VendorOption[];
  } catch (error) {
    console.error('Error fetching benchmark vendors:', error);
    return [];
  }
}

export async function saveBenchmarkVendor(coupleId: string, vendor: Omit<VendorOption, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const vendorsRef = collection(db, COUPLES_COLLECTION, coupleId, BENCHMARK_SUBCOLLECTION, 'vendors', 'items');
    
    // Filter out undefined values to prevent Firestore errors
    const cleanedVendor = filterUndefined(vendor);
    
    const docRef = await addDoc(vendorsRef, {
      ...cleanedVendor,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving benchmark vendor:', error);
    throw error;
  }
}

export async function updateBenchmarkVendor(coupleId: string, vendorId: string, updates: Partial<VendorOption>): Promise<void> {
  try {
    const vendorRef = doc(db, COUPLES_COLLECTION, coupleId, BENCHMARK_SUBCOLLECTION, 'vendors', 'items', vendorId);
    
    // Filter out undefined values to prevent Firestore errors
    const cleanedUpdates = filterUndefined(updates);
    
    await updateDoc(vendorRef, {
      ...cleanedUpdates,
      updatedAt: Timestamp.fromDate(new Date())
    });
  } catch (error) {
    console.error('Error updating benchmark vendor:', error);
    throw error;
  }
}

export async function deleteBenchmarkVendor(coupleId: string, vendorId: string): Promise<void> {
  try {
    const vendorRef = doc(db, COUPLES_COLLECTION, coupleId, BENCHMARK_SUBCOLLECTION, 'vendors', 'items', vendorId);
    await deleteDoc(vendorRef);
  } catch (error) {
    console.error('Error deleting benchmark vendor:', error);
    throw error;
  }
}

// Criteria CRUD Functions
export async function getBenchmarkCriteria(coupleId: string): Promise<CriteriaItem[]> {
  try {
    const criteriaRef = collection(db, COUPLES_COLLECTION, coupleId, BENCHMARK_SUBCOLLECTION, 'criteria', 'items');
    const q = query(criteriaRef, orderBy('weight', 'desc'));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as CriteriaItem[];
  } catch (error) {
    console.error('Error fetching benchmark criteria:', error);
    return [];
  }
}

export async function saveBenchmarkCriterion(coupleId: string, criterion: Omit<CriteriaItem, 'id'>): Promise<string> {
  try {
    const criteriaRef = collection(db, COUPLES_COLLECTION, coupleId, BENCHMARK_SUBCOLLECTION, 'criteria', 'items');
    
    // Filter out undefined values to prevent Firestore errors
    const cleanedCriterion = filterUndefined(criterion);
    
    const docRef = await addDoc(criteriaRef, cleanedCriterion);
    return docRef.id;
  } catch (error) {
    console.error('Error saving benchmark criterion:', error);
    throw error;
  }
}

export async function deleteBenchmarkCriterion(coupleId: string, criterionId: string): Promise<void> {
  try {
    const criterionRef = doc(db, COUPLES_COLLECTION, coupleId, BENCHMARK_SUBCOLLECTION, 'criteria', 'items', criterionId);
    await deleteDoc(criterionRef);
  } catch (error) {
    console.error('Error deleting benchmark criterion:', error);
    throw error;
  }
}

// Migration function to help migrate from localStorage
export async function migrateBenchmarkDataFromLocalStorage(coupleId: string): Promise<void> {
  try {
    // Check if localStorage data exists
    const savedVendors = localStorage.getItem('benchmarkVendors');
    const savedCriteria = localStorage.getItem('benchmarkCriteria');
    
    if (savedVendors || savedCriteria) {
      console.log('Migrating benchmark data from localStorage to Firestore...');
      
      // Migrate criteria first
      if (savedCriteria) {
        const criteria = JSON.parse(savedCriteria);
        for (const criterion of criteria) {
          await saveBenchmarkCriterion(coupleId, {
            name: criterion.name,
            type: criterion.type,
            weight: criterion.weight,
            description: criterion.description
          });
        }
      }
      
      // Migrate vendors
      if (savedVendors) {
        const vendors = JSON.parse(savedVendors);
        for (const vendor of vendors) {
          await saveBenchmarkVendor(coupleId, {
            name: vendor.name,
            category: vendor.category,
            contact: vendor.contact || '',
            email: vendor.email,
            phone: vendor.phone,
            website: vendor.website,
            price: vendor.price || 0,
            notes: vendor.notes,
            customCriteria: vendor.customCriteria || {},
            overallScore: vendor.overallScore
          });
        }
      }
      
      // Clear localStorage after successful migration
      localStorage.removeItem('benchmarkVendors');
      localStorage.removeItem('benchmarkCriteria');
      
      console.log('Benchmark data migration completed successfully');
    }
  } catch (error) {
    console.error('Error migrating benchmark data:', error);
    // Don't throw - let the app continue even if migration fails
  }
}

// Initialize default criteria if none exist
export async function initializeDefaultCriteria(coupleId: string): Promise<void> {
  try {
    const existingCriteria = await getBenchmarkCriteria(coupleId);
    
    if (existingCriteria.length === 0) {
      const defaultCriteria = [
        { name: 'Quality', type: 'rating' as const, weight: 8, description: 'Overall service quality' },
        { name: 'Price Value', type: 'rating' as const, weight: 7, description: 'Value for money' },
        { name: 'Communication', type: 'rating' as const, weight: 6, description: 'Responsiveness and communication' },
        { name: 'Experience', type: 'number' as const, weight: 5, description: 'Years of experience' }
      ];
      
      for (const criterion of defaultCriteria) {
        await saveBenchmarkCriterion(coupleId, criterion);
      }
    }
  } catch (error) {
    console.error('Error initializing default criteria:', error);
  }
}