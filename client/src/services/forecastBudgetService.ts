import { db } from '@ume/shared';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  runTransaction,
  onSnapshot,
  deleteDoc
} from 'firebase/firestore';

export interface ForecastBudgetSync {
  allocationId: string;
  budgetCategoryId: string;
  coupleId: string;
  syncType: 'baseline_created' | 'allocation_updated' | 'budget_modified';
  lastSyncAt: Date;
  isActive: boolean;
}

export interface BaselineComparison {
  categoryId: string;
  categoryName: string;
  forecastAmount: number;
  actualSpent: number;
  budgetAllocated: number;
  variance: number;
  variancePercentage: number;
  status: 'under_budget' | 'on_budget' | 'over_budget';
  recommendedAction?: string;
}

export interface ForecastBaseline {
  id: string;
  categoryId: string;
  categoryName: string;
  originalAllocation: number;
  currentAllocation: number;
  baselineDate: Date;
  lastUpdated: Date;
  isActive: boolean;
}

export class ForecastBudgetService {
  constructor(private coupleId: string) {}

  async createBaselineFromForecast(): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Get all budget allocations from forecast
        const allocationsQuery = query(collection(db, 'couples', this.coupleId, 'budgetAllocations'));
        const allocationsSnapshot = await getDocs(allocationsQuery);

        // Get existing baselines
        const baselineQuery = query(
          collection(db, 'couples', this.coupleId, 'forecastBaselines'),
          where('isActive', '==', true)
        );
        const baselineSnapshot = await getDocs(baselineQuery);
        const existingBaselines = new Set(baselineSnapshot.docs.map(doc => doc.data().categoryId));

        for (const allocationDoc of allocationsSnapshot.docs) {
          const allocation = allocationDoc.data();
          
          // Only create baseline if one doesn't exist
          if (!existingBaselines.has(allocation.categoryId)) {
            await this.createCategoryBaseline(allocation, transaction);
          }
        }

        // Create budget categories based on forecast allocations
        await this.syncForecastToBudgetCategories(transaction);
      });
    } catch (error) {
      console.error('Error creating baseline from forecast:', error);
      throw error;
    }
  }

  private async createCategoryBaseline(allocation: any, transaction: any): Promise<void> {
    const baselineId = `baseline-${allocation.categoryId}-${Date.now()}`;
    const syncId = `sync-${allocation.id}-${allocation.categoryId}`;

    const baseline: ForecastBaseline = {
      id: baselineId,
      categoryId: allocation.categoryId,
      categoryName: allocation.categoryName,
      originalAllocation: allocation.plannedAmount,
      currentAllocation: allocation.plannedAmount,
      baselineDate: new Date(),
      lastUpdated: new Date(),
      isActive: true
    };

    const sync: ForecastBudgetSync = {
      allocationId: allocation.id,
      budgetCategoryId: allocation.categoryId,
      coupleId: this.coupleId,
      syncType: 'baseline_created',
      lastSyncAt: new Date(),
      isActive: true
    };

    transaction.set(doc(db, 'couples', this.coupleId, 'forecastBaselines', baselineId), baseline);
    transaction.set(doc(db, 'couples', this.coupleId, 'forecastBudgetSyncs', syncId), sync);
  }

  private async syncForecastToBudgetCategories(transaction: any): Promise<void> {
    // Get budget allocations
    const allocationsQuery = query(collection(db, 'couples', this.coupleId, 'budgetAllocations'));
    const allocationsSnapshot = await getDocs(allocationsQuery);

    // Get existing budget categories
    const budgetCategoriesQuery = query(collection(db, 'couples', this.coupleId, 'budgetCategories'));
    const budgetCategoriesSnapshot = await getDocs(budgetCategoriesQuery);
    const existingBudgetCategories = new Set(budgetCategoriesSnapshot.docs.map(doc => doc.id));

    for (const allocationDoc of allocationsSnapshot.docs) {
      const allocation = allocationDoc.data();
      
      // Create budget category if it doesn't exist
      if (!existingBudgetCategories.has(allocation.categoryId)) {
        const budgetCategory = {
          name: allocation.categoryName,
          allocated: allocation.plannedAmount,
          spent: 0,
          forecastBaseline: allocation.plannedAmount,
          expenses: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          createdFromForecast: true
        };

        transaction.set(
          doc(db, 'couples', this.coupleId, 'budgetCategories', allocation.categoryId),
          budgetCategory
        );
      } else {
        // Update existing budget category with forecast baseline
        const existingCategoryDoc = budgetCategoriesSnapshot.docs.find(
          doc => doc.id === allocation.categoryId
        );
        
        if (existingCategoryDoc) {
          const existingData = existingCategoryDoc.data();
          transaction.update(existingCategoryDoc.ref, {
            forecastBaseline: allocation.plannedAmount,
            updatedAt: new Date(),
            // Only update allocated amount if it hasn't been manually set in budget
            ...(existingData.allocated === 0 && { allocated: allocation.plannedAmount })
          });
        }
      }
    }
  }

  async syncForecastChangesToBudget(allocationId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Get updated allocation
        const allocationDoc = await transaction.get(
          doc(db, 'couples', this.coupleId, 'budgetAllocations', allocationId)
        );
        
        if (!allocationDoc.exists()) return;
        
        const allocation = allocationDoc.data();

        // Update baseline
        const baselineQuery = query(
          collection(db, 'couples', this.coupleId, 'forecastBaselines'),
          where('categoryId', '==', allocation.categoryId),
          where('isActive', '==', true)
        );
        const baselineSnapshot = await getDocs(baselineQuery);

        if (!baselineSnapshot.empty) {
          const baselineDoc = baselineSnapshot.docs[0];
          transaction.update(baselineDoc.ref, {
            currentAllocation: allocation.plannedAmount,
            lastUpdated: new Date()
          });
        }

        // Update budget category
        const budgetCategoryRef = doc(db, 'couples', this.coupleId, 'budgetCategories', allocation.categoryId);
        const budgetCategoryDoc = await transaction.get(budgetCategoryRef);

        if (budgetCategoryDoc.exists()) {
          transaction.update(budgetCategoryRef, {
            forecastBaseline: allocation.plannedAmount,
            updatedAt: new Date()
          });
        } else {
          // Create new budget category
          const budgetCategory = {
            name: allocation.categoryName,
            allocated: allocation.plannedAmount,
            spent: 0,
            forecastBaseline: allocation.plannedAmount,
            expenses: [],
            createdAt: new Date(),
            updatedAt: new Date(),
            createdFromForecast: true
          };

          transaction.set(budgetCategoryRef, budgetCategory);
        }

        // Update sync record
        const syncQuery = query(
          collection(db, 'couples', this.coupleId, 'forecastBudgetSyncs'),
          where('allocationId', '==', allocationId),
          where('isActive', '==', true)
        );
        const syncSnapshot = await getDocs(syncQuery);

        if (!syncSnapshot.empty) {
          const syncDoc = syncSnapshot.docs[0];
          transaction.update(syncDoc.ref, {
            syncType: 'allocation_updated',
            lastSyncAt: new Date()
          });
        }
      });
    } catch (error) {
      console.error('Error syncing forecast changes to budget:', error);
      throw error;
    }
  }

  async generateBaselineComparison(): Promise<BaselineComparison[]> {
    try {
      const [baselines, budgetCategories] = await Promise.all([
        this.getForecastBaselines(),
        this.getBudgetCategories()
      ]);

      const comparisons: BaselineComparison[] = [];

      for (const baseline of baselines) {
        const budgetCategory = budgetCategories.find(bc => bc.id === baseline.categoryId);
        
        if (budgetCategory) {
          const variance = budgetCategory.spent - baseline.currentAllocation;
          const variancePercentage = baseline.currentAllocation > 0 
            ? (variance / baseline.currentAllocation) * 100 
            : 0;

          let status: 'under_budget' | 'on_budget' | 'over_budget' = 'on_budget';
          let recommendedAction: string | undefined;

          if (variancePercentage > 10) {
            status = 'over_budget';
            recommendedAction = 'Consider reducing expenses or increasing budget allocation';
          } else if (variancePercentage < -10) {
            status = 'under_budget';
            recommendedAction = 'You have room to spend more or reallocate funds to other categories';
          }

          comparisons.push({
            categoryId: baseline.categoryId,
            categoryName: baseline.categoryName,
            forecastAmount: baseline.currentAllocation,
            actualSpent: budgetCategory.spent,
            budgetAllocated: budgetCategory.allocated,
            variance,
            variancePercentage: Math.round(variancePercentage),
            status,
            recommendedAction
          });
        }
      }

      return comparisons.sort((a, b) => Math.abs(b.variancePercentage) - Math.abs(a.variancePercentage));
    } catch (error) {
      console.error('Error generating baseline comparison:', error);
      return [];
    }
  }

  private async getForecastBaselines(): Promise<ForecastBaseline[]> {
    const baselineQuery = query(
      collection(db, 'couples', this.coupleId, 'forecastBaselines'),
      where('isActive', '==', true),
      orderBy('lastUpdated', 'desc')
    );
    const baselineSnapshot = await getDocs(baselineQuery);
    
    return baselineSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      baselineDate: doc.data().baselineDate?.toDate() || new Date(),
      lastUpdated: doc.data().lastUpdated?.toDate() || new Date()
    })) as ForecastBaseline[];
  }

  private async getBudgetCategories(): Promise<Array<{id: string, allocated: number, spent: number}>> {
    const budgetCategoriesQuery = query(collection(db, 'couples', this.coupleId, 'budgetCategories'));
    const budgetCategoriesSnapshot = await getDocs(budgetCategoriesQuery);
    
    return budgetCategoriesSnapshot.docs.map(doc => ({
      id: doc.id,
      allocated: doc.data().allocated || 0,
      spent: doc.data().spent || 0
    }));
  }

  async updateBudgetFromSpending(categoryId: string, newSpentAmount: number): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Update budget category
        const budgetCategoryRef = doc(db, 'couples', this.coupleId, 'budgetCategories', categoryId);
        const budgetCategoryDoc = await transaction.get(budgetCategoryRef);

        if (budgetCategoryDoc.exists()) {
          transaction.update(budgetCategoryRef, {
            spent: newSpentAmount,
            updatedAt: new Date()
          });
        }

        // Update sync record
        const syncQuery = query(
          collection(db, 'couples', this.coupleId, 'forecastBudgetSyncs'),
          where('budgetCategoryId', '==', categoryId),
          where('isActive', '==', true)
        );
        const syncSnapshot = await getDocs(syncQuery);

        if (!syncSnapshot.empty) {
          const syncDoc = syncSnapshot.docs[0];
          transaction.update(syncDoc.ref, {
            syncType: 'budget_modified',
            lastSyncAt: new Date()
          });
        }
      });
    } catch (error) {
      console.error('Error updating budget from spending:', error);
      throw error;
    }
  }

  async getForecastBudgetInsights(): Promise<{
    totalForecastAmount: number;
    totalBudgetAllocated: number;
    totalSpent: number;
    forecastAccuracy: number;
    topVariances: BaselineComparison[];
    recommendedActions: string[];
  }> {
    try {
      const comparisons = await this.generateBaselineComparison();
      
      const totalForecastAmount = comparisons.reduce((sum, c) => sum + c.forecastAmount, 0);
      const totalBudgetAllocated = comparisons.reduce((sum, c) => sum + c.budgetAllocated, 0);
      const totalSpent = comparisons.reduce((sum, c) => sum + c.actualSpent, 0);
      
      const forecastAccuracy = totalForecastAmount > 0 
        ? Math.max(0, 100 - Math.abs((totalSpent - totalForecastAmount) / totalForecastAmount) * 100)
        : 100;

      const topVariances = comparisons
        .filter(c => Math.abs(c.variancePercentage) > 5)
        .slice(0, 5);

      const recommendedActions = [];

      if (forecastAccuracy < 80) {
        recommendedActions.push('Your spending significantly differs from forecast. Review and adjust your budget.');
      }

      if (totalSpent > totalForecastAmount) {
        recommendedActions.push('You\'re overspending compared to your forecast. Consider cost-cutting measures.');
      }

      const overBudgetCategories = comparisons.filter(c => c.status === 'over_budget').length;
      if (overBudgetCategories > 2) {
        recommendedActions.push(`${overBudgetCategories} categories are over budget. Prioritize essential expenses.`);
      }

      const underBudgetCategories = comparisons.filter(c => c.status === 'under_budget');
      if (underBudgetCategories.length > 0) {
        recommendedActions.push(`Consider reallocating funds from under-budget categories to areas that need more funding.`);
      }

      return {
        totalForecastAmount,
        totalBudgetAllocated,
        totalSpent,
        forecastAccuracy: Math.round(forecastAccuracy),
        topVariances,
        recommendedActions
      };
    } catch (error) {
      console.error('Error getting forecast budget insights:', error);
      return {
        totalForecastAmount: 0,
        totalBudgetAllocated: 0,
        totalSpent: 0,
        forecastAccuracy: 0,
        topVariances: [],
        recommendedActions: []
      };
    }
  }

  async resetBaseline(categoryId: string): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Get current allocation from forecast
        const allocationQuery = query(
          collection(db, 'couples', this.coupleId, 'budgetAllocations'),
          where('categoryId', '==', categoryId)
        );
        const allocationSnapshot = await getDocs(allocationQuery);

        if (allocationSnapshot.empty) return;

        const allocation = allocationSnapshot.docs[0].data();

        // Update baseline
        const baselineQuery = query(
          collection(db, 'couples', this.coupleId, 'forecastBaselines'),
          where('categoryId', '==', categoryId),
          where('isActive', '==', true)
        );
        const baselineSnapshot = await getDocs(baselineQuery);

        if (!baselineSnapshot.empty) {
          const baselineDoc = baselineSnapshot.docs[0];
          transaction.update(baselineDoc.ref, {
            currentAllocation: allocation.plannedAmount,
            lastUpdated: new Date()
          });
        }

        // Update budget category
        const budgetCategoryRef = doc(db, 'couples', this.coupleId, 'budgetCategories', categoryId);
        transaction.update(budgetCategoryRef, {
          forecastBaseline: allocation.plannedAmount,
          allocated: allocation.plannedAmount,
          updatedAt: new Date()
        });
      });
    } catch (error) {
      console.error('Error resetting baseline:', error);
      throw error;
    }
  }

  // Real-time listener for forecast-budget sync
  subscribeToForecastBudgetSync(callback: (insights: any) => void): () => void {
    const unsubscribes: (() => void)[] = [];
    
    // Listen to budget allocations changes
    const allocationsUnsubscribe = onSnapshot(
      collection(db, 'couples', this.coupleId, 'budgetAllocations'),
      () => {
        this.getForecastBudgetInsights().then(callback);
      }
    );
    unsubscribes.push(allocationsUnsubscribe);
    
    // Listen to budget categories changes
    const budgetUnsubscribe = onSnapshot(
      collection(db, 'couples', this.coupleId, 'budgetCategories'),
      () => {
        this.getForecastBudgetInsights().then(callback);
      }
    );
    unsubscribes.push(budgetUnsubscribe);
    
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }
}

// Factory function for creating service instances
export function createForecastBudgetService(coupleId: string): ForecastBudgetService {
  return new ForecastBudgetService(coupleId);
}

// Utility function to initialize forecast-budget baseline
export async function initializeForecastBaseline(coupleId: string): Promise<void> {
  const service = createForecastBudgetService(coupleId);
  await service.createBaselineFromForecast();
}