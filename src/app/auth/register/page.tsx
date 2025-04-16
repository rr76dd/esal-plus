'use client';

import { useState } from 'react';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Image from 'next/image';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

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
  
  // OTP related states
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpResendTimer, setOtpResendTimer] = useState(0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateForm = () => {
    const newErrors: Partial<FormData> = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'الرجاء إدخال الاسم الكامل';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'الرجاء إدخال البريد الإلكتروني';
    }
    
    if (formData.password.length < 6) {
      newErrors.password = 'يجب أن تكون كلمة المرور 6 أحرف على الأقل';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'كلمة المرور غير متطابقة';
    }
    
    if (!formData.acceptTerms) {
      newErrors.acceptTerms = 'يجب الموافقة على الشروط والأحكام';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // رسالة OTP يتم إرسالها إلى البريد الإلكتروني
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setServerError('');
    
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          isRegistration: true
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setShowOtpForm(true);
        // بدء مؤقت لإعادة الإرسال (2 دقائق)
        setOtpResendTimer(120);
        const timer = setInterval(() => {
          setOtpResendTimer(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setServerError(data.error || 'فشل في إرسال رمز التحقق');
      }
    } catch (error) {
      setServerError('حدث خطأ أثناء إرسال رمز التحقق');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // التحقق من رمز OTP وإكمال التسجيل
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp) {
      setOtpError('الرجاء إدخال رمز التحقق');
      return;
    }
    
    setLoading(true);
    setOtpError('');
    
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          otp,
          password: formData.password,
          fullName: formData.fullName,
          isRegistration: true
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // تم إنشاء المستخدم بنجاح، قم بتسجيل الدخول
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );
        
        await updateProfile(userCredential.user, {
          displayName: formData.fullName
        });
        
        // توجيه المستخدم إلى لوحة التحكم
        window.location.href = '/dashboard';
      } else {
        setOtpError(data.error || 'فشل في التحقق من رمز التحقق');
      }
    } catch (error) {
      setOtpError('حدث خطأ أثناء التحقق من رمز التحقق');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // إعادة إرسال رمز OTP
  const handleResendOTP = async () => {
    if (otpResendTimer > 0) return;
    
    setLoading(true);
    setServerError('');
    
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          isRegistration: true
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // تم إرسال OTP بنجاح، ابدأ المؤقت مرة أخرى
        setOtpResendTimer(120);
        const timer = setInterval(() => {
          setOtpResendTimer(prev => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setServerError(data.error || 'فشل في إعادة إرسال رمز التحقق');
      }
    } catch (error) {
      setServerError('حدث خطأ أثناء إعادة إرسال رمز التحقق');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-24 h-24 relative mb-4">
            <Image
              src="/logo.png"
              alt="Logo"
              width={96}
              height={96}
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold">إنشاء حساب جديد</CardTitle>
          <CardDescription>سجل في المنصة لإدارة فواتيرك</CardDescription>
        </CardHeader>
        <CardContent>
          {!showOtpForm ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              {serverError && (
                <div className="bg-red-50 p-3 rounded-md text-red-500 text-center text-sm">
                  {serverError}
                </div>
              )}
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
              <div className="flex items-start space-x-2 space-x-reverse rtl:space-x-reverse">
                <Checkbox
                  id="acceptTerms"
                  name="acceptTerms"
                  checked={formData.acceptTerms}
                  onCheckedChange={(checked) => 
                    setFormData(prev => ({ ...prev, acceptTerms: checked === true }))}
                />
                <Label htmlFor="acceptTerms" className="text-sm text-gray-700 cursor-pointer mr-2">
                  أوافق على <Link href="/terms" className="underline text-black">الشروط والأحكام</Link>
                </Label>
              </div>
              {errors.acceptTerms && (
                <div className="text-red-500 text-sm text-right">
                  {errors.acceptTerms}
                </div>
              )}
              <Button
                type="submit"
                className="w-full bg-black hover:bg-gray-800 text-white py-2"
                disabled={loading}
              >
                {loading ? 'جاري إرسال رمز التحقق...' : 'إرسال رمز التحقق'}
              </Button>
              <div className="text-center text-sm">
                لديك حساب بالفعل؟{' '}
                <Link href="/auth/login" className="text-black hover:underline">
                  تسجيل الدخول
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              {serverError && (
                <div className="bg-red-50 p-3 rounded-md text-red-500 text-center text-sm">
                  {serverError}
                </div>
              )}
              
              <div className="text-center mb-4">
                <p className="mb-2">تم إرسال رمز التحقق إلى</p>
                <p className="font-semibold">{formData.email}</p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="otp" className="font-medium">رمز التحقق</Label>
                <Input
                  id="otp"
                  name="otp"
                  type="text"
                  placeholder="أدخل رمز التحقق المكون من 6 أرقام"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  maxLength={6}
                  className="text-center font-semibold text-lg tracking-widest"
                  dir="ltr"
                />
                {otpError && (
                  <div className="text-red-500 text-sm text-center">
                    {otpError}
                  </div>
                )}
              </div>
              
              <Button
                type="submit"
                className="w-full bg-black hover:bg-gray-800 text-white py-2"
                disabled={loading}
              >
                {loading ? 'جاري التحقق...' : 'تأكيد رمز التحقق'}
              </Button>
              
              <div className="text-center mt-4">
                <p className="text-sm text-gray-600 mb-2">
                  لم تستلم الرمز؟{' '}
                  {otpResendTimer > 0 ? (
                    <span>يمكنك طلب رمز جديد بعد {Math.floor(otpResendTimer / 60)}:{(otpResendTimer % 60).toString().padStart(2, '0')}</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleResendOTP}
                      className="text-black hover:underline focus:outline-none"
                      disabled={loading}
                    >
                      إعادة إرسال الرمز
                    </button>
                  )}
                </p>
              </div>
              
              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpForm(false);
                    setOtp('');
                    setOtpError('');
                  }}
                  className="text-black hover:underline"
                >
                  العودة للخلف
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 