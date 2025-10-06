import BudgetClient from './BudgetClient';

export default async function BudgetPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <BudgetClient locale={locale} />;
}