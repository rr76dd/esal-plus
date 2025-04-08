'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile, AuthError } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Image from 'next/image';
import { RequiredField } from '@/components/RequiredField';
import { Checkbox } from '@/components/ui/checkbox';

interface FormData {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

export default function RegisterPage() {
  const [formData, setFormData] = useState<FormData>({ fullName: '', email: '', password: '', confirmPassword: '', acceptTerms: false });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = () => {
    if (!formData.fullName.trim()) {
      setErrors({ fullName: 'الرجاء إدخال الاسم الكامل' });
      return false;
    }
    if (!formData.email.trim()) {
      setErrors({ email: 'الرجاء إدخال البريد الإلكتروني' });
      return false;
    }
    if (formData.password.length < 6) {
      setErrors({ password: 'يجب أن تكون كلمة المرور 6 أحرف على الأقل' });
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrors({ confirmPassword: 'كلمة المرور غير متطابقة' });
      return false;
    }
    if (!formData.acceptTerms) {
      setErrors({ acceptTerms: 'يجب الموافقة على الشروط والأحكام' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!validateForm()) return;

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      
      await updateProfile(userCredential.user, {
        displayName: formData.fullName
      });

      // استخدام window.location بدلاً من router لإعادة تحميل التطبيق
      window.location.href = '/dashboard';
    } catch (error) {
      const authError = error as AuthError;
      // ترجمة رسائل الخطأ من Firebase
      const errorCode = authError.code;
      let errorMessage = 'حدث خطأ غير متوقع. الرجاء المحاولة مرة أخرى';
      
      switch (errorCode) {
        case 'auth/email-already-in-use':
          errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
          break;
        case 'auth/invalid-email':
          errorMessage = 'عنوان البريد الإلكتروني غير صحيح';
          break;
        case 'auth/operation-not-allowed':
          errorMessage = 'تسجيل الحساب غير مفعل حالياً';
          break;
        case 'auth/weak-password':
          errorMessage = 'كلمة المرور ضعيفة جداً';
          break;
      }
      
      setServerError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 flex flex-col items-center">
          <Image
            src="/logo.png"
            alt="Logo"
            width={150}
            height={40}
            className="mb-4"
          />
          <CardTitle className="text-2xl font-bold">إنشاء حساب جديد</CardTitle>
          <CardDescription>
            قم بإنشاء حسابك للبدء في إدارة فواتيرك
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName" className="font-medium">الاسم الكامل</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="أدخل اسمك الكامل"
                value={formData.fullName}
                onChange={handleChange}
                required
                dir="rtl"
              />
              {errors.fullName && (
                <div className="text-red-500 text-sm text-right">
                  {errors.fullName}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="font-medium">البريد الإلكتروني</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="أدخل بريدك الإلكتروني"
                value={formData.email}
                onChange={handleChange}
                required
                dir="rtl"
              />
              {errors.email && (
                <div className="text-red-500 text-sm text-right">
                  {errors.email}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="font-medium">كلمة المرور</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                dir="rtl"
              />
              {errors.password && (
                <div className="text-red-500 text-sm text-right">
                  {errors.password}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-medium">تأكيد كلمة المرور</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="أعد إدخال كلمة المرور"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                dir="rtl"
              />
              {errors.confirmPassword && (
                <div className="text-red-500 text-sm text-right">
                  {errors.confirmPassword}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="acceptTerms"
                name="acceptTerms"
                checked={formData.acceptTerms}
                onCheckedChange={(checked: boolean) => 
                  setFormData(prev => ({ ...prev, acceptTerms: checked }))
                }
              />
              <Label htmlFor="acceptTerms" className="text-sm">
                أوافق على{' '}
                <Link href="/terms" className="text-black hover:underline">
                  الشروط والأحكام
                </Link>
              </Label>
            </div>
            {serverError && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm text-right">
                {serverError}
              </div>
            )}
            <Button
              type="submit"
              className="w-full bg-black hover:bg-black/90 text-white"
              disabled={loading}
            >
              {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
            </Button>
            <div className="text-center text-sm">
              لديك حساب بالفعل؟{' '}
              <Link href="/auth/login" className="text-black hover:underline">
                تسجيل الدخول
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 