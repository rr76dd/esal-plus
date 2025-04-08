'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Sidebar } from '@/components/Sidebar';

export default function ClientsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/auth/login');
      }
    });
    
    return () => unsubscribe();
  }, [router]);

  return (
    <div>
      <Sidebar />
      <main className="min-h-screen bg-white lg:mr-72 pt-16 lg:pt-0">
        <div className="container mx-auto p-6 space-y-6">
          {children}
        </div>
      </main>
    </div>
  );
} 