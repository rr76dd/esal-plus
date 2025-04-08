'use client';

import { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, AuthError } from 'firebase/auth';
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    // منع التقديم أثناء حالة التحميل
    if (loading) return;
    
    setLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      if (userCredential.user) {
        console.log('تم تسجيل الدخول بنجاح');
        
        // إعادة تعيين جميع متغيرات الجلسة المتعلقة بالتوجيه
        sessionStorage.clear();
        
        // التوجيه المباشر بدون تأخير
        window.location.replace('/dashboard');
      }
    } catch (err) {
      let errorMessage = 'حدث خطأ أثناء تسجيل الدخول';
      
      if (err instanceof Error) {
        const firebaseError = err as AuthError;
        switch (firebaseError.code) {
          case 'auth/invalid-email':
            errorMessage = 'البريد الإلكتروني غير صحيح';
            break;
          case 'auth/user-disabled':
            errorMessage = 'تم تعطيل هذا الحساب';
            break;
          case 'auth/user-not-found':
            errorMessage = 'لم يتم العثور على حساب بهذا البريد الإلكتروني';
            break;
          case 'auth/wrong-password':
            errorMessage = 'كلمة المرور غير صحيحة';
            break;
        }
      }
      console.error('خطأ في تسجيل الدخول:', err);
      setError(errorMessage);
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
              src="/logo.png"
              alt="Logo"
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
          <form onSubmit={handleLogin} className="space-y-4">
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
              {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
            </Button>
            <div className="text-center text-sm">
              <span className="text-gray-600">ليس لديك حساب؟</span>{' '}
              <Link href="/auth/register" className="text-black hover:underline">
                إنشاء حساب جديد
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 