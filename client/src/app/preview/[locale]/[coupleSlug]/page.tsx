import PreviewClient from './PreviewClient';

export default async function PreviewPage({ 
  params 
}: { 
  params: Promise<{ locale: string; coupleSlug: string }> 
}) {
  const { locale, coupleSlug } = await params;

  return <PreviewClient locale={locale} coupleSlug={coupleSlug} />;
}