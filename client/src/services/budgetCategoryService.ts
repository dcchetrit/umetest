import { db } from '@ume/shared';
import { 
  doc, 
  getDoc, 
  updateDoc, 
  Timestamp,
  arrayUnion,
  arrayRemove
} from 'firebase/firestore';
import { filterUndefined } from '@/utils/firestore';

const COUPLES_COLLECTION = 'couples';

export interface BudgetCategory {
  id: string;
  name: string;
  createdAt: Date;
  spentAmount: number;
}

export async function getBudgetCategories(coupleId: string): Promise<BudgetCategory[]> {
  try {
    const coupleRef = doc(db, COUPLES_COLLECTION, coupleId);
    const coupleDoc = await getDoc(coupleRef);
    
    if (!coupleDoc.exists()) {
      return [];
    }
    
    const data = coupleDoc.data();
    const finCategories = data.Fin_Category || [];
    
    return finCategories.map((category: any) => ({
      id: category.id,
      name: category.name,
      createdAt: category.createdAt?.toDate ? category.createdAt.toDate() : (category.createdAt || new Date()),
      spentAmount: category.spentAmount || 0
    })) as BudgetCategory[];
  } catch (error) {
    console.error('Error fetching budget categories:', error);
    return [];
  }
}

export async function saveBudgetCategory(coupleId: string, categoryName: string): Promise<string> {
  try {
    const categoryId = `fin_cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newCategory = {
      id: categoryId,
      name: categoryName.trim(),
      createdAt: Timestamp.fromDate(new Date()),
      spentAmount: 0
    };
    
    const coupleRef = doc(db, COUPLES_COLLECTION, coupleId);
    await updateDoc(coupleRef, {
      Fin_Category: arrayUnion(newCategory)
    });
    
    return categoryId;
  } catch (error) {
    console.error('Error saving budget category:', error);
    throw error;
  }
}

export async function updateBudgetCategory(coupleId: string, categoryId: string, updates: Partial<BudgetCategory>): Promise<void> {
  try {
    // Get current categories
    const categories = await getBudgetCategories(coupleId);
    const categoryIndex = categories.findIndex(cat => cat.id === categoryId);
    
    if (categoryIndex === -1) {
      throw new Error('Category not found');
    }
    
    // Update the specific category
    const updatedCategory = {
      ...categories[categoryIndex],
      ...updates,
      createdAt: categories[categoryIndex].createdAt // Keep original createdAt as Date
    };
    
    // Convert createdAt back to Timestamp for Firestore
    const categoryForFirestore = {
      ...updatedCategory,
      createdAt: Timestamp.fromDate(updatedCategory.createdAt)
    };
    
    // Remove old category and add updated one
    const oldCategory = {
      ...categories[categoryIndex],
      createdAt: Timestamp.fromDate(categories[categoryIndex].createdAt)
    };
    
    const coupleRef = doc(db, COUPLES_COLLECTION, coupleId);
    await updateDoc(coupleRef, {
      Fin_Category: arrayRemove(oldCategory)
    });
    
    await updateDoc(coupleRef, {
      Fin_Category: arrayUnion(categoryForFirestore)
    });
  } catch (error) {
    console.error('Error updating budget category:', error);
    throw error;
  }
}

export async function updateCategorySpentAmount(coupleId: string, categoryId: string, newSpentAmount: number): Promise<void> {
  try {
    await updateBudgetCategory(coupleId, categoryId, { spentAmount: newSpentAmount });
  } catch (error) {
    console.error('Error updating category spent amount:', error);
    throw error;
  }
}

export async function deleteBudgetCategory(coupleId: string, categoryId: string): Promise<void> {
  try {
    const categories = await getBudgetCategories(coupleId);
    const categoryToDelete = categories.find(cat => cat.id === categoryId);
    
    if (!categoryToDelete) {
      throw new Error('Category not found');
    }
    
    const categoryForFirestore = {
      ...categoryToDelete,
      createdAt: Timestamp.fromDate(categoryToDelete.createdAt)
    };
    
    const coupleRef = doc(db, COUPLES_COLLECTION, coupleId);
    await updateDoc(coupleRef, {
      Fin_Category: arrayRemove(categoryForFirestore)
    });
  } catch (error) {
    console.error('Error deleting budget category:', error);
    throw error;
  }
}

export async function saveBulkBudgetCategories(coupleId: string, categoryNames: string[]): Promise<string[]> {
  const categoryIds: string[] = [];
  
  try {
    const newCategories = categoryNames.map(name => {
      const categoryId = `fin_cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      categoryIds.push(categoryId);
      return {
        id: categoryId,
        name: name.trim(),
        createdAt: Timestamp.fromDate(new Date()),
        spentAmount: 0
      };
    });
    
    const coupleRef = doc(db, COUPLES_COLLECTION, coupleId);
    await updateDoc(coupleRef, {
      Fin_Category: arrayUnion(...newCategories)
    });
    
    return categoryIds;
  } catch (error) {
    console.error('Error saving bulk budget categories:', error);
    throw error;
  }
}