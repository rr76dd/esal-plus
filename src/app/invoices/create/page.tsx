'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { format } from 'date-fns';
import { ArrowRight, Plus, Search } from 'lucide-react';
import { invoiceServices, Invoice } from '@/lib/firebase/services/invoiceServices';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequiredField } from '@/components/RequiredField';
import '@emran-alhaddad/saudi-riyal-font/index.css';
import { customerServices, Customer } from '@/lib/firebase/services/customerServices';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

type InvoiceFormData = Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;

export default function CreateInvoice() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingBusinessData, setLoadingBusinessData] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [formData, setFormData] = useState<InvoiceFormData>({
    businessName: '',
    phone: '',
    email: '',
    address: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    customerId: '',
    invoiceNumber: `INV-${Date.now()}`,
    issueDate: format(new Date(), 'yyyy-MM-dd'),
    dueDate: '',
    status: 'unpaid',
    items: [{
      id: Date.now().toString(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      total: 0
    }],
    subtotal: 0,
    discount: 0,
    discountType: 'percentage',
    total: 0,
    notes: '',
    paymentLink: '',
    logo: ''
  });

  // ضمان تحديث توكن المصادقة
  const refreshAuthToken = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        setAuthError(true);
        throw new Error('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');
      }
      
      // تحديث توكن المصادقة
      await user.getIdToken(true);
      setAuthError(false);
      return true;
    } catch (error) {
      console.error('Error refreshing authentication token:', error);
      setAuthError(true);
      return false;
    }
  }, []);

  // جلب بيانات النشاط التجاري من API
  const fetchBusinessProfile = useCallback(async () => {
    try {
      await refreshAuthToken();
      setLoadingBusinessData(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        return;
      }

      const response = await fetch('/api/settings/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (!data.error) {
        const businessData = {
          businessName: data.name || '',
          phone: data.phone || '',
          email: data.email || '',
          address: data.address || '',
          logo: data.logo || ''
        };
        
        // تحديث النموذج ببيانات النشاط
        setFormData(prev => ({
          ...prev,
          businessName: businessData.businessName,
          phone: businessData.phone,
          email: businessData.email,
          address: businessData.address,
          logo: businessData.logo
        }));
        
        // حفظ البيانات في localStorage للاستخدام اللاحق إذا لزم الأمر
        localStorage.setItem('businessData', JSON.stringify(businessData));
      } else {
        // محاولة استخدام البيانات المخزنة محلياً إذا فشل جلب البيانات من API
        const storedData = localStorage.getItem('businessData');
        if (storedData) {
          try {
            const data = JSON.parse(storedData);
            setFormData(prev => ({
              ...prev,
              businessName: data.businessName || '',
              phone: data.phone || '',
              email: data.email || '',
              address: data.address || '',
              logo: data.logo || ''
            }));
          } catch (error) {
            console.error('Error parsing stored business data:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching business profile:', error);
      
      // محاولة استخدام البيانات المخزنة محلياً إذا فشل جلب البيانات من API
      const storedData = localStorage.getItem('businessData');
      if (storedData) {
        try {
          const data = JSON.parse(storedData);
          setFormData(prev => ({
            ...prev,
            businessName: data.businessName || '',
            phone: data.phone || '',
            email: data.email || '',
            address: data.address || '',
            logo: data.logo || ''
          }));
        } catch (error) {
          console.error('Error parsing stored business data:', error);
        }
      }
    } finally {
      setLoadingBusinessData(false);
    }
  }, []);

  useEffect(() => {
    // التحقق من حالة المصادقة عند تحميل الصفحة
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // إذا لم يكن المستخدم مسجل الدخول، فسيتم توجيهه إلى صفحة تسجيل الدخول
        router.push('/auth/login');
        return;
      }
      
      // تحديث توكن المصادقة ثم جلب البيانات
      refreshAuthToken().then(() => {
        // جلب بيانات النشاط التجاري
        fetchBusinessProfile();
        
        // جلب قائمة العملاء
        fetchCustomers();
      });
    });

    // تنظيف المراقب عند إلغاء تحميل المكون
    return () => unsubscribe();
  }, [fetchBusinessProfile, router, refreshAuthToken]);
  
  // استخراج عملية جلب العملاء كدالة منفصلة
  const fetchCustomers = async () => {
    try {
      setLoadingCustomers(true);
      
      // تحديث التوكن قبل جلب العملاء
      await refreshAuthToken();
      
      const fetchedCustomers = await customerServices.getAllCustomers();
      
      if (fetchedCustomers.length === 0) {
        // Try again after a short delay if no customers were found
        setTimeout(async () => {
          try {
            await refreshAuthToken();
            const retryCustomers = await customerServices.getAllCustomers();
            setCustomers(retryCustomers);
            setFilteredCustomers(retryCustomers);
          } catch (error) {
            console.error('Error retrying customer fetch:', error);
          } finally {
            setLoadingCustomers(false);
          }
        }, 1500);
      } else {
        setCustomers(fetchedCustomers);
        setFilteredCustomers(fetchedCustomers);
        setLoadingCustomers(false);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      setLoadingCustomers(false);
    }
  };
  
  // Filter customers when search term changes
  useEffect(() => {
    if (!customerSearchTerm) {
      setFilteredCustomers(customers);
      return;
    }
    
    const searchQuery = customerSearchTerm.toLowerCase();
    const filtered = customers.filter(customer => 
      customer.fullName.toLowerCase().includes(searchQuery) ||
      (customer.email && customer.email.toLowerCase().includes(searchQuery)) ||
      (customer.phone && customer.phone.toLowerCase().includes(searchQuery))
    );
    
    setFilteredCustomers(filtered);
    
    // Directly select the customer if there's only one match
    if (filtered.length === 1 && filtered[0].id) {
      handleCustomerSelect(filtered[0].id);
      setShowCustomerSearch(false); // Hide search after selection
    }
  }, [customerSearchTerm, customers]);
  
  // Handle customer selection
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    
    // Find the selected customer
    const selectedCustomer = customers.find(c => c.id === customerId);
    
    if (selectedCustomer) {
      // Update form data with customer information
      setFormData(prev => ({
        ...prev,
        clientName: selectedCustomer.fullName,
        clientEmail: selectedCustomer.email || '',
        clientPhone: selectedCustomer.phone || '',
        clientAddress: selectedCustomer.address || '',
        customerId: selectedCustomer.id
      }));
    } else {
      // Clear customer information if "None" is selected
      setFormData(prev => ({
        ...prev,
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        clientAddress: '',
        customerId: ''
      }));
    }
  };

  const updateItem = (index: number, field: 'description' | 'quantity' | 'unitPrice', value: string | number) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index] };

    if (field === 'quantity') {
      // التأكد من أن الكمية موجبة دائمًا
      const numValue = parseFloat(value as string) || 0;
      item[field] = Math.max(1, numValue); // الحد الأدنى للكمية هو 1
      item.total = item.quantity * item.unitPrice;
    } else if (field === 'unitPrice') {
      // التأكد من أن سعر الوحدة غير سالب
      const numValue = parseFloat(value as string) || 0;
      item[field] = Math.max(0, numValue); // الحد الأدنى للسعر هو 0
      item.total = item.quantity * item.unitPrice;
    } else {
      item[field] = value as string;
    }

    newItems[index] = item;

    const subtotal = newItems.reduce((sum, item) => sum + item.total, 0);
    const total = calculateTotal(subtotal, formData.discount, formData.discountType);

    setFormData(prev => ({
      ...prev,
      items: newItems,
      subtotal,
      total
    }));
  };

  const addItem = () => {
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: Date.now().toString(),
          description: '',
          quantity: 1,
          unitPrice: 0,
          total: 0
        }
      ]
    }));
  };

  const removeItem = (id: string) => {
    const newItems = formData.items.filter(item => item.id !== id);
    const subtotal = newItems.reduce((sum, item) => sum + item.total, 0);
    const total = calculateTotal(subtotal, formData.discount, formData.discountType);

    setFormData(prev => ({
      ...prev,
      items: newItems,
      subtotal,
      total
    }));
  };

  const calculateTotal = (subtotal: number, discount: number, discountType: 'percentage' | 'fixed'): number => {
    if (discount <= 0) return subtotal;
    
    const discountAmount = discountType === 'percentage'
      ? (subtotal * discount) / 100
      : discount;
    
    return subtotal - discountAmount;
  };

  const handleDiscountChange = (value: string, type: 'percentage' | 'fixed') => {
    let discount = parseFloat(value) || 0;
    
    // التحقق من قيود الخصم
    if (type === 'percentage') {
      // لا يمكن أن يتجاوز الخصم 100%
      discount = Math.min(100, Math.max(0, discount));
    } else {
      // لا يمكن أن يتجاوز الخصم قيمة الفاتورة
      discount = Math.min(formData.subtotal, Math.max(0, discount));
    }
    
    setFormData(prev => ({
      ...prev,
      discount,
      discountType: type,
      total: calculateTotal(prev.subtotal, discount, type)
    }));
  };

  // التحقق من صحة الفاتورة
  const validateInvoice = (): { isValid: boolean; errorMessage: string } => {
    // التحقق من وجود عميل
    if (!formData.clientName.trim()) {
      return { isValid: false, errorMessage: 'يجب إدخال اسم العميل' };
    }

    // التحقق من وجود بنود خدمات
    if (formData.items.length === 0) {
      return { isValid: false, errorMessage: 'يجب إضافة بند خدمة واحد على الأقل' };
    }

    // التحقق من وجود وصف ووجود كمية وسعر صحيح لكل بند
    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      
      if (!item.description.trim()) {
        return { isValid: false, errorMessage: `يجب إدخال وصف للبند رقم ${i + 1}` };
      }
      
      if (item.quantity <= 0) {
        return { isValid: false, errorMessage: `يجب أن تكون الكمية للبند رقم ${i + 1} أكبر من صفر` };
      }
      
      if (item.unitPrice < 0) {
        return { isValid: false, errorMessage: `لا يمكن أن يكون سعر الوحدة للبند رقم ${i + 1} بالسالب` };
      }
    }

    // التحقق من أن الخصم لا يتجاوز 100% إذا كان نسبة مئوية
    if (formData.discountType === 'percentage' && formData.discount > 100) {
      return { isValid: false, errorMessage: 'لا يمكن أن يتجاوز الخصم 100%' };
    }

    // التحقق من أن الخصم لا يتجاوز المجموع الفرعي إذا كان مبلغًا ثابتًا
    if (formData.discountType === 'fixed' && formData.discount > formData.subtotal) {
      return { isValid: false, errorMessage: 'لا يمكن أن يتجاوز الخصم إجمالي الفاتورة' };
    }

    // التحقق من إجمالي الفاتورة
    if (formData.total <= 0) {
      return { isValid: false, errorMessage: 'المجموع النهائي للفاتورة يجب أن يكون أكبر من صفر' };
    }

    // التحقق من وجود رابط الدفع
    if (!formData.paymentLink || !formData.paymentLink.trim()) {
      return { isValid: false, errorMessage: 'يجب إدخال رابط الدفع من منصة وفي' };
    }

    return { isValid: true, errorMessage: '' };
  };

  // تنظيف البنود الفارغة قبل تقديم الفاتورة
  const cleanupEmptyItems = () => {
    const nonEmptyItems = formData.items.filter(item => 
      item.description.trim() !== '' && item.quantity > 0 && item.unitPrice > 0
    );
    
    // إذا كانت كل البنود فارغة، نبقي على بند واحد فارغ
    if (nonEmptyItems.length === 0) {
      return [{ 
        id: Date.now().toString(),
        description: '',
        quantity: 1,
        unitPrice: 0,
        total: 0
      }];
    }
    
    return nonEmptyItems;
  };

  const handlePreview = () => {
    const { isValid, errorMessage } = validateInvoice();
    
    if (!isValid) {
      alert(errorMessage);
      return;
    }
    
    // تنظيف البنود الفارغة قبل المعاينة
    const cleanedItems = cleanupEmptyItems();
    const updatedFormData = {
      ...formData,
      items: cleanedItems
    };
    
    localStorage.setItem('previewInvoice', JSON.stringify(updatedFormData));
    router.push('/invoices/preview');
  };

  const handleSubmit = async () => {
    const { isValid, errorMessage } = validateInvoice();
    
    if (!isValid) {
      alert(errorMessage);
      return;
    }
    
    try {
      // تحديث توكن المصادقة قبل إنشاء الفاتورة
      const isAuthenticated = await refreshAuthToken();
      if (!isAuthenticated) {
        alert('يرجى تسجيل الدخول مرة أخرى للمتابعة');
        router.push('/auth/login');
        return;
      }
      
      // تنظيف البنود الفارغة
      const cleanedItems = cleanupEmptyItems();
      
      // Ensure subtotal and total are calculated
      const subtotal = cleanedItems.reduce((sum, item) => sum + item.total, 0);
      const total = calculateTotal(subtotal, Number(formData.discount), formData.discountType);
      
      // Prepare invoice data with proper customer link
      const invoiceData = {
        ...formData,
        items: cleanedItems,
        subtotal,
        total,
        // Make sure customerId is set correctly - this ensures it's stored in Firestore
        customerId: selectedCustomerId
      };
      
      console.log('Creating invoice with customerId:', selectedCustomerId);
      
      // Create the invoice
      await invoiceServices.createInvoice(invoiceData);
      
      // Redirect based on whether this was created for a specific customer
      if (selectedCustomerId) {
        // Redirect to customer details with refresh parameter
        router.push(`/clients/${selectedCustomerId}?refresh=${Date.now()}`);
      } else {
        // Redirect to invoices list
        router.push('/invoices');
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      alert('حدث خطأ أثناء إنشاء الفاتورة');
      
      // إذا كان الخطأ متعلق بالمصادقة، توجيه المستخدم لتسجيل الدخول مرة أخرى
      if (String(error).includes('المستخدم غير مسجل الدخول')) {
        router.push('/auth/login');
      }
    }
  };

  const handleCancel = () => {
    router.push('/invoices');
  };

  return (
    <div className="container mx-auto p-6 space-y-6 pb-6">
      {authError && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">خطأ في المصادقة: </strong>
          <span className="block sm:inline">يرجى تسجيل الدخول مرة أخرى للمتابعة.</span>
          <Button 
            onClick={() => router.push('/auth/login')} 
            className="mr-2 bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-2 rounded"
          >
            تسجيل الدخول
          </Button>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 pt-6 sm:pt-4">
        <div className="flex items-center">
          <Button
            variant="ghost"
            onClick={handleCancel}
            className="hover:bg-gray-100 -mr-3"
          >
            <ArrowRight className="h-5 w-5 ml-2" />
            رجوع
          </Button>
          <h1 className="text-3xl font-bold mr-2">إنشاء فاتورة جديدة</h1>
        </div>
      </div>

      {/* معلومات المرسل */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>معلومات المرسل</CardTitle>
          <p className="text-sm text-gray-600">هذه البيانات مأخوذة من إعدادات النشاط التجاري ويمكنك تعديلها</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingBusinessData ? (
            <div className="flex justify-center items-center py-4">
              <LoadingIndicator />
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {formData.logo && (
                <div className="flex justify-center mb-4">
                  <img src={formData.logo} alt="Business Logo" className="h-20 w-auto object-contain" />
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <RequiredField />
                    اسم النشاط التجاري
                  </label>
                  <Input
                    value={formData.businessName}
                    onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                    required
                    className="border-gray-300 focus:border-black focus:ring-black"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <RequiredField />
                    رقم الجوال
                  </label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                    className="border-gray-300 focus:border-black focus:ring-black"
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    <RequiredField />
                    البريد الإلكتروني
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="border-gray-300 focus:border-black focus:ring-black"
                    dir="rtl"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">العنوان</label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    className="border-gray-300 focus:border-black focus:ring-black"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* معلومات المستلم */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>معلومات المستلم</CardTitle>
          <p className="text-sm text-gray-600">يمكنك اختيار عميل موجود مسبقًا أو إدخال معلومات جديدة</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="mb-4">
            <Button
              variant={showCustomerSearch ? "default" : "outline"}
              onClick={() => setShowCustomerSearch(!showCustomerSearch)}
              className={`w-full md:w-auto mb-2 ${showCustomerSearch ? 'bg-black text-white hover:bg-gray-800' : 'border-gray-300 hover:bg-gray-100'}`}
            >
              <Search className="h-4 w-4 ml-2" />
              البحث عن عميل
            </Button>
          </div>

          {showCustomerSearch && (
            <div className="border rounded-md p-4 mb-4 bg-gray-50">
              <div className="mb-3">
                <Input
                  type="text"
                  placeholder="ابحث عن عميل بالاسم أو رقم الهاتف أو البريد الإلكتروني"
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="w-full border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
              
              {loadingCustomers ? (
                <div className="flex justify-center py-4">
                  <LoadingIndicator />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <p className="text-center text-gray-500 py-2">لا توجد نتائج</p>
              ) : (
                <div className="max-h-60 overflow-y-auto">
                  <div className="space-y-2">
                    {filteredCustomers.map(customer => (
                      <div 
                        key={customer.id}
                        className="p-2 rounded cursor-pointer hover:bg-gray-100 flex justify-between items-center"
                        onClick={() => handleCustomerSelect(customer.id || '')}
                      >
                        <div>
                          <div className="font-medium">{customer.fullName}</div>
                          <div className="text-sm text-gray-600">{customer.phone}</div>
                        </div>
                        {customer.id === selectedCustomerId && (
                          <div className="text-green-600">✓</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                <RequiredField />
                اسم العميل
              </label>
              <Input
                value={formData.clientName}
                onChange={(e) => setFormData(prev => ({ ...prev, clientName: e.target.value }))}
                required
                className="border-gray-300 focus:border-black focus:ring-black"
                placeholder="أدخل اسم العميل (مطلوب)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                رقم الجوال
              </label>
              <Input
                value={formData.clientPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, clientPhone: e.target.value }))}
                className="border-gray-300 focus:border-black focus:ring-black"
                dir="rtl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                البريد الإلكتروني
              </label>
              <Input
                type="email"
                value={formData.clientEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, clientEmail: e.target.value }))}
                className="border-gray-300 focus:border-black focus:ring-black"
                dir="ltr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">العنوان</label>
              <Input
                value={formData.clientAddress}
                onChange={(e) => setFormData(prev => ({ ...prev, clientAddress: e.target.value }))}
                className="border-gray-300 focus:border-black focus:ring-black"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* تفاصيل الفاتورة */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>تفاصيل الفاتورة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                <RequiredField />
                رقم الفاتورة
              </label>
              <Input
                value={formData.invoiceNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                placeholder="سيتم إنشاؤه تلقائياً"
                className="border-gray-300 focus:border-black focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                <RequiredField />
                تاريخ الإصدار
              </label>
              <Input
                type="date"
                value={formData.issueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, issueDate: e.target.value }))}
                required
                className="border-gray-300 focus:border-black focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">تاريخ الاستحقاق</label>
              <Input
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                className="border-gray-300 focus:border-black focus:ring-black"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                <RequiredField />
                الحالة
              </label>
              <select
                className="w-full p-2 border rounded-md border-gray-300 focus:border-black focus:ring-black"
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as 'unpaid' | 'partially_paid' | 'paid' }))}
              >
                <option value="unpaid">غير مدفوعة</option>
                <option value="partially_paid">مدفوعة جزئيا</option>
                <option value="paid">مدفوعة</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* البنود والحسابات */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>البنود والحسابات</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 sm:px-4 py-4 text-right font-medium text-gray-600 text-base w-[50%]">
                    <RequiredField />
                    الوصف
                  </th>
                  <th className="px-2 sm:px-4 py-4 text-right font-medium text-gray-600 text-base w-[15%]">
                    <RequiredField />
                    الكمية
                  </th>
                  <th className="px-2 sm:px-4 py-4 text-right font-medium text-gray-600 text-base w-[15%]">
                    <RequiredField />
                    سعر الوحدة
                  </th>
                  <th className="px-2 sm:px-4 py-4 text-right font-medium text-gray-600 text-base w-[12%]">المجموع</th>
                  <th className="px-2 sm:px-4 py-4 text-right font-medium text-gray-600 text-base w-[8%]">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {formData.items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-2 sm:px-4 py-4 w-[50%]">
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(index, 'description', e.target.value)}
                        placeholder="وصف البند (مطلوب)"
                        required
                        className="w-full text-base min-h-[45px] border-gray-300 focus:border-black focus:ring-black"
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-4 w-[15%]">
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                        className="w-full text-base min-h-[45px] px-2 border-gray-300 focus:border-black focus:ring-black"
                        placeholder="1+"
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-4 w-[15%]">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                        className="w-full text-base min-h-[45px] px-2 border-gray-300 focus:border-black focus:ring-black"
                        placeholder="0+"
                      />
                    </td>
                    <td className="px-2 sm:px-4 py-4 text-left font-medium whitespace-nowrap w-[12%]">
                      <div className="flex items-center gap-1 text-base">
                        {item.total.toLocaleString()}
                        <span style={{ fontFamily: 'saudi_riyal' }}>&#xE900;</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-4 py-4 w-[8%]">
                      {formData.items.length > 1 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => removeItem(item.id)}
                          className="bg-red-100 hover:bg-red-200 text-red-600 hover:text-red-700 text-base whitespace-nowrap min-h-[45px] px-4"
                        >
                          حذف
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            onClick={addItem} 
            variant="outline" 
            className="border-dashed border-gray-300 hover:bg-gray-100 hover:text-black"
          >
            <Plus className="w-4 h-4 ml-2" />
            إضافة بند
          </Button>

          <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">المجموع الفرعي:</span>
              <span className="text-lg font-medium flex items-center gap-1">
                {formData.subtotal.toLocaleString()}
                <span style={{ fontFamily: 'saudi_riyal' }}>&#xE900;</span>
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">الخصم:</span>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.discount}
                  onChange={(e) => handleDiscountChange(e.target.value, formData.discountType)}
                  className="w-32 border-gray-300 focus:border-black focus:ring-black"
                  placeholder={formData.discountType === 'percentage' ? "0-100%" : "0 ريال"}
                />
                <select
                  className="p-2 border rounded-md bg-white border-gray-300 focus:border-black focus:outline-none"
                  value={formData.discountType}
                  onChange={(e) => handleDiscountChange(formData.discount.toString(), e.target.value as 'percentage' | 'fixed')}
                >
                  <option value="percentage">نسبة مئوية</option>
                  <option value="fixed">مبلغ ثابت</option>
                </select>
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
              <span className="text-gray-900 font-medium">المجموع النهائي:</span>
              <span className="text-2xl font-bold flex items-center gap-1">
                {formData.total.toLocaleString()}
                <span style={{ fontFamily: 'saudi_riyal' }}>&#xE900;</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ملاحظات */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>ملاحظات</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={4}
            placeholder="أضف ملاحظات هنا..."
            className="border-gray-300 focus:border-black focus:ring-black"
          />
        </CardContent>
      </Card>

      {/* رابط الدفع */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>
            <RequiredField />
            رابط الدفع من منصة وفي
          </CardTitle>
          <p className="text-sm text-gray-600">أدخل رابط الدفع من منصة وفي لتسهيل عملية الدفع للعميل</p>
        </CardHeader>
        <CardContent>
          <Input
            value={formData.paymentLink}
            onChange={(e) => setFormData(prev => ({ ...prev, paymentLink: e.target.value }))}
            placeholder="https://wafy.co/payment/... (مطلوب)"
            required
            className="border-gray-300 focus:border-black focus:ring-black"
            dir="ltr"
          />
        </CardContent>
      </Card>

      {/* أزرار التحكم */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mt-8 mb-4">
        <Button 
          variant="outline" 
          onClick={handleCancel}
          className="w-full sm:w-[200px] py-5 text-lg border-gray-300 hover:bg-gray-100 hover:text-black"
        >
          إلغاء
        </Button>
        <Button 
          variant="outline" 
          onClick={handlePreview}
          className="w-full sm:w-[200px] py-5 text-lg bg-white hover:bg-gray-50 text-black border-black"
        >
          معاينة
        </Button>
        <Button 
          onClick={handleSubmit} 
          className="w-full sm:w-[200px] py-5 text-lg bg-black hover:bg-black/90 text-white"
        >
          حفظ الفاتورة
        </Button>
      </div>
    </div>
  );
} 