'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { invoiceServices, Invoice as ServiceInvoice } from '@/lib/firebase/services/invoiceServices';
import { customerServices, Customer } from '@/lib/firebase/services/customerServices';
import { Timestamp } from 'firebase/firestore';
import { Eye, Share2, Trash2, Users, Plus, Check, CheckCheck, AlertCircle, MoreVertical, X, HelpCircle, ChevronDown, ChevronUp, Search, BarChart3, TrendingUp, ArrowUpRight, ArrowDownRight, Calendar, FileDown, FileText } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { User } from 'firebase/auth';
import '@emran-alhaddad/saudi-riyal-font/index.css';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import {
  ResponsiveContainer,
  BarChart as RBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart as RLineChart,
  Line
} from 'recharts';

interface Invoice extends Omit<ServiceInvoice, 'createdAt' | 'id'> {
  id: string;
  createdAt: Timestamp;
}

interface MonthlyDataItem {
  name: string;
  paid: number;
  partially: number;
  unpaid: number;
  total: number;
}

const statusLabels = {
  unpaid: 'غير مدفوعة',
  partially_paid: 'مدفوعة جزئيا',
  paid: 'مدفوعة',
};

const statusStyles = {
  unpaid: 'bg-red-50 text-red-700',
  partially_paid: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
};

// تحديد نطاق التاريخ بناءً على الفترة المختارة
const getDateRange = (months: number) => {
  const today = new Date();
  const startDate = new Date();
  
  if (months === 1) { // هذا الشهر
    startDate.setDate(1);
  } else if (months === 2) { // الشهر السابق
    startDate.setMonth(today.getMonth() - 1);
    startDate.setDate(1);
    // تعيين تاريخ النهاية إلى آخر يوم في الشهر السابق
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);
    endDate.setDate(0);
    return {
      startDate,
      endDate,
      formattedStartDate: startDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' }),
      formattedEndDate: endDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })
    };
  } else { // آخر X أشهر
    startDate.setMonth(today.getMonth() - (months - 1));
    startDate.setDate(1);
  }
  
  return {
    startDate,
    endDate: today,
    formattedStartDate: startDate.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' }),
    formattedEndDate: today.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })
  };
};

export default function DashboardPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [showPendingInvoices, setShowPendingInvoices] = useState(false);
  const [showQuickGuide, setShowQuickGuide] = useState(false);
  const [expandedGuideSection, setExpandedGuideSection] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{invoices: Invoice[], customers: Customer[]}>({invoices: [], customers: []});
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(1);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTimeRangeMenu, setShowTimeRangeMenu] = useState(false);
  
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      
      // إضافة CSS للطباعة
      const printStyles = document.createElement('style');
      printStyles.setAttribute('id', 'print-styles');
      printStyles.innerHTML = `
        @media print {
          body * {
            visibility: hidden;
          }
          .container, .container * {
            visibility: hidden;
          }
          .print-section, .print-section * {
            visibility: visible;
          }
          .print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-hide {
            display: none !important;
          }
        }
      `;
      document.head.appendChild(printStyles);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        const style = document.getElementById('print-styles');
        if (style) document.head.removeChild(style);
      };
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = auth.onAuthStateChanged((user: User | null) => {
      if (!user && isMounted) {
        window.location.replace('/auth/login');
        return;
      }
      
      if (!user || !isMounted) return;

      const fetchData = async () => {
        try {
          const fetchedInvoices = await invoiceServices.getAllInvoices();
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
          const fetchedCustomers = await customerServices.getAllCustomers();
          
          if (isMounted) {
            setInvoices(sortedInvoices);
            setCustomers(fetchedCustomers);
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
  const pendingInvoicesList = invoices.filter(invoice => invoice.status === 'unpaid');

  // تحليل البيانات حسب الحالة
  const paidInvoices = invoices.filter(invoice => invoice.status === 'paid');
  const partiallyPaidInvoices = invoices.filter(invoice => invoice.status === 'partially_paid');
  
  const paidRevenue = paidInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const partiallyPaidRevenue = partiallyPaidInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
  const pendingRevenue = pendingInvoicesList.reduce((sum, invoice) => sum + invoice.total, 0);

  // معدل التحصيل (نسبة الفواتير المدفوعة)
  const collectionRate = totalInvoices > 0 ? (paidInvoices.length / totalInvoices) * 100 : 0;
  
  // متوسط قيمة الفاتورة
  const averageInvoiceValue = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

  // تحليل الدخل الشهري
  const getMonthlyData = () => {
    const monthlyData: Record<string, MonthlyDataItem> = {};
    const today = new Date();
    
    // تحديد عدد الأشهر المطلوب عرضها بناءً على النطاق الزمني المختار
    const monthsToShow = selectedTimeRange;
    
    // إنشاء مصفوفة تحتوي على الأشهر الماضية حسب النطاق الزمني المختار
    for (let i = 0; i < monthsToShow; i++) {
      const date = new Date();
      date.setMonth(today.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      monthlyData[monthKey] = {
        name: new Date(date.getFullYear(), date.getMonth(), 1).toLocaleDateString('ar-SA', { month: 'long' }),
        paid: 0,
        partially: 0,
        unpaid: 0,
        total: 0
      };
    }
    
    // تحليل الفواتير وتصنيفها حسب الشهر والحالة
    invoices.forEach(invoice => {
      const date = new Date(invoice.createdAt.seconds * 1000);
      const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
      
      // تجاهل الفواتير التي تاريخها أقدم من النطاق الزمني المختار
      if (!monthlyData[monthKey]) return;
      
      monthlyData[monthKey].total += invoice.total;
      
      if (invoice.status === 'paid') {
        monthlyData[monthKey].paid += invoice.total;
      } else if (invoice.status === 'partially_paid') {
        monthlyData[monthKey].partially += invoice.total;
      } else {
        monthlyData[monthKey].unpaid += invoice.total;
      }
    });
    
    // تحويل البيانات إلى مصفوفة للمخطط البياني
    return Object.values(monthlyData).reverse();
  };

  // مقارنة للأشهر الحالية والشهر السابق
  const getCurrentMonthComparison = () => {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    
    // حساب إجمالي الدخل للشهر الحالي
    const currentMonthRevenue = invoices
      .filter(invoice => {
        const date = new Date(invoice.createdAt.seconds * 1000);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      })
      .reduce((sum, invoice) => sum + invoice.total, 0);
    
    // حساب إجمالي الدخل للشهر السابق
    const previousMonthRevenue = invoices
      .filter(invoice => {
        const date = new Date(invoice.createdAt.seconds * 1000);
        return date.getMonth() === previousMonth && date.getFullYear() === previousYear;
      })
      .reduce((sum, invoice) => sum + invoice.total, 0);
    
    // حساب نسبة التغيير
    const percentageChange = previousMonthRevenue !== 0 
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
      : currentMonthRevenue > 0 ? 100 : 0;
    
    return {
      currentMonthRevenue,
      previousMonthRevenue,
      percentageChange,
      isIncrease: percentageChange >= 0
    };
  };

  // بيانات المخططات
  const monthlyData = getMonthlyData();
  const monthComparison = getCurrentMonthComparison();

  // بيانات للرسم البياني الخطي
  const lineChartData = monthlyData.map(month => ({
    name: month.name,
    إجمالي: month.total,
    مدفوعة: month.paid,
    غير_مدفوعة: month.unpaid,
    مدفوعة_جزئيا: month.partially
  }));

  // إعادة تعيين مؤشر الشهر الحالي عند تغيير نطاق الوقت
  useEffect(() => {
    // إعادة تعيين المؤشر عند تغيير النطاق الزمني
    // لتجنب الخروج عن حدود المصفوفة إذا كان هناك عدد أقل من الأشهر
    if (currentMonthIndex >= monthlyData.length) {
      setCurrentMonthIndex(0);
    }
  }, [selectedTimeRange, monthlyData.length, currentMonthIndex]);

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

  // Add new function to handle search
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setShowSearchResults(false);
      return;
    }
    
    setIsSearching(true);
    
    try {
      // Search in invoices
      const filteredInvoices = invoices.filter(invoice => 
        invoice.invoiceNumber.toLowerCase().includes(query.toLowerCase()) ||
        invoice.clientName.toLowerCase().includes(query.toLowerCase()) ||
        invoice.total.toString().includes(query)
      );
      
      // Search in customers
      const filteredCustomers = customers.filter(customer => 
        customer.fullName.toLowerCase().includes(query.toLowerCase()) ||
        (customer.email && customer.email.toLowerCase().includes(query.toLowerCase())) ||
        (customer.phone && customer.phone.includes(query))
      );
      
      setSearchResults({
        invoices: filteredInvoices,
        customers: filteredCustomers
      });
      
      setShowSearchResults(true);
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Function to navigate to customer page
  const handleViewCustomer = (id: string) => {
    router.push(`/clients/${id}`);
    setShowSearchResults(false);
  };

  // Function to clear search
  const clearSearch = () => {
    setSearchQuery('');
    setShowSearchResults(false);
  };

  // إحصائيات الفترة المختارة
  const getTimeRangeStats = () => {
    const range = getDateRange(selectedTimeRange);
    const totalInRange = lineChartData.reduce((sum, month) => sum + month.إجمالي, 0);
    const paidInRange = lineChartData.reduce((sum, month) => sum + month.مدفوعة, 0);
    const unpaidInRange = lineChartData.reduce((sum, month) => sum + month.غير_مدفوعة, 0);
    const partiallyInRange = lineChartData.reduce((sum, month) => sum + month.مدفوعة_جزئيا, 0);
    
    return {
      totalInRange,
      paidInRange,
      unpaidInRange,
      partiallyInRange,
      startDateStr: range.formattedStartDate,
      endDateStr: range.formattedEndDate,
      averageMonthly: totalInRange / (lineChartData.length || 1)
    };
  };

  // دالة تصدير بيانات فترة محددة
  const exportChartData = (format: 'csv' | 'print') => {
    // إغلاق قائمة التصدير
    setShowExportMenu(false);

    if (format === 'print') {
      // طباعة التقرير
      window.print();
      return;
    }

    let csvContent = '';
    
    // إضافة عنوان التقرير والفترة الزمنية
    csvContent += `تقرير تحليل الدخل\n`;
    csvContent += `الفترة: ${getDateRange(selectedTimeRange).formattedStartDate} - ${getDateRange(selectedTimeRange).formattedEndDate}\n\n`;
    
    // إضافة البيانات حسب نوع الرسم البياني
    if (chartType === 'bar' || chartType === 'line') {
      // إضافة عناوين الأعمدة
      csvContent += `الشهر,إجمالي الدخل,مدفوعة,مدفوعة جزئياً,غير مدفوعة\n`;
      
      // إضافة بيانات كل شهر
      lineChartData.forEach(item => {
        csvContent += `${item.name},${item.إجمالي},${item.مدفوعة},${item.مدفوعة_جزئيا},${item.غير_مدفوعة}\n`;
      });
    }

    // إنشاء ملف وتنزيله
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const date = new Date();
    const formattedDate = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', `تقرير_تحليل_الدخل_${formattedDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  if (error) {
    return (
      <div className="text-center text-red-600">{error}</div>
    );
  }

  // Get last 5 invoices
  const recentInvoices = invoices.slice(0, 5);

  return (
    <div className="container mx-auto p-4 space-y-8 mb-20">
      {/* رسالة الخطأ */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mb-6 relative">
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      {/* مؤشر التحميل */}
      {loading && <LoadingIndicator />}

      {/* عنوان الصفحة والأزرار */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
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
          <Button 
            onClick={() => setShowQuickGuide(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white w-full justify-center"
          >
            <HelpCircle className="w-4 h-4" />
            الدليل السريع
          </Button>
        </div>
      </div>

      {/* نافذة الدليل السريع المنبثقة */}
      {showQuickGuide && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 min-h-screen">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden relative">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="text-xl font-semibold text-blue-800 flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-blue-600" />
                الدليل السريع
              </h2>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0" 
                onClick={() => setShowQuickGuide(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-4rem)] p-4">
              <div className="space-y-4">
                <div className="border border-blue-200 rounded-md overflow-hidden">
                  <button 
                    className="w-full flex justify-between items-center p-3 bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors font-medium text-right"
                    onClick={() => setExpandedGuideSection(expandedGuideSection === "dashboard" ? null : "dashboard")}
                  >
                    <span>لوحة التحكم</span>
                    {expandedGuideSection === "dashboard" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {expandedGuideSection === "dashboard" && (
                    <div className="p-3 text-sm text-blue-800 bg-white border-t border-blue-200">
                      <p>تعرض لوحة التحكم نظرة عامة عن نشاطك، وتتضمن:</p>
                      <ul className="list-disc mr-6 mt-2 space-y-1">
                        <li>إجمالي عدد الفواتير المُصدرة</li>
                        <li>إجمالي الإيرادات من جميع الفواتير</li>
                        <li>عدد العملاء الحاليين</li>
                        <li>عدد الفواتير غير المدفوعة</li>
                        <li>مخططات تحليل الدخل الشهري</li>
                        <li>مقارنة الأداء مع الشهر السابق</li>
                        <li>إحصائيات مفصلة عن حالة الفواتير</li>
                      </ul>
                    </div>
                  )}
                </div>

                <div className="border border-blue-200 rounded-md overflow-hidden">
                  <button 
                    className="w-full flex justify-between items-center p-3 bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors font-medium text-right"
                    onClick={() => setExpandedGuideSection(expandedGuideSection === "search" ? null : "search")}
                  >
                    <span>البحث السريع</span>
                    {expandedGuideSection === "search" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {expandedGuideSection === "search" && (
                    <div className="p-3 text-sm text-blue-800 bg-white border-t border-blue-200">
                      <p>يمكنك استخدام البحث السريع للوصول السريع إلى:</p>
                      <ul className="list-disc mr-6 mt-2 space-y-1">
                        <li>البحث عن فاتورة حسب رقم الفاتورة أو اسم العميل أو المبلغ</li>
                        <li>البحث عن عميل حسب الاسم أو البريد الإلكتروني أو رقم الهاتف</li>
                        <li>عرض نتائج البحث في الوقت الفعلي أثناء الكتابة</li>
                        <li>الوصول المباشر إلى الفواتير والعملاء من نتائج البحث</li>
                      </ul>
                      <p className="mt-2">ببساطة اكتب في حقل البحث ما تبحث عنه، وستظهر النتائج مباشرة أثناء الكتابة.</p>
                    </div>
                  )}
                </div>

                <div className="border border-blue-200 rounded-md overflow-hidden">
                  <button 
                    className="w-full flex justify-between items-center p-3 bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors font-medium text-right"
                    onClick={() => setExpandedGuideSection(expandedGuideSection === "invoices" ? null : "invoices")}
                  >
                    <span>الفواتير</span>
                    {expandedGuideSection === "invoices" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {expandedGuideSection === "invoices" && (
                    <div className="p-3 text-sm text-blue-800 bg-white border-t border-blue-200">
                      <p>لإنشاء فاتورة جديدة:</p>
                      <ol className="list-decimal mr-6 mt-2 space-y-1">
                        <li>انقر على زر &quot;إنشاء فاتورة&quot; في الأعلى</li>
                        <li>أدخل بيانات العميل، أو اختر عميلاً موجوداً</li>
                        <li>أضف المنتجات أو الخدمات مع التفاصيل والأسعار</li>
                        <li>اضغط على &quot;حفظ الفاتورة&quot; لإتمام العملية</li>
                      </ol>
                      <p className="mt-2">يمكنك الوصول لكافة الفواتير من خلال الضغط على &quot;عرض الكل&quot; أسفل قائمة آخر الفواتير.</p>
                      <p className="mt-2">مميزات إضافية:</p>
                      <ul className="list-disc mr-6 mt-2 space-y-1">
                        <li>مشاركة الفواتير مع العملاء عبر رابط مباشر</li>
                        <li>تتبع حالة الفاتورة (مدفوعة، مدفوعة جزئياً، غير مدفوعة)</li>
                        <li>تصدير الفواتير بتنسيق CSV للنسخ الاحتياطي</li>
                        <li>طباعة الفواتير مباشرة من المنصة</li>
                      </ul>
                    </div>
                  )}
                </div>

                <div className="border border-blue-200 rounded-md overflow-hidden">
                  <button 
                    className="w-full flex justify-between items-center p-3 bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors font-medium text-right"
                    onClick={() => setExpandedGuideSection(expandedGuideSection === "clients" ? null : "clients")}
                  >
                    <span>العملاء</span>
                    {expandedGuideSection === "clients" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {expandedGuideSection === "clients" && (
                    <div className="p-3 text-sm text-blue-800 bg-white border-t border-blue-200">
                      <p>لإضافة عميل جديد:</p>
                      <ol className="list-decimal mr-6 mt-2 space-y-1">
                        <li>انقر على زر &quot;إضافة عميل&quot; في الأعلى</li>
                        <li>أدخل معلومات العميل (الاسم، رقم الهاتف، البريد الإلكتروني، إلخ)</li>
                        <li>اضغط على &quot;حفظ&quot; لإضافة العميل</li>
                      </ol>
                      <p className="mt-2">يمكنك إدارة كافة العملاء عبر الانتقال إلى صفحة &quot;العملاء&quot; من القائمة الجانبية.</p>
                      <p className="mt-2">مميزات إدارة العملاء:</p>
                      <ul className="list-disc mr-6 mt-2 space-y-1">
                        <li>تخزين معلومات العملاء بشكل آمن</li>
                        <li>عرض سجل الفواتير لكل عميل</li>
                        <li>تحديث معلومات العملاء في أي وقت</li>
                        <li>إضافة ملاحظات خاصة لكل عميل</li>
                      </ul>
                    </div>
                  )}
                </div>

                <div className="border border-blue-200 rounded-md overflow-hidden">
                  <button 
                    className="w-full flex justify-between items-center p-3 bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors font-medium text-right"
                    onClick={() => setExpandedGuideSection(expandedGuideSection === "status" ? null : "status")}
                  >
                    <span>تغيير حالة الفواتير</span>
                    {expandedGuideSection === "status" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  {expandedGuideSection === "status" && (
                    <div className="p-3 text-sm text-blue-800 bg-white border-t border-blue-200">
                      <p>يمكنك تغيير حالة الفاتورة من خلال:</p>
                      <ol className="list-decimal mr-6 mt-2 space-y-1">
                        <li>الضغط على زر الإجراءات (النقاط الثلاثة) بجانب الفاتورة</li>
                        <li>اختيار &quot;تغيير الحالة إلى&quot; من القائمة</li>
                        <li>تحديد الحالة المطلوبة (غير مدفوعة، مدفوعة جزئياً، مدفوعة)</li>
                      </ol>
                      <p className="mt-2">يمكنك أيضاً الاطلاع على الفواتير غير المدفوعة بالضغط على زر &quot;عرض&quot; في بطاقة الفواتير غير المدفوعة.</p>
                      <p className="mt-2">مميزات إضافية:</p>
                      <ul className="list-disc mr-6 mt-2 space-y-1">
                        <li>تتبع حالة الفواتير في الوقت الفعلي</li>
                        <li>إشعارات عند تغيير حالة الفاتورة</li>
                        <li>تصفية الفواتير حسب الحالة</li>
                        <li>عرض إحصائيات مفصلة عن حالة الفواتير</li>
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* شريط البحث */}
      <div className="mb-8 relative">
        <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
          <div className="p-3 text-gray-500">
            <Search className="h-5 w-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="البحث عن فواتير، عملاء..."
            className="flex-1 py-3 px-2 outline-none border-0 text-right text-base"
          />
          {searchQuery && (
            <button 
              onClick={clearSearch}
              className="p-3 text-gray-500 hover:text-gray-800"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        
        {/* Search Results Dropdown */}
        {showSearchResults && (
          <div className="absolute z-10 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            {isSearching ? (
              <div className="p-4 text-center text-gray-500">
                جارِ البحث...
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto">
                {searchResults.invoices.length === 0 && searchResults.customers.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    لا توجد نتائج مطابقة للبحث
                  </div>
                ) : (
                  <>
                    {searchResults.invoices.length > 0 && (
                      <div>
                        <div className="bg-gray-50 p-2 font-medium text-gray-600 border-b">
                          الفواتير
                        </div>
                        <div className="divide-y">
                          {searchResults.invoices.slice(0, 5).map(invoice => (
                            <div 
                              key={invoice.id}
                              className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                              onClick={() => handleViewInvoice(invoice.id)}
                            >
                              <div>
                                <div className="font-medium text-base">{invoice.clientName}</div>
                                <div className="text-sm text-gray-500">
                                  رقم الفاتورة: {invoice.invoiceNumber}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-gray-700">
                                {invoice.total.toLocaleString()}
                                <span style={{ fontFamily: 'saudi_riyal', fontSize: '18px' }}>&#xE900;</span>
                                <span className={`mr-2 inline-block px-2 py-1 rounded-full text-sm ${statusStyles[invoice.status]}`}>
                                  {statusLabels[invoice.status]}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {searchResults.customers.length > 0 && (
                      <div>
                        <div className="bg-gray-50 p-2 font-medium text-gray-600 border-b">
                          العملاء
                        </div>
                        <div className="divide-y">
                          {searchResults.customers.slice(0, 5).map(customer => (
                            <div 
                              key={customer.id}
                              className="p-3 hover:bg-gray-50 cursor-pointer"
                              onClick={() => handleViewCustomer(customer.id || '')}
                            >
                              <div className="font-medium text-base">{customer.fullName}</div>
                              <div className="flex gap-2 text-sm text-gray-500">
                                {customer.phone && <span>{customer.phone}</span>}
                                {customer.email && <span>{customer.email}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {(searchResults.invoices.length > 5 || searchResults.customers.length > 5) && (
                      <div className="p-2 text-center border-t">
                        <span className="text-sm text-gray-600">هناك المزيد من النتائج. يرجى تدقيق البحث.</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* مؤشرات الأداء الرئيسية (KPIs) - قسم جديد مجمع */}
      <Card className="mb-8 shadow-sm border-blue-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            مؤشرات الأداء الرئيسية
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* البطاقات الإحصائية المصغرة */}
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="text-lg font-semibold mb-1 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                إجمالي الفواتير
              </div>
              <div className="text-3xl font-bold mb-1">{totalInvoices}</div>
              <div className="flex justify-between">
                <div className="text-sm text-gray-500">عدد الفواتير المصدرة</div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="text-lg font-semibold mb-1">إجمالي الدخل</div>
              <div className="flex items-center mb-1">
                <div className="text-3xl font-bold">{totalRevenue.toLocaleString()}</div>
                <span style={{ fontFamily: 'saudi_riyal', fontSize: '24px', paddingRight: '2px' }}>&#xE900;</span>
              </div>
              {monthComparison.percentageChange !== 0 && (
                <div className={`flex items-center text-sm ${monthComparison.isIncrease ? 'text-green-600' : 'text-red-600'}`}>
                  {monthComparison.isIncrease ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                  <span>{Math.abs(monthComparison.percentageChange).toFixed(1)}% مقارنة بالشهر السابق</span>
                </div>
              )}
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="text-lg font-semibold mb-1">متوسط قيمة الفاتورة</div>
              <div className="flex items-center mb-1">
                <div className="text-3xl font-bold">{averageInvoiceValue.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                <span style={{ fontFamily: 'saudi_riyal', fontSize: '24px', paddingRight: '2px' }}>&#xE900;</span>
              </div>
              <div className="text-sm text-gray-500">
                من {totalInvoices} فاتورة
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="text-lg font-semibold mb-1">معدل التحصيل</div>
              <div className="text-3xl font-bold mb-1">{collectionRate.toFixed(1)}%</div>
              <div className="text-sm text-gray-500">
                نسبة الفواتير المدفوعة بالكامل
              </div>
            </div>
          </div>
          
          {/* إحصائيات الدخل حسب حالة الفواتير */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-green-50 p-4 rounded-lg border border-green-100">
              <div className="text-lg font-semibold text-green-700 mb-1">الدخل من الفواتير المدفوعة</div>
              <div className="flex items-center mb-1">
                <div className="text-2xl font-bold text-green-700">{paidRevenue.toLocaleString()}</div>
                <span style={{ fontFamily: 'saudi_riyal', fontSize: '20px', paddingRight: '2px' }}>&#xE900;</span>
              </div>
              <div className="text-sm text-green-600">
                {totalRevenue > 0 ? ((paidRevenue / totalRevenue) * 100).toFixed(1) : 0}% من إجمالي الدخل
              </div>
              <div className="text-sm text-green-600 mt-1">
                عدد الفواتير: {paidInvoices.length}
              </div>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-100">
              <div className="text-lg font-semibold text-amber-700 mb-1">الدخل من الفواتير المدفوعة جزئيا</div>
              <div className="flex items-center mb-1">
                <div className="text-2xl font-bold text-amber-700">{partiallyPaidRevenue.toLocaleString()}</div>
                <span style={{ fontFamily: 'saudi_riyal', fontSize: '20px', paddingRight: '2px' }}>&#xE900;</span>
              </div>
              <div className="text-sm text-amber-600">
                {totalRevenue > 0 ? ((partiallyPaidRevenue / totalRevenue) * 100).toFixed(1) : 0}% من إجمالي الدخل
              </div>
              <div className="text-sm text-amber-600 mt-1">
                عدد الفواتير: {partiallyPaidInvoices.length}
              </div>
            </div>
            
            <div className="bg-red-50 p-4 rounded-lg border border-red-100">
              <div className="text-lg font-semibold text-red-700 mb-1">الدخل من الفواتير غير المدفوعة</div>
              <div className="flex items-center mb-1">
                <div className="text-2xl font-bold text-red-700">{pendingRevenue.toLocaleString()}</div>
                <span style={{ fontFamily: 'saudi_riyal', fontSize: '20px', paddingRight: '2px' }}>&#xE900;</span>
              </div>
              <div className="text-sm text-red-600">
                {totalRevenue > 0 ? ((pendingRevenue / totalRevenue) * 100).toFixed(1) : 0}% من إجمالي الدخل
              </div>
              <div className="text-sm text-red-600 mt-1 flex items-center">
                عدد الفواتير: {pendingInvoicesList.length}
                <button 
                  onClick={() => setShowPendingInvoices(true)}
                  className="text-blue-600 hover:underline text-sm mr-2"
                >
                  (عرض التفاصيل)
                </button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* تحليل الدخل */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-2 mb-8">
        {/* مخطط الدخل الشهري */}
        <Card className="col-span-1 lg:col-span-2 print-section">
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-col gap-4">
              <div className="flex items-center">
                <BarChart3 className="h-5 w-5 ml-2" />
                تحليل الدخل الشهري
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {/* مجموعة أزرار نوع المخطط */}
                <div className="flex items-center gap-1 p-0.5 bg-gray-100 rounded-lg">
                  <Button
                    variant={chartType === 'bar' ? 'default' : 'ghost'}
                    size="sm"
                    className={`${chartType === 'bar' ? 'bg-white shadow text-black' : 'text-gray-600 hover:text-black hover:bg-white/50'}`}
                    onClick={() => setChartType('bar')}
                  >
                    <BarChart3 className="h-4 w-4 mx-1" />
                    عمودي
                  </Button>
                  <Button
                    variant={chartType === 'line' ? 'default' : 'ghost'}
                    size="sm"
                    className={`${chartType === 'line' ? 'bg-white shadow text-black' : 'text-gray-600 hover:text-black hover:bg-white/50'}`}
                    onClick={() => setChartType('line')}
                  >
                    <TrendingUp className="h-4 w-4 mx-1" />
                    خطي
                  </Button>
                </div>

                {/* قائمة اختيار الفترة الزمنية */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-white text-black border-gray-200 hover:bg-gray-50"
                    onClick={() => setShowTimeRangeMenu(!showTimeRangeMenu)}
                  >
                    <Calendar className="h-4 w-4 ml-1" />
                    <span className="mx-1">
                      {selectedTimeRange === 1 ? 'هذا الشهر' : 
                       selectedTimeRange === 2 ? 'الشهر السابق' : 
                       selectedTimeRange === 3 ? 'آخر 3 أشهر' : 
                       selectedTimeRange === 6 ? 'آخر 6 أشهر' : 
                       selectedTimeRange === 12 ? 'آخر 12 شهر' : 'حدد الفترة'}
                    </span>
                    <ChevronDown className="h-3 w-3 mr-1" />
                  </Button>
                  
                  {showTimeRangeMenu && (
                    <div className="absolute left-0 mt-1 w-48 rounded-lg shadow-lg bg-white z-10 border border-gray-200">
                      <div className="py-1">
                        <button
                          className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => {
                            setSelectedTimeRange(1);
                            setShowTimeRangeMenu(false);
                          }}
                        >
                          هذا الشهر
                        </button>
                        <button
                          className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => {
                            setSelectedTimeRange(2);
                            setShowTimeRangeMenu(false);
                          }}
                        >
                          الشهر السابق
                        </button>
                        <button
                          className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => {
                            setSelectedTimeRange(3);
                            setShowTimeRangeMenu(false);
                          }}
                        >
                          آخر 3 أشهر
                        </button>
                        <button
                          className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => {
                            setSelectedTimeRange(6);
                            setShowTimeRangeMenu(false);
                          }}
                        >
                          آخر 6 أشهر
                        </button>
                        <button
                          className="w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          onClick={() => {
                            setSelectedTimeRange(12);
                            setShowTimeRangeMenu(false);
                          }}
                        >
                          آخر 12 شهر
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* زر التصدير */}
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm" 
                    className="bg-white text-black border-gray-200 hover:bg-gray-50"
                    onClick={() => setShowExportMenu(!showExportMenu)}
                  >
                    <FileDown className="h-4 w-4 ml-1" />
                    تصدير
                  </Button>
                  {showExportMenu && (
                    <div className="absolute left-0 mt-1 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <button 
                        onClick={() => {
                          exportChartData('csv');
                          setShowExportMenu(false);
                        }} 
                        className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        تصدير CSV
                      </button>
                      <button 
                        onClick={() => {
                          exportChartData('print');
                          setShowExportMenu(false);
                        }} 
                        className="w-full text-right px-3 py-2 text-sm hover:bg-gray-50"
                      >
                        طباعة
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </CardTitle>
            <div className="text-sm text-gray-500 mt-2 text-center">
              {getDateRange(selectedTimeRange).formattedStartDate} - {getDateRange(selectedTimeRange).formattedEndDate}
            </div>
          </CardHeader>
          <CardContent className="px-4 py-3">
            {chartType === 'bar' && (
              <>
                <div className="h-80 mt-4">
                  {lineChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RBarChart data={lineChartData} margin={{ top: 25, right: 30, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip 
                          formatter={(value: number) => [`${value.toLocaleString()} ر.س`, '']}
                          labelFormatter={(label) => `${label}`}
                        />
                        <Legend />
                        <Bar dataKey="إجمالي" name="إجمالي" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="مدفوعة" name="مدفوعة" fill="#10b981" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="مدفوعة_جزئيا" name="مدفوعة جزئيا" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="غير_مدفوعة" name="غير مدفوعة" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </RBarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center flex-col">
                      <div className="text-gray-400 mb-2">
                        <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
                      </div>
                      <p className="text-gray-500 text-lg font-medium">لا توجد بيانات للفترة المحددة</p>
                      <p className="text-gray-400 text-sm mt-2">حاول تغيير النطاق الزمني أو إضافة فواتير جديدة</p>
                    </div>
                  )}
                </div>
                {lineChartData.length > 0 ? (
                  <div className="mt-6 text-sm text-gray-500 text-center">
                    إجمالي الدخل للفترة: <span className="font-bold text-gray-700">{getTimeRangeStats().totalInRange.toLocaleString()}</span>
                    <span style={{ fontFamily: 'saudi_riyal', fontSize: '16px', paddingRight: '2px' }}>&#xE900;</span>
                  </div>
                ) : (
                  <div className="mt-6 text-sm text-gray-500 text-center">
                    لا توجد بيانات للفترة المحددة
                  </div>
                )}
              </>
            )}
            
            {chartType === 'line' && (
              <div className="h-96 mt-4">
                {lineChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RLineChart data={lineChartData} margin={{ top: 25, right: 30, left: 20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip 
                        formatter={(value: number) => [`${value.toLocaleString()} ر.س`, '']}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="إجمالي" 
                        stroke="#3b82f6" 
                        strokeWidth={2} 
                        dot={{ r: 4 }} 
                        activeDot={{ r: 6 }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="مدفوعة" 
                        stroke="#10b981" 
                        strokeWidth={2} 
                        dot={{ r: 4 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="غير_مدفوعة" 
                        stroke="#ef4444" 
                        strokeWidth={2} 
                        dot={{ r: 4 }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="مدفوعة_جزئيا" 
                        stroke="#f59e0b" 
                        strokeWidth={2} 
                        dot={{ r: 4 }} 
                      />
                    </RLineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center flex-col">
                    <div className="text-gray-400 mb-2">
                      <TrendingUp className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    </div>
                    <p className="text-gray-500 text-lg font-medium">لا توجد بيانات للفترة المحددة</p>
                    <p className="text-gray-400 text-sm mt-2">حاول تغيير النطاق الزمني أو إضافة فواتير جديدة</p>
                  </div>
                )}
              </div>
            )}
            <div className="mt-2 text-xs text-gray-400 text-center">
              {selectedTimeRange === 12 ? 'البيانات المعروضة للسنة الحالية' : (
                selectedTimeRange === 24 ? 'البيانات المعروضة للسنتين الأخيرتين' :
                `البيانات المعروضة لآخر ${selectedTimeRange} أشهر`
              )}
            </div>

            {/* ملخص أداء الفترة المختارة */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div className="text-base text-blue-500 mb-1">إجمالي الدخل</div>
                <div className="font-bold text-lg flex items-center">
                  {getTimeRangeStats().totalInRange.toLocaleString()}
                  <span style={{ fontFamily: 'saudi_riyal', fontSize: '16px', paddingRight: '2px' }}>&#xE900;</span>
                </div>
                <div className="text-sm text-blue-400 mt-1">
                  {getTimeRangeStats().startDateStr} - {getTimeRangeStats().endDateStr}
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="text-base text-emerald-500 mb-1">الدخل المُحصل</div>
                <div className="font-bold text-lg flex items-center">
                  {getTimeRangeStats().paidInRange.toLocaleString()}
                  <span style={{ fontFamily: 'saudi_riyal', fontSize: '16px', paddingRight: '2px' }}>&#xE900;</span>
                </div>
                <div className="text-sm text-emerald-400 mt-1">
                  {((getTimeRangeStats().paidInRange / (getTimeRangeStats().totalInRange || 1)) * 100).toFixed(1)}% من الإجمالي
                </div>
              </div>
              
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-100">
                <div className="text-base text-amber-500 mb-1">متوسط الدخل الشهري</div>
                <div className="font-bold text-lg flex items-center">
                  {getTimeRangeStats().averageMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  <span style={{ fontFamily: 'saudi_riyal', fontSize: '16px', paddingRight: '2px' }}>&#xE900;</span>
                </div>
                <div className="text-sm text-amber-400 mt-1">
                  محسوب على {lineChartData.length} {lineChartData.length >= 3 && lineChartData.length <= 10 ? 'أشهر' : 'شهر'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* نافذة الفواتير غير المدفوعة */}
      {showPendingInvoices && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="text-xl font-semibold">الفواتير غير المدفوعة</h3>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-8 w-8 p-0" 
                onClick={() => setShowPendingInvoices(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="overflow-auto max-h-[70vh] p-5">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">رقم الفاتورة</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">العميل</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">المبلغ</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">التاريخ</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingInvoicesList.map(invoice => (
                    <tr key={invoice.id} className="text-base">
                      <td className="px-4 py-4">{invoice.invoiceNumber}</td>
                      <td className="px-4 py-4">{invoice.clientName}</td>
                      <td className="px-4 py-4 flex items-center gap-1">
                        {invoice.total.toLocaleString()}
                        <span style={{ fontFamily: 'saudi_riyal', fontSize: '18px' }}>&#xE900;</span>
                      </td>
                      <td className="px-4 py-4">
                        {new Date(invoice.createdAt.seconds * 1000).toLocaleDateString('ar-SA')}
                      </td>
                      <td className="px-4 py-4">
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
                            className="bg-amber-50 hover:bg-amber-100 text-amber-700"
                            disabled={updating === invoice.id}
                          >
                            {updating === invoice.id ? (
                              <div className="h-4 w-4 border-2 border-amber-700 border-t-transparent rounded-full animate-spin" />
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
                <div className="text-center py-8 text-gray-500 text-base">
                  لا توجد فواتير غير مدفوعة
                </div>
              )}
            </div>
            <div className="p-5 border-t flex justify-end">
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
        <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4 px-4">
          <CardTitle>آخر الفواتير</CardTitle>
          <Button
            onClick={() => router.push('/invoices')}
            className="bg-black hover:bg-black/90 text-white"
          >
            عرض الكل
          </Button>
        </CardHeader>
        <CardContent className="pt-2 pb-4 px-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">رقم الفاتورة</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">العميل</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">المبلغ</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">التاريخ</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 text-base">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recentInvoices.map(invoice => (
                  <tr key={invoice.id} className="text-base">
                    <td className="px-4 py-4">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-4">{invoice.clientName}</td>
                    <td className="px-4 py-4 flex items-center gap-1">
                      {invoice.total.toLocaleString()}
                      <span style={{ fontFamily: 'saudi_riyal', fontSize: '18px' }}>&#xE900;</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-block px-2 py-1 rounded-full text-sm ${statusStyles[invoice.status]}`}>
                        {statusLabels[invoice.status]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {new Date(invoice.createdAt.seconds * 1000).toLocaleDateString('ar-SA')}
                    </td>
                    <td className="px-4 py-4">
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
                            <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowStatusMenu(null)}>
                              <div 
                                className="absolute bg-white border shadow-xl rounded-md z-50 w-48 max-h-[80vh] overflow-y-auto"
                                style={{
                                  position: 'fixed',
                                  top: (() => {
                                    const buttonEl = document.getElementById(`dash_btn_${invoice.id}`);
                                    if (!buttonEl) return windowWidth <= 768 ? "50%" : "auto";
                                    
                                    const buttonRect = buttonEl.getBoundingClientRect();
                                    const windowHeight = window.innerHeight;
                                    const menuHeight = 300; // تقدير تقريبي لارتفاع القائمة
                                    
                                    // تحقق ما إذا كانت المساحة كافية لظهور القائمة للأسفل
                                    const spaceBelow = windowHeight - buttonRect.bottom;
                                    const isNearBottom = spaceBelow < menuHeight;
                                    
                                    if (windowWidth <= 768) {
                                      return "50%"; // توسيط رأسي على الشاشات الصغيرة
                                    } else if (isNearBottom) {
                                      // إذا كان بالقرب من الأسفل، اعرض القائمة فوق الزر
                                      return `${buttonRect.top - 10}px`;
                                    } else {
                                      // وإلا، اعرضها تحت الزر
                                      return `${buttonRect.bottom + 5}px`;
                                    }
                                  })(),
                                  left: windowWidth <= 768 
                                    ? "50%" // Center horizontally on small screens
                                    : (document.getElementById(`dash_btn_${invoice.id}`)?.getBoundingClientRect().left || 0) + 100,
                                  transform: windowWidth <= 768 
                                    ? "translate(-50%, -50%)" // Center in both dimensions on small screens
                                    : (() => {
                                        const buttonEl = document.getElementById(`dash_btn_${invoice.id}`);
                                        if (!buttonEl) return "translateX(-100%)";
                                        
                                        const buttonRect = buttonEl.getBoundingClientRect();
                                        const windowHeight = window.innerHeight;
                                        const menuHeight = 300; // تقدير تقريبي لارتفاع القائمة
                                        
                                        const spaceBelow = windowHeight - buttonRect.bottom;
                                        const isNearBottom = spaceBelow < menuHeight;
                                        
                                        return isNearBottom 
                                          ? "translate(-100%, -100%)" // للقائمة التي تفتح للأعلى
                                          : "translateX(-100%)";      // للقائمة التي تفتح للأسفل
                                      })()
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="p-2 flex flex-col">
                                  <button 
                                    className="px-3 py-2 text-right text-base rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors"
                                    onClick={() => {
                                      setShowStatusMenu(null);
                                      handleViewInvoice(invoice.id);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                    عرض الفاتورة
                                  </button>
                                  <button 
                                    className="px-3 py-2 text-right text-base rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors"
                                    onClick={() => {
                                      setShowStatusMenu(null);
                                      handleShareInvoice(invoice.id);
                                    }}
                                  >
                                    <Share2 className="h-4 w-4" />
                                    مشاركة الفاتورة
                                  </button>
                                  <div className="border-t my-1"></div>
                                  <div className="px-3 py-1 text-sm text-gray-500 select-none">تغيير الحالة إلى:</div>
                                  <button 
                                    className={`px-3 py-2 text-right text-base rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors ${invoice.status === 'unpaid' ? 'bg-gray-100 font-medium' : ''}`}
                                    onClick={() => handleChangeStatus(invoice.id, 'unpaid')}
                                  >
                                    <AlertCircle className="h-4 w-4" />
                                    غير مدفوعة
                                  </button>
                                  <button 
                                    className={`px-3 py-2 text-right text-base rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors ${invoice.status === 'partially_paid' ? 'bg-gray-100 font-medium' : ''}`}
                                    onClick={() => handleChangeStatus(invoice.id, 'partially_paid')}
                                  >
                                    <Check className="h-4 w-4" />
                                    مدفوعة جزئيا
                                  </button>
                                  <button 
                                    className={`px-3 py-2 text-right text-base rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors ${invoice.status === 'paid' ? 'bg-gray-100 font-medium' : ''}`}
                                    onClick={() => handleChangeStatus(invoice.id, 'paid')}
                                  >
                                    <CheckCheck className="h-4 w-4" />
                                    مدفوعة
                                  </button>
                                  <div className="border-t my-1"></div>
                                  <button 
                                    className="px-3 py-2 text-right text-base rounded-md hover:bg-red-50 flex items-center gap-2 w-full transition-colors text-red-600"
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