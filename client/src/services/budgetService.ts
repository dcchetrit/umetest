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
  BudgetAllocation, 
  FundingSource, 
  BudgetSummary, 
  CategoryExpenseData,
  ExpenseEntry,
  BudgetCategory,
  SimpleExpense
} from '@/types/budget';
import { filterUndefined } from '@/utils/firestore';

const COUPLES_COLLECTION = 'couples';
const BUDGET_SUBCOLLECTION = 'budget';

// Budget Allocation Functions
export async function getBudgetAllocations(coupleId: string): Promise<BudgetAllocation[]> {
  try {
    const allocationsRef = collection(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'allocations', 'items');
    const snapshot = await getDocs(allocationsRef);
    
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date())
      };
    }) as BudgetAllocation[];
  } catch (error) {
    console.error('Error fetching budget allocations:', error);
    return [];
  }
}

export async function saveBudgetAllocation(coupleId: string, allocation: Omit<BudgetAllocation, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const allocationsRef = collection(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'allocations', 'items');
    const docRef = await addDoc(allocationsRef, filterUndefined({
      ...allocation,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    }));
    
    // Auto-generate benchmark alert if allocation is significantly off market rates
    try {
      const { getBenchmarkAlerts } = await import('./benchmarkBudgetService');
      await getBenchmarkAlerts(coupleId);
    } catch (benchmarkError) {
      console.warn('Failed to check benchmark alerts:', benchmarkError);
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Error saving budget allocation:', error);
    throw error;
  }
}

export async function updateBudgetAllocation(coupleId: string, allocationId: string, updates: Partial<BudgetAllocation>): Promise<void> {
  try {
    const allocationRef = doc(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'allocations', 'items', allocationId);
    await updateDoc(allocationRef, filterUndefined({
      ...updates,
      updatedAt: Timestamp.fromDate(new Date())
    }));
  } catch (error) {
    console.error('Error updating budget allocation:', error);
    throw error;
  }
}

export async function deleteBudgetAllocation(coupleId: string, allocationId: string): Promise<void> {
  try {
    const allocationRef = doc(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'allocations', 'items', allocationId);
    await deleteDoc(allocationRef);
  } catch (error) {
    console.error('Error deleting budget allocation:', error);
    throw error;
  }
}

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
        paymentDueDate: data.paymentDueDate?.toDate ? data.paymentDueDate.toDate() : data.paymentDueDate
      };
    }) as ExpenseEntry[];

    // Group expenses by category
    const categoryMap = new Map<string, ExpenseEntry[]>();
    expenses.forEach(expense => {
      const categoryExpenses = categoryMap.get(expense.categoryId) || [];
      categoryExpenses.push(expense);
      categoryMap.set(expense.categoryId, categoryExpenses);
    });

    // Get budget allocations to match with categories
    const allocations = await getBudgetAllocations(coupleId);
    const allocationMap = new Map(allocations.map(a => [a.categoryId, a]));

    // Create CategoryExpenseData
    const categoryExpenseData: CategoryExpenseData[] = [];
    
    for (const [categoryId, categoryExpenses] of categoryMap) {
      const allocation = allocationMap.get(categoryId);
      const plannedAmount = allocation?.plannedAmount || 0;
      const totalPaid = categoryExpenses.reduce((sum, e) => sum + e.amountPaid, 0);
      const totalForecasted = categoryExpenses.reduce((sum, e) => sum + e.quotedPrice, 0);
      const remainingBudget = plannedAmount - totalForecasted;
      const isOverBudget = totalForecasted > plannedAmount;
      
      let status: CategoryExpenseData['status'] = 'under_budget';
      if (isOverBudget) {
        status = 'over_budget';
      } else if (remainingBudget < plannedAmount * 0.1) {
        status = 'close_to_budget';
      }

      categoryExpenseData.push({
        categoryId,
        categoryName: allocation?.categoryName || 'Unknown Category',
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

export async function saveExpense(coupleId: string, expense: Omit<ExpenseEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const expensesRef = collection(db, COUPLES_COLLECTION, coupleId, BUDGET_SUBCOLLECTION, 'expenses', 'items');
    const docRef = await addDoc(expensesRef, filterUndefined({
      ...expense,
      paymentDueDate: expense.paymentDueDate ? Timestamp.fromDate(expense.paymentDueDate) : null,
      createdAt: Timestamp.fromDate(new Date()),
      updatedAt: Timestamp.fromDate(new Date())
    }));
    
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
    const [fundingSources, allocations, categoryExpenses] = await Promise.all([
      getFundingSources(coupleId),
      getBudgetAllocations(coupleId),
      getCategoryExpenses(coupleId)
    ]);

    const totalFunds = fundingSources.reduce((sum, source) => sum + source.amount, 0);
    const totalAllocated = allocations.reduce((sum, allocation) => sum + allocation.plannedAmount, 0);
    const totalSpent = categoryExpenses.reduce((sum, category) => sum + category.totalPaid, 0);
    const remainingFunds = totalFunds - totalSpent;

    return {
      totalFunds,
      totalAllocated,
      totalSpent,
      remainingFunds,
      unallocatedFunds: totalFunds - totalAllocated
    };
  } catch (error) {
    console.error('Error calculating budget summary:', error);
    return {
      totalFunds: 0,
      totalAllocated: 0,
      totalSpent: 0,
      remainingFunds: 0,
      unallocatedFunds: 0
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