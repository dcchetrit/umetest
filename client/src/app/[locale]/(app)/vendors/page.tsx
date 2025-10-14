import VendorsClient from './VendorsClient';

export default async function VendorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <VendorsClient locale={locale} />;
}