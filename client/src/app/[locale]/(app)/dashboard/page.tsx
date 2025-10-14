import DashboardClient from './DashboardClient';

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <DashboardClient locale={locale} />;
}