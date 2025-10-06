'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import BudgetHeader from '@/components/budget/BudgetHeader';
import FundingSourcesSection from '@/components/budget/FundingSourcesSection';
import { 
  BudgetAllocation, 
  FundingSource, 
  BudgetSummary, 
  DEFAULT_CATEGORIES,
  BudgetCategory,
  SimpleExpense
} from '@/types/budget';
import {
  getBudgetAllocations,
  saveBudgetAllocation,
  updateBudgetAllocation,
  deleteBudgetAllocation,
  getFundingSources,
  saveFundingSource,
  updateFundingSource,
  deleteFundingSource,
  getBudgetSummary,
  getSimpleExpenses,
  saveSimpleExpense,
  updateSimpleExpense,
  deleteSimpleExpense,
  getEvents
} from '@/services/budgetService';
import { createForecastBudgetService } from '@/services/forecastBudgetService';

interface ForecastClientProps {
  locale: string;
}


function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      forecast: 'Budget Forecast',
      welcome: 'Plan Your Wedding Budget',
      overview: 'Plan your wedding budget by allocating your funds to each category.',
      add_expense: 'Add Expense',
      expense: 'Expense',
      event: 'Event',
      planned_amount: 'Planned Amount',
      notes: 'Notes',
      actions: 'Actions',
      back_home: '← Back to Home',
      login_required: 'Please log in to view forecast',
      total_allocated: 'Total Allocated',
      remaining_unallocated: 'Remaining Unallocated',
      save_changes: 'Save Changes',
      expense_name: 'Expense Name',
      add: 'Add',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      save: 'Save',
      optional_notes: 'Optional notes for this category...',
      optional_event: 'e.g., Reception, Ceremony, Photoshoot...',
      expenses: 'Expenses',
      vendor_name: 'Vendor Name',
      quoted_price: 'Quoted Price',
      amount_paid: 'Amount Paid',
      payment_due_date: 'Payment Due Date',
      payment_status: 'Payment Status',
      paid: 'Paid',
      due: 'Due',
      overdue: 'Overdue',
      show_expenses: 'Show Expenses',
      hide_expenses: 'Hide Expenses',
      no_expenses: 'No expenses added yet'
    },
    fr: {
      forecast: 'Prévisions budgétaires',
      welcome: 'Planifiez votre budget de mariage',
      overview: 'Planifiez votre budget de mariage en allouant vos fonds à chaque catégorie.',
      add_expense: 'Ajouter une dépense',
      expense_line: 'Ligne de dépenses',
      event: 'Événements',
      estimated_amount: 'Montant estimé (€)',
      comments: 'Commentaire',
      actions: 'Actions',
      back_home: '← Retour à l\'accueil',
      login_required: 'Veuillez vous connecter pour voir les prévisions',
      total_allocated: 'Total alloué',
      remaining_unallocated: 'Restant non alloué',
      save_changes: 'Sauvegarder les modifications',
      expense_name: 'Nom de la dépense',
      add: 'Ajouter',
      cancel: 'Annuler',
      delete: 'Supprimer',
      edit: 'Modifier',
      save: 'Sauvegarder',
      optional_notes: 'Notes optionnelles pour cette catégorie...',
      optional_event: 'ex: Réception, Cérémonie, Séance photo...',
      expenses: 'Dépenses',
      vendor_name: 'Nom du vendeur',
      quoted_price: 'Prix devisé',
      amount_paid: 'Montant payé',
      payment_due_date: 'Date d\'échéance',
      payment_status: 'Statut de paiement',
      paid: 'Payé',
      due: 'Dû',
      overdue: 'En retard',
      show_expenses: 'Afficher les dépenses',
      hide_expenses: 'Masquer les dépenses',
      no_expenses: 'Aucune dépense ajoutée'
    },
    es: {
      forecast: 'Pronóstico presupuestario',
      welcome: 'Planifica tu presupuesto de boda',
      overview: 'Planifica tu presupuesto de boda asignando tus fondos a cada categoría.',
      add_expense: 'Agregar gasto',
      expense: 'Gasto',
      event: 'Evento',
      planned_amount: 'Cantidad planificada',
      notes: 'Notas',
      actions: 'Acciones',
      back_home: '← Volver al inicio',
      login_required: 'Por favor inicia sesión para ver el pronóstico',
      total_allocated: 'Total asignado',
      remaining_unallocated: 'Restante no asignado',
      save_changes: 'Guardar cambios',
      expense_name: 'Nombre del gasto',
      add: 'Agregar',
      cancel: 'Cancelar',
      delete: 'Eliminar',
      edit: 'Editar',
      save: 'Guardar',
      optional_notes: 'Notas opcionales para esta categoría...',
      optional_event: 'ej: Recepción, Ceremonia, Sesión de fotos...',
      expenses: 'Gastos',
      vendor_name: 'Nombre del proveedor',
      quoted_price: 'Precio cotizado',
      amount_paid: 'Cantidad pagada',
      payment_due_date: 'Fecha de vencimiento',
      payment_status: 'Estado de pago',
      paid: 'Pagado',
      due: 'Pendiente',
      overdue: 'Vencido',
      show_expenses: 'Mostrar gastos',
      hide_expenses: 'Ocultar gastos',
      no_expenses: 'No se han agregado gastos'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default function ForecastClient({ locale }: ForecastClientProps) {
  const { user } = useAuth();

  // Authentication guard
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Please log in to view your budget forecast</h1>
          <Link href={`/${locale}/login`} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Login
          </Link>
        </div>
      </div>
    );
  }

  const coupleId = user.uid;
  const [fundingSources, setFundingSources] = useState<FundingSource[]>([]);
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [allocations, setAllocations] = useState<BudgetAllocation[]>([]);
  const [events, setEvents] = useState<Array<{id: string, name: string, showOnWebsite: boolean}>>([]);
  const [simpleExpenses, setSimpleExpenses] = useState<SimpleExpense[]>([]);
  const [summary, setSummary] = useState<BudgetSummary>({
    totalFunds: 0,
    totalAllocated: 0,
    totalSpent: 0,
    remainingFunds: 0,
    unallocatedFunds: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  
  // Initialize Forecast-Budget service
  const forecastBudgetService = createForecastBudgetService(coupleId);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState({
    categoryName: '',
    event: '',
    plannedAmount: '',
    notes: ''
  });
  const [newExpenseData, setNewExpenseData] = useState({
    vendorName: '',
    quotedPrice: '',
    amountPaid: '',
    paymentDueDate: '',
    paymentStatus: 'due' as PaymentStatus,
    notes: '',
    event: ''
  });
  const [editingExpenseData, setEditingExpenseData] = useState({
    vendorName: '',
    quotedPrice: '',
    amountPaid: '',
    paymentDueDate: '',
    paymentStatus: 'due' as PaymentStatus,
    notes: ''
  });

  const loadData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      setError('');
      
      const [budgetSummary, fundingSourcesData, allocationsData, expensesData, eventsData] = await Promise.all([
        getBudgetSummary(coupleId),
        getFundingSources(coupleId),
        getBudgetAllocations(coupleId),
        getSimpleExpenses(coupleId),
        getEvents(coupleId)
      ]);

      setSummary(budgetSummary);
      setFundingSources(fundingSourcesData);
      setAllocations(allocationsData);
      setEvents(eventsData);
      setSimpleExpenses(expensesData);
      
      // Initialize categories only from existing allocations (no defaults)
      const customCats = allocationsData.map(alloc => ({
        id: alloc.categoryId,
        name: alloc.categoryName,
        order: 999,
        isCustom: true
      }));
      
      setCategories(customCats);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    // Load initial data
    loadData();

    // Set up real-time listener for forecast budget sync with error handling
    let unsubscribeForecastSync: (() => void) | null = null;
    
    try {
      unsubscribeForecastSync = forecastBudgetService.subscribeToForecastBudgetSync((insights) => {
        // Reload data when forecast budget changes
        loadData();
      });
    } catch (error) {
      console.error('Failed to set up forecast budget sync listener:', error);
      // Continue without real-time updates - the initial data load still works
    }

    // Cleanup function to prevent memory leaks
    return () => {
      if (unsubscribeForecastSync) {
        try {
          unsubscribeForecastSync();
        } catch (error) {
          console.error('Error cleaning up forecast budget sync listener:', error);
        }
      }
    };
  }, [user]);

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

  const handleUpdateAllocation = async (categoryId: string, amount: number, event?: string, notes?: string) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    try {
      const existingAllocation = allocations.find(alloc => alloc.categoryId === categoryId);
      
      if (existingAllocation) {
        await updateBudgetAllocation(coupleId, existingAllocation.id, {
          plannedAmount: amount,
          event,
          notes
        });
        setAllocations(allocations.map(alloc => 
          alloc.categoryId === categoryId 
            ? { ...alloc, plannedAmount: amount, event, notes, updatedAt: new Date() }
            : alloc
        ));
      } else {
        const id = await saveBudgetAllocation(coupleId, {
          categoryId,
          categoryName: category.name,
          plannedAmount: amount,
          event,
          notes
        });
        const newAllocation: BudgetAllocation = {
          id,
          categoryId,
          categoryName: category.name,
          plannedAmount: amount,
          event,
          notes,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setAllocations([...allocations, newAllocation]);
      }
      
      // Refresh summary
      const newSummary = await getBudgetSummary(coupleId);
      setSummary(newSummary);
      
      // Sync allocation changes to budget baseline
      if (existingAllocation) {
        await forecastBudgetService.syncForecastChangesToBudget(existingAllocation.id);
      } else {
        // Create baseline from new allocation
        await forecastBudgetService.createBaselineFromForecast();
      }
    } catch (error) {
      console.error('Error updating allocation:', error);
      setError('Failed to update allocation');
    }
  };

  const handleEditAllocation = (allocation: BudgetAllocation) => {
    setEditingId(allocation.id);
    setEditingData({
      categoryName: allocation.categoryName,
      event: allocation.event || '',
      plannedAmount: allocation.plannedAmount.toString(),
      notes: allocation.notes || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    
    try {
      const updates = {
        expenseLine: editingData.expenseLine || '',
        event: editingData.event || '',
        estimatedAmount: parseFloat(editingData.estimatedAmount || '0'),
        comments: editingData.comments || ''
      };
      
      await updateSimpleExpense(coupleId, editingId, updates);
      await loadData();
      setEditingId(null);
      resetEditingData();
    } catch (error) {
      console.error('Error updating expense:', error);
      setError('Failed to update expense');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetEditingData();
  };

  const resetEditingData = () => {
    setEditingData({
      expenseLine: '',
      event: '',
      estimatedAmount: '',
      comments: ''
    });
  };

  const handleAddNewExpense = async (expenseData: Omit<SimpleExpense, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      await saveSimpleExpense(coupleId, expenseData);
      await loadData();
      setShowAddExpense(false);
      resetEditingData();
    } catch (error) {
      console.error('Error adding expense:', error);
      setError('Failed to add expense');
    }
  };

  const handleDeleteAllocation = async (allocationId: string) => {
    try {
      await deleteBudgetAllocation(coupleId, allocationId);
      setAllocations(allocations.filter(alloc => alloc.id !== allocationId));
      
      // Refresh summary
      const newSummary = await getBudgetSummary(coupleId);
      setSummary(newSummary);
    } catch (error) {
      console.error('Error deleting allocation:', error);
      setError('Failed to delete allocation');
    }
  };

  const handleAddCustomCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    try {
      const newCategory: BudgetCategory = {
        id: `custom-${Date.now()}`,
        name: newCategoryName,
        order: categories.length + 1,
        isCustom: true
      };
      
      setCategories([...categories, newCategory]);
      
      // Create a budget allocation with the estimated amount
      const quotedPrice = parseFloat(newExpenseData.quotedPrice) || 0;
      await handleUpdateAllocation(newCategory.id, quotedPrice, editingData.event, '');
      
      // If there's expense data, also create an expense
      if (quotedPrice > 0 || newExpenseData.vendorName || newExpenseData.notes || newExpenseData.paymentDueDate) {
        const amountPaid = parseFloat(newExpenseData.amountPaid) || 0;
        const paymentDueDate = newExpenseData.paymentDueDate ? new Date(newExpenseData.paymentDueDate) : undefined;
        
        await saveExpense(coupleId, {
          categoryId: newCategory.id,
          vendorName: newExpenseData.vendorName || 'TBD',
          quotedPrice,
          amountPaid,
          paymentDueDate,
          paymentStatus: newExpenseData.paymentStatus,
          notes: newExpenseData.notes,
          event: editingData.event || newExpenseData.event
        });
      }
      
      // Refresh all data
      await loadData();
      
      // Reset form
      setNewCategoryName('');
      setEditingData({ ...editingData, event: '' });
      setNewExpenseData({
        vendorName: '',
        quotedPrice: '',
        amountPaid: '',
        paymentDueDate: '',
        paymentStatus: 'due',
        notes: '',
        event: ''
      });
      setShowAddCategory(false);
    } catch (error) {
      console.error('Error adding custom category:', error);
      setError('Failed to add expense category');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      // Delete associated allocation if exists
      const allocation = allocations.find(alloc => alloc.categoryId === categoryId);
      if (allocation) {
        await deleteBudgetAllocation(coupleId, allocation.id);
      }
      
      setCategories(categories.filter(cat => cat.id !== categoryId));
      setAllocations(allocations.filter(alloc => alloc.categoryId !== categoryId));
      
      // Refresh summary
      const newSummary = await getBudgetSummary(coupleId);
      setSummary(newSummary);
    } catch (error) {
      console.error('Error deleting category:', error);
      setError('Failed to delete category');
    }
  };

  const handleAddExpense = async () => {
    if (!selectedCategoryId) return;
    
    try {
      const quotedPrice = parseFloat(newExpenseData.quotedPrice) || 0;
      const amountPaid = parseFloat(newExpenseData.amountPaid) || 0;
      const paymentDueDate = newExpenseData.paymentDueDate ? new Date(newExpenseData.paymentDueDate) : undefined;
      
      await saveExpense(coupleId, {
        categoryId: selectedCategoryId,
        vendorName: newExpenseData.vendorName || 'TBD',
        quotedPrice,
        amountPaid,
        paymentDueDate,
        paymentStatus: newExpenseData.paymentStatus,
        notes: newExpenseData.notes,
        event: newExpenseData.event
      });
      
      // Refresh data
      await loadData();
      
      // Reset form
      setNewExpenseData({
        vendorName: '',
        quotedPrice: '',
        amountPaid: '',
        paymentDueDate: '',
        paymentStatus: 'due',
        notes: '',
        event: ''
      });
      setShowAddExpense(false);
      setSelectedCategoryId('');
    } catch (error) {
      console.error('Error adding expense:', error);
      setError('Failed to add expense');
    }
  };
  
  const handleUpdateExpense = async (expenseId: string) => {
    try {
      const quotedPrice = parseFloat(editingExpenseData.quotedPrice) || 0;
      const amountPaid = parseFloat(editingExpenseData.amountPaid) || 0;
      const paymentDueDate = editingExpenseData.paymentDueDate ? new Date(editingExpenseData.paymentDueDate) : undefined;
      
      await updateExpense(coupleId, expenseId, {
        vendorName: editingExpenseData.vendorName,
        quotedPrice,
        amountPaid,
        paymentDueDate,
        paymentStatus: editingExpenseData.paymentStatus,
        notes: editingExpenseData.notes
      });
      
      // Refresh data
      await loadData();
      
      setEditingExpenseId(null);
      resetEditingExpenseData();
    } catch (error) {
      console.error('Error updating expense:', error);
      setError('Failed to update expense');
    }
  };
  
  const handleDeleteExpense = async (expenseId: string) => {
    try {
      await deleteSimpleExpense(coupleId, expenseId);
      
      // Refresh data
      await loadData();
    } catch (error) {
      console.error('Error deleting expense:', error);
      setError('Failed to delete expense');
    }
  };
  
  const handleEditExpense = (expense: SimpleExpense) => {
    setEditingId(expense.id);
    setEditingData({
      expenseLine: expense.expenseLine,
      event: expense.event || '',
      estimatedAmount: expense.estimatedAmount.toString(),
      comments: expense.comments || ''
    });
  };
  
  const resetEditingExpenseData = () => {
    setEditingExpenseData({
      vendorName: '',
      quotedPrice: '',
      amountPaid: '',
      paymentDueDate: '',
      paymentStatus: 'due',
      notes: ''
    });
  };
  
  const toggleCategoryExpansion = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const renderExpenseRows = (allocation: BudgetAllocation) => {
    if (!expandedCategories.has(allocation.categoryId)) {
      return null;
    }

    const categoryExpenseData = categoryExpenses.find(ce => ce.categoryId === allocation.categoryId);
    const expenses = categoryExpenseData?.expenses || [];
    
    if (expenses.length === 0) {
      return (
        <tr key={`${allocation.id}-no-expenses`} className="bg-gray-50">
          <td colSpan={5} className="px-12 py-3 text-sm text-gray-500 text-center">
            {getLocalizedText(locale, 'no_expenses')}
          </td>
        </tr>
      );
    }
    
    return expenses.map((expense) => (
      <tr key={`${allocation.id}-expense-${expense.id}`} className="bg-gray-50">
        {editingExpenseId === expense.id ? (
          // Edit mode for expense
          <>
            <td className="px-12 py-3">
              <input
                type="text"
                value={editingExpenseData.vendorName}
                onChange={(e) => setEditingExpenseData({ ...editingExpenseData, vendorName: e.target.value })}
                placeholder={getLocalizedText(locale, 'vendor_name')}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </td>
            <td className="px-6 py-3">
              <input
                type="date"
                value={editingExpenseData.paymentDueDate}
                onChange={(e) => setEditingExpenseData({ ...editingExpenseData, paymentDueDate: e.target.value })}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </td>
            <td className="px-6 py-3">
              <div className="space-y-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingExpenseData.quotedPrice}
                  onChange={(e) => setEditingExpenseData({ ...editingExpenseData, quotedPrice: e.target.value })}
                  placeholder={getLocalizedText(locale, 'quoted_price')}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingExpenseData.amountPaid}
                  onChange={(e) => setEditingExpenseData({ ...editingExpenseData, amountPaid: e.target.value })}
                  placeholder={getLocalizedText(locale, 'amount_paid')}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </td>
            <td className="px-6 py-3">
              <div className="space-y-1">
                <select
                  value={editingExpenseData.paymentStatus}
                  onChange={(e) => setEditingExpenseData({ ...editingExpenseData, paymentStatus: e.target.value as PaymentStatus })}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                >
                  <option value="paid">{getLocalizedText(locale, 'paid')}</option>
                  <option value="due">{getLocalizedText(locale, 'due')}</option>
                  <option value="overdue">{getLocalizedText(locale, 'overdue')}</option>
                </select>
                <input
                  type="text"
                  value={editingExpenseData.notes}
                  onChange={(e) => setEditingExpenseData({ ...editingExpenseData, notes: e.target.value })}
                  placeholder={getLocalizedText(locale, 'optional_notes')}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </td>
            <td className="px-6 py-3 text-sm">
              <div className="flex gap-1">
                <button
                  onClick={() => handleUpdateExpense(expense.id)}
                  className="text-green-600 hover:text-green-800 px-1 text-xs"
                >
                  {getLocalizedText(locale, 'save')}
                </button>
                <button
                  onClick={() => {
                    setEditingExpenseId(null);
                    resetEditingExpenseData();
                  }}
                  className="text-gray-600 hover:text-gray-800 px-1 text-xs"
                >
                  {getLocalizedText(locale, 'cancel')}
                </button>
              </div>
            </td>
          </>
        ) : (
          // View mode for expense
          <>
            <td className="px-12 py-3">
              <div className="text-sm text-gray-700">
                🏪 {expense.vendorName}
              </div>
            </td>
            <td className="px-6 py-3">
              <div className="text-sm text-gray-600">
                {expense.paymentDueDate 
                  ? new Date(expense.paymentDueDate).toLocaleDateString(locale)
                  : '-'
                }
              </div>
            </td>
            <td className="px-6 py-3">
              <div className="text-sm">
                <div className="text-gray-900">
                  ${expense.quotedPrice.toLocaleString()} {getLocalizedText(locale, 'quoted_price').toLowerCase()}
                </div>
                <div className={`${expense.amountPaid > 0 ? 'text-green-600' : 'text-gray-500'}`}>
                  ${expense.amountPaid.toLocaleString()} {getLocalizedText(locale, 'amount_paid').toLowerCase()}
                </div>
              </div>
            </td>
            <td className="px-6 py-3">
              <div className="space-y-1">
                <span className={`inline-flex px-2 py-1 text-xs rounded-full ${
                  expense.paymentStatus === 'paid' 
                    ? 'bg-green-100 text-green-800'
                    : expense.paymentStatus === 'overdue'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {getLocalizedText(locale, expense.paymentStatus)}
                </span>
                {expense.notes && (
                  <div className="text-xs text-gray-500 mt-1">
                    {expense.notes}
                  </div>
                )}
              </div>
            </td>
            <td className="px-6 py-3 text-sm">
              <div className="flex gap-1">
                <button
                  onClick={() => handleEditExpense(expense)}
                  className="text-blue-600 hover:text-blue-800 px-1 text-xs"
                >
                  {getLocalizedText(locale, 'edit')}
                </button>
                <button
                  onClick={() => handleDeleteExpense(expense.id)}
                  className="text-red-600 hover:text-red-800 px-1 text-xs"
                >
                  {getLocalizedText(locale, 'delete')}
                </button>
              </div>
            </td>
          </>
        )}
      </tr>
    ));
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{getLocalizedText(locale, 'login_required')}</h1>
          <Link href={`/${locale}/login`} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Login
          </Link>
        </div>
      </div>
    );
  }

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

  const remainingUnallocated = summary.totalFunds - summary.totalAllocated;
  const isOverBudget = summary.totalAllocated > summary.totalFunds;

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

        {/* Simple Expenses Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-900">Dépenses</h3>
            <button
              onClick={() => setShowAddExpense(true)}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm"
            >
              {getLocalizedText(locale, 'add_expense')}
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {getLocalizedText(locale, 'expense_line')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {getLocalizedText(locale, 'event')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {getLocalizedText(locale, 'estimated_amount')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {getLocalizedText(locale, 'comments')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {getLocalizedText(locale, 'actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Simple expenses */}
                {simpleExpenses.map((expense) => (
                  <tr key={expense.id}>
                    {editingId === expense.id ? (
                      // Edit mode
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="text"
                            value={editingData.expenseLine || ''}
                            onChange={(e) => setEditingData({ ...editingData, expenseLine: e.target.value })}
                            placeholder="Ligne de dépenses"
                            className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <select
                            value={editingData.event || ''}
                            onChange={(e) => setEditingData({ ...editingData, event: e.target.value })}
                            className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Sélectionner un événement</option>
                            {events.map(event => (
                              <option key={event.id} value={event.name}>
                                {event.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editingData.estimatedAmount || ''}
                            onChange={(e) => setEditingData({ ...editingData, estimatedAmount: e.target.value })}
                            className="w-32 px-3 py-1 border border-gray-300 rounded text-sm"
                            placeholder="0.00"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editingData.comments || ''}
                            onChange={(e) => setEditingData({ ...editingData, comments: e.target.value })}
                            placeholder="Commentaire"
                            className="w-full px-3 py-1 border border-gray-300 rounded text-sm"
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveEdit}
                              className="text-green-600 hover:text-green-800 px-2"
                            >
                              {getLocalizedText(locale, 'save')}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="text-gray-600 hover:text-gray-800 px-2"
                            >
                              {getLocalizedText(locale, 'cancel')}
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      // Display mode
                      <>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{expense.expenseLine}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-600">{expense.event || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            €{expense.estimatedAmount.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600">{expense.comments || '-'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditExpense(expense)}
                              className="text-blue-600 hover:text-blue-800 px-2"
                            >
                              {getLocalizedText(locale, 'edit')}
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(expense.id)}
                              className="text-red-600 hover:text-red-800 px-2"
                            >
                              {getLocalizedText(locale, 'delete')}
                            </button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}

                {/* Empty state when no expenses */}
                {simpleExpenses.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      <div className="text-lg mb-2">Aucune dépense pour le moment</div>
                      <div className="text-sm">
                        Cliquez sur "Ajouter une dépense" pour commencer
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Bar */}
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                ${summary.totalAllocated.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">
                {getLocalizedText(locale, 'total_allocated')}
              </div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${
                remainingUnallocated >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${Math.abs(remainingUnallocated).toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">
                {remainingUnallocated >= 0 
                  ? getLocalizedText(locale, 'remaining_unallocated')
                  : 'Over Budget'
                }
              </div>
            </div>
            <div className="text-center">
              {isOverBudget && (
                <div className="text-sm bg-red-100 text-red-800 p-2 rounded">
                  ⚠️ Your allocations exceed available funds by ${Math.abs(remainingUnallocated).toLocaleString()}
                </div>
              )}
              {!isOverBudget && remainingUnallocated > 0 && (
                <div className="text-sm bg-green-100 text-green-800 p-2 rounded">
                  ✅ You have ${remainingUnallocated.toLocaleString()} left to allocate
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Simple Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-t-xl p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">Ajouter une dépense</h2>
                <button
                  onClick={() => {
                    setShowAddExpense(false);
                    resetEditingData();
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-green-100 mt-2">Ajouter une nouvelle dépense à votre budget</p>
            </div>
            
            {/* Simple Form Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Ligne de dépenses */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Ligne de dépenses <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editingData.expenseLine || ''}
                    onChange={(e) => setEditingData({ ...editingData, expenseLine: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-0 transition-colors"
                    placeholder="Ex: Photographe, Traiteur, Lieu de réception..."
                    required
                  />
                </div>

                {/* Événements */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Événements
                  </label>
                  <select
                    value={editingData.event || ''}
                    onChange={(e) => setEditingData({ ...editingData, event: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-0 transition-colors"
                  >
                    <option value="">Sélectionner un événement</option>
                    {events.map(event => (
                      <option key={event.id} value={event.name}>
                        {event.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Montant estimé */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Montant estimé (€)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-3 text-gray-500">€</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingData.estimatedAmount || ''}
                      onChange={(e) => setEditingData({ ...editingData, estimatedAmount: e.target.value })}
                      className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-0 transition-colors"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                {/* Commentaire */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    Commentaire
                  </label>
                  <textarea
                    value={editingData.comments || ''}
                    onChange={(e) => setEditingData({ ...editingData, comments: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:ring-0 transition-colors resize-none"
                    placeholder="Ajouter des notes ou des détails supplémentaires..."
                    rows={3}
                  />
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 justify-end mt-8 pt-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowAddExpense(false);
                    resetEditingData();
                  }}
                  className="px-6 py-3 text-gray-600 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 font-semibold"
                >
                  Annuler
                </button>
                <button
                  onClick={async () => {
                    if (!editingData.expenseLine?.trim()) return;
                    
                    await handleAddNewExpense({
                      expenseLine: editingData.expenseLine.trim(),
                      event: editingData.event || '',
                      estimatedAmount: parseFloat(editingData.estimatedAmount || '0'),
                      comments: editingData.comments || ''
                    });
                  }}
                  disabled={!editingData.expenseLine?.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Ajouter
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate modal removed */}
      {false && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-xl p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">{getLocalizedText(locale, 'add_expense')}</h2>
                <button
                  onClick={() => {
                    setShowAddExpense(false);
                    setSelectedCategoryId('');
                    setNewExpenseData({
                      vendorName: '',
                      quotedPrice: '',
                      amountPaid: '',
                      paymentDueDate: '',
                      paymentStatus: 'due',
                      notes: '',
                      event: ''
                    });
                  }}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-blue-100 mt-2">Add expense details for tracking and budget management</p>
            </div>
            
            {/* Form Content */}
            <div className="p-6">
              <div className="space-y-6">
                {/* Vendor and Event Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getLocalizedText(locale, 'vendor_name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newExpenseData.vendorName}
                      onChange={(e) => setNewExpenseData({ ...newExpenseData, vendorName: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                      placeholder="e.g., John's Photography Studio"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getLocalizedText(locale, 'event')}
                    </label>
                    <select
                      value={newExpenseData.event}
                      onChange={(e) => setNewExpenseData({ ...newExpenseData, event: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors bg-white"
                    >
                      <option value="">Select an event...</option>
                      {events.map(event => (
                        <option key={event.id} value={event.name}>{event.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Price Information */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Price Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        {getLocalizedText(locale, 'quoted_price')}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newExpenseData.quotedPrice}
                          onChange={(e) => setNewExpenseData({ ...newExpenseData, quotedPrice: e.target.value })}
                          className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        {getLocalizedText(locale, 'amount_paid')}
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={newExpenseData.amountPaid}
                          onChange={(e) => setNewExpenseData({ ...newExpenseData, amountPaid: e.target.value })}
                          className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getLocalizedText(locale, 'payment_due_date')}
                    </label>
                    <input
                      type="date"
                      value={newExpenseData.paymentDueDate}
                      onChange={(e) => setNewExpenseData({ ...newExpenseData, paymentDueDate: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getLocalizedText(locale, 'payment_status')}
                    </label>
                    <select
                      value={newExpenseData.paymentStatus}
                      onChange={(e) => setNewExpenseData({ ...newExpenseData, paymentStatus: e.target.value as PaymentStatus })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors bg-white"
                    >
                      <option value="paid" className="text-green-600">✓ {getLocalizedText(locale, 'paid')}</option>
                      <option value="due" className="text-orange-600">⏰ {getLocalizedText(locale, 'due')}</option>
                      <option value="overdue" className="text-red-600">⚠ {getLocalizedText(locale, 'overdue')}</option>
                    </select>
                  </div>
                </div>
                
                {/* Notes */}
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-gray-700">
                    {getLocalizedText(locale, 'notes')}
                  </label>
                  <textarea
                    value={newExpenseData.notes}
                    onChange={(e) => setNewExpenseData({ ...newExpenseData, notes: e.target.value })}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors resize-none"
                    placeholder="Add any additional notes about this expense..."
                    rows={4}
                  />
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="bg-gray-50 rounded-b-xl px-6 py-4">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowAddExpense(false);
                    setSelectedCategoryId('');
                    setNewExpenseData({
                      vendorName: '',
                      quotedPrice: '',
                      amountPaid: '',
                      paymentDueDate: '',
                      paymentStatus: 'due',
                      notes: '',
                      event: ''
                    });
                  }}
                  className="px-6 py-3 text-gray-600 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 font-semibold"
                >
                  {getLocalizedText(locale, 'cancel')}
                </button>
                <button
                  onClick={handleAddExpense}
                  disabled={false}
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {getLocalizedText(locale, 'add')}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}