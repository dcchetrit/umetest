import SignupForm from './SignupForm';

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  
  return <SignupForm locale={locale} />;
}