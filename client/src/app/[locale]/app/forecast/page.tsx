import ForecastClient from './ForecastClient';

export default async function ForecastPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <ForecastClient locale={locale} />;
}