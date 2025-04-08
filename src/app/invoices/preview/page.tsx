'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import '@emran-alhaddad/saudi-riyal-font/index.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type InvoicePreview = {
  businessName: string;
  phone: string;
  email: string;
  address?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  customerId?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  status: 'unpaid' | 'partially_paid' | 'paid';
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  total: number;
  notes?: string;
  paymentLink?: string;
  logo?: string;
};

export default function PreviewInvoicePage() {
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoicePreview | null>(null);

  useEffect(() => {
    const fetchInvoice = async () => {
      try {
        const savedInvoice = localStorage.getItem('previewInvoice');
        if (savedInvoice) {
          setInvoice(JSON.parse(savedInvoice));
        } else {
          throw new Error('Invoice not found in local storage');
        }
      } catch (error) {
        console.error('Error fetching invoice:', error);
        setInvoice(null);
        alert('حدث خطأ أثناء جلب بيانات الفاتورة. يرجى المحاولة مرة أخرى.');
        router.push('/invoices/create');
      }
    };

    fetchInvoice();
  }, [router]);

  if (!invoice) {
    return <LoadingIndicator />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 pt-6 sm:pt-4">
        <h1 className="text-3xl font-bold">معاينة الفاتورة</h1>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={() => router.push('/invoices/create')}
            className="w-1/2 sm:w-auto justify-center"
          >
            رجوع
          </Button>
          <Button 
            onClick={() => {
              navigator.clipboard.writeText(window.location.href);
              alert('تم نسخ رابط الفاتورة');
            }}
            className="bg-black hover:bg-black/90 text-white w-1/2 sm:w-auto justify-center"
          >
            نسخ الرابط
          </Button>
          <Button 
            onClick={() => router.push('/invoices')} 
            className="bg-black hover:bg-black/90 text-white w-1/2 sm:w-auto justify-center"
          >
            تحميل الفاتورة
          </Button>
        </div>
      </div>

      <Card className="p-6 space-y-8">
        {/* معلومات المرسل */}
        <div className="flex flex-col items-center mb-4">
          {invoice.logo && (
            <div className="flex justify-center mb-4">
              <img src={invoice.logo} alt="Business Logo" className="h-32 w-auto object-contain" />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <div>
              <p className="text-sm text-gray-500">اسم النشاط التجاري</p>
              <p className="font-medium">{invoice.businessName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">رقم الجوال</p>
              <p className="font-medium">{invoice.phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">البريد الإلكتروني</p>
              <p className="font-medium">{invoice.email}</p>
            </div>
            {invoice.address && (
              <div>
                <p className="text-sm text-gray-500">العنوان</p>
                <p className="font-medium">{invoice.address}</p>
              </div>
            )}
          </div>
        </div>

        {/* معلومات المستلم */}
        <div>
          <h2 className="text-xl font-semibold mb-4">معلومات المستلم</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">اسم العميل</p>
              <p className="font-medium">{invoice.clientName}</p>
            </div>
            {invoice.clientEmail && (
              <div>
                <p className="text-sm text-gray-500">البريد الإلكتروني</p>
                <p className="font-medium">{invoice.clientEmail}</p>
              </div>
            )}
            {invoice.clientPhone && (
              <div>
                <p className="text-sm text-gray-500">رقم الجوال</p>
                <p className="font-medium">{invoice.clientPhone}</p>
              </div>
            )}
            {invoice.clientAddress && (
              <div>
                <p className="text-sm text-gray-500">العنوان</p>
                <p className="font-medium">{invoice.clientAddress}</p>
              </div>
            )}
          </div>
        </div>

        {/* تفاصيل الفاتورة */}
        <div>
          <h2 className="text-xl font-semibold mb-4">تفاصيل الفاتورة</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">رقم الفاتورة</p>
              <p className="font-medium">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">تاريخ الإصدار</p>
              <p className="font-medium">
                {format(new Date(invoice.issueDate), 'yyyy/MM/dd', { locale: ar })}
              </p>
            </div>
            {invoice.dueDate && (
              <div>
                <p className="text-sm text-gray-500">تاريخ الاستحقاق</p>
                <p className="font-medium">
                  {format(new Date(invoice.dueDate), 'yyyy/MM/dd', { locale: ar })}
                </p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">الحالة</p>
              <p className="font-medium">
                {invoice.status === 'paid' ? 'مدفوعة' : 
                 invoice.status === 'unpaid' ? 'معلقة' : 'غير مكتملة'}
              </p>
            </div>
          </div>
        </div>

        {/* البنود */}
        <div>
          <h2 className="text-xl font-semibold mb-4">البنود</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-right">الوصف</th>
                  <th className="px-4 py-2 text-center">الكمية</th>
                  <th className="px-4 py-2 text-left">سعر الوحدة</th>
                  <th className="px-4 py-2 text-left">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="px-4 py-2 text-right">{item.description}</td>
                    <td className="px-4 py-2 text-center">{item.quantity}</td>
                    <td className="px-4 py-2 text-left whitespace-nowrap">
                      <span className="icon-saudi_riyal"></span>
                      {item.unitPrice.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-left whitespace-nowrap">
                      <span className="icon-saudi_riyal"></span>
                      {item.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-left font-medium">المجموع الفرعي:</td>
                  <td className="px-4 py-2 text-left whitespace-nowrap">
                    <span className="icon-saudi_riyal"></span>
                    {invoice.subtotal.toLocaleString()}
                  </td>
                </tr>
                {invoice.discount > 0 && (
                  <tr>
                    <td colSpan={2}></td>
                    <td className="px-4 py-2 text-left font-medium">
                      الخصم ({invoice.discountType === 'percentage' ? `${invoice.discount}%` : 'مبلغ ثابت'}):
                    </td>
                    <td className="px-4 py-2 text-left whitespace-nowrap">
                      <span className="icon-saudi_riyal"></span>
                      {invoice.discountType === 'percentage'
                        ? ((invoice.subtotal * invoice.discount) / 100).toLocaleString()
                        : invoice.discount.toLocaleString()}
                    </td>
                  </tr>
                )}
                <tr>
                  <td colSpan={2}></td>
                  <td className="px-4 py-2 text-left font-bold">المجموع النهائي:</td>
                  <td className="px-4 py-2 text-left whitespace-nowrap font-bold">
                    <span className="icon-saudi_riyal"></span>
                    {invoice.total.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ملاحظات */}
        {invoice.notes && (
          <div>
            <h2 className="text-xl font-semibold mb-4">ملاحظات</h2>
            <p className="whitespace-pre-wrap">{invoice.notes}</p>
          </div>
        )}
      </Card>
    </div>
  );
} 