'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, LayoutDashboard, FileText, Settings, Users } from 'lucide-react';

const links = [
  {
    href: '/dashboard',
    label: 'لوحة التحكم',
    icon: LayoutDashboard
  },
  {
    href: '/invoices',
    label: 'الفواتير',
    icon: FileText
  },
  {
    href: '/clients',
    label: 'العملاء',
    icon: Users
  },
  {
    href: '/settings',
    label: 'الإعدادات',
    icon: Settings
  }
];

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return pathname === '/dashboard' || pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:right-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-l bg-white px-6 pb-4">
          <div className="flex h-24 shrink-0 items-center justify-center flex-col gap-2">
            <div className="relative w-16 h-16">
              <Image
                src="/logo/EsalPlusLogo.svg"
                alt="إيصال بلس"
                fill
                className="object-contain"
                priority
              />
            </div>
            <h1 className="text-2xl font-bold">إيصال بلس</h1>
          </div>
          <nav className="flex-1 space-y-1.5">
            {links.map(link => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive(link.href) ? 'bg-black text-white font-medium' : 'hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      {/* Mobile menu */}
      <div className="lg:hidden">
        <button
          type="button"
          className="fixed top-4 right-4 z-50 rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="sr-only">فتح القائمة</span>
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>

        {/* Mobile menu overlay */}
        {isOpen && (
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsOpen(false)} />
        )}

        {/* Mobile menu panel */}
        <div
          className={`fixed inset-y-0 right-0 z-40 w-full transform overflow-y-auto bg-white transition duration-300 ease-in-out ${
            isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex min-h-full flex-col pt-16 pb-6">
            <div className="flex items-center justify-center flex-col gap-2 mb-6">
              <div className="relative w-16 h-16">
                <Image
                  src="/logo/EsalPlusLogo.svg"
                  alt="إيصال بلس"
                  fill
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-2xl font-bold">إيصال بلس</h1>
            </div>
            <div className="w-full max-w-[320px] mx-auto">
              <nav className="space-y-4">
                {links.map(link => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`flex items-center justify-center gap-4 px-6 py-4 rounded-lg transition-colors text-center ${
                        isActive(link.href) ? 'bg-black text-white font-medium' : 'hover:bg-gray-100'
                      }`}
                      onClick={() => setIsOpen(false)}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-lg">{link.label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 