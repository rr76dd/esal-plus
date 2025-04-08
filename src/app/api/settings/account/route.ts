import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase/admin';
import { v2 as cloudinary } from 'cloudinary';

// تكوين Cloudinary إذا لزم الأمر
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function DELETE(request: NextRequest) {
  try {
    // استخراج رمز المصادقة من الهيدرز
    const token = request.headers.get('Authorization')?.split('Bearer ')[1];
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح لك' },
        { status: 401 }
      );
    }
    
    // التحقق من رمز المصادقة
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    // 1. حذف بيانات النشاط التجاري
    try {
      // الحصول على البيانات أولاً للتحقق من وجود صورة
      const businessProfileDoc = await db.collection('businessProfiles').doc(uid).get();
      const businessData = businessProfileDoc.data();
      
      // حذف صورة الشعار من Cloudinary إذا وجدت
      if (businessData && businessData.logo) {
        try {
          // تحقق مما إذا كان المعرف هو URL كامل أو معرف فقط
          let publicId = businessData.logo;
          
          // إذا كان URL كامل، استخراج معرف الصورة
          if (typeof publicId === 'string' && publicId.includes('http')) {
            const urlParts = publicId.split('/');
            publicId = urlParts[urlParts.length - 1].split('?')[0];
          }
          
          // حذف الصورة
          await cloudinary.uploader.destroy(publicId);
          console.log(`تم حذف الصورة بنجاح: ${publicId}`);
        } catch (error) {
          console.error('خطأ في حذف صورة النشاط التجاري:', error);
          // نتابع العملية حتى لو فشل حذف الصورة
        }
      }
      
      // حذف الملف الشخصي للنشاط التجاري
      await db.collection('businessProfiles').doc(uid).delete();
      console.log(`تم حذف بيانات النشاط التجاري للمستخدم: ${uid}`);
      
      // حذف البيانات القديمة في مجموعة businesses أيضًا إذا كانت موجودة
      const oldBusinessDoc = await db.collection('businesses').doc(uid).get();
      if (oldBusinessDoc.exists) {
        await db.collection('businesses').doc(uid).delete();
        console.log(`تم حذف البيانات القديمة للنشاط التجاري للمستخدم: ${uid}`);
      }
    } catch (error) {
      console.error('خطأ في حذف بيانات النشاط التجاري:', error);
      // نتابع العملية رغم الخطأ
    }
    
    // 2. حذف جميع مستندات المستخدم في Firestore (العملاء، الفواتير، إلخ)
    try {
      // هنا يمكن إضافة المزيد من المجموعات التي يجب حذفها
      const collections = ['clients', 'invoices', 'invoice_items'];
      
      for (const collection of collections) {
        const querySnapshot = await db.collection(collection)
          .where('userId', '==', uid)
          .get();
          
        const batch = db.batch();
        let count = 0;
        
        querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
          count++;
        });
        
        if (count > 0) {
          await batch.commit();
          console.log(`تم حذف ${count} عنصر من مجموعة ${collection}`);
        }
      }
    } catch (error) {
      console.error('خطأ في حذف بيانات المستخدم:', error);
      // نتابع العملية رغم الخطأ
    }
    
    // 3. حذف حساب المستخدم من Firebase Authentication
    try {
      await auth.deleteUser(uid);
      console.log(`تم حذف حساب المستخدم: ${uid}`);
    } catch (error) {
      console.error('خطأ في حذف حساب المستخدم:', error);
      return NextResponse.json(
        { success: false, error: 'فشل في حذف الحساب' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم حذف الحساب بنجاح'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { success: false, error: 'فشل في حذف الحساب' },
      { status: 500 }
    );
  }
} 