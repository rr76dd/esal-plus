'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { invoiceServices, Invoice as ServiceInvoice } from '@/lib/firebase/services/invoiceServices';
import { customerServices } from '@/lib/firebase/services/customerServices';
import { Timestamp } from 'firebase/firestore';
import { Eye, Share2, Trash2, FileText, Users, Clock, Plus, Check, CheckCheck, AlertCircle, MoreVertical, X } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { User } from 'firebase/auth';
import '@emran-alhaddad/saudi-riyal-font/index.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';

interface Invoice extends Omit<ServiceInvoice, 'createdAt' | 'id'> {
  id: string;
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

// إضافة مكون مخصص لأيقونة الريال السعودي
const SaudiRiyal = () => (
  <div className="flex justify-center items-center h-5 w-5">
    <span style={{ fontFamily: 'saudi_riyal', fontSize: '18px', lineHeight: '18px', color: 'black' }}>&#xE900;</span>
  </div>
);

export default function DashboardPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [showPendingInvoices, setShowPendingInvoices] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
      if (!user && isMounted) {
        // المستخدم غير مصرح له - توجيه إلى صفحة تسجيل الدخول
        window.location.replace('/auth/login');
        return;
      }
      
      if (!user || !isMounted) return;

      const fetchData = async () => {
        try {
          // جلب الفواتير
          const fetchedInvoices = await invoiceServices.getAllInvoices();
          // Convert Date to Timestamp and ensure ID exists
          const processedInvoices = fetchedInvoices
            .filter((invoice): invoice is ServiceInvoice & { id: string } => invoice.id !== undefined)
            .map(invoice => ({
              ...invoice,
              createdAt: invoice.createdAt instanceof Timestamp 
                ? invoice.createdAt 
                : Timestamp.fromDate(new Date(invoice.createdAt))
            })) as Invoice[];
          
          // Sort invoices by date in descending order
          const sortedInvoices = processedInvoices.sort((a, b) => 
            b.createdAt.seconds - a.createdAt.seconds
          );
          
          // جلب العملاء
          const customers = await customerServices.getAllCustomers();
          
          if (isMounted) {
            setInvoices(sortedInvoices);
            setCustomerCount(customers.length);
            setError(null);
            setLoading(false);
          }
        } catch (err) {
          console.error('Error fetching data:', err);
          if (isMounted) {
            setError('حدث خطأ أثناء تحميل البيانات');
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
  }, []);

  // Calculate statistics
  const totalInvoices = invoices.length;
  const totalRevenue = invoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const pendingInvoices = invoices.filter(invoice => invoice.status === 'unpaid').length;
  const pendingInvoicesList = invoices.filter(invoice => invoice.status === 'unpaid');

  // Get last 5 invoices
  const recentInvoices = invoices.slice(0, 5);

  const handleViewInvoice = (id: string) => {
    router.push(`/invoices/${id}/share`);
  };

  const handleShareInvoice = async (id: string) => {
    const shareUrl = `${window.location.origin}/invoices/${id}/share`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'مشاركة الفاتورة',
          text: 'شاهد تفاصيل الفاتورة',
          url: shareUrl
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert('تم نسخ رابط الفاتورة');
      } catch (error) {
        console.error('Error copying to clipboard:', error);
        alert('حدث خطأ أثناء نسخ الرابط');
      }
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) {
      return;
    }

    try {
      await invoiceServices.deleteInvoice(id);
      setInvoices(prev => prev.filter(invoice => invoice.id !== id));
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('حدث خطأ أثناء حذف الفاتورة');
    }
  };

  const handleChangeStatus = async (invoiceId: string, newStatus: ServiceInvoice['status']) => {
    if (updating) return;
    
    try {
      setUpdating(invoiceId);
      await invoiceServices.updateInvoice(invoiceId, { status: newStatus });
      
      // تحديث حالة الفاتورة في القائمة المحلية
      setInvoices(prev => prev.map(invoice => 
        invoice.id === invoiceId ? { ...invoice, status: newStatus } : invoice
      ));
      
      // إخفاء قائمة تغيير الحالة
      setShowStatusMenu(null);
    } catch (error) {
      console.error('Error updating invoice status:', error);
      alert('حدث خطأ أثناء تحديث حالة الفاتورة');
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return (
      <div className="text-center text-red-600">{error}</div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 pt-6">
        <h1 className="text-3xl font-bold">لوحة التحكم</h1>
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Button 
            onClick={() => router.push('/clients/create')}
            className="flex items-center gap-2 bg-black hover:bg-black/90 text-white w-full justify-center"
          >
            <Users className="w-4 h-4" />
            إضافة عميل
          </Button>
          <Button 
            onClick={() => router.push('/invoices/create')}
            className="flex items-center gap-2 bg-black hover:bg-black/90 text-white w-full justify-center"
          >
            <Plus className="w-4 h-4" />
            إنشاء فاتورة
          </Button>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <FileText className="h-5 w-5 text-black" />
              إجمالي الفواتير
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalInvoices}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <SaudiRiyal />
              إجمالي الإيرادات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-1">
              {totalRevenue.toLocaleString()}
              <span style={{ fontFamily: 'saudi_riyal', fontSize: '20px' }}>&#xE900;</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Users className="h-5 w-5 text-black" />
              العملاء الحاليين
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customerCount}</div>
          </CardContent>
        </Card>

        <Card className="relative">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <Clock className="h-5 w-5 text-black" />
              الفواتير غير المدفوعة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div className="text-2xl font-bold">{pendingInvoices}</div>
              {pendingInvoices > 0 && (
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-xs bg-gray-100 hover:bg-gray-200"
                  onClick={() => setShowPendingInvoices(true)}
                >
                  عرض
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Invoices Modal */}
      {showPendingInvoices && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">الفواتير غير المدفوعة</h3>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0" 
                onClick={() => setShowPendingInvoices(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-auto max-h-[70vh] p-4">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">رقم الفاتورة</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">العميل</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">المبلغ</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">التاريخ</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingInvoicesList.map(invoice => (
                    <tr key={invoice.id}>
                      <td className="px-4 py-3">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-3">{invoice.clientName}</td>
                      <td className="px-4 py-3 flex items-center gap-1">
                        {invoice.total.toLocaleString()}
                        <span style={{ fontFamily: 'saudi_riyal', fontSize: '18px' }}>&#xE900;</span>
                      </td>
                      <td className="px-4 py-3">
                        {new Date(invoice.createdAt.seconds * 1000).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleViewInvoice(invoice.id)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-800"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleChangeStatus(invoice.id, 'partially_paid')}
                            className="bg-yellow-100 hover:bg-yellow-200 text-yellow-800"
                            disabled={updating === invoice.id}
                          >
                            {updating === invoice.id ? (
                              <div className="h-4 w-4 border-2 border-yellow-800 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Check className="h-4 w-4 mr-1" />
                                مدفوع جزئيا
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pendingInvoicesList.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  لا توجد فواتير معلقة
                </div>
              )}
            </div>
            <div className="p-4 border-t flex justify-end">
              <Button 
                onClick={() => setShowPendingInvoices(false)}
                className="bg-black hover:bg-black/90 text-white"
              >
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* آخر الفواتير */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>آخر الفواتير</CardTitle>
          <Button
            onClick={() => router.push('/invoices')}
            className="bg-black hover:bg-black/90 text-white"
          >
            عرض الكل
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">رقم الفاتورة</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">العميل</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">المبلغ</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">التاريخ</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentInvoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td className="px-4 py-3">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3">{invoice.clientName}</td>
                    <td className="px-4 py-3 flex items-center gap-1">
                      {invoice.total.toLocaleString()}
                      <span style={{ fontFamily: 'saudi_riyal', fontSize: '18px' }}>&#xE900;</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs ${statusStyles[invoice.status]}`}>
                        {statusLabels[invoice.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {new Date(invoice.createdAt.seconds * 1000).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {/* قائمة الإجراءات */}
                        <div className="relative">
                          <Button
                            id={`dash_btn_${invoice.id}`}
                            size="sm"
                            onClick={() => setShowStatusMenu(showStatusMenu === `action_${invoice.id}` ? null : `action_${invoice.id}`)}
                            className="bg-black hover:bg-black/90 text-white"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                          
                          {showStatusMenu === `action_${invoice.id}` && (
                            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 transition-all duration-200" onClick={() => setShowStatusMenu(null)}>
                              <div 
                                className="absolute bg-white border shadow-xl rounded-md z-50 w-48 max-h-[80vh] overflow-y-auto transition-all duration-200 animate-in fade-in"
                                style={{
                                  position: 'fixed',
                                  top: windowWidth <= 768 
                                    ? "50%" // Center vertically on small screens
                                    : (document.getElementById(`dash_btn_${invoice.id}`)?.getBoundingClientRect().bottom || 0) + 5,
                                  left: windowWidth <= 768 
                                    ? "50%" // Center horizontally on small screens
                                    : (document.getElementById(`dash_btn_${invoice.id}`)?.getBoundingClientRect().left || 0) + 100,
                                  transform: windowWidth <= 768 
                                    ? "translate(-50%, -50%)" // Center in both dimensions on small screens
                                    : "translateX(-100%)" // Position to the left of the button on large screens
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="p-2 flex flex-col">
                                  <button 
                                    className="px-3 py-2 text-right text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors"
                                    onClick={() => {
                                      setShowStatusMenu(null);
                                      handleViewInvoice(invoice.id);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                    عرض الفاتورة
                                  </button>
                                  <button 
                                    className="px-3 py-2 text-right text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors"
                                    onClick={() => {
                                      setShowStatusMenu(null);
                                      handleShareInvoice(invoice.id);
                                    }}
                                  >
                                    <Share2 className="h-4 w-4" />
                                    مشاركة الفاتورة
                                  </button>
                                  <div className="border-t my-1"></div>
                                  <div className="px-3 py-1 text-xs text-gray-500 select-none">تغيير الحالة إلى:</div>
                                  <button 
                                    className={`px-3 py-2 text-right text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors ${invoice.status === 'unpaid' ? 'bg-gray-100 font-medium' : ''}`}
                                    onClick={() => handleChangeStatus(invoice.id, 'unpaid')}
                                  >
                                    <AlertCircle className="h-4 w-4" />
                                    غير مدفوعة
                                  </button>
                                  <button 
                                    className={`px-3 py-2 text-right text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors ${invoice.status === 'partially_paid' ? 'bg-gray-100 font-medium' : ''}`}
                                    onClick={() => handleChangeStatus(invoice.id, 'partially_paid')}
                                  >
                                    <Check className="h-4 w-4" />
                                    مدفوعة جزئيا
                                  </button>
                                  <button 
                                    className={`px-3 py-2 text-right text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors ${invoice.status === 'paid' ? 'bg-gray-100 font-medium' : ''}`}
                                    onClick={() => handleChangeStatus(invoice.id, 'paid')}
                                  >
                                    <CheckCheck className="h-4 w-4" />
                                    مدفوعة
                                  </button>
                                  <div className="border-t my-1"></div>
                                  <button 
                                    className="px-3 py-2 text-right text-sm rounded-md hover:bg-red-50 flex items-center gap-2 w-full transition-colors text-red-600"
                                    onClick={() => {
                                      setShowStatusMenu(null);
                                      handleDeleteInvoice(invoice.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    حذف الفاتورة
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 