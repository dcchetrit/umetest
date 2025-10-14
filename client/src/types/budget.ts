export type PaymentStatus = 'paid' | 'due' | 'overdue';

export interface FundingSource {
  id: string;
  description: string;
  amount: number;
  createdAt: Date;
}

export interface BudgetCategory {
  id: string;
  name: string;
  order: number;
  isCustom?: boolean;
}

export interface SimpleExpense {
  id: string;
  expenseLine: string;      // Ligne de dépenses
  event?: string;          // Événements
  estimatedAmount: number; // Montant estimé (€)
  comments?: string;       // Commentaire
  createdAt: Date;
  updatedAt: Date;
}

// Keep old ExpenseEntry for backwards compatibility
export interface ExpenseEntry {
  id: string;
  categoryId: string;
  vendorName: string;
  quotedPrice: number;
  amountPaid: number;
  paymentDueDate?: Date;
  paymentStatus: PaymentStatus;
  notes?: string;
  event?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetAllocation {
  id: string;
  categoryId: string;
  categoryName: string;
  plannedAmount: number;
  event?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryExpenseData {
  categoryId: string;
  categoryName: string;
  plannedAmount: number;
  expenses: ExpenseEntry[];
  totalForecasted: number;
  totalPaid: number;
  remainingBudget: number;
  isOverBudget: boolean;
  status: 'under_budget' | 'close_to_budget' | 'over_budget';
}

export interface BudgetSummary {
  totalFunds: number;
  totalAllocated: number;
  totalSpent: number;
  remainingFunds: number;
  unallocatedFunds: number;
  estimatedBudget: number;
  remainingBudget: number;
  isOverBudget: boolean;
}

export const DEFAULT_CATEGORIES: Omit<BudgetCategory, 'id'>[] = [
  { name: 'Venue & Ceremony', order: 1 },
  { name: 'Catering & Drinks', order: 2 },
  { name: 'Photographer & Videographer', order: 3 },
  { name: 'Music / Entertainment', order: 4 },
  { name: 'Flowers & Decoration', order: 5 },
  { name: 'Bride & Groom Attire', order: 6 },
  { name: 'Hair & Makeup', order: 7 },
  { name: 'Invitations & Stationery', order: 8 },
  { name: 'Transportation', order: 9 },
  { name: 'Guest Accommodation', order: 10 },
  { name: 'Wedding Planner', order: 11 },
  { name: 'Miscellaneous / Contingency', order: 12 },
];