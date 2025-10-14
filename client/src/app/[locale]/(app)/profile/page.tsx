import ProfileClient from './ProfileClient';

export default async function ProfilePage({ 
  params 
}: { 
  params: Promise<{ locale: string }> 
}) {
  const { locale } = await params;
  
  return <ProfileClient locale={locale} />;
}