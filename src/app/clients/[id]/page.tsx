'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Edit, FileText, Plus, User } from 'lucide-react';
import { customerServices, Customer } from '@/lib/firebase/services/customerServices';
import { invoiceServices, Invoice } from '@/lib/firebase/services/invoiceServices';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Timestamp } from 'firebase/firestore';
import { LoadingIndicator } from '@/components/LoadingIndicator';

export default function CustomerDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refreshKey = searchParams.get('refresh');
  const customerId = params.id;
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // المستخدم غير مصرح له - توجيه إلى صفحة تسجيل الدخول
        router.push('/auth/login');
        return;
      }

      const fetchData = async () => {
        try {
          setLoading(true);
          
          // جلب بيانات العميل
          const customerData = await customerServices.getCustomerById(customerId);
          if (!customerData) {
            throw new Error('لم يتم العثور على العميل');
          }
          
          // التحقق من أن العميل ينتمي إلى المستخدم الحالي
          if (customerData.userId !== user.uid) {
            throw new Error('ليس لديك صلاحية لعرض هذا العميل');
          }
          
          // جلب الفواتير المرتبطة بالعميل
          try {
            // تحديث رمز المصادقة
            await user.getIdToken(true);
            
            const allInvoices = await invoiceServices.getAllInvoices();
            console.log('Fetched invoices:', allInvoices.length);
            
            // تصفية الفواتير للعميل الحالي (بواسطة id أو الاسم)
            const customerInvoices = allInvoices.filter(inv => {
              // تأكد من أن customerId يتطابق (إذا كان موجوداً) أو الاسم يتطابق
              const matchesById = inv.customerId === customerId;
              const matchesByName = inv.clientName === customerData.fullName;
              console.log(`Invoice ${inv.invoiceNumber} - By ID: ${matchesById}, By Name: ${matchesByName}`);
              return matchesById || matchesByName;
            });
            
            console.log('Filtered invoices for customer:', customerInvoices.length);
            
            // ترتيب الفواتير حسب التاريخ (الأحدث أولاً)
            const sortedInvoices = customerInvoices.sort((a, b) => {
              const dateA = a.createdAt instanceof Timestamp 
                ? a.createdAt.toMillis() 
                : new Date(a.createdAt).getTime();
              const dateB = b.createdAt instanceof Timestamp 
                ? b.createdAt.toMillis() 
                : new Date(b.createdAt).getTime();
              return dateB - dateA;
            });
            
            if (isMounted) {
              setInvoices(sortedInvoices);
            }
          } catch (invoiceError) {
            console.error('Error fetching invoices:', invoiceError);
            if (isMounted) {
              setInvoices([]);
              console.error('Failed to load invoices for customer');
            }
          }
          
          if (isMounted) {
            setCustomer(customerData);
            setError(null);
          }
          
        } catch (err) {
          console.error('Error fetching customer details:', err);
          if (isMounted) {
            setError(err instanceof Error ? err.message : 'حدث خطأ أثناء جلب بيانات العميل');
          }
        } finally {
          if (isMounted) {
            setLoading(false);
          }
        }
      };

      fetchData();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [customerId, router, refreshKey]);

  const handleEditCustomer = () => {
    router.push(`/clients/${customerId}/edit`);
  };

  const handleBack = () => {
    router.push('/clients');
  };

  const handleViewInvoice = (invoiceId: string) => {
    router.push(`/invoices/${invoiceId}/share`);
  };

  const handleCreateInvoice = () => {
    router.push(`/invoices/create?customerId=${customerId}`);
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  if (error || !customer) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-center">
          {error || 'لم يتم العثور على بيانات العميل'}
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={handleBack}
          >
            العودة إلى قائمة العملاء
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* رأس الصفحة */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 pt-6">
        <div className="flex items-center">
          <Button
            variant="ghost"
            onClick={handleBack}
            className="hover:bg-gray-100 -mr-3"
          >
            <ArrowRight className="h-5 w-5 ml-2" />
            رجوع
          </Button>
          <h1 className="text-3xl font-bold mr-2">بيانات العميل</h1>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleEditCustomer}
            className="flex items-center gap-2 bg-black hover:bg-black/90 text-white"
          >
            <Edit className="w-4 h-4" />
            تعديل البيانات
          </Button>
          <Button 
            onClick={handleCreateInvoice}
            className="flex items-center gap-2 bg-black hover:bg-black/90 text-white"
          >
            <Plus className="w-4 h-4" />
            إنشاء فاتورة جديدة
          </Button>
        </div>
      </div>

      {/* بطاقة بيانات العميل */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            معلومات العميل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm text-gray-500">الاسم الكامل</p>
              <p className="font-medium">{customer.fullName}</p>
            </div>
            {customer.email && (
              <div>
                <p className="text-sm text-gray-500">البريد الإلكتروني</p>
                <p className="font-medium">{customer.email}</p>
              </div>
            )}
            {customer.phone && (
              <div>
                <p className="text-sm text-gray-500">رقم الجوال</p>
                <p className="font-medium">{customer.phone}</p>
              </div>
            )}
            {customer.company && (
              <div>
                <p className="text-sm text-gray-500">الشركة</p>
                <p className="font-medium">{customer.company}</p>
              </div>
            )}
            {customer.address && (
              <div>
                <p className="text-sm text-gray-500">العنوان</p>
                <p className="font-medium">{customer.address}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">تاريخ الإضافة</p>
              <p className="font-medium">
                {format(
                  customer.createdAt instanceof Timestamp 
                    ? customer.createdAt.toDate() 
                    : new Date(customer.createdAt), 
                  'yyyy/MM/dd', 
                  { locale: ar }
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* قائمة الفواتير */}
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            فواتير العميل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">رقم الفاتورة</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">المبلغ</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">الحالة</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">التاريخ</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoices.length > 0 ? (
                  invoices.map((invoice, index) => (
                    <tr key={invoice.id?.toString() || index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{invoice.invoiceNumber}</td>
                      <td className="px-6 py-4 text-sm">{invoice.total.toLocaleString()} ريال</td>
                      <td className="px-6 py-4 text-sm">
                        <span 
                          className={`px-2 py-1 rounded-full text-xs ${
                            invoice.status === 'paid' 
                              ? 'bg-green-100 text-green-800' 
                              : invoice.status === 'unpaid' 
                                ? 'bg-orange-100 text-orange-800' 
                                : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {invoice.status === 'paid' ? 'مدفوعة' : 
                           invoice.status === 'unpaid' ? 'معلقة' : 'غير مكتملة'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {format(
                          invoice.createdAt instanceof Timestamp 
                            ? invoice.createdAt.toDate() 
                            : new Date(invoice.createdAt), 
                          'yyyy/MM/dd', 
                          { locale: ar }
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => invoice.id && handleViewInvoice(invoice.id)}
                          className="bg-black hover:bg-black/90 text-white border-0"
                        >
                          عرض
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      لا توجد فواتير لهذا العميل. قم بإنشاء فاتورة جديدة.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 