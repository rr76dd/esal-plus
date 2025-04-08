import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebase/admin';

export async function PUT(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json();
    
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'كلمة المرور الحالية والجديدة مطلوبة' },
        { status: 400 }
      );
    }
    
    // استخراج رمز المصادقة من الكوكيز
    const sessionCookie = request.cookies.get('session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح لك' },
        { status: 401 }
      );
    }
    
    // التحقق من جلسة المستخدم
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    const uid = decodedClaims.uid;
    
    // تغيير كلمة المرور
    try {
      // نحتاج إلى استخدام Firebase client لتحديث كلمة المرور
      // هنا نجهز استجابة تحتوي على معلومات خاصة ليتم استخدامها في الواجهة
      return NextResponse.json({
        success: true,
        message: 'يرجى استكمال تغيير كلمة المرور في الواجهة',
        actionRequired: true,
        uid: uid
      });
    } catch (error: unknown) {
      console.error('Error updating password:', error);
      const errorMessage = error instanceof Error ? error.message : 'فشل في تحديث كلمة المرور';
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error('Error in password update route:', error);
    return NextResponse.json(
      { success: false, error: 'فشل في تحديث كلمة المرور' },
      { status: 500 }
    );
  }
} 