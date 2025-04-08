'use client';

import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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