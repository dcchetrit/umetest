'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import BudgetHeader from '@/components/budget/BudgetHeader';
import FundingSourcesSection from '@/components/budget/FundingSourcesSection';
import ExpenseTracker from '@/components/budget/ExpenseTracker';
import { 
  BudgetAllocation, 
  FundingSource, 
  BudgetSummary, 
  CategoryExpenseData,
  ExpenseEntry,
  DEFAULT_CATEGORIES,
  BudgetCategory
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
  deleteExpense
} from '@/services/budgetService';
import { createBudgetTasksService } from '@/services/budgetTasksService';
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
      no_overdue_payments: 'All payments are up to date!'
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
      no_overdue_payments: 'Tous les paiements sont à jour !'
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
      no_overdue_payments: '¡Todos los pagos están al día!'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default function BudgetClient({ locale }: BudgetClientProps) {
  const { user } = useAuth();
  const [fundingSources, setFundingSources] = useState<FundingSource[]>([]);
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpenseData[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({
    totalFunds: 0,
    totalAllocated: 0,
    totalSpent: 0,
    remainingFunds: 0,
    unallocatedFunds: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  
  // Use authenticated user's ID as couple ID
  const coupleId = user?.uid;

  // Initialize services conditionally using useMemo to prevent recreation on every render
  const budgetTasksService = useMemo(() => {
    return coupleId ? createBudgetTasksService(coupleId) : null;
  }, [coupleId]);
  
  const forecastBudgetService = useMemo(() => {
    return coupleId ? createForecastBudgetService(coupleId) : null;
  }, [coupleId]);

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError('');
      
      const [budgetSummary, fundingSourcesData, categoryExpensesData] = await Promise.all([
        getBudgetSummary(coupleId),
        getFundingSources(coupleId),
        getCategoryExpenses(coupleId)
      ]);

      setSummary(budgetSummary);
      setFundingSources(fundingSourcesData);
      setCategoryExpenses(categoryExpensesData);
    } catch (err) {
      console.error('❌ Error loading data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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
          // Update budget data when payment reminders change
          loadData();
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
    };
  }, [user, coupleId]);

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
      
      // Sync payment reminders after adding expense
      if (budgetTasksService) {
        await budgetTasksService.syncPaymentReminders();
      }
      
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
      
      // Sync payment reminders after updating expense
      if (budgetTasksService) {
        await budgetTasksService.syncPaymentReminders();
      }
      
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

  // Get upcoming and overdue payments
  const allExpenses = categoryExpenses.flatMap(cat => cat.expenses);
  const today = new Date();
  const upcomingPayments = allExpenses.filter(expense => 
    expense.paymentStatus === 'due' && 
    expense.paymentDueDate && 
    expense.paymentDueDate > today
  );
  const overduePayments = allExpenses.filter(expense => 
    expense.paymentStatus === 'due' && 
    expense.paymentDueDate && 
    expense.paymentDueDate <= today
  );


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

        <FundingSourcesSection 
          locale={locale}
          fundingSources={fundingSources}
          onAddFundingSource={handleAddFundingSource}
          onUpdateFundingSource={handleUpdateFundingSource}
          onDeleteFundingSource={handleDeleteFundingSource}
        />

        {/* Payment Timeline */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-6">{getLocalizedText(locale, 'payment_timeline')}</h2>
          
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
                    {upcomingPayments.slice(0, 5).map((expense) => (
                      <div key={expense.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                        <div>
                          <div className="font-medium text-gray-900">{expense.vendorName}</div>
                          <div className="text-sm text-gray-600">
                            Due: {expense.paymentDueDate?.toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-lg font-bold text-yellow-600">
                          ${(expense.quotedPrice - expense.amountPaid).toLocaleString()}
                        </div>
                      </div>
                    ))}
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
                    {overduePayments.slice(0, 5).map((expense) => (
                      <div key={expense.id} className="flex justify-between items-center p-3 bg-red-50 rounded">
                        <div>
                          <div className="font-medium text-gray-900">{expense.vendorName}</div>
                          <div className="text-sm text-gray-600">
                            Due: {expense.paymentDueDate?.toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-lg font-bold text-red-600">
                          ${(expense.quotedPrice - expense.amountPaid).toLocaleString()}
                        </div>
                      </div>
                    ))}
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
                href={`/${locale}/app/forecast`}
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