import RSVPClient from './RSVPClient';

export default async function RSVPPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <RSVPClient locale={locale} />;
}