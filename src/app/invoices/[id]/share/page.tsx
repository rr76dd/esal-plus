'use client';

import { use, useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { invoiceServices, Invoice as ServiceInvoice } from '@/lib/firebase/services/invoiceServices';
import '@emran-alhaddad/saudi-riyal-font/index.css';
import { Timestamp } from 'firebase/firestore';
import { Lock, FileDown } from 'lucide-react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { exportInvoiceToPdf } from '@/lib/pdfExport';

interface TimestampLike {
  seconds: number;
  nanoseconds: number;
}

function isTimestampLike(obj: unknown): obj is TimestampLike {
  return obj !== null && 
         typeof obj === 'object' && 
         'seconds' in obj && 
         typeof (obj as TimestampLike).seconds === 'number' &&
         'nanoseconds' in obj && 
         typeof (obj as TimestampLike).nanoseconds === 'number';
}

interface Invoice extends ServiceInvoice {
  createdAt: Timestamp;
}

const statusLabels = {
  unpaid: 'غير مدفوعة',
  partially_paid: 'مدفوعة جزئيا',
  paid: 'مدفوعة',
};

const statusStyles = {
  unpaid: 'bg-orange-100 text-orange-800',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
};

function formatDate(date: Date | Timestamp) {
  try {
    const finalDate = date instanceof Date ? date : date.toDate();
    return finalDate.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

export default function ShareInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const shouldDownload = searchParams.get('download') === 'true';

  // Function to download PDF
  const downloadPdf = async () => {
    if (!invoice || downloading) return;
    
    try {
      setDownloading(true);
      
      await exportInvoiceToPdf({
        invoice,
        onProgress: (message) => console.log(message),
        onError: (error) => {
          console.error('خطأ في إنشاء ملف PDF:', error);
          alert('حدث خطأ أثناء إنشاء ملف PDF');
          setDownloading(false);
        },
        onSuccess: () => {
          console.log('تم إنشاء ملف PDF بنجاح');
          setDownloading(false);
        }
      });
    } catch (error) {
      console.error('خطأ في إنشاء ملف PDF:', error);
      alert('حدث خطأ أثناء إنشاء ملف PDF');
      setDownloading(false);
    }
  };

  // Handle auto-download when requested via URL param
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (shouldDownload && invoice && !downloading) {
      // Small delay to ensure the page is fully rendered
      timer = setTimeout(() => {
        downloadPdf();
      }, 1000);
      
      return () => {
        clearTimeout(timer);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, shouldDownload]);

  useEffect(() => {
    const fetchInvoice = async () => {
      if (!id) {
        setError('معرف الفاتورة غير صحيح');
        setLoading(false);
        return;
      }

      try {
        const data = await invoiceServices.getInvoiceById(id);
        if (!data) {
          setError('الفاتورة غير موجودة');
          return;
        }
        
        // Convert Firestore Timestamp to Date if needed
        const processedData = {
          ...data,
          createdAt: data.createdAt instanceof Timestamp 
            ? data.createdAt 
            : isTimestampLike(data.createdAt)
              ? new Timestamp(data.createdAt.seconds, data.createdAt.nanoseconds)
              : Timestamp.fromDate(new Date(data.createdAt))
        };
        
        setInvoice(processedData as Invoice);
      } catch (error) {
        console.error('Error fetching invoice:', error);
        setError('حدث خطأ أثناء جلب بيانات الفاتورة');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto text-center py-12">
          جاري التحميل...
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-3xl mx-auto text-center py-12">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error || 'الفاتورة غير موجودة'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 pt-6 sm:pt-4">
          <h1 className="text-3xl font-bold">عرض الفاتورة</h1>
          <Button
            className="bg-black hover:bg-black text-white gap-2"
            onClick={downloadPdf}
            disabled={downloading}
          >
            <FileDown className="w-4 h-4" />
            {downloading ? 'جاري التحميل...' : 'تحميل PDF'}
          </Button>
        </div>

        <div ref={invoiceRef}>
          {/* رأس الفاتورة */}
          <Card className="mb-8">
            <CardHeader className="text-center border-b">
              <CardTitle className="text-3xl">فاتورة #{invoice.invoiceNumber}</CardTitle>
              <p className="text-gray-500 mt-2" suppressHydrationWarning>
                {formatDate(invoice.createdAt)}
              </p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium mt-2 ${statusStyles[invoice.status]}`}>
                {statusLabels[invoice.status]}
              </span>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col items-center mb-4">
                {invoice.logo && (
                  <div className="flex justify-center mb-4">
                    <img src={invoice.logo} alt="Business Logo" className="h-32 w-auto object-contain" />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                  <div>
                    <h3 className="font-semibold mb-3 text-gray-900">معلومات المرسل</h3>
                    <div className="space-y-2 text-gray-600">
                      <p>{invoice.businessName}</p>
                      <p>{invoice.phone}</p>
                      <p>{invoice.email}</p>
                      {invoice.address && <p>{invoice.address}</p>}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3 text-gray-900">معلومات المستلم</h3>
                    <div className="space-y-2 text-gray-600">
                      <p>{invoice.clientName}</p>
                      {invoice.clientPhone && <p>{invoice.clientPhone}</p>}
                      {invoice.clientEmail && <p>{invoice.clientEmail}</p>}
                      {invoice.clientAddress && <p>{invoice.clientAddress}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* تفاصيل البنود */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>تفاصيل البنود</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 text-right">
                    <tr>
                      <th className="px-6 py-3 text-sm font-medium text-gray-500">الوصف</th>
                      <th className="px-6 py-3 text-sm font-medium text-gray-500 text-center">الكمية</th>
                      <th className="px-6 py-3 text-sm font-medium text-gray-500 text-left">سعر الوحدة</th>
                      <th className="px-6 py-3 text-sm font-medium text-gray-500 text-left">المجموع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {invoice.items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 text-sm text-right">{item.description}</td>
                        <td className="px-6 py-4 text-sm text-center">{item.quantity}</td>
                        <td className="px-6 py-4 text-sm text-left">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            {item.unitPrice.toLocaleString()}
                            <span style={{ fontFamily: 'saudi_riyal' }}>&#xE900;</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-left">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            {item.total.toLocaleString()}
                            <span style={{ fontFamily: 'saudi_riyal' }}>&#xE900;</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* الحسابات */}
              <div className="mt-6 border-t pt-6">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">المجموع الفرعي:</span>
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      {invoice.subtotal.toLocaleString()}
                      <span style={{ fontFamily: 'saudi_riyal' }}>&#xE900;</span>
                    </div>
                  </div>
                  {invoice.discount > 0 && (
                    <div className="flex justify-between items-center text-red-600">
                      <span>الخصم {invoice.discountType === 'percentage' ? `(${invoice.discount}%)` : ''}:</span>
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        - {(invoice.discountType === 'percentage' 
                          ? (invoice.subtotal * invoice.discount / 100) 
                          : invoice.discount).toLocaleString()}
                        <span style={{ fontFamily: 'saudi_riyal' }}>&#xE900;</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between items-center font-bold text-lg pt-4 border-t">
                    <span>المجموع النهائي:</span>
                    <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                      {invoice.total.toLocaleString()}
                      <span style={{ fontFamily: 'saudi_riyal' }}>&#xE900;</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* الملاحظات */}
          {invoice.notes && (
            <div>
              <h2 className="text-xl font-semibold mb-4">ملاحظات</h2>
              <p className="whitespace-pre-wrap">{invoice.notes}</p>
            </div>
          )}
        </div>

        {/* زر الدفع */}
        {invoice.status !== 'paid' && invoice.paymentLink && (
          <a 
            href={invoice.paymentLink}
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block w-full mt-8"
          >
            <Button 
              className="bg-green-600 hover:bg-green-700 text-white gap-2 w-full justify-center"
            >
              <Lock className="w-4 h-4" />
              الدفع
            </Button>
            <div className="flex justify-center gap-4 mt-2">
              <Image src="/icons/visa.svg" alt="Visa" width={40} height={40} />
              <Image src="/icons/mastercard.svg" alt="MasterCard" width={40} height={40} />
              <Image src="/icons/mada.svg" alt="Mada" width={52} height={52} />
              <Image src="/icons/applepay.svg" alt="Apple Pay" width={40} height={40} />
            </div>
          </a>
        )}
      </div>
    </div>
  );
} 