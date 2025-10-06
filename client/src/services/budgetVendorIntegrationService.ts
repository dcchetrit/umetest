import { db } from '@ume/shared';
import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  setDoc, 
  updateDoc, 
  addDoc, 
  query, 
  where, 
  orderBy,
  runTransaction,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { 
  BudgetAllocation, 
  ExpenseEntry, 
  BudgetCategory,
  DEFAULT_CATEGORIES
} from '@/types/budget';

export interface VendorBudgetIntegration {
  vendorId: string;
  vendorName: string;
  vendorType: string;
  budgetCategoryId: string;
  budgetCategoryName: string;
  estimatedAmount: number;
  actualAmount: number;
  autoCreated: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface VendorExpenseSync {
  expenseId: string;
  vendorId: string;
  budgetAllocationId: string;
  categoryId: string;
  syncStatus: 'synced' | 'pending' | 'error';
  lastSyncAt: Date;
}

// Mapping of vendor types to budget categories
const VENDOR_CATEGORY_MAPPING: Record<string, string> = {
  'venue': 'Venue & Ceremony',
  'catering': 'Catering & Drinks', 
  'photographer': 'Photographer & Videographer',
  'videographer': 'Photographer & Videographer',
  'music': 'Music / Entertainment',
  'dj': 'Music / Entertainment',
  'band': 'Music / Entertainment',
  'florist': 'Flowers & Decoration',
  'decorator': 'Flowers & Decoration',
  'bridal_shop': 'Bride & Groom Attire',
  'tuxedo': 'Bride & Groom Attire',
  'hair_stylist': 'Hair & Makeup',
  'makeup_artist': 'Hair & Makeup',
  'stationery': 'Invitations & Stationery',
  'transportation': 'Transportation',
  'hotel': 'Guest Accommodation',
  'accommodation': 'Guest Accommodation',
  'planner': 'Wedding Planner',
  'coordinator': 'Wedding Planner'
};

export class BudgetVendorIntegrationService {
  constructor(private coupleId: string) {}

  // Automatically create budget category and allocation when vendor is added
  async createBudgetFromVendor(
    vendorId: string, 
    vendorName: string, 
    vendorType: string, 
    estimatedCost: number = 0
  ): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Determine appropriate budget category
        const categoryName = this.determineBudgetCategory(vendorType, vendorName);
        
        // Get or create budget category
        const categoryId = await this.getOrCreateBudgetCategory(categoryName, transaction);
        
        // Check if allocation already exists for this category
        const allocationId = await this.getOrCreateBudgetAllocation(
          categoryId, 
          categoryName, 
          estimatedCost, 
          `Auto-created for ${vendorName}`,
          transaction
        );
        
        // Create vendor-budget integration record
        const integrationId = `integration-${vendorId}-${Date.now()}`;
        const integration: VendorBudgetIntegration = {
          vendorId,
          vendorName,
          vendorType,
          budgetCategoryId: categoryId,
          budgetCategoryName: categoryName,
          estimatedAmount: estimatedCost,
          actualAmount: 0,
          autoCreated: true,
          createdAt: new Date(),
          updatedAt: Timestamp.fromDate(new Date())
        };
        
        transaction.set(
          doc(db, 'couples', this.coupleId, 'vendorBudgetIntegrations', integrationId),
          integration
        );
      });
    } catch (error) {
      console.error('Error creating budget from vendor:', error);
      throw error;
    }
  }

  // Automatically update budget when vendor expense is logged
  async syncExpenseToVendorBudget(expenseEntry: ExpenseEntry): Promise<void> {
    try {
      await runTransaction(db, async (transaction) => {
        // Find existing vendor integration
        const integrationQuery = query(
          collection(db, 'couples', this.coupleId, 'vendorBudgetIntegrations'),
          where('vendorName', '==', expenseEntry.vendorName)
        );
        const integrationSnapshot = await getDocs(integrationQuery);
        
        let integration: VendorBudgetIntegration | null = null;
        let integrationDocRef = null;
        
        if (!integrationSnapshot.empty) {
          const integrationDoc = integrationSnapshot.docs[0];
          integration = integrationDoc.data() as VendorBudgetIntegration;
          integrationDocRef = integrationDoc.ref;
        } else {
          // Create new integration if vendor not found
          const categoryName = this.determineBudgetCategory('', expenseEntry.vendorName);
          const categoryId = await this.getOrCreateBudgetCategory(categoryName, transaction);
          
          const newIntegrationId = `integration-${expenseEntry.vendorName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
          integration = {
            vendorId: newIntegrationId,
            vendorName: expenseEntry.vendorName,
            vendorType: 'other',
            budgetCategoryId: categoryId,
            budgetCategoryName: categoryName,
            estimatedAmount: expenseEntry.quotedPrice,
            actualAmount: expenseEntry.amountPaid,
            autoCreated: true,
            createdAt: new Date(),
            updatedAt: Timestamp.fromDate(new Date())
          };
          
          integrationDocRef = doc(db, 'couples', this.coupleId, 'vendorBudgetIntegrations', newIntegrationId);
          transaction.set(integrationDocRef, integration);
        }
        
        // Update integration with actual amount
        if (integrationDocRef && integration) {
          transaction.update(integrationDocRef, {
            actualAmount: (integration.actualAmount || 0) + expenseEntry.amountPaid,
            updatedAt: Timestamp.fromDate(new Date())
          });
        }
        
        // Update or create budget allocation
        if (integration) {
          await this.updateBudgetAllocationFromExpense(
            integration.budgetCategoryId,
            integration.budgetCategoryName,
            expenseEntry,
            transaction
          );
        }
        
        // Create sync record
        const syncId = `sync-${expenseEntry.id}-${Date.now()}`;
        const syncRecord: VendorExpenseSync = {
          expenseId: expenseEntry.id,
          vendorId: integration?.vendorId || '',
          budgetAllocationId: integration?.budgetCategoryId || '',
          categoryId: integration?.budgetCategoryId || '',
          syncStatus: 'synced',
          lastSyncAt: Timestamp.fromDate(new Date())
        };
        
        transaction.set(
          doc(db, 'couples', this.coupleId, 'vendorExpenseSyncs', syncId),
          syncRecord
        );
      });
    } catch (error) {
      console.error('Error syncing expense to vendor budget:', error);
      throw error;
    }
  }

  // Get vendor budget insights and recommendations
  async getVendorBudgetInsights(): Promise<{
    totalVendors: number;
    vendorsWithBudgets: number;
    totalEstimated: number;
    totalActual: number;
    variance: number;
    topOverbudgetVendors: Array<{
      vendorName: string;
      estimated: number;
      actual: number;
      variance: number;
      variancePercentage: number;
    }>;
    recommendations: string[];
  }> {
    try {
      const integrationsQuery = query(
        collection(db, 'couples', this.coupleId, 'vendorBudgetIntegrations'),
        orderBy('updatedAt', 'desc')
      );
      const integrationsSnapshot = await getDocs(integrationsQuery);
      
      const integrations = integrationsSnapshot.docs.map(doc => doc.data() as VendorBudgetIntegration);
      
      const totalVendors = integrations.length;
      const vendorsWithBudgets = integrations.filter(i => i.estimatedAmount > 0).length;
      const totalEstimated = integrations.reduce((sum, i) => sum + i.estimatedAmount, 0);
      const totalActual = integrations.reduce((sum, i) => sum + i.actualAmount, 0);
      const variance = totalActual - totalEstimated;
      
      const topOverbudgetVendors = integrations
        .filter(i => i.actualAmount > i.estimatedAmount && i.estimatedAmount > 0)
        .map(i => ({
          vendorName: i.vendorName,
          estimated: i.estimatedAmount,
          actual: i.actualAmount,
          variance: i.actualAmount - i.estimatedAmount,
          variancePercentage: ((i.actualAmount - i.estimatedAmount) / i.estimatedAmount) * 100
        }))
        .sort((a, b) => b.variancePercentage - a.variancePercentage)
        .slice(0, 5);
      
      const recommendations: string[] = [];
      
      if (variance > totalEstimated * 0.1) {
        recommendations.push('You are significantly over budget. Consider negotiating with vendors or finding alternatives.');
      }
      
      if (vendorsWithBudgets < totalVendors * 0.8) {
        recommendations.push('Set budgets for more vendors to better track spending.');
      }
      
      if (topOverbudgetVendors.length > 2) {
        recommendations.push(`Review contracts with ${topOverbudgetVendors[0].vendorName} and other over-budget vendors.`);
      }
      
      return {
        totalVendors,
        vendorsWithBudgets,
        totalEstimated,
        totalActual,
        variance,
        topOverbudgetVendors,
        recommendations
      };
    } catch (error) {
      console.error('Error getting vendor budget insights:', error);
      return {
        totalVendors: 0,
        vendorsWithBudgets: 0,
        totalEstimated: 0,
        totalActual: 0,
        variance: 0,
        topOverbudgetVendors: [],
        recommendations: []
      };
    }
  }

  // Auto-categorize vendor based on type and name
  private determineBudgetCategory(vendorType: string, vendorName: string): string {
    // First check explicit vendor type mapping
    if (vendorType && VENDOR_CATEGORY_MAPPING[vendorType.toLowerCase()]) {
      return VENDOR_CATEGORY_MAPPING[vendorType.toLowerCase()];
    }
    
    // Then check vendor name for keywords
    const name = vendorName.toLowerCase();
    
    if (name.includes('venue') || name.includes('hall') || name.includes('church') || name.includes('ceremony')) {
      return 'Venue & Ceremony';
    }
    if (name.includes('cater') || name.includes('food') || name.includes('restaurant') || name.includes('bar')) {
      return 'Catering & Drinks';
    }
    if (name.includes('photo') || name.includes('video') || name.includes('film')) {
      return 'Photographer & Videographer';
    }
    if (name.includes('music') || name.includes('dj') || name.includes('band') || name.includes('sound')) {
      return 'Music / Entertainment';
    }
    if (name.includes('flower') || name.includes('floral') || name.includes('decor') || name.includes('decoration')) {
      return 'Flowers & Decoration';
    }
    if (name.includes('dress') || name.includes('bridal') || name.includes('tuxedo') || name.includes('suit')) {
      return 'Bride & Groom Attire';
    }
    if (name.includes('hair') || name.includes('makeup') || name.includes('beauty')) {
      return 'Hair & Makeup';
    }
    if (name.includes('invitation') || name.includes('stationery') || name.includes('card') || name.includes('print')) {
      return 'Invitations & Stationery';
    }
    if (name.includes('transport') || name.includes('limo') || name.includes('car') || name.includes('bus')) {
      return 'Transportation';
    }
    if (name.includes('hotel') || name.includes('accommodation') || name.includes('lodging')) {
      return 'Guest Accommodation';
    }
    if (name.includes('planner') || name.includes('coordinator') || name.includes('wedding consultant')) {
      return 'Wedding Planner';
    }
    
    // Default to miscellaneous
    return 'Miscellaneous / Contingency';
  }

  private async getOrCreateBudgetCategory(categoryName: string, transaction: any): Promise<string> {
    // Check if category exists in default categories
    const defaultCategory = DEFAULT_CATEGORIES.find(cat => cat.name === categoryName);
    if (defaultCategory) {
      const categoryId = categoryName.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '-');
      
      // Ensure category document exists
      const categoryRef = doc(db, 'couples', this.coupleId, 'budgetCategories', categoryId);
      const categoryDoc = await transaction.get(categoryRef);
      
      if (!categoryDoc.exists()) {
        transaction.set(categoryRef, {
          name: categoryName,
          order: defaultCategory.order,
          isCustom: false,
          createdAt: new Date(),
          updatedAt: Timestamp.fromDate(new Date())
        });
      }
      
      return categoryId;
    } else {
      // Create custom category
      const categoryId = `custom-${Date.now()}`;
      const categoryRef = doc(db, 'couples', this.coupleId, 'budgetCategories', categoryId);
      
      transaction.set(categoryRef, {
        name: categoryName,
        order: 999, // Custom categories go last
        isCustom: true,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      });
      
      return categoryId;
    }
  }

  private async getOrCreateBudgetAllocation(
    categoryId: string,
    categoryName: string,
    plannedAmount: number,
    notes: string,
    transaction: any
  ): Promise<string> {
    // Check for existing allocation
    const allocationsQuery = query(
      collection(db, 'couples', this.coupleId, 'budget', 'allocations', 'items'),
      where('categoryId', '==', categoryId)
    );
    const allocationsSnapshot = await getDocs(allocationsQuery);
    
    if (!allocationsSnapshot.empty) {
      const existingAllocation = allocationsSnapshot.docs[0];
      const existingData = existingAllocation.data();
      
      // Update planned amount if new amount is higher
      if (plannedAmount > existingData.plannedAmount) {
        transaction.update(existingAllocation.ref, {
          plannedAmount,
          notes: notes + ` (Updated: ${new Date().toLocaleDateString()})`,
          updatedAt: Timestamp.fromDate(new Date())
        });
      }
      
      return existingAllocation.id;
    } else {
      // Create new allocation
      const allocationRef = doc(collection(db, 'couples', this.coupleId, 'budget', 'allocations', 'items'));
      const allocation: Omit<BudgetAllocation, 'id'> = {
        categoryId,
        categoryName,
        plannedAmount,
        notes,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      };
      
      transaction.set(allocationRef, allocation);
      return allocationRef.id;
    }
  }

  private async updateBudgetAllocationFromExpense(
    categoryId: string,
    categoryName: string,
    expense: ExpenseEntry,
    transaction: any
  ): Promise<void> {
    // Get existing allocation
    const allocationsQuery = query(
      collection(db, 'couples', this.coupleId, 'budget', 'allocations', 'items'),
      where('categoryId', '==', categoryId)
    );
    const allocationsSnapshot = await getDocs(allocationsQuery);
    
    if (!allocationsSnapshot.empty) {
      const allocationDoc = allocationsSnapshot.docs[0];
      const allocationData = allocationDoc.data();
      
      // Update planned amount if expense quoted price is higher
      const newPlannedAmount = Math.max(
        allocationData.plannedAmount || 0,
        expense.quotedPrice
      );
      
      transaction.update(allocationDoc.ref, {
        plannedAmount: newPlannedAmount,
        notes: `${allocationData.notes || ''} | Updated from ${expense.vendorName} expense`,
        updatedAt: new Date()
      });
    } else {
      // Create new allocation based on expense
      const allocationRef = doc(collection(db, 'couples', this.coupleId, 'budget', 'allocations', 'items'));
      const allocation: Omit<BudgetAllocation, 'id'> = {
        categoryId,
        categoryName,
        plannedAmount: expense.quotedPrice,
        notes: `Auto-created from ${expense.vendorName} expense`,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      };
      
      transaction.set(allocationRef, allocation);
    }
  }

  // Real-time listener for vendor-budget sync
  subscribeToVendorBudgetSync(callback: (insights: any) => void): () => void {
    const unsubscribes: (() => void)[] = [];
    
    // Listen to vendor integrations changes
    const integrationsUnsubscribe = onSnapshot(
      collection(db, 'couples', this.coupleId, 'vendorBudgetIntegrations'),
      () => {
        this.getVendorBudgetInsights().then(callback);
      }
    );
    unsubscribes.push(integrationsUnsubscribe);
    
    // Listen to budget allocations changes
    const allocationsUnsubscribe = onSnapshot(
      collection(db, 'couples', this.coupleId, 'budget', 'allocations', 'items'),
      () => {
        this.getVendorBudgetInsights().then(callback);
      }
    );
    unsubscribes.push(allocationsUnsubscribe);
    
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }
}

// Factory function for creating service instances
export function createBudgetVendorIntegrationService(coupleId: string): BudgetVendorIntegrationService {
  return new BudgetVendorIntegrationService(coupleId);
}

// Utility functions for easy integration
export async function autoCreateBudgetFromVendor(
  coupleId: string,
  vendorId: string,
  vendorName: string,
  vendorType: string,
  estimatedCost: number = 0
): Promise<void> {
  const service = createBudgetVendorIntegrationService(coupleId);
  await service.createBudgetFromVendor(vendorId, vendorName, vendorType, estimatedCost);
}

export async function autoSyncExpenseToVendorBudget(
  coupleId: string,
  expenseEntry: ExpenseEntry
): Promise<void> {
  const service = createBudgetVendorIntegrationService(coupleId);
  await service.syncExpenseToVendorBudget(expenseEntry);
}