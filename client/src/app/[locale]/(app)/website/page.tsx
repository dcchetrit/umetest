import WebsiteClient from './WebsiteClient';

export default async function WebsitePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <WebsiteClient locale={locale} />;
}