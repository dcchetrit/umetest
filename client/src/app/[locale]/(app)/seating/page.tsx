import SeatingClient from './SeatingClient';

export default async function SeatingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <SeatingClient locale={locale} />;
}