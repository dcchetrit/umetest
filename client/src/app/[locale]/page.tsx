'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    const handleRedirect = async () => {
      const { locale } = await params;
      
      if (!loading) {
        if (user) {
          // User is authenticated, redirect to dashboard
          router.push(`/${locale}/app/dashboard`);
        } else {
          // User is not authenticated, redirect to login
          router.push(`/${locale}/login`);
        }
      }
    };

    handleRedirect();
  }, [user, loading, router, params]);

  // Show loading spinner while determining authentication state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // This should not be visible as user will be redirected
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}