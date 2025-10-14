'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import BudgetHeader from '@/components/budget/BudgetHeader';
import FundingSourcesSection from '@/components/budget/FundingSourcesSection';
import ExpenseTracker from '@/components/budget/ExpenseTracker';
import { 
  FundingSource, 
  BudgetSummary, 
  CategoryExpenseData,
  ExpenseEntry
} from '@/types/budget';
import {
  getBudgetSummary,
  getCategoryExpenses,
  getFundingSources,
  saveFundingSource,
  updateFundingSource,
  deleteFundingSource,
  saveExpense,
  updateExpense,
  deleteExpense,
  getEvents
} from '@/services/budgetService';
import {
  getBudgetCategories,
  saveBudgetCategory,
  saveBulkBudgetCategories,
  BudgetCategory
} from '@/services/budgetCategoryService';
import { createBudgetTasksService } from '@/services/budgetTasksService';
import { initializeExpenseTaskSync, destroyExpenseTaskSync } from '@/services/expenseTaskSyncService';
import { createForecastBudgetService } from '@/services/forecastBudgetService';

interface BudgetClientProps {
  locale: string;
}

// Helper function to update forecast baseline with spending data
async function updateForecastBaselineSpending(categoryExpenses: CategoryExpenseData[], forecastBudgetService: any) {
  try {
    for (const categoryData of categoryExpenses) {
      const totalSpent = categoryData.expenses.reduce((sum, expense) => sum + expense.amountPaid, 0);
      await forecastBudgetService.updateBudgetFromSpending(categoryData.categoryId, totalSpent);
    }
  } catch (error) {
    console.error('Error updating forecast baseline spending:', error);
  }
}

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      budget: 'Budget Tracking',
      welcome: 'Track Your Wedding Expenses',
      overview: 'Log your actual spending and track how it compares to your forecast.',
      back_home: '← Back to Home',
      login_required: 'Please log in to view budget tracking',
      total_forecast: 'Total Forecasted',
      total_spent: 'Total Spent', 
      remaining_funds: 'Remaining Funds',
      payment_timeline: 'Payment Timeline',
      upcoming_payments: 'Upcoming Payments',
      overdue_payments: 'Overdue Payments',
      export_summary: 'Export Summary',
      no_upcoming_payments: 'No upcoming payments',
      no_overdue_payments: 'All payments are up to date!',
      quick_add_payment: 'Quick Add Payment',
      add_payment_description: 'Add upcoming, overdue, or made payments',
      add_new_payment: 'Add New Payment',
      category: 'Category',
      vendor_item_name: 'Vendor/Item Name',
      payment_status: 'Payment Status',
      payment_due_date: 'Payment Due Date',
      total_amount_quote: 'Total Amount/Quote',
      amount_paid: 'Amount Paid',
      notes: 'Notes',
      upcoming_payment: 'Upcoming/Due Payment',
      overdue_payment: 'Overdue Payment',
      payment_made: 'Payment Made',
      add_payment: 'Add Payment',
      cancel: 'Cancel'
    },
    fr: {
      budget: 'Suivi du budget',
      welcome: 'Suivez vos dépenses de mariage',
      overview: 'Enregistrez vos dépenses réelles et comparez-les à vos prévisions.',
      back_home: '← Retour à l\'accueil',
      login_required: 'Veuillez vous connecter pour voir le suivi du budget',
      total_forecast: 'Total prévu',
      total_spent: 'Total dépensé',
      remaining_funds: 'Fonds restants',
      payment_timeline: 'Calendrier des paiements',
      upcoming_payments: 'Paiements à venir',
      overdue_payments: 'Paiements en retard',
      export_summary: 'Exporter le résumé',
      no_upcoming_payments: 'Aucun paiement à venir',
      no_overdue_payments: 'Tous les paiements sont à jour !',
      quick_add_payment: 'Ajout rapide de paiement',
      add_payment_description: 'Ajouter des paiements à venir, en retard ou effectués',
      add_new_payment: 'Ajouter un nouveau paiement',
      category: 'Catégorie',
      vendor_item_name: 'Fournisseur/Nom de l\'article',
      payment_status: 'Statut du paiement',
      payment_due_date: 'Date d\'échéance du paiement',
      total_amount_quote: 'Montant total/Devis',
      amount_paid: 'Montant payé',
      notes: 'Notes',
      upcoming_payment: 'Paiement à venir/Dû',
      overdue_payment: 'Paiement en retard',
      payment_made: 'Paiement effectué',
      add_payment: 'Ajouter le paiement',
      cancel: 'Annuler'
    },
    es: {
      budget: 'Seguimiento del presupuesto',
      welcome: 'Rastrea tus gastos de boda',
      overview: 'Registra tus gastos reales y compara con tu pronóstico.',
      back_home: '← Volver al inicio',
      login_required: 'Por favor inicia sesión para ver el seguimiento del presupuesto',
      total_forecast: 'Total pronosticado',
      total_spent: 'Total gastado',
      remaining_funds: 'Fondos restantes',
      payment_timeline: 'Cronograma de pagos',
      upcoming_payments: 'Pagos próximos',
      overdue_payments: 'Pagos vencidos',
      export_summary: 'Exportar resumen',
      no_upcoming_payments: 'No hay pagos próximos',
      no_overdue_payments: '¡Todos los pagos están al día!',
      quick_add_payment: 'Agregar pago rápido',
      add_payment_description: 'Agregar pagos próximos, vencidos o realizados',
      add_new_payment: 'Agregar nuevo pago',
      category: 'Categoría',
      vendor_item_name: 'Proveedor/Nombre del artículo',
      payment_status: 'Estado del pago',
      payment_due_date: 'Fecha de vencimiento del pago',
      total_amount_quote: 'Cantidad total/Cotización',
      amount_paid: 'Cantidad pagada',
      notes: 'Notas',
      upcoming_payment: 'Pago próximo/Pendiente',
      overdue_payment: 'Pago vencido',
      payment_made: 'Pago realizado',
      add_payment: 'Agregar pago',
      cancel: 'Cancelar'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default function BudgetClient({ locale }: BudgetClientProps) {
  const { user } = useAuth();
  const [fundingSources, setFundingSources] = useState<FundingSource[]>([]);
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpenseData[]>([]);
  const [budgetCategories, setBudgetCategories] = useState<BudgetCategory[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({
    totalFunds: 0,
    totalAllocated: 0,
    totalSpent: 0,
    remainingFunds: 0,
    unallocatedFunds: 0,
    estimatedBudget: 0,
    remainingBudget: 0,
    isOverBudget: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showQuickAddPayment, setShowQuickAddPayment] = useState(false);
  const [quickPaymentForm, setQuickPaymentForm] = useState({
    categoryId: '',
    vendorName: '',
    quotedPrice: '',
    amountPaid: '',
    paymentDueDate: '',
    paymentStatus: 'due' as 'paid' | 'due' | 'overdue',
    notes: '',
    event: ''
  });
  const [events, setEvents] = useState<Array<{id: string, name: string}>>([]);
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Use authenticated user's ID as couple ID
  const coupleId = user?.uid;

  // Initialize services conditionally using useMemo to prevent recreation on every render
  const budgetTasksService = useMemo(() => {
    return coupleId ? createBudgetTasksService(coupleId) : null;
  }, [coupleId]);
  
  const forecastBudgetService = useMemo(() => {
    return coupleId ? createForecastBudgetService(coupleId) : null;
  }, [coupleId]);

  // Initialize expense task sync service for automatic task creation (only once)
  const expenseTaskSyncService = useMemo(() => {
    if (!coupleId) return null;
    return initializeExpenseTaskSync({
      coupleId,
      onSyncComplete: (expenseId, tasksCreated) => {
        // Task sync completed - no need to reload all data
        // The expense is already in state, tasks will be handled separately
      },
      onError: (error) => {
        console.error('Expense task sync error:', error);
      }
    });
  }, [coupleId]);

  const loadData = useCallback(async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError('');
      
      const [budgetSummary, fundingSourcesData, categoryExpensesData, eventsData, budgetCategoriesData] = await Promise.all([
        getBudgetSummary(coupleId),
        getFundingSources(coupleId),
        getCategoryExpenses(coupleId),
        getEvents(coupleId),
        getBudgetCategories(coupleId)
      ]);

      setSummary(budgetSummary);
      setFundingSources(fundingSourcesData);
      setCategoryExpenses(categoryExpensesData);
      setEvents(eventsData);
      setBudgetCategories(budgetCategoriesData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [user, coupleId]);

  useEffect(() => {
    if (!user || !coupleId) {
      setLoading(false);
      return;
    }
    
    // Load initial data
    loadData();

    // Set up real-time listeners for budget data with error handling
    let unsubscribePaymentReminders: (() => void) | null = null;
    
    if (budgetTasksService) {
      try {
        unsubscribePaymentReminders = budgetTasksService.subscribeToPaymentReminders(() => {
          // Payment reminders changed - refresh summary only (lighter operation)
          getBudgetSummary(coupleId).then(setSummary).catch(console.error);
        });
      } catch (error) {
        console.error('Failed to set up payment reminders listener:', error);
        // Continue without real-time updates - the initial data load still works
      }
    }

    // Cleanup function to prevent memory leaks
    return () => {
      if (unsubscribePaymentReminders) {
        try {
          unsubscribePaymentReminders();
        } catch (error) {
          console.error('Error cleaning up payment reminders listener:', error);
        }
      }
      
      // Cleanup expense task sync service
      try {
        destroyExpenseTaskSync(coupleId);
      } catch (error) {
        console.error('Error cleaning up expense task sync service:', error);
      }
    };
  }, [user, coupleId, loadData]);

  // Early return after all hooks are called
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to view your budget</p>
        </div>
      </div>
    );
  }

  if (!coupleId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Invalid user data</p>
        </div>
      </div>
    );
  }

  const handleAddFundingSource = async (description: string, amount: number) => {
    try {
      const id = await saveFundingSource(coupleId, { description, amount });
      const newSource: FundingSource = {
        id,
        description,
        amount,
        createdAt: new Date()
      };
      setFundingSources([...fundingSources, newSource]);
      
      // Refresh summary
      const newSummary = await getBudgetSummary(coupleId);
      setSummary(newSummary);
    } catch (error) {
      console.error('Error adding funding source:', error);
      setError('Failed to add funding source');
    }
  };

  const handleUpdateFundingSource = async (id: string, description: string, amount: number) => {
    try {
      await updateFundingSource(coupleId, id, { description, amount });
      setFundingSources(fundingSources.map(source => 
        source.id === id ? { ...source, description, amount } : source
      ));
      
      // Refresh summary
      const newSummary = await getBudgetSummary(coupleId);
      setSummary(newSummary);
    } catch (error) {
      console.error('Error updating funding source:', error);
      setError('Failed to update funding source');
    }
  };

  const handleDeleteFundingSource = async (id: string) => {
    try {
      await deleteFundingSource(coupleId, id);
      setFundingSources(fundingSources.filter(source => source.id !== id));
      
      // Refresh summary
      const newSummary = await getBudgetSummary(coupleId);
      setSummary(newSummary);
    } catch (error) {
      console.error('Error deleting funding source:', error);
      setError('Failed to delete funding source');
    }
  };

  const handleAddExpense = async (categoryId: string, expense: Omit<ExpenseEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const id = await saveExpense(coupleId, { ...expense, categoryId });
      
      // Refresh category expenses and summary
      const [newCategoryExpenses, newSummary] = await Promise.all([
        getCategoryExpenses(coupleId),
        getBudgetSummary(coupleId)
      ]);
      
      setCategoryExpenses(newCategoryExpenses);
      setSummary(newSummary);
      
      // Update forecast-budget baseline with new spending
      if (forecastBudgetService) {
        await updateForecastBaselineSpending(newCategoryExpenses, forecastBudgetService);
      }
    } catch (error) {
      console.error('Error adding expense:', error);
      setError('Failed to add expense');
    }
  };

  const handleUpdateExpense = async (expenseId: string, updates: Partial<ExpenseEntry>) => {
    try {
      await updateExpense(coupleId, expenseId, updates);
      
      // Refresh category expenses and summary
      const [newCategoryExpenses, newSummary] = await Promise.all([
        getCategoryExpenses(coupleId),
        getBudgetSummary(coupleId)
      ]);
      
      setCategoryExpenses(newCategoryExpenses);
      setSummary(newSummary);
      
      // Update forecast-budget baseline with new spending
      if (forecastBudgetService) {
        await updateForecastBaselineSpending(newCategoryExpenses, forecastBudgetService);
      }
    } catch (error) {
      console.error('Error updating expense:', error);
      setError('Failed to update expense');
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteExpense(coupleId, expenseId);
      
      // Refresh category expenses and summary
      const [newCategoryExpenses, newSummary] = await Promise.all([
        getCategoryExpenses(coupleId),
        getBudgetSummary(coupleId)
      ]);
      
      setCategoryExpenses(newCategoryExpenses);
      setSummary(newSummary);
      
      // Update forecast-budget baseline with new spending
      if (forecastBudgetService) {
        await updateForecastBaselineSpending(newCategoryExpenses, forecastBudgetService);
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      setError('Failed to delete expense');
    }
  };

  const basicCategories = [
    'Venue & Ceremony',
    'Catering & Drinks', 
    'Photography & Videography',
    'Music & Entertainment',
    'Flowers & Decoration',
    'Attire & Beauty',
    'Invitations & Stationery',
    'Transportation',
    'Miscellaneous'
  ];

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newCategoryName.trim()) return;

    try {
      setError(null);
      
      // Create budget category
      const categoryId = await saveBudgetCategory(coupleId, newCategoryName.trim());

      // Refresh budget categories
      const newBudgetCategories = await getBudgetCategories(coupleId);
      setBudgetCategories(newBudgetCategories);

      // Reset form
      setNewCategoryName('');
      setShowCreateCategory(false);
      
    } catch (error) {
      console.error('Error creating category:', error);
      setError('Failed to create category');
    }
  };

  const handleCreateBasicCategories = async () => {
    try {
      setError(null);
      
      // Create all basic categories
      await saveBulkBudgetCategories(coupleId, basicCategories);

      // Refresh budget categories
      const newBudgetCategories = await getBudgetCategories(coupleId);
      setBudgetCategories(newBudgetCategories);

      // Close modal
      setShowCreateCategory(false);
      
    } catch (error) {
      console.error('Error creating basic categories:', error);
      setError('Failed to create basic categories');
    }
  };

  // Helper to determine if due date is required
  const isDueDateRequired = () => {
    const quotedPrice = parseFloat(quickPaymentForm.quotedPrice) || 0;
    const amountPaid = parseFloat(quickPaymentForm.amountPaid) || 0;
    return quotedPrice > amountPaid && quotedPrice > 0;
  };

  // Helper to get current payment status
  const getCurrentPaymentStatus = () => {
    const quotedPrice = parseFloat(quickPaymentForm.quotedPrice) || 0;
    const amountPaid = parseFloat(quickPaymentForm.amountPaid) || 0;
    
    if (quotedPrice === amountPaid && quotedPrice > 0) {
      return 'paid';
    } else if (quotedPrice > amountPaid && quickPaymentForm.paymentDueDate) {
      const dueDate = new Date(quickPaymentForm.paymentDueDate);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      return dueDate <= today ? 'overdue' : 'due';
    } else if (quotedPrice > amountPaid) {
      return 'due';
    }
    return 'due';
  };

  const handleQuickAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!quickPaymentForm.categoryId || !quickPaymentForm.vendorName || !quickPaymentForm.quotedPrice) return;

    try {
      const quotedPrice = parseFloat(quickPaymentForm.quotedPrice) || 0;
      const amountPaid = parseFloat(quickPaymentForm.amountPaid) || 0;
      
      // Validation: Total Amount can't be lower than Amount Paid
      if (quotedPrice < amountPaid) {
        setError('Total Amount/Quote cannot be lower than Amount Paid');
        return;
      }
      
      // Determine payment status and due date requirements
      let paymentStatus: 'paid' | 'due' | 'overdue';
      let paymentDueDate: Date | undefined;
      
      if (quotedPrice === amountPaid) {
        // Fully paid
        paymentStatus = 'paid';
        paymentDueDate = undefined; // No due date needed for fully paid
      } else {
        // Partially paid - need due date
        if (!quickPaymentForm.paymentDueDate) {
          setError('Payment Due Date is required when Amount Paid is less than Total Amount');
          return;
        }
        
        paymentDueDate = new Date(quickPaymentForm.paymentDueDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        
        // Determine if overdue or upcoming
        paymentStatus = paymentDueDate <= today ? 'overdue' : 'due';
      }
      
      const expenseData = {
        vendorName: quickPaymentForm.vendorName,
        quotedPrice,
        amountPaid,
        paymentDueDate,
        paymentStatus,
        notes: quickPaymentForm.notes || undefined,
        event: quickPaymentForm.event || undefined
      };

      await handleAddExpense(quickPaymentForm.categoryId, expenseData);
      
      // Reset form and close modal
      setQuickPaymentForm({
        categoryId: '',
        vendorName: '',
        quotedPrice: '',
        amountPaid: '',
        paymentDueDate: '',
        paymentStatus: 'due',
        notes: '',
        event: ''
      });
      setShowQuickAddPayment(false);
    } catch (error) {
      console.error('Error adding quick payment:', error);
      setError('Failed to add payment');
    }
  };

  // Get upcoming and overdue payments
  const allExpenses = categoryExpenses.flatMap(cat => cat.expenses);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today for comparison
  
  // Filter for expenses that have remaining balance or are unpaid
  const expensesWithRemainingPayments = allExpenses.filter(expense => {
    const remainingAmount = expense.quotedPrice - expense.amountPaid;
    const hasValidDueDate = expense.paymentDueDate && expense.paymentDueDate instanceof Date && !isNaN(expense.paymentDueDate.getTime());
    return remainingAmount > 0 && expense.paymentStatus !== 'paid' && hasValidDueDate;
  });
  
  const upcomingPayments = expensesWithRemainingPayments.filter(expense => {
    if (!expense.paymentDueDate || !(expense.paymentDueDate instanceof Date) || isNaN(expense.paymentDueDate.getTime())) {
      return false;
    }
    return expense.paymentDueDate > today;
  });
  
  const overduePayments = expensesWithRemainingPayments.filter(expense => {
    if (!expense.paymentDueDate || !(expense.paymentDueDate instanceof Date) || isNaN(expense.paymentDueDate.getTime())) {
      return false;
    }
    return expense.paymentDueDate <= today;
  });

  // Calculate spent per event
  const spentPerEvent = events.reduce((acc, event) => {
    const eventExpenses = allExpenses.filter(expense => expense.event === event.name);
    const totalSpent = eventExpenses.reduce((sum, expense) => sum + expense.amountPaid, 0);
    acc[event.name] = {
      eventName: event.name,
      totalSpent,
      expenseCount: eventExpenses.length,
      expenses: eventExpenses
    };
    return acc;
  }, {} as Record<string, {eventName: string, totalSpent: number, expenseCount: number, expenses: any[]}>);

  // Get payments made (paid status)
  const paymentsMade = allExpenses.filter(expense => expense.paymentStatus === 'paid');


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-lg text-gray-600">Loading budget data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-lg mb-4">{error}</div>
          <button 
            onClick={() => loadData()} 
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Main Content */}
      <div className="max-w-7xl mx-auto py-8 px-4">
        <BudgetHeader 
          locale={locale}
          summary={summary}
          title={getLocalizedText(locale, 'welcome')}
          subtitle={getLocalizedText(locale, 'overview')}
        />

        {/* Spent per Events Stats */}
        {events.length > 0 && (
          <div className="bg-white rounded-lg shadow mb-8 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Spent per Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {events.map((event, index) => {
                const eventData = spentPerEvent[event.name];
                return (
                  <div key={event.id || `event-${index}`} className="bg-gray-50 rounded-lg p-4">
                    <div className="text-lg font-bold text-blue-600">
                      ${eventData?.totalSpent.toLocaleString() || '0'}
                    </div>
                    <div className="text-sm font-medium text-gray-900">{event.name}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {eventData?.expenseCount || 0} payments
                    </div>
                  </div>
                );
              })}
              
              {/* Unassigned expenses */}
              {(() => {
                const unassignedExpenses = allExpenses.filter(expense => !expense.event);
                const unassignedTotal = unassignedExpenses.reduce((sum, expense) => sum + expense.amountPaid, 0);
                if (unassignedTotal > 0) {
                  return (
                    <div key="unassigned" className="bg-gray-50 rounded-lg p-4 border-l-4 border-yellow-400">
                      <div className="text-lg font-bold text-yellow-600">
                        ${unassignedTotal.toLocaleString()}
                      </div>
                      <div className="text-sm font-medium text-gray-900">No Event Specified</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {unassignedExpenses.length} payments
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        )}

        {/* Quick Add Payment Section */}
        <div className="bg-white rounded-lg shadow mb-8 p-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{getLocalizedText(locale, 'quick_add_payment')}</h2>
              <p className="text-gray-600">{getLocalizedText(locale, 'add_payment_description')}</p>
              {categoryExpenses.length === 0 && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-blue-800">
                      📋 No budget categories found. Create one to get started!
                    </span>
                    <button
                      onClick={() => setShowCreateCategory(true)}
                      className="ml-3 bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
                    >
                      + Create Category
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowQuickAddPayment(true)}
              className="px-6 py-3 rounded-lg font-medium transition-colors bg-blue-600 text-white hover:bg-blue-700"
            >
              + {getLocalizedText(locale, 'add_payment')}
            </button>
          </div>
          
          {/* Quick Add Payment Form Modal */}
          {showQuickAddPayment && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">{getLocalizedText(locale, 'add_new_payment')}</h3>
                  <button
                    onClick={() => setShowQuickAddPayment(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <form onSubmit={handleQuickAddPayment} className="space-y-6">
                  {/* Category, Event and Vendor */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Category <span className="text-red-500">*</span>
                      </label>
                      {budgetCategories.length > 0 ? (
                        <div className="space-y-2">
                          <select
                            value={quickPaymentForm.categoryId}
                            onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, categoryId: e.target.value })}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            required
                          >
                            <option value="">Select a category...</option>
                            {budgetCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => setShowCreateCategory(true)}
                            className="w-full text-left px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm border border-dashed border-blue-300"
                          >
                            + Create New Category
                          </button>
                        </div>
                      ) : (
                        <div className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                          <div className="text-center">
                            <div className="text-sm text-gray-600 mb-2">No budget categories found</div>
                            <div className="text-xs text-gray-500 mb-3">
                              Create your first budget category to get started
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowCreateCategory(true)}
                              className="inline-block bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
                            >
                              Create Category
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Event
                      </label>
                      <select
                        value={quickPaymentForm.event}
                        onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, event: e.target.value })}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">Select an event...</option>
                        {events.map((event, index) => (
                          <option key={event.id || `event-option-${index}`} value={event.name}>
                            {event.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vendor/Item Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={quickPaymentForm.vendorName}
                        onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, vendorName: e.target.value })}
                        placeholder="e.g., Elegant Venues, John Doe Photography"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  {/* Payment Status Display and Conditional Due Date */}
                  <div className="space-y-6">
                    {/* Payment Status Display */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Status (Automatically Determined)
                      </label>
                      <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                        {(() => {
                          const quotedPrice = parseFloat(quickPaymentForm.quotedPrice) || 0;
                          const amountPaid = parseFloat(quickPaymentForm.amountPaid) || 0;
                          const status = getCurrentPaymentStatus();
                          
                          if (!quotedPrice && !amountPaid) {
                            return <span className="text-gray-500">Enter amounts to see status</span>;
                          }
                          
                          if (quotedPrice < amountPaid) {
                            return <span className="text-red-600">❌ Error: Amount Paid cannot exceed Total Amount</span>;
                          }
                          
                          switch (status) {
                            case 'paid':
                              return <span className="text-green-600">✅ Payment Made (Fully Paid)</span>;
                            case 'overdue':
                              return <span className="text-red-600">⚠️ Overdue Payment</span>;
                            case 'due':
                              return <span className="text-yellow-600">⏰ Upcoming/Due Payment</span>;
                            default:
                              return <span className="text-gray-500">⏰ Upcoming/Due Payment</span>;
                          }
                        })()}
                      </div>
                    </div>

                    {/* Conditional Due Date */}
                    {isDueDateRequired() && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Due Date <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={quickPaymentForm.paymentDueDate}
                          onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, paymentDueDate: e.target.value })}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Required when Amount Paid is less than Total Amount
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Price Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Total Amount/Quote <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quickPaymentForm.quotedPrice}
                          onChange={(e) => {
                            const newQuotedPrice = e.target.value;
                            const quotedPrice = parseFloat(newQuotedPrice) || 0;
                            const amountPaid = parseFloat(quickPaymentForm.amountPaid) || 0;
                            
                            // Clear due date if payment becomes fully paid
                            const newPaymentDueDate = (quotedPrice === amountPaid && quotedPrice > 0) 
                              ? '' 
                              : quickPaymentForm.paymentDueDate;
                            
                            setQuickPaymentForm({ 
                              ...quickPaymentForm, 
                              quotedPrice: newQuotedPrice,
                              paymentDueDate: newPaymentDueDate
                            });
                          }}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount Paid
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-3 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={quickPaymentForm.amountPaid}
                          onChange={(e) => {
                            const newAmountPaid = e.target.value;
                            const quotedPrice = parseFloat(quickPaymentForm.quotedPrice) || 0;
                            const amountPaid = parseFloat(newAmountPaid) || 0;
                            
                            // Clear due date if payment becomes fully paid
                            const newPaymentDueDate = (quotedPrice === amountPaid && quotedPrice > 0) 
                              ? '' 
                              : quickPaymentForm.paymentDueDate;
                            
                            setQuickPaymentForm({ 
                              ...quickPaymentForm, 
                              amountPaid: newAmountPaid,
                              paymentDueDate: newPaymentDueDate
                            });
                          }}
                          placeholder="0.00"
                          className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      value={quickPaymentForm.notes}
                      onChange={(e) => setQuickPaymentForm({ ...quickPaymentForm, notes: e.target.value })}
                      placeholder="Additional notes..."
                      rows={3}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  {/* Form Actions */}
                  <div className="flex gap-4 justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => setShowQuickAddPayment(false)}
                      className="px-6 py-3 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium"
                    >
                      Add Payment
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>

        {/* Create Category Modal */}
        {showCreateCategory && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Create Budget Category</h3>
                <button
                  onClick={() => setShowCreateCategory(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Quick Setup Option */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-blue-900 mb-1">Quick Setup</h4>
                    <p className="text-xs text-blue-700">
                      Add all {basicCategories.length} essential wedding categories at once
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateBasicCategories}
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium whitespace-nowrap"
                  >
                    Add Basic Categories
                  </button>
                </div>
                <div className="mt-3 text-xs text-blue-600">
                  Categories: {basicCategories.join(' • ')}
                </div>
              </div>

              <div className="text-center text-sm text-gray-500 mb-4">
                — or create a custom category —
              </div>

              <form onSubmit={handleCreateCategory} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g., Wedding Planner, Guest Accommodation..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Keep it simple - just a name for organizing your expenses
                  </p>
                </div>

                <div className="flex gap-3 justify-end pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateCategory(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg"
                  >
                    Create Category
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <FundingSourcesSection 
          locale={locale}
          fundingSources={fundingSources}
          onAddFundingSource={handleAddFundingSource}
          onUpdateFundingSource={handleUpdateFundingSource}
          onDeleteFundingSource={handleDeleteFundingSource}
        />

        {/* Payment Timeline */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">{getLocalizedText(locale, 'payment_timeline')}</h2>
            <div className="text-sm text-gray-600">
              Total Payments: {allExpenses.length} | Upcoming: {upcomingPayments.length} | Overdue: {overduePayments.length}
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Upcoming Payments */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <span className="w-3 h-3 bg-yellow-500 rounded-full mr-2"></span>
                  {getLocalizedText(locale, 'upcoming_payments')}
                </h3>
              </div>
              <div className="p-6">
                {upcomingPayments.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingPayments.slice(0, 5).map((expense) => {
                      const categoryData = categoryExpenses.find(cat => cat.categoryId === expense.categoryId);
                      const remainingAmount = expense.quotedPrice - expense.amountPaid;
                      return (
                        <div key={expense.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{expense.vendorName}</div>
                            <div className="text-sm text-gray-600">
                              {categoryData?.categoryName && (
                                <span className="inline-block bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs mr-2">
                                  {categoryData.categoryName}
                                </span>
                              )}
                              {expense.event && (
                                <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs mr-2">
                                  {expense.event}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Due: {expense.paymentDueDate ? new Date(expense.paymentDueDate).toLocaleDateString() : 'N/A'}
                              {expense.amountPaid > 0 && (
                                <span className="ml-2">
                                  (${expense.amountPaid.toLocaleString()} paid of ${expense.quotedPrice.toLocaleString()})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-lg font-bold text-yellow-600">
                            ${remainingAmount.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    {getLocalizedText(locale, 'no_upcoming_payments')}
                  </div>
                )}
              </div>
            </div>

            {/* Overdue Payments */}
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <span className="w-3 h-3 bg-red-500 rounded-full mr-2"></span>
                  {getLocalizedText(locale, 'overdue_payments')}
                </h3>
              </div>
              <div className="p-6">
                {overduePayments.length > 0 ? (
                  <div className="space-y-3">
                    {overduePayments.slice(0, 5).map((expense) => {
                      const categoryData = categoryExpenses.find(cat => cat.categoryId === expense.categoryId);
                      const remainingAmount = expense.quotedPrice - expense.amountPaid;
                      return (
                        <div key={expense.id} className="flex justify-between items-center p-3 bg-red-50 rounded">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900">{expense.vendorName}</div>
                            <div className="text-sm text-gray-600">
                              {categoryData?.categoryName && (
                                <span className="inline-block bg-gray-200 text-gray-700 px-2 py-1 rounded text-xs mr-2">
                                  {categoryData.categoryName}
                                </span>
                              )}
                              {expense.event && (
                                <span className="inline-block bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs mr-2">
                                  {expense.event}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-600 mt-1">
                              Due: {expense.paymentDueDate ? new Date(expense.paymentDueDate).toLocaleDateString() : 'N/A'}
                              {expense.amountPaid > 0 && (
                                <span className="ml-2">
                                  (${expense.amountPaid.toLocaleString()} paid of ${expense.quotedPrice.toLocaleString()})
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-lg font-bold text-red-600">
                            ${remainingAmount.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center text-green-600 py-4">
                    {getLocalizedText(locale, 'no_overdue_payments')}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Payments Made Table */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Payments Made</h2>
            <p className="text-gray-600 text-sm mt-1">All completed payments</p>
          </div>
          
          {paymentsMade.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vendor</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount Paid</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paymentsMade.map((payment) => {
                    const category = categoryExpenses.find(cat => 
                      cat.expenses.some(exp => exp.id === payment.id)
                    );
                    return (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{payment.vendorName}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {payment.event ? (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                {payment.event}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{category?.categoryName || 'Unknown'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-green-600">${payment.amountPaid.toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {payment.paymentDueDate ? new Date(payment.paymentDueDate).toLocaleDateString() : '-'}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {payment.notes || '-'}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {/* Summary Row */}
              <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">
                    Total Payments Made: {paymentsMade.length}
                  </span>
                  <span className="text-lg font-bold text-green-600">
                    ${paymentsMade.reduce((sum, payment) => sum + payment.amountPaid, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <div className="text-lg mb-2">No payments made yet</div>
              <div className="text-sm">
                Payments marked as "paid" will appear here
              </div>
            </div>
          )}
        </div>

        {/* Expense Tracking by Category */}
        <div className="space-y-6">
          {categoryExpenses.length > 0 ? (
            categoryExpenses.map((categoryData) => (
              <ExpenseTracker
                key={categoryData.categoryId}
                locale={locale}
                categoryData={categoryData}
                onAddExpense={handleAddExpense}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            ))
          ) : (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <div className="text-lg mb-2">No expense categories found</div>
              <div className="text-sm">
                Add budget allocations in the Forecast page to start tracking expenses
              </div>
              <Link 
                href={`/${locale}/forecast`}
                className="inline-block mt-4 bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
              >
                Go to Budget Forecast
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}