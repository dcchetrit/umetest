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
      total_funds: 'Total Available Funds',
      remaining_unallocated: 'Remaining Unallocated',
      total_allocated: 'Total Allocated',
      total_spent: 'Total Spent',
      remaining_after_spending: 'Remaining After Spending',
      over_budget: 'Over Budget'
    },
    fr: {
      total_funds: 'Fonds totaux disponibles',
      remaining_unallocated: 'Restant non alloué',
      total_allocated: 'Total alloué',
      total_spent: 'Total dépensé',
      remaining_after_spending: 'Restant après dépenses',
      over_budget: 'Dépassement de budget'
    },
    es: {
      total_funds: 'Fondos totales disponibles',
      remaining_unallocated: 'Restante no asignado',
      total_allocated: 'Total asignado',
      total_spent: 'Total gastado',
      remaining_after_spending: 'Restante después de gastos',
      over_budget: 'Sobre presupuesto'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default function BudgetHeader({ locale, summary, title, subtitle }: BudgetHeaderProps) {
  return (
    <>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
          <p className="text-gray-600">{subtitle}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-blue-600">
            ${summary.totalFunds.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">
            {getLocalizedText(locale, 'total_funds')}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-2xl font-bold text-purple-600">
            ${summary.totalAllocated.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">
            {getLocalizedText(locale, 'total_allocated')}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className={`text-2xl font-bold ${
            summary.remainingUnallocated >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            ${Math.abs(summary.remainingUnallocated).toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">
            {summary.remainingUnallocated >= 0 
              ? getLocalizedText(locale, 'remaining_unallocated')
              : getLocalizedText(locale, 'over_budget')
            }
          </div>
        </div>
      </div>
    </>
  );
}