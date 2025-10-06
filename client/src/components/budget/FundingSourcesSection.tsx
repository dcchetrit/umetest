import React, { useState } from 'react';
import { FundingSource } from '@/types/budget';

interface FundingSourcesSectionProps {
  locale: string;
  fundingSources: FundingSource[];
  onAddFundingSource: (description: string, amount: number) => void;
  onUpdateFundingSource: (id: string, description: string, amount: number) => void;
  onDeleteFundingSource: (id: string) => void;
}

function getLocalizedText(locale: string, key: string): string {
  const translations: Record<string, Record<string, string>> = {
    en: {
      funding_sources: 'Funding Sources',
      add_funding_source: 'Add Funding Source',
      description: 'Description',
      amount: 'Amount',
      total: 'Total',
      save: 'Save',
      cancel: 'Cancel',
      edit: 'Edit',
      delete: 'Delete',
      placeholder_description: 'e.g., Charles\'s savings, Emily\'s parents',
      placeholder_amount: '0.00'
    },
    fr: {
      funding_sources: 'Sources de financement',
      add_funding_source: 'Ajouter une source de financement',
      description: 'Description',
      amount: 'Montant',
      total: 'Total',
      save: 'Sauvegarder',
      cancel: 'Annuler',
      edit: 'Modifier',
      delete: 'Supprimer',
      placeholder_description: 'ex: épargne de Charles, parents d\'Emily',
      placeholder_amount: '0,00'
    },
    es: {
      funding_sources: 'Fuentes de financiamiento',
      add_funding_source: 'Agregar fuente de financiamiento',
      description: 'Descripción',
      amount: 'Cantidad',
      total: 'Total',
      save: 'Guardar',
      cancel: 'Cancelar',
      edit: 'Editar',
      delete: 'Eliminar',
      placeholder_description: 'ej: ahorros de Carlos, padres de Emily',
      placeholder_amount: '0,00'
    }
  };
  
  return translations[locale]?.[key] || translations.en[key] || key;
}

export default function FundingSourcesSection({
  locale,
  fundingSources,
  onAddFundingSource,
  onUpdateFundingSource,
  onDeleteFundingSource
}: FundingSourcesSectionProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ description: '', amount: '' });

  const totalFunds = fundingSources.reduce((sum, source) => sum + source.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.description || !formData.amount) return;

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) return;

    if (editingId) {
      onUpdateFundingSource(editingId, formData.description, amount);
      setEditingId(null);
    } else {
      onAddFundingSource(formData.description, amount);
      setShowAddForm(false);
    }

    setFormData({ description: '', amount: '' });
  };

  const handleEdit = (source: FundingSource) => {
    setEditingId(source.id);
    setFormData({ description: source.description, amount: source.amount.toString() });
    setShowAddForm(false);
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingId(null);
    setFormData({ description: '', amount: '' });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          {getLocalizedText(locale, 'funding_sources')}
        </h3>
        <button
          onClick={() => {
            setShowAddForm(true);
            setEditingId(null);
            setFormData({ description: '', amount: '' });
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
        >
          {getLocalizedText(locale, 'add_funding_source')}
        </button>
      </div>

      <div className="space-y-3">
        {fundingSources.map((source) => (
          <div
            key={source.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            {editingId === source.id ? (
              <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-3">
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={getLocalizedText(locale, 'placeholder_description')}
                  className="flex-1 px-3 py-1 border border-gray-300 rounded"
                  required
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder={getLocalizedText(locale, 'placeholder_amount')}
                  className="w-32 px-3 py-1 border border-gray-300 rounded"
                  required
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                  >
                    {getLocalizedText(locale, 'save')}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="bg-gray-500 text-white px-3 py-1 rounded text-sm hover:bg-gray-600"
                  >
                    {getLocalizedText(locale, 'cancel')}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex-1">
                  <span className="font-medium">{source.description}</span>
                  <span className="ml-4 text-lg font-bold text-green-600">
                    ${source.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(source)}
                    className="text-blue-600 hover:text-blue-800 text-sm px-2"
                  >
                    {getLocalizedText(locale, 'edit')}
                  </button>
                  <button
                    onClick={() => onDeleteFundingSource(source.id)}
                    className="text-red-600 hover:text-red-800 text-sm px-2"
                  >
                    {getLocalizedText(locale, 'delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {showAddForm && (
          <form onSubmit={handleSubmit} className="p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder={getLocalizedText(locale, 'placeholder_description')}
                className="flex-1 px-3 py-2 border border-gray-300 rounded"
                required
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder={getLocalizedText(locale, 'placeholder_amount')}
                className="w-32 px-3 py-2 border border-gray-300 rounded"
                required
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                >
                  {getLocalizedText(locale, 'save')}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  {getLocalizedText(locale, 'cancel')}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="flex justify-between items-center pt-3 border-t border-gray-200">
          <span className="text-lg font-medium">{getLocalizedText(locale, 'total')}:</span>
          <span className="text-xl font-bold text-blue-600">
            ${totalFunds.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}