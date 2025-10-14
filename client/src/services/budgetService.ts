import { db } from '@ume/shared';
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
  where, 
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { 
  FundingSource, 
  BudgetSummary, 
  CategoryExpenseData,
  ExpenseEntry,
  SimpleExpense
} from '@/types/budget';
import { filterUndefined } from '@/utils/firestore';

const COUPLES_COLLECTION = 'couples';
const BUDGET_SUBCOLLECTION = 'budget';


// Funding Sources Functions
export async function getFundingSources(coupleId: string): Promise<FundingSource[]> {
  try {
    const sourcesRef = collection(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'funding-sources', 'items');
    const snapshot = await getDocs(sourcesRef);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
      };
    }) as FundingSource[];
  } catch (error) {
    console.error('Error fetching funding sources:', error);
    return [];
  }
}

export async function saveFundingSource(coupleId: string, source: Omit<FundingSource, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const sourcesRef = collection(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'funding-sources', 'items');
    const docRef = await addDoc(sourcesRef, filterUndefined({
      ...source,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    }));
    return docRef.id;
  } catch (error) {
    console.error('Error saving funding source:', error);
    throw error;
  }
}

export async function updateFundingSource(coupleId: string, sourceId: string, updates: Partial<FundingSource>): Promise<void> {
  try {
    const sourceRef = doc(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'funding-sources', 'items', sourceId);
    await updateDoc(sourceRef, filterUndefined({
      ...updates,
      updatedAt: Timestamp.fromDate(new Date())
    }));
  } catch (error) {
    console.error('Error updating funding source:', error);
    throw error;
  }
}

export async function deleteFundingSource(coupleId: string, sourceId: string): Promise<void> {
  try {
    const sourceRef = doc(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'funding-sources', 'items', sourceId);
    await deleteDoc(sourceRef);
  } catch (error) {
    console.error('Error deleting funding source:', error);
    throw error;
  }
}

// Expense Functions
export async function getCategoryExpenses(coupleId: string): Promise<CategoryExpenseData[]> {
  try {
    const expensesRef = collection(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'expenses', 'items');
    const snapshot = await getDocs(expensesRef);
    
    const expenses = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        paymentDueDate: (() => {
          if (!data.paymentDueDate) return null;
          if (data.paymentDueDate.toDate && typeof data.paymentDueDate.toDate === 'function') {
            return data.paymentDueDate.toDate();
          }
          if (data.paymentDueDate.seconds) {
            // Handle Firestore Timestamp with seconds property
            return new Date(data.paymentDueDate.seconds * 1000);
          }
          if (data.paymentDueDate instanceof Date) {
            return data.paymentDueDate;
          }
          // Try to parse as regular date string/number
          return new Date(data.paymentDueDate);
        })()
      };
    }) as ExpenseEntry[];

    // Group expenses by category
    const categoryMap = new Map<string, ExpenseEntry[]>();
    expenses.forEach(expense => {
      const categoryExpenses = categoryMap.get(expense.categoryId) || [];
      categoryExpenses.push(expense);
      categoryMap.set(expense.categoryId, categoryExpenses);
    });

    // Get budget categories to match with expenses
    const { getBudgetCategories } = await import('./budgetCategoryService');
    const budgetCategories = await getBudgetCategories(coupleId);
    const categoryMap2 = new Map(budgetCategories.map(c => [c.id, c]));

    // Create CategoryExpenseData
    const categoryExpenseData: CategoryExpenseData[] = [];
    
    for (const [categoryId, categoryExpenses] of categoryMap) {
      const budgetCategory = categoryMap2.get(categoryId);
      const plannedAmount = 0; // No planned amount in new system, just expenses
      const totalPaid = categoryExpenses.reduce((sum, e) => sum + e.amountPaid, 0);
      const totalForecasted = categoryExpenses.reduce((sum, e) => sum + e.quotedPrice, 0);
      const remainingBudget = plannedAmount - totalForecasted;
      const isOverBudget = false; // No budget to compare against in new system
      
      let status: CategoryExpenseData['status'] = 'under_budget';

      categoryExpenseData.push({
        categoryId,
        categoryName: budgetCategory?.name || 'Unknown Category',
        plannedAmount,
        totalPaid,
        totalForecasted,
        remainingBudget,
        isOverBudget,
        status,
        expenses: categoryExpenses
      });
    }

    return categoryExpenseData;
  } catch (error) {
    console.error('Error fetching category expenses:', error);
    return [];
  }
}

// Helper function to update category spent amount
async function updateCategorySpentAmountForCategory(coupleId: string, categoryId: string): Promise<void> {
  try {
    const categoryExpenses = await getCategoryExpenses(coupleId);
    const categoryData = categoryExpenses.find(cat => cat.categoryId === categoryId);
    
    if (categoryData) {
      const { updateCategorySpentAmount } = await import('./budgetCategoryService');
      await updateCategorySpentAmount(coupleId, categoryId, categoryData.totalPaid);
    }
  } catch (error) {
    console.warn('Failed to update category spent amount:', error);
  }
}

export async function saveExpense(coupleId: string, expense: Omit<ExpenseEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const expensesRef = collection(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'expenses', 'items');
    const docRef = await addDoc(expensesRef, filterUndefined({
      ...expense,
      paymentDueDate: expense.paymentDueDate ? Timestamp.fromDate(expense.paymentDueDate) : null,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    }));
    
    // Update category spent amount
    try {
      const { updateCategorySpentAmount } = await import('./budgetCategoryService');
      await updateCategorySpentAmountForCategory(coupleId, expense.categoryId);
    } catch (error) {
      console.warn('Failed to update category spent amount:', error);
    }
    
    // Auto-integrate with vendor budget system
    try {
      const { autoSyncExpenseToVendorBudget } = await import('./budgetVendorIntegrationService');
      const expenseWithId: ExpenseEntry = {
        id: docRef.id,
        ...expense,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      await autoSyncExpenseToVendorBudget(coupleId, expenseWithId);
    } catch (integrationError) {
      console.warn('Failed to sync expense with vendor budget system:', integrationError);
      // Don't fail the main expense creation if integration fails
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving expense:', error);
    throw error;
  }
}

export async function updateExpense(coupleId: string, expenseId: string, updates: Partial<ExpenseEntry>): Promise<void> {
  try {
    const expenseRef = doc(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'expenses', 'items', expenseId);
    const updateData: any = {
      ...updates,
      updatedAt: Timestamp.fromDate(new Date())
    };
    
    if (updates.paymentDueDate) {
      updateData.paymentDueDate = Timestamp.fromDate(updates.paymentDueDate);
    }
    
    await updateDoc(expenseRef, filterUndefined(updateData));
    
    // Update category spent amount if amounts changed
    if (updates.quotedPrice !== undefined || updates.amountPaid !== undefined || updates.categoryId) {
      try {
        const categoryIdToUpdate = updates.categoryId || (await getDoc(expenseRef)).data()?.categoryId;
        if (categoryIdToUpdate) {
          await updateCategorySpentAmountForCategory(coupleId, categoryIdToUpdate);
        }
      } catch (error) {
        console.warn('Failed to update category spent amount:', error);
      }
    }
    
    // Auto-sync updates with vendor budget system if vendor name or amounts changed
    if (updates.vendorName || updates.quotedPrice !== undefined || updates.amountPaid !== undefined) {
      try {
        // Get the updated expense data
        const updatedExpenseDoc = await getDoc(expenseRef);
        if (updatedExpenseDoc.exists()) {
          const { autoSyncExpenseToVendorBudget } = await import('./budgetVendorIntegrationService');
          const expenseData = updatedExpenseDoc.data();
          const fullExpense: ExpenseEntry = {
            id: expenseId,
            ...expenseData,
            createdAt: expenseData.createdAt?.toDate ? expenseData.createdAt.toDate() : (expenseData.createdAt || new Date()),
            updatedAt: expenseData.updatedAt?.toDate ? expenseData.updatedAt.toDate() : (expenseData.updatedAt || new Date()),
            paymentDueDate: expenseData.paymentDueDate?.toDate ? expenseData.paymentDueDate.toDate() : expenseData.paymentDueDate
          };
          await autoSyncExpenseToVendorBudget(coupleId, fullExpense);
        }
      } catch (integrationError) {
        console.warn('Failed to sync expense update with vendor budget system:', integrationError);
      }
    }
    
  } catch (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
}

export async function deleteExpense(coupleId: string, expenseId: string): Promise<void> {
  try {
    const expenseRef = doc(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'expenses', 'items', expenseId);
    await deleteDoc(expenseRef);
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
}

// Budget Summary Functions
export async function getBudgetSummary(coupleId: string): Promise<BudgetSummary> {
  try {
    const [fundingSources, categoryExpenses, coupleDoc] = await Promise.all([
      getFundingSources(coupleId),
      getCategoryExpenses(coupleId),
      getDoc(doc(db, COUPLES_COLLECTION, coupleId))
    ]);

    // Get estimated budget from couple document
    let estimatedBudget = 0;
    if (coupleDoc.exists()) {
      const coupleData = coupleDoc.data();
      estimatedBudget = coupleData.estimatedBudget || 0;
    }

    const totalFunds = fundingSources.reduce((sum, source) => sum + source.amount, 0);
    const totalAllocated = categoryExpenses.reduce((sum, category) => sum + category.totalForecasted, 0); // Use total forecasted instead
    const totalSpent = categoryExpenses.reduce((sum, category) => sum + category.totalPaid, 0);
    const remainingFunds = totalFunds - totalSpent;
    const remainingBudget = estimatedBudget - totalSpent;

    return {
      totalFunds,
      totalAllocated,
      totalSpent,
      remainingFunds,
      unallocatedFunds: totalFunds - totalAllocated,
      estimatedBudget,
      remainingBudget,
      isOverBudget: totalSpent > estimatedBudget
    };
  } catch (error) {
    console.error('Error calculating budget summary:', error);
    return {
      totalFunds: 0,
      totalAllocated: 0,
      totalSpent: 0,
      remainingFunds: 0,
      unallocatedFunds: 0,
      estimatedBudget: 0,
      remainingBudget: 0,
      isOverBudget: false
    };
  }
}

// Simple Expense Functions
export async function getSimpleExpenses(coupleId: string): Promise<SimpleExpense[]> {
  try {
    const expensesRef = collection(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'simple-expenses', 'items');
    const snapshot = await getDocs(expensesRef);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
      };
    }) as SimpleExpense[];
  } catch (error) {
    console.error('Error fetching simple expenses:', error);
    return [];
  }
}

export async function saveSimpleExpense(coupleId: string, expense: Omit<SimpleExpense, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const expensesRef = collection(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'simple-expenses', 'items');
    const docRef = await addDoc(expensesRef, filterUndefined({
      ...expense,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    }));
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving simple expense:', error);
    throw error;
  }
}

export async function updateSimpleExpense(coupleId: string, expenseId: string, updates: Partial<SimpleExpense>): Promise<void> {
  try {
    const expenseRef = doc(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'simple-expenses', 'items', expenseId);
    await updateDoc(expenseRef, filterUndefined({
      ...updates,
      updatedAt: Timestamp.fromDate(new Date())
    }));
  } catch (error) {
    console.error('Error updating simple expense:', error);
    throw error;
  }
}

export async function deleteSimpleExpense(coupleId: string, expenseId: string): Promise<void> {
  try {
    const expenseRef = doc(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'simple-expenses', 'items', expenseId);
    await deleteDoc(expenseRef);
  } catch (error) {
    console.error('Error deleting simple expense:', error);
    throw error;
  }
}

// Events Functions
export async function getEvents(coupleId: string): Promise<Array<{id: string, name: string, showOnWebsite: boolean}>> {
  try {
    const coupleRef = doc(db, COUPLES_COLLECTION, coupleId);
    const coupleDoc = await getDoc(coupleRef);
    
    if (coupleDoc.exists()) {
      const data = coupleDoc.data();
      return data.events || [];
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching events:', error);
    return [];
  }
}