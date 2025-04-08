'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Filter, Share2, Trash2, Eye, Check, CheckCheck, AlertCircle, MoreVertical, FileDown } from 'lucide-react';
import { invoiceServices, Invoice as ServiceInvoice } from '@/lib/firebase/services/invoiceServices';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Timestamp } from 'firebase/firestore';
import '@emran-alhaddad/saudi-riyal-font/index.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type FilterStatus = 'all' | ServiceInvoice['status'];

interface Invoice extends Omit<ServiceInvoice, 'createdAt' | 'id'> {
  id: string;
  createdAt: Timestamp;
}

const statusStyles = {
  unpaid: 'bg-orange-100 text-orange-800',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
};

const statusLabels = {
  unpaid: 'غير مدفوعة',
  partially_paid: 'مدفوعة جزئيا',
  paid: 'مدفوعة',
};

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      const fetchInvoices = async () => {
        try {
          setLoading(true);
          setError(null);
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
          
          setInvoices(processedInvoices);
        } catch (error) {
          console.error('Error fetching invoices:', error);
          setError('حدث خطأ أثناء جلب الفواتير. يرجى المحاولة مرة أخرى.');
        } finally {
          setLoading(false);
        }
      };

      fetchInvoices();
    });

    return () => unsubscribe();
  }, [router]);

  const filteredInvoices = invoices.filter((invoice) => {
    const matchesSearch = 
      invoice.clientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (invoice.clientPhone && invoice.clientPhone.toLowerCase().includes(searchTerm.toLowerCase())) || 
      (invoice.clientEmail && invoice.clientEmail.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleShareInvoice = async (invoice: Invoice) => {
    const shareUrl = `${window.location.origin}/invoices/${invoice.id}/share`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `فاتورة ${invoice.invoiceNumber}`,
          text: `فاتورة من ${invoice.businessName} بقيمة ${invoice.total.toLocaleString()} ريال`,
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
    if (!confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;
    
    try {
      await invoiceServices.deleteInvoice(id);
      setInvoices(prev => prev.filter(inv => inv.id !== id));
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

  const handleDownloadPdf = async (invoiceId: string) => {
    try {
      // نقل المستخدم إلى صفحة مشاركة الفاتورة مع إضافة معلمة تحميل PDF
      router.push(`/invoices/${invoiceId}/share?download=true`);
    } catch (error) {
      console.error('Error downloading invoice as PDF:', error);
      alert('حدث خطأ أثناء تحميل الفاتورة كملف PDF');
    }
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-center">
          {error}
          <Button 
            variant="outline" 
            className="mt-2"
            onClick={() => window.location.reload()}
          >
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 pt-6">
        <h1 className="text-3xl font-bold">الفواتير</h1>
        <Link href="/invoices/create" className="w-full sm:w-auto">
          <Button className="flex items-center gap-2 bg-black hover:bg-black/90 text-white w-full justify-center">
            <Plus className="w-4 h-4" />
            فاتورة جديدة
          </Button>
        </Link>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>تصفية الفواتير</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="البحث عن فاتورة أو عميل..."
                  className="w-full pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                يمكنك البحث باسم العميل أو رقم الفاتورة أو جوال العميل أو بريده الإلكتروني
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                className="border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as FilterStatus)}
              >
                <option value="all">جميع الحالات</option>
                <option value="unpaid">غير مدفوعة</option>
                <option value="partially_paid">مدفوعة جزئيا</option>
                <option value="paid">مدفوعة</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">رقم الفاتورة</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">العميل</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">المبلغ</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">الحالة</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">التاريخ</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm">#{invoice.invoiceNumber}</td>
                    <td className="px-6 py-4 text-sm">{invoice.clientName}</td>
                    <td className="px-6 py-4 text-sm flex items-center gap-1">
                      {invoice.total.toLocaleString()}
                      <span style={{ fontFamily: 'saudi_riyal' }}>&#xE900;</span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${statusStyles[invoice.status]}`}>
                          {statusLabels[invoice.status]}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {new Date(invoice.createdAt.seconds * 1000).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        {/* قائمة الإجراءات */}
                        <div className="relative">
                          {showStatusMenu === `action_${invoice.id}` && (
                            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 transition-all duration-200" onClick={() => setShowStatusMenu(null)}>
                              <div 
                                className="absolute bg-white border shadow-xl rounded-md z-50 w-48 max-h-[80vh] overflow-y-auto transition-all duration-200 animate-in fade-in"
                                style={{
                                  position: 'fixed',
                                  top: windowWidth <= 768 
                                    ? "50%" // Center vertically on small screens
                                    : (document.getElementById(`btn_${invoice.id}`)?.getBoundingClientRect().bottom || 0) + 5,
                                  left: windowWidth <= 768 
                                    ? "50%" // Center horizontally on small screens
                                    : (document.getElementById(`btn_${invoice.id}`)?.getBoundingClientRect().left || 0) + 100,
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
                                      router.push(`/invoices/${invoice.id}/share`);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                    عرض الفاتورة
                                  </button>
                                  <button 
                                    className="px-3 py-2 text-right text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors"
                                    onClick={() => {
                                      setShowStatusMenu(null);
                                      handleShareInvoice(invoice);
                                    }}
                                  >
                                    <Share2 className="h-4 w-4" />
                                    مشاركة الفاتورة
                                  </button>
                                  <button 
                                    className="px-3 py-2 text-right text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors"
                                    onClick={() => {
                                      setShowStatusMenu(null);
                                      handleDownloadPdf(invoice.id);
                                    }}
                                  >
                                    <FileDown className="h-4 w-4" />
                                    تحميل الفاتورة PDF
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

                          <Button 
                            id={`btn_${invoice.id}`}
                            variant="outline" 
                            size="sm"
                            onClick={() => setShowStatusMenu(showStatusMenu === `action_${invoice.id}` ? null : `action_${invoice.id}`)}
                            className="bg-black hover:bg-black/90 text-white border-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      لا توجد فواتير مطابقة للبحث
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