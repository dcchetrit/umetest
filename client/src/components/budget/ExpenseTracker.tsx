import React, { useState } from 'react';
import { ExpenseEntry, CategoryExpenseData, PaymentStatus } from '@/types/budget';

interface ExpenseTrackerProps {
  locale: string;
  categoryData: CategoryExpenseData;
  onAddExpense: (categoryId: string, expense: Omit<ExpenseEntry, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateExpense: (expenseId: string, expense: Partial<ExpenseEntry>) => void;
  onDeleteExpense: (expenseId: string) => void;
}

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      add_expense: 'Add Expense',
      vendor_name: 'Vendor / Item Name',
      quoted_price: 'Quoted Price',
      amount_paid: 'Amount Paid',
      payment_due_date: 'Payment Due Date',
      payment_status: 'Payment Status',
      notes: 'Notes',
      paid: 'Paid',
      due: 'Due',
      overdue: 'Overdue',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      total_forecasted: 'Total Forecasted',
      total_spent: 'Total Spent',
      remaining_budget: 'Remaining Budget',
      placeholder_vendor: 'e.g., Elegant Venues, John Doe Photography',
      placeholder_notes: 'Additional notes...'
    },
    fr: {
      add_expense: 'Ajouter une dépense',
      vendor_name: 'Nom du fournisseur / Article',
      quoted_price: 'Prix devisé',
      amount_paid: 'Montant payé',
      payment_due_date: 'Date d\'échéance',
      payment_status: 'Statut du paiement',
      notes: 'Notes',
      paid: 'Payé',
      due: 'Dû',
      overdue: 'En retard',
      save: 'Sauvegarder',
      cancel: 'Annuler',
      edit: 'Modifier',
      delete: 'Supprimer',
      total_forecasted: 'Total prévu',
      total_spent: 'Total dépensé',
      remaining_budget: 'Budget restant',
      placeholder_vendor: 'ex: Lieux Élégants, Photographie John Doe',
      placeholder_notes: 'Notes supplémentaires...'
    },
    es: {
      add_expense: 'Agregar gasto',
      vendor_name: 'Nombre del proveedor / Artículo',
      quoted_price: 'Precio cotizado',
      amount_paid: 'Cantidad pagada',
      payment_due_date: 'Fecha de vencimiento',
      payment_status: 'Estado del pago',
      notes: 'Notas',
      paid: 'Pagado',
      due: 'Pendiente',
      overdue: 'Vencido',
      save: 'Guardar',
      cancel: 'Cancelar',
      edit: 'Editar',
      delete: 'Eliminar',
      total_forecasted: 'Total pronosticado',
      total_spent: 'Total gastado',
      remaining_budget: 'Presupuesto restante',
      placeholder_vendor: 'ej: Lugares Elegantes, Fotografía John Doe',
      placeholder_notes: 'Notas adicionales...'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

function getStatusColor(status: PaymentStatus) {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'due':
    default:
      return 'bg-yellow-100 text-yellow-800';
  }
}

function getBudgetStatusColor(status: CategoryExpenseData['status']) {
  switch (status) {
    case 'under_budget':
      return 'text-green-600';
    case 'close_to_budget':
      return 'text-yellow-600';
    case 'over_budget':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

export default function ExpenseTracker({
  locale,
  categoryData,
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense
}: ExpenseTrackerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    vendorName: '',
    quotedPrice: '',
    amountPaid: '',
    paymentDueDate: '',
    paymentStatus: 'due' as PaymentStatus,
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.vendorName || !formData.quotedPrice) return;

    const quotedPrice = parseFloat(formData.quotedPrice) || 0;
    const amountPaid = parseFloat(formData.amountPaid) || 0;
    
    const expenseData = {
      vendorName: formData.vendorName,
      quotedPrice,
      amountPaid,
      paymentDueDate: formData.paymentDueDate ? new Date(formData.paymentDueDate) : undefined,
      paymentStatus: formData.paymentStatus,
      notes: formData.notes || undefined
    };

    if (editingId) {
      onUpdateExpense(editingId, {
        ...expenseData,
        updatedAt: new Date()
      });
      setEditingId(null);
    } else {
      onAddExpense(categoryData.categoryId, expenseData);
      setShowAddForm(false);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      vendorName: '',
      quotedPrice: '',
      amountPaid: '',
      paymentDueDate: '',
      paymentStatus: 'due',
      notes: ''
    });
  };

  const handleEdit = (expense: ExpenseEntry) => {
    setEditingId(expense.id);
    setFormData({
      vendorName: expense.vendorName,
      quotedPrice: expense.quotedPrice.toString(),
      amountPaid: expense.amountPaid.toString(),
      paymentDueDate: expense.paymentDueDate?.toISOString().split('T')[0] || '',
      paymentStatus: expense.paymentStatus,
      notes: expense.notes || ''
    });
    setShowAddForm(false);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
    resetForm();
  };

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{categoryData.categoryName}</h3>
            <div className="mt-1 flex gap-4 text-sm">
              <span>
                {getLocalizedText(locale, 'total_forecasted')}: 
                <span className="font-medium ml-1">${categoryData.plannedAmount.toLocaleString()}</span>
              </span>
              <span>
                {getLocalizedText(locale, 'total_spent')}: 
                <span className="font-medium ml-1">${categoryData.totalPaid.toLocaleString()}</span>
              </span>
              <span>
                {getLocalizedText(locale, 'remaining_budget')}: 
                <span className={`font-medium ml-1 ${getBudgetStatusColor(categoryData.status)}`}>
                  ${Math.abs(categoryData.remainingBudget).toLocaleString()}
                  {categoryData.isOverBudget && ' (Over)'}
                </span>
              </span>
            </div>
          </div>
          <button
            onClick={() => {
              setShowAddForm(true);
              setEditingId(null);
              resetForm();
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
          >
            {getLocalizedText(locale, 'add_expense')}
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Add/Edit Form */}
        {(showAddForm || editingId) && (
          <div className="mb-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-100 overflow-hidden">
            {/* Form Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
              <h4 className="text-lg font-bold text-white">
                {editingId ? 'Edit Expense' : getLocalizedText(locale, 'add_expense')}
              </h4>
              <p className="text-blue-100 text-sm mt-1">
                {editingId ? 'Update expense details' : 'Enter expense details for tracking and budget management'}
              </p>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                {/* Vendor and Payment Status Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getLocalizedText(locale, 'vendor_name')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.vendorName}
                      onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
                      placeholder={getLocalizedText(locale, 'placeholder_vendor')}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getLocalizedText(locale, 'payment_status')}
                    </label>
                    <select
                      value={formData.paymentStatus}
                      onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as PaymentStatus })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors bg-white"
                    >
                      <option value="due" className="text-orange-600">⏰ {getLocalizedText(locale, 'due')}</option>
                      <option value="paid" className="text-green-600">✓ {getLocalizedText(locale, 'paid')}</option>
                      <option value="overdue" className="text-red-600">⚠ {getLocalizedText(locale, 'overdue')}</option>
                    </select>
                  </div>
                </div>

                {/* Price Information Section */}
                <div className="bg-white rounded-lg p-4 border border-gray-200">
                  <h5 className="text-md font-semibold text-gray-800 mb-4">Price Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-gray-700">
                        {getLocalizedText(locale, 'quoted_price')} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-gray-500">$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.quotedPrice}
                          onChange={(e) => setFormData({ ...formData, quotedPrice: e.target.value })}
                          className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                          placeholder="0.00"
                          required
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
                          value={formData.amountPaid}
                          onChange={(e) => setFormData({ ...formData, amountPaid: e.target.value })}
                          className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Due Date and Notes */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getLocalizedText(locale, 'payment_due_date')}
                    </label>
                    <input
                      type="date"
                      value={formData.paymentDueDate}
                      onChange={(e) => setFormData({ ...formData, paymentDueDate: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-gray-700">
                      {getLocalizedText(locale, 'notes')}
                    </label>
                    <input
                      type="text"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder={getLocalizedText(locale, 'placeholder_notes')}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-3 text-gray-600 bg-white border-2 border-gray-200 rounded-lg hover:bg-gray-100 hover:border-gray-300 transition-all duration-200 font-semibold"
                >
                  {getLocalizedText(locale, 'cancel')}
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all duration-200 font-semibold shadow-lg"
                >
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {getLocalizedText(locale, 'save')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Expense List */}
        <div className="space-y-3">
          {categoryData.expenses.map((expense) => (
            <div
              key={expense.id}
              className="p-4 border border-gray-200 rounded-lg"
            >
              {editingId === expense.id ? (
                // Editing form is shown above
                null
              ) : (
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">{expense.vendorName}</h4>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(expense.paymentStatus)}`}>
                        {getLocalizedText(locale, expense.paymentStatus)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 mb-2">
                      <div>Quoted: <span className="font-medium">${expense.quotedPrice.toLocaleString()}</span></div>
                      <div>Paid: <span className="font-medium">${expense.amountPaid.toLocaleString()}</span></div>
                      {expense.paymentDueDate && (
                        <div>Due: <span className="font-medium">{new Date(expense.paymentDueDate).toLocaleDateString()}</span></div>
                      )}
                    </div>
                    
                    {expense.notes && (
                      <p className="text-sm text-gray-600 italic">{expense.notes}</p>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(expense)}
                      className="text-blue-600 hover:text-blue-800 text-sm px-2"
                    >
                      {getLocalizedText(locale, 'edit')}
                    </button>
                    <button
                      onClick={() => onDeleteExpense(expense.id)}
                      className="text-red-600 hover:text-red-800 text-sm px-2"
                    >
                      {getLocalizedText(locale, 'delete')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {categoryData.expenses.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No expenses added yet for this category
            </div>
          )}
        </div>
      </div>
    </div>
  );
}