import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase/admin';
import { verifyToken } from '@/lib/firebase/admin';
import { v2 as cloudinary } from 'cloudinary';

// تكوين Cloudinary
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// وظيفة لإعادة ضبط صورة الشعار في حال وجود خطأ في تحميلها
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
    }

    const decodedToken = await verifyToken(token);
    const userId = decodedToken.uid;
    
    // الحصول على بيانات النشاط التجاري
    const businessDoc = await db.collection('businessProfiles').doc(userId).get();
    
    if (!businessDoc.exists) {
      return NextResponse.json({ error: 'Business not found', success: false }, { status: 404 });
    }

    const businessData = businessDoc.data() || {};
    
    // إذا كان هناك شعار، نحاول حذفه من Cloudinary
    if (businessData.logo && typeof businessData.logo === 'string' && businessData.logo.trim() !== '') {
      try {
        let publicId = businessData.logo;
        
        // إذا كان URL كامل، نستخرج معرف الصورة
        if (publicId.includes('http')) {
          const urlParts = publicId.split('/');
          // نتجاهل الاستعلام في نهاية الرابط
          publicId = urlParts[urlParts.length - 1].split('?')[0];
        }
        
        // معالجة المعرف لاستخراج المعرف الصحيح من الشكل business-logos/user-id/publicId
        if (publicId.includes('/')) {
          const parts = publicId.split('/');
          // يمكن أن يكون المعرف في الشكل business-logos/user-id/publicId
          // أو business-logos/publicId في الملفات القديمة
          // نتأكد من أخذ المعرف الصحيح حسب الهيكل
          if (parts.length >= 3 && parts[0] === 'business-logos' && parts[1] === userId) {
            // الهيكل الجديد: business-logos/user-id/publicId
            publicId = parts[2];
          } else if (parts.length >= 2 && parts[0] === 'business-logos') {
            // الهيكل القديم: business-logos/publicId
            publicId = parts[1];
          } else {
            // مجرد القسم الأخير
            publicId = parts.pop() || publicId;
          }
        }
        
        console.log(`محاولة حذف الصورة بمعرف: ${publicId}`);
        
        // محاولة حذف الصورة من Cloudinary
        try {
          // نحاول حذف الصورة باستخدام المعرف الكامل أولاً (مع مراعاة المجلد الخاص بالمستخدم)
          const fullPublicId = `business-logos/${userId}/${publicId}`;
          console.log('محاولة حذف باستخدام المعرف الكامل:', fullPublicId);
          
          // التحقق من وجود الصورة أولاً
          try {
            const resource = await cloudinary.api.resource(fullPublicId);
            console.log('تم العثور على الصورة:', resource.public_id);
          } catch (resourceError) {
            console.error('لم يتم العثور على الصورة في Cloudinary:', resourceError);
            // رغم ذلك نحاول الحذف
          }
          
          const deleteResult = await cloudinary.uploader.destroy(fullPublicId);
          console.log(`نتيجة حذف الصورة: ${JSON.stringify(deleteResult)}`);
          
          if (deleteResult.result === 'ok' || deleteResult.result === 'not found') {
            console.log(`تم حذف الصورة أو لم تكن موجودة: ${fullPublicId}`);
          } else {
            console.error(`فشل في حذف الصورة: ${fullPublicId}، النتيجة: ${deleteResult.result}`);
          }
        } catch (error) {
          console.error('خطأ أثناء حذف الصورة من Cloudinary:', error);
          // نتابع العملية حتى لو فشل الحذف
        }
      } catch (error) {
        console.error('خطأ في معالجة عنوان الصورة:', error);
      }
    } else {
      console.log('لا توجد صورة لحذفها');
    }
    
    // تحديث السجل في Firestore لإزالة الشعار
    await db.collection('businessProfiles').doc(userId).update({
      logo: null
    });
    
    console.log(`تم إعادة ضبط الشعار للمستخدم: ${userId}`);
    
    return NextResponse.json({
      message: 'Logo reset successfully',
      success: true
    });
  } catch (error) {
    console.error('Error resetting logo:', error);
    return NextResponse.json({ 
      error: 'Failed to reset logo', 
      success: false 
    }, { status: 500 });
  }
} 