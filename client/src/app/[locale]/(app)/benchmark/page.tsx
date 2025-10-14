import BenchmarkClient from './BenchmarkClient';

export default async function BenchmarkPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  return <BenchmarkClient locale={locale} />;
}