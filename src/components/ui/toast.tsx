'use client';

import { Toaster } from 'sonner';

export function ToastNotification() {
  return <Toaster richColors position="top-center" />;
}

export { toast } from 'sonner'; 