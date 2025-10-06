import { Suspense } from 'react';
import RSVPForm from '@/components/rsvp/RSVPForm';

interface RSVPFormPageProps {
  params: Promise<{
    coupleSlug: string;
  }>;
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function RSVPFormPage({ params, searchParams }: RSVPFormPageProps) {
  const { coupleSlug } = await params;
  const { token } = await searchParams;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        </div>
      }>
        <RSVPForm coupleSlug={coupleSlug} token={token} />
      </Suspense>
    </div>
  );
}