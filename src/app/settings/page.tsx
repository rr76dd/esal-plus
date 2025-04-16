'use client';

import { useState, useEffect, useCallback } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Pencil, LogOut, MailIcon, PhoneIcon, TwitterIcon } from 'lucide-react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import { signOut } from '@/lib/firebase/auth';

interface BusinessProfile {
  businessName: string;
  email: string;
  phone?: string;
  logo?: string;
}

interface PasswordData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("business");
  const [profile, setProfile] = useState<BusinessProfile>({
    businessName: '',
    email: '',
    phone: '',
    logo: ''
  });
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [passwordData, setPasswordData] = useState<PasswordData>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const fetchProfile = useCallback(async () => {
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        router.push('/auth/login');
        return;
      }

      const response = await fetch('/api/settings/profile', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      console.log('Fetched profile data:', data);
      
      if (!data.error) {
        const profileData = {
          businessName: data.name,
          email: data.email,
          phone: data.phone || '',
          logo: data.logo || ''
        };
        setProfile(profileData);
        
        if (data.logo) {
          console.log('Setting logo preview to:', data.logo);
          
          // تحقق من أن الرابط يستخدم res.cloudinary.com وليس asset.cloudinary.com
          let logoUrl = data.logo;
          if (logoUrl.includes('asset.cloudinary.com')) {
            logoUrl = logoUrl.replace('asset.cloudinary.com', 'res.cloudinary.com');
            console.log('Fixed logo URL from asset to res:', logoUrl);
          }
          
          // إضافة معلمات التحويل إذا لم تكن موجودة
          if (!logoUrl.includes('c_fill')) {
            const baseUrl = logoUrl.split('/upload/')[0] + '/upload/';
            const publicId = logoUrl.split('/upload/')[1].split('?')[0];
            logoUrl = `${baseUrl}c_fill,g_center,h_500,w_500,q_auto,f_auto/${publicId}`;
            console.log('Added transformations to logo URL:', logoUrl);
          }
          
          // Add cache-busting timestamp for Cloudinary image
          const logoWithCacheBusting = logoUrl.includes('?') 
            ? `${logoUrl}&t=${new Date().getTime()}` 
            : `${logoUrl}?t=${new Date().getTime()}`;
          
          setLogoPreview(logoWithCacheBusting);
          
          // تحديث وضع الصورة في الملف الشخصي
          profileData.logo = logoUrl;
          setProfile(profileData);
        } else {
          setLogoPreview(null);
        }
      } else {
        toast.error(data.error || 'فشل في جلب البيانات');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('فشل في جلب البيانات');
    } finally {
      setInitialLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push('/auth/login');
        return;
      }
      fetchProfile();
    });

    return () => unsubscribe();
  }, [router, fetchProfile]);

  useEffect(() => {
    if (logoError) {
      const timer = setTimeout(() => {
        setLogoError(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [logoError]);

  // إضافة فحص مسبق للصورة للتأكد من صلاحيتها
  useEffect(() => {
    if (profile.logo && profile.logo.trim() !== '' && !logoError) {
      const img = document.createElement('img') as HTMLImageElement;
      
      img.onload = () => {
        // الصورة تم تحميلها بنجاح
        setLogoError(null);
      };
      
      img.onerror = () => {
        // فشل في تحميل الصورة
        console.log('Pre-check: Logo image failed to load');
        setLogoError('فشل في تحميل صورة الشعار، يرجى تحديث الصفحة أو رفع شعار جديد');
        resetCorruptedLogo();
      };
      
      // إضافة معلمة لمنع التخزين المؤقت
      const cacheParam = `t=${new Date().getTime()}`;
      const imgSrc = profile.logo.includes('?') 
        ? `${profile.logo}&${cacheParam}` 
        : `${profile.logo}?${cacheParam}`;
      
      img.src = imgSrc;
    }
  }, [profile.logo]);

  // وظيفة لإعادة ضبط الشعار في قاعدة البيانات إذا كان هناك خطأ في تحميله
  const resetCorruptedLogo = async () => {
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      
      const token = await currentUser.getIdToken();
      
      // إرسال طلب لإعادة ضبط الشعار
      const response = await fetch('/api/settings/profile/reset-logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('Logo reset successfully in database');
        // تحديث الملف الشخصي المحلي لإزالة الشعار
        setProfile(prev => ({ ...prev, logo: '' }));
        setLogoPreview(null);
      }
    } catch (error) {
      console.error('Error resetting corrupted logo:', error);
    }
  };

  // وظيفة لمعالجة خطأ تحميل الصورة
  const handleLogoError = () => {
    console.log('Logo image failed to load');
    setLogoError('فشل في تحميل صورة الشعار، يرجى تحديث الصفحة أو رفع شعار جديد');
  };

  // وظيفة مبسطة لمعالجة الصور
  const processAndOptimizeImage = async (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      // تقليل حجم وضغط الصورة
      const img = document.createElement('img') as HTMLImageElement;
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        
        // التحقق من أبعاد الصورة
        if (img.width < 200 || img.height < 200) {
          reject(new Error('أبعاد الصورة صغيرة جداً. يجب أن تكون على الأقل 200×200 بيكسل'));
          return;
        }
        
        if (img.width > 4000 || img.height > 4000) {
          reject(new Error('أبعاد الصورة كبيرة جداً. يجب أن تكون أقل من 4000×4000 بيكسل'));
          return;
        }
        
        // ضغط الصورة
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // تقليل حجم الصورة
        const maxSize = 800;
        let newWidth = img.width;
        let newHeight = img.height;
        
        if (img.width > maxSize || img.height > maxSize) {
          if (img.width > img.height) {
            newWidth = maxSize;
            newHeight = Math.round((img.height / img.width) * maxSize);
          } else {
            newHeight = maxSize;
            newWidth = Math.round((img.width / img.height) * maxSize);
          }
        }
        
        // تعيين أبعاد الكانفس
        canvas.width = newWidth;
        canvas.height = newHeight;
        
        if (!ctx) {
          reject(new Error('فشل في إنشاء سياق الكانفس'));
          return;
        }
        
        // رسم الصورة على الكانفس مع تحسين جودة التصغير
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        
        // ضغط الصورة بجودة متوسطة لتقليل الحجم
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('فشل في تحويل الصورة'));
            return;
          }
          
          // إنشاء ملف من البلوب
          const optimizedFile = new File([blob], 'optimized_' + file.name.replace(/\s+/g, '_'), {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          
          console.log(`تم تحسين الصورة: ${file.size/1024}KB -> ${optimizedFile.size/1024}KB`);
          resolve(optimizedFile);
        }, 'image/jpeg', 0.75); // ضغط بنسبة 75%
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('فشل في قراءة الصورة'));
      };
      
      img.src = objectUrl;
    });
  };

  const handleLogoClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/jpg,image/png';
    
    input.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      
      if (!file) return;
      
      // التحقق من نوع الملف
      if (!['image/jpeg', 'image/jpg', 'image/png'].includes(file.type.toLowerCase())) {
        toast.error('صيغة الملف غير مدعومة. الصيغ المدعومة هي: JPG, JPEG, PNG');
        return;
      }
      
      // التحقق من حجم الملف (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم الملف يجب أن يكون أقل من 5 ميجابايت');
        return;
      }
      
      // إظهار مؤشر التحميل
      toast.loading('جاري معالجة الصورة...', { id: 'image-processing' });
      
      try {
        // معالجة الصورة وتحسينها
        const optimizedFile = await processAndOptimizeImage(file);
        
        // تعيين الصورة المحسنة
        setLogoFile(optimizedFile);
        setLogoError(null);
        
        // إظهار معاينة الصورة
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          // تخزين المعاينة مع معلومات إضافية لضمان العرض الصحيح
          setLogoPreview(dataUrl);
          setLogoError(null);
          
          // إغلاق مؤشر التحميل مع رسالة نجاح
          toast.dismiss('image-processing');
          toast.success('تم اختيار الصورة بنجاح');
          
          // تحقق يدوي من تحميل الصورة
          setTimeout(() => {
            const previewImage = document.querySelector('.logo-preview-image') as HTMLImageElement;
            if (previewImage) {
              previewImage.onload = () => {
                console.log('Preview image loaded correctly');
                previewImage.style.opacity = '1';
              };
            }
          }, 100);
        };
        reader.readAsDataURL(optimizedFile);
      } catch (error) {
        // إغلاق مؤشر التحميل مع رسالة خطأ
        toast.dismiss('image-processing');
        toast.error(error instanceof Error ? error.message : 'فشل في معالجة الصورة');
        console.error('Error processing image:', error);
      }
    });
    
    input.click();
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      toast.error('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    
    setPasswordLoading(true);
    
    try {
      const user = auth.currentUser;
      
      if (!user || !user.email) {
        toast.error('يجب تسجيل الدخول أولاً');
        setPasswordLoading(false);
        return;
      }
      
      // Firebase يتطلب إعادة المصادقة قبل تغيير كلمة المرور
      const credential = await import('firebase/auth').then(
        ({ EmailAuthProvider }) => EmailAuthProvider.credential(user.email!, passwordData.currentPassword)
      );
      
      // إعادة المصادقة
      await import('firebase/auth').then(
        ({ reauthenticateWithCredential }) => reauthenticateWithCredential(user, credential)
      );
      
      // تغيير كلمة المرور
      await import('firebase/auth').then(
        ({ updatePassword }) => updatePassword(user, passwordData.newPassword)
      );
      
      toast.success('تم تغيير كلمة المرور بنجاح');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: unknown) {
      console.error('Error changing password:', error);
      
      // التعامل مع أخطاء Firebase المختلفة
      let errorMessage = 'حدث خطأ أثناء تغيير كلمة المرور';
      
      // نفترض أن خطأ Firebase له هيكل معين
      if (typeof error === 'object' && error !== null && 'code' in error) {
        const firebaseError = error as { code: string };
        if (firebaseError.code === 'auth/wrong-password') {
          errorMessage = 'كلمة المرور الحالية غير صحيحة';
        } else if (firebaseError.code === 'auth/weak-password') {
          errorMessage = 'كلمة المرور الجديدة ضعيفة جدًا';
        } else if (firebaseError.code === 'auth/requires-recent-login') {
          errorMessage = 'الرجاء تسجيل الخروج وإعادة تسجيل الدخول لتغيير كلمة المرور';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'حذف') {
      toast.error('يرجى كتابة "حذف" للتأكيد');
      return;
    }

    try {
      const currentUser = auth.currentUser;
      const token = await currentUser?.getIdToken();
      
      if (!token) {
        toast.error('يجب تسجيل الدخول أولاً');
        return;
      }

      const response = await fetch('/api/settings/account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (data.success) {
        toast.success('تم حذف الحساب بنجاح');
        
        // تسجيل الخروج بعد حذف الحساب
        await auth.signOut();
        
        // إعادة التوجيه إلى صفحة تسجيل الدخول
        router.push('/auth/login');
      } else {
        toast.error(data.error || 'فشل في حذف الحساب');
      }
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('حدث خطأ أثناء حذف الحساب');
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await signOut();
      toast.success('تم تسجيل الخروج بنجاح');
      router.push('/auth/login');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('فشل في تسجيل الخروج');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateBusiness = async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        toast.error('يجب تسجيل الدخول أولاً');
        return;
      }

      const formData = new FormData();
      formData.append('name', profile.businessName);
      formData.append('email', profile.email);
      formData.append('phone', profile.phone || '');
      
      if (logoFile) {
        formData.append('logo', logoFile);
      } else if (profile.logo) {
        formData.append('logoUrl', profile.logo);
      }

      const response = await fetch('/api/settings/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (response.ok && !data.error) {
        toast.success('تم تحديث معلومات النشاط بنجاح');
        // تحديث المعلومات المخزنة محلياً إذا تم إرجاع معلومات جديدة
        if (data.logo) {
          setProfile(prev => ({ ...prev, logo: data.logo }));
          setLogoPreview(data.logo);
        }
        setLogoFile(null);
      } else {
        toast.error(data.error || 'فشل في تحديث المعلومات');
      }
    } catch (error) {
      console.error('Error updating business info:', error);
      toast.error('فشل في تحديث المعلومات');
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-semibold mb-8">الإعدادات</h1>
      
      <div className="border-b flex gap-2 overflow-x-auto mb-6">
        <button 
          onClick={() => setActiveTab("business")}
          className={`px-4 py-2 ${activeTab === "business" ? "border-b-2 border-black text-black font-medium" : "text-gray-500"}`}
        >
          إعدادات النشاط
        </button>
        <button 
          onClick={() => setActiveTab("security")}
          className={`px-4 py-2 ${activeTab === "security" ? "border-b-2 border-black text-black font-medium" : "text-gray-500"}`}
        >
          تسجيل الدخول والأمان
        </button>
        <button 
          onClick={() => setActiveTab("about")}
          className={`px-4 py-2 ${activeTab === "about" ? "border-b-2 border-black text-black font-medium" : "text-gray-500"}`}
        >
          عن إيصال بلس
        </button>
      </div>
      
      {activeTab === "business" && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-lg border shadow-sm">
            <div className="text-center mb-8">
              <h2 className="text-xl font-medium mb-6 text-black">إعدادات النشاط</h2>
              
              <div className="flex flex-col items-center justify-center mb-6">
                <div 
                  className="relative w-32 h-32 rounded-full overflow-hidden cursor-pointer border border-gray-200 mb-4 hover:shadow-md transition-all"
                  onClick={handleLogoClick}
                >
                  {(logoPreview || profile.logo) && !logoError ? (
                    <Image
                      src={logoPreview || (profile.logo ? `${profile.logo}${profile.logo.includes('?') ? '&' : '?'}t=${new Date().getTime()}` : '/next.svg')}
                      alt="شعار النشاط"
                      fill
                      sizes="(max-width: 128px) 100vw"
                      className="object-cover"
                      unoptimized={true}
                      onError={() => handleLogoError()}
                    />
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center">
                      <Pencil className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleLogoClick}
                    className="bg-black text-white hover:bg-gray-800"
                    size="sm"
                  >
                    رفع شعار جديد
                  </Button>
                  {(logoPreview || profile.logo) && !logoError && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setLogoPreview(null);
                        setProfile(prev => ({ ...prev, logo: '' }));
                      }}
                      className="border-gray-300 hover:bg-gray-100"
                      size="sm"
                    >
                      إزالة الشعار
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="max-w-2xl mx-auto">
                <div className="space-y-6">
                  <div>
                    <Label htmlFor="businessName" className="mb-2 block text-black text-right">اسم النشاط</Label>
                    <Input
                      id="businessName"
                      value={profile.businessName}
                      onChange={(e) => setProfile({...profile, businessName: e.target.value})}
                      className="w-full border-gray-300 focus:border-black focus:ring-black rounded-lg py-2 px-4 text-right"
                      placeholder="أدخل اسم النشاط"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="email" className="mb-2 block text-black text-right">البريد الإلكتروني</Label>
                    <Input
                      id="email"
                      type="email"
                      value={profile.email}
                      onChange={(e) => setProfile({...profile, email: e.target.value})}
                      className="w-full border-gray-300 focus:border-black focus:ring-black rounded-lg py-2 px-4 text-right"
                      placeholder="أدخل البريد الإلكتروني"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="phone" className="mb-2 block text-black text-right">رقم الهاتف</Label>
                    <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                      <Input
                        id="phone"
                        value={profile.phone}
                        onChange={(e) => setProfile({...profile, phone: e.target.value})}
                        className="flex-1 border-0 focus:border-0 focus:ring-0 text-right"
                        placeholder="5xxxxxxxx"
                      />
                      <div className="bg-gray-100 px-4 flex items-center justify-center text-gray-600 border-l border-gray-300">
                        +966
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-8 text-center">
                  <Button 
                    onClick={handleUpdateBusiness}
                    className="bg-black text-white hover:bg-gray-800 px-8 py-2"
                    disabled={loading}
                  >
                    {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === "security" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-black">تغيير كلمة المرور</h2>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="currentPassword" className="mb-2 block text-black">كلمة المرور الحالية</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  required
                  className="border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
              
              <div>
                <Label htmlFor="newPassword" className="mb-2 block text-black">كلمة المرور الجديدة</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  required
                  className="border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
              
              <div>
                <Label htmlFor="confirmPassword" className="mb-2 block text-black">تأكيد كلمة المرور الجديدة</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  required
                  className="border-gray-300 focus:border-black focus:ring-black"
                />
              </div>
              
              <Button 
                type="submit" 
                disabled={passwordLoading}
                className="bg-black text-white hover:bg-gray-800 mt-2"
              >
                {passwordLoading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
              </Button>
            </form>
          </div>
          
          <div className="p-6 border rounded-lg shadow-sm bg-white">
            <h2 className="text-lg font-medium mb-4 text-black">تسجيل الخروج</h2>
            <p className="text-gray-600 mb-4">تسجيل الخروج من جميع الأجهزة وإنهاء جلسة العمل الحالية</p>
            <Button 
              onClick={handleLogout} 
              variant="destructive" 
              className="w-full sm:w-auto flex items-center gap-2 bg-black text-white hover:bg-gray-800"
              disabled={loading}
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </Button>
          </div>
          
          <div className="p-6 border border-red-200 rounded-lg shadow-sm bg-white">
            <h2 className="text-lg font-medium mb-4 text-red-600">حذف الحساب</h2>
            <p className="text-gray-600 mb-4">سيؤدي هذا إلى حذف حسابك ومعلوماتك بشكل نهائي ولا يمكن استرجاعها</p>
            
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" className="bg-red-600 hover:bg-red-700 text-white">
                  حذف الحساب نهائياً
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle className="text-red-600">تأكيد حذف الحساب</DialogTitle>
                  <DialogDescription>
                    هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بياناتك بشكل نهائي.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <p className="mb-4 text-red-600 text-sm">
                    لتأكيد الحذف، اكتب &quot;حذف&quot; في الحقل أدناه
                  </p>
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="اكتب &quot;حذف&quot;"
                    className="border-gray-300 focus:border-red-500 focus:ring-red-500"
                  />
                </div>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setDeleteDialogOpen(false)}
                    className="ml-2 border-gray-300"
                  >
                    إلغاء
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== 'حذف'}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    تأكيد الحذف
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}
      
      {activeTab === "about" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h2 className="text-xl font-medium mb-4 text-black">عن إيصال بلس</h2>
            <p className="text-gray-700 leading-relaxed mb-4 text-right">
              إيصال بلس هي منصة متكاملة لإدارة الفواتير والإيصالات الإلكترونية بطريقة سهلة وفعالة. تهدف المنصة إلى مساعدة أصحاب الأعمال على إدارة معاملاتهم المالية وتنظيمها بكل سهولة وأمان.
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-black text-right">تواصل معنا</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button 
                className="flex items-center justify-center w-full bg-black text-white hover:bg-gray-800"
                onClick={() => window.open('mailto:support@esalplus.com', '_blank')}
              >
                <MailIcon className="w-4 h-4 mr-2 ml-2" />
                البريد الإلكتروني
              </Button>
              <Button 
                className="flex items-center justify-center w-full bg-black text-white hover:bg-gray-800"
                onClick={() => window.open('tel:+966550000000', '_blank')}
              >
                <PhoneIcon className="w-4 h-4 mr-2 ml-2" />
                رقم الهاتف
              </Button>
              <Button 
                className="flex items-center justify-center w-full bg-black text-white hover:bg-gray-800"
                onClick={() => window.open('https://twitter.com/esalplus', '_blank')}
              >
                <TwitterIcon className="w-4 h-4 mr-2 ml-2" />
                تويتر المنصة
              </Button>
              <Button 
                className="flex items-center justify-center w-full bg-black text-white hover:bg-gray-800"
                onClick={() => window.open('https://twitter.com/esalplus_dev', '_blank')}
              >
                <TwitterIcon className="w-4 h-4 mr-2 ml-2" />
                تويتر المطور
              </Button>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-black">روابط مهمة</h2>
            <div className="flex space-x-3">
              <Button 
                className="w-full bg-black text-white hover:bg-gray-800"
                onClick={() => window.open('https://esalplus.com/privacy', '_blank')}
              >
                سياسة الخصوصية
              </Button>
              <Button 
                className="w-full bg-black text-white hover:bg-gray-800"
                onClick={() => window.open('https://esalplus.com/terms', '_blank')}
              >
                شروط الاستخدام
              </Button>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h2 className="text-lg font-medium mb-4 text-black">إصدار المنصة</h2>
            <div className="flex items-center bg-gray-50 p-3 rounded-lg justify-center">
              <span className="font-medium text-gray-700">الإصدار التجريبي (Beta)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 