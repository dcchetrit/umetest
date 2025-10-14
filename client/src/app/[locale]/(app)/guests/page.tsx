import GuestsClient from './GuestsClient';

export default async function GuestsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <GuestsClient locale={locale} />;
}