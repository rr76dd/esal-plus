'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from 'lucide-react';
import { customerServices } from '@/lib/firebase/services/customerServices';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RequiredField } from '@/components/RequiredField';
import { auth } from '@/lib/firebase/config';
import { LoadingIndicator } from '@/components/LoadingIndicator';

export default function EditClient({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    company: '',
    address: ''
  });

  useEffect(() => {
    const fetchCustomer = async () => {
      if (!params.id) {
        setError('معرف العميل غير صحيح');
        setLoading(false);
        return;
      }

      try {
        const customer = await customerServices.getCustomerById(params.id);
        if (!customer) {
          setError('العميل غير موجود');
          setLoading(false);
          return;
        }

        setFormData({
          fullName: customer.fullName,
          email: customer.email || '',
          phone: customer.phone || '',
          company: customer.company || '',
          address: customer.address || ''
        });
      } catch (error) {
        console.error('Error fetching customer:', error);
        setError('حدث خطأ أثناء جلب بيانات العميل');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomer();
  }, [params.id]);

  const handleSubmit = async () => {
    try {
      if (!formData.fullName.trim()) {
        setError('يرجى إدخال اسم العميل');
        return;
      }

      // تأكد من وجود المستخدم
      if (!auth.currentUser) {
        setError('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');
        setTimeout(() => router.push('/auth/login'), 2000);
        return;
      }

      setSaveLoading(true);
      setError(null);

      // تحديث بيانات العميل
      await customerServices.updateCustomer(params.id, {
        fullName: formData.fullName,
        email: formData.email || '',
        phone: formData.phone || '',
        company: formData.company || '',
        address: formData.address || ''
      });

      // العودة إلى صفحة العملاء
      router.push('/clients');
    } catch (error) {
      console.error('Error updating client:', error);
      const errorMessage = error instanceof Error ? error.message : 'حدث خطأ أثناء تحديث بيانات العميل';
      setError(errorMessage);
    } finally {
      setSaveLoading(false);
    }
  };

  const handleCancel = () => {
    router.push('/clients');
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
            className="mt-4"
            onClick={() => router.push('/clients')}
          >
            العودة إلى قائمة العملاء
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
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
          <h1 className="text-3xl font-bold mr-2">تعديل بيانات العميل</h1>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* معلومات العميل */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>معلومات العميل</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                <RequiredField />
                الاسم الكامل
              </label>
              <Input
                value={formData.fullName}
                onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                placeholder="أدخل الاسم الكامل للعميل"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                البريد الإلكتروني
              </label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="البريد الإلكتروني (اختياري)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                رقم الجوال
              </label>
              <Input
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="رقم الجوال (اختياري)"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                اسم الشركة
              </label>
              <Input
                value={formData.company}
                onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                placeholder="اسم الشركة (اختياري)"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">
                العنوان
              </label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="العنوان (اختياري)"
                rows={3}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* أزرار التحكم */}
      <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 mt-8">
        <Button 
          variant="outline" 
          onClick={handleCancel}
          className="w-full sm:w-[200px] py-4 text-lg"
          disabled={saveLoading}
        >
          إلغاء
        </Button>
        <Button 
          onClick={handleSubmit} 
          className="w-full sm:w-[200px] py-4 text-lg bg-black hover:bg-black/90 text-white"
          disabled={saveLoading}
        >
          {saveLoading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </Button>
      </div>
    </div>
  );
} 