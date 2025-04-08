export const metadata = {
  title: 'مشاركة الفاتورة',
  description: 'عرض تفاصيل الفاتورة',
};

export default function ShareLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
} 