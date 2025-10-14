import { db } from '@ume/shared';
import { 
  collection, 
  onSnapshot, 
  query,
  where,
  Unsubscribe
} from 'firebase/firestore';
import { createBudgetTasksService } from './budgetTasksService';

export interface ExpenseTaskSyncOptions {
  coupleId: string;
  onSyncComplete?: (expenseId: string, tasksCreated: number) => void;
  onError?: (error: Error) => void;
}

class ExpenseTaskSyncService {
  private unsubscribes: Unsubscribe[] = [];
  private processedExpenses = new Set<string>();
  private coupleId: string;
  private budgetTasksService: ReturnType<typeof createBudgetTasksService>;
  private options: ExpenseTaskSyncOptions;
  private isInitialized = false;

  constructor(options: ExpenseTaskSyncOptions) {
    this.options = options;
    this.coupleId = options.coupleId;
    this.budgetTasksService = createBudgetTasksService(this.coupleId);
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // First, run a one-time sync for existing expenses
      await this.syncExistingExpenses();

      // Then start listening for new expenses
      this.startListening();
      
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize expense task sync service:', error);
      this.options.onError?.(error as Error);
    }
  }

  private async syncExistingExpenses(): Promise<void> {
    try {
      await this.budgetTasksService.syncPaymentReminders();
    } catch (error) {
      console.warn('Failed to sync existing expenses:', error);
    }
  }

  private startListening(): void {
    const expensesRef = collection(
      db, 
      'couples', 
      this.coupleId, 
      'budget', 
      'expenses', 
      'items'
    );

    // Listen for new expenses being added
    const unsubscribe = onSnapshot(
      expensesRef,
      (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const expenseId = change.doc.id;
            const expenseData = change.doc.data();
            
            // Avoid processing expenses we've already handled
            if (this.processedExpenses.has(expenseId)) {
              return;
            }
            
            this.processedExpenses.add(expenseId);
            
            // Check if this expense needs tasks
            const needsTasks = expenseData.paymentDueDate || 
                             expenseData.depositDueDate || 
                             expenseData.finalPaymentDueDate;
            
            if (needsTasks) {
              try {
                await this.budgetTasksService.syncPaymentReminders();
                
                // Callback to notify about successful sync
                this.options.onSyncComplete?.(expenseId, 1);
              } catch (error) {
                console.error(`Failed to create tasks for expense ${expenseId}:`, error);
                this.options.onError?.(error as Error);
              }
            }
          }
        });
      },
      (error) => {
        console.error('Error listening to expense changes:', error);
        this.options.onError?.(error);
      }
    );

    this.unsubscribes.push(unsubscribe);
  }

  destroy(): void {
    this.unsubscribes.forEach(unsubscribe => unsubscribe());
    this.unsubscribes = [];
    this.processedExpenses.clear();
    this.isInitialized = false;
  }

  // Manual sync method for when needed
  async manualSync(): Promise<void> {
    try {
      await this.budgetTasksService.syncPaymentReminders();
    } catch (error) {
      console.error('Manual sync failed:', error);
      this.options.onError?.(error as Error);
    }
  }
}

// Global service instances per couple
const serviceInstances = new Map<string, ExpenseTaskSyncService>();

export function initializeExpenseTaskSync(options: ExpenseTaskSyncOptions): ExpenseTaskSyncService {
  const existingService = serviceInstances.get(options.coupleId);
  
  if (existingService) {
    return existingService;
  }

  const service = new ExpenseTaskSyncService(options);
  serviceInstances.set(options.coupleId, service);
  
  // Initialize the service
  service.initialize().catch((error) => {
    console.error('Failed to initialize expense task sync service:', error);
    options.onError?.(error);
  });

  return service;
}

export function getExpenseTaskSyncService(coupleId: string): ExpenseTaskSyncService | null {
  return serviceInstances.get(coupleId) || null;
}

export function destroyExpenseTaskSync(coupleId: string): void {
  const service = serviceInstances.get(coupleId);
  if (service) {
    service.destroy();
    serviceInstances.delete(coupleId);
  }
}

export function manualSyncExpenseTasks(coupleId: string): Promise<void> {
  const service = serviceInstances.get(coupleId);
  if (service) {
    return service.manualSync();
  }
  throw new Error(`No expense task sync service found for couple: ${coupleId}`);
}