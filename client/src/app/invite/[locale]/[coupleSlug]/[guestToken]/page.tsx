import PersonalizedInviteClient from './PersonalizedInviteClient';

export default async function PersonalizedInvitePage({ 
  params 
}: { 
  params: Promise<{ locale: string; coupleSlug: string; guestToken: string }> 
}) {
  const { locale, coupleSlug, guestToken: guestSlug } = await params;

  return (
    <PersonalizedInviteClient 
      locale={locale} 
      coupleSlug={coupleSlug} 
      guestSlug={guestSlug} 
    />
  );
}