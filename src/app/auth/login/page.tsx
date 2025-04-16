'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  
  // OTP related states
  const [showOtpForm, setShowOtpForm] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpResendTimer, setOtpResendTimer] = useState(0);

  // التحقق من حالة المصادقة عند تحميل الصفحة
  useEffect(() => {
    // مسح مؤقت الجلسة
    sessionStorage.clear();
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // المستخدم مسجل بالفعل - توجيه مباشر إلى لوحة التحكم
        window.location.replace('/dashboard');
      } else {
        // المستخدم غير مسجل - إظهار نموذج تسجيل الدخول
        setIsAuthChecking(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // إرسال OTP بدلاً من تسجيل الدخول المباشر
  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    // منع التقديم أثناء حالة التحميل
    if (loading) return;
    
    if (!email || !password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // أولاً نتحقق من أن البريد الإلكتروني وكلمة المرور صحيحة (دون تسجيل الدخول)
      // ثم نرسل OTP إلى البريد الإلكتروني للتحقق
      
      // أرسل OTP
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          isRegistration: false
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
        setError(data.error || 'فشل في إرسال رمز التحقق');
      }
    } catch (err) {
      console.error('خطأ في إرسال OTP:', err);
      setError('حدث خطأ أثناء محاولة إرسال رمز التحقق');
    } finally {
      setLoading(false);
    }
  };

  // التحقق من OTP وتسجيل الدخول
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!otp) {
      setOtpError('الرجاء إدخال رمز التحقق');
      return;
    }
    
    setLoading(true);
    setOtpError('');
    
    try {
      // التحقق من رمز OTP
      const verifyResponse = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp,
          isRegistration: false
        }),
      });
      
      const verifyData = await verifyResponse.json();
      
      if (verifyData.success) {
        // إذا تم التحقق بنجاح، قم بتسجيل الدخول
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (userCredential.user) {
          console.log('تم تسجيل الدخول بنجاح');
          
          // إعادة تعيين جميع متغيرات الجلسة المتعلقة بالتوجيه
          sessionStorage.clear();
          
          // التوجيه المباشر بدون تأخير
          window.location.replace('/dashboard');
        }
      } else {
        setOtpError(verifyData.error || 'رمز التحقق غير صحيح');
      }
    } catch (err) {
      console.error('خطأ في التحقق من OTP أو تسجيل الدخول:', err);
      setOtpError('حدث خطأ أثناء التحقق من رمز التحقق');
    } finally {
      setLoading(false);
    }
  };

  // إعادة إرسال رمز OTP
  const handleResendOTP = async () => {
    if (otpResendTimer > 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          isRegistration: false
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
        setError(data.error || 'فشل في إعادة إرسال رمز التحقق');
      }
    } catch (error) {
      setError('حدث خطأ أثناء إعادة إرسال رمز التحقق');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // عرض شاشة التحميل أثناء التحقق من حالة المصادقة
  if (isAuthChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-24 h-24 relative mb-4">
            <Image
              src="/logo/EsalPlusLogo.svg"
              alt="EsalPlus Logo"
              width={96}
              height={96}
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-2xl font-bold">مرحباً بعودتك</CardTitle>
          <CardDescription>قم بتسجيل الدخول لإدارة فواتيرك</CardDescription>
        </CardHeader>
        <CardContent>
          {!showOtpForm ? (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium">
                  البريد الإلكتروني
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@domain.com"
                  required
                  className="text-right"
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium">
                  كلمة المرور
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="text-right"
                  dir="rtl"
                />
              </div>
              {error && (
                <div className="text-red-500 text-sm text-center">{error}</div>
              )}

              <Button
                type="submit"
                className="w-full bg-black hover:bg-gray-800 text-white font-medium py-2"
                disabled={loading}
              >
                {loading ? 'جاري الإرسال...' : 'إرسال رمز التحقق'}
              </Button>
              <div className="text-center text-sm">
                <span className="text-gray-600">ليس لديك حساب؟</span>{' '}
                <Link href="/auth/register" className="text-black hover:underline">
                  إنشاء حساب جديد
                </Link>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="text-center mb-4">
                <p className="mb-2">تم إرسال رمز التحقق إلى</p>
                <p className="font-semibold">{email}</p>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="otp" className="block text-sm font-medium">
                  رمز التحقق
                </label>
                <Input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="أدخل رمز التحقق المكون من 6 أرقام"
                  required
                  maxLength={6}
                  className="text-center font-semibold text-lg tracking-widest"
                  dir="ltr"
                />
                {otpError && (
                  <div className="text-red-500 text-sm text-center">{otpError}</div>
                )}
              </div>
              
              <Button
                type="submit"
                className="w-full bg-black hover:bg-gray-800 text-white font-medium py-2"
                disabled={loading}
              >
                {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
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