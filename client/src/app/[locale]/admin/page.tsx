import AdminPanel from './AdminPanel';

export default async function AdminPage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const { locale } = await params;

  return <AdminPanel locale={locale} />;
}