import React from 'react';
import { BudgetSummary } from '@/types/budget';

interface BudgetHeaderProps {
  locale: string;
  summary: BudgetSummary;
  title: string;
  subtitle: string;
}

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      estimated_budget: 'Estimated Budget',
      total_spent: 'Total Spent',
      total_available_funds: 'Total Available Funds',
      remaining_unallocated: 'Remaining Unallocated'
    },
    fr: {
      estimated_budget: 'Budget estimé',
      total_spent: 'Total dépensé',
      total_available_funds: 'Fonds totaux disponibles',
      remaining_unallocated: 'Restant non alloué'
    },
    es: {
      estimated_budget: 'Presupuesto estimado',
      total_spent: 'Total gastado',
      total_available_funds: 'Fondos totales disponibles',
      remaining_unallocated: 'Restante no asignado'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default function BudgetHeader({ locale, summary, title, subtitle }: BudgetHeaderProps) {
  // Calculate Remaining Unallocated as: Available Funds - Total Spent
  const remainingUnallocated = summary.totalFunds - summary.totalSpent;

  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600">{subtitle}</p>
        </div>
      </div>

      {/* Budget Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">
            ${summary.totalAllocated.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">
            {getLocalizedText(locale, 'estimated_budget')}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Sum of payments
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-red-600">
            ${summary.totalSpent.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">
            {getLocalizedText(locale, 'total_spent')}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Payments made
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-green-600">
            ${summary.totalFunds.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">
            {getLocalizedText(locale, 'total_available_funds')}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Sum of funding sources
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className={`text-2xl font-bold ${
            remainingUnallocated >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            ${Math.abs(remainingUnallocated).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">
            {getLocalizedText(locale, 'remaining_unallocated')}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Available funds - Total spent
          </div>
        </div>
      </div>
    </>
  );
}