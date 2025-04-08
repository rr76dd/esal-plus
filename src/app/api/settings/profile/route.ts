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

// وظيفة لنقل البيانات من مجموعة 'businesses' إلى 'businessProfiles'
async function migrateBusinessData(userId: string) {
  try {
    // التحقق من وجود بيانات في مجموعة 'businessProfiles'
    const businessProfileDoc = await db.collection('businessProfiles').doc(userId).get();
    
    // إذا كانت البيانات موجودة بالفعل، فلا داعي للنقل
    if (businessProfileDoc.exists) {
      return;
    }
    
    // التحقق من وجود بيانات في مجموعة 'businesses'
    const businessDoc = await db.collection('businesses').doc(userId).get();
    
    // إذا كانت البيانات موجودة، قم بنقلها
    if (businessDoc.exists && businessDoc.data()) {
      // استخدام business Data لتجنب خطأ Type
      const data = businessDoc.data() || {};
      // نسخ البيانات إلى مجموعة 'businessProfiles'
      await db.collection('businessProfiles').doc(userId).set(data);
      console.log(`تم نقل بيانات النشاط التجاري للمستخدم: ${userId}`);
    }
  } catch (error) {
    console.error('خطأ أثناء نقل بيانات النشاط التجاري:', error);
  }
}

// وظيفة لحذف البيانات القديمة من مجموعة 'businesses' بعد نقلها بنجاح
async function deleteOldBusinessData(userId: string) {
  try {
    // التحقق من وجود بيانات في مجموعة 'businesses'
    const businessDoc = await db.collection('businesses').doc(userId).get();
    
    // إذا كانت البيانات موجودة، قم بحذفها
    if (businessDoc.exists) {
      await db.collection('businesses').doc(userId).delete();
      console.log(`تم حذف البيانات القديمة للمستخدم: ${userId}`);
    }
  } catch (error) {
    console.error('خطأ أثناء حذف بيانات النشاط التجاري القديمة:', error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedToken = await verifyToken(token);
    
    // نقل البيانات إذا لزم الأمر
    await migrateBusinessData(decodedToken.uid);
    
    const businessDoc = await db.collection('businessProfiles').doc(decodedToken.uid).get();
    
    if (!businessDoc.exists) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessData = businessDoc.data() || {};

    // إذا كان هناك شعار، قم بإنشاء رابط مؤقت
    if (businessData.logo && businessData.logo.trim() !== '') {
      try {
        console.log('Raw logo public ID from database:', businessData.logo);
        
        // التحقق مما إذا كان المعرف هو URL كامل أو معرف فقط
        const isFullUrl = typeof businessData.logo === 'string' && businessData.logo.includes('http');
        let publicId = businessData.logo;
        
        // إذا كان URL كامل، استخراج معرف الصورة
        if (isFullUrl) {
          // نستخرج معرف الصورة من الرابط
          const urlParts = businessData.logo.split('/');
          // نتجاهل الاستعلام في نهاية الرابط
          const rawId = urlParts[urlParts.length - 1].split('?')[0];
          publicId = rawId;
          
          // تحديث معرف الصورة في Firestore ليكون فقط المعرف وليس URL كامل
          await db.collection('businessProfiles').doc(decodedToken.uid).update({
            logo: publicId
          });
        }
        
        // التحقق من وجود الصورة في Cloudinary قبل إنشاء الرابط
        try {
          // محاولة جلب معلومات الصورة للتأكد من وجودها
          await cloudinary.api.resource(publicId);
          
          // إنشاء رابط مباشر للصورة
          const transformation = "c_fill,g_center,h_500,w_500,q_auto,f_auto";
          const timestamp = Date.now();
          const baseUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/`;
          // تحقق من تنسيق المعرف وإضافة المجلد إذا لزم الأمر
          const fullPublicId = publicId.includes('/') ? publicId : `business-logos/${decodedToken.uid}/${publicId}`;
          const logoUrl = `${baseUrl}${transformation}/${fullPublicId}?_t=${timestamp}`;
          
          console.log('Generated logo URL from publicId:', publicId);
          console.log('Full logo URL:', logoUrl);
          businessData.logo = logoUrl;
        } catch (resourceError) {
          console.error('Error checking image existence in Cloudinary:', resourceError);
          businessData.logo = null;
          
          // تحديث قاعدة البيانات لإزالة المعرف غير الصالح
          await db.collection('businessProfiles').doc(decodedToken.uid).update({
            logo: null
          });
        }
      } catch (error) {
        console.error('Error generating logo URL:', error);
        businessData.logo = null;
      }
    } else {
      businessData.logo = null;
    }

    return NextResponse.json(businessData);
  } catch (error) {
    console.error('Error fetching business profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedToken = await verifyToken(token);
    
    // نقل البيانات إذا لزم الأمر
    await migrateBusinessData(decodedToken.uid);
    
    const formData = await request.formData();
    
    // التحقق من البيانات المطلوبة
    const name = formData.get('name');
    const email = formData.get('email');
    const phone = formData.get('phone');
    
    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400 }
      );
    }

    const logoFile = formData.get('logo') as File | null;
    let logoPublicId = formData.get('logoUrl') as string;

    // رفع الصورة إلى Cloudinary إذا تم تقديم ملف جديد
    if (logoFile) {
      try {
        // التحقق من حجم ونوع الملف مرة أخرى
        if (logoFile.size > 5 * 1024 * 1024) {
          return NextResponse.json(
            { error: 'حجم الصورة يجب أن يكون أقل من 5 ميجابايت' },
            { status: 400 }
          );
        }
        
        const validMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!validMimeTypes.includes(logoFile.type)) {
          return NextResponse.json(
            { error: 'نوع الملف غير مدعوم. الأنواع المدعومة هي: JPG, JPEG, PNG' },
            { status: 400 }
          );
        }
        
        // تحويل الملف إلى Buffer
        const bytes = await logoFile.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // حذف الصورة القديمة إذا وجدت
        if (logoPublicId) {
          try {
            // تنظيف معرف الصورة إذا كان رابط كامل
            const cleanPublicId = logoPublicId.includes('http') 
              ? logoPublicId.split('/').pop()?.split('?')[0] 
              : logoPublicId;
              
            if (cleanPublicId) {
              // محاولة الحذف من المجلد الجديد أولاً (business-logos/userId/cleanPublicId)
              try {
                const newFolderPublicId = `business-logos/${decodedToken.uid}/${cleanPublicId}`;
                await cloudinary.uploader.destroy(newFolderPublicId);
                console.log(`محاولة حذف الصورة القديمة من المجلد الجديد: ${newFolderPublicId}`);
              } catch (deleteNewError) {
                console.error('فشل في حذف الصورة من المجلد الجديد:', deleteNewError);
              }
              
              // محاولة الحذف من المجلد القديم (business-logos/cleanPublicId)
              try {
                const oldFolderPublicId = `business-logos/${cleanPublicId}`;
                await cloudinary.uploader.destroy(oldFolderPublicId);
                console.log(`محاولة حذف الصورة القديمة من المجلد القديم: ${oldFolderPublicId}`);
              } catch (deleteOldError) {
                console.error('فشل في حذف الصورة من المجلد القديم:', deleteOldError);
              }
              
              // محاولة الحذف باستخدام المعرف المباشر
              try {
                await cloudinary.uploader.destroy(cleanPublicId);
                console.log(`محاولة حذف الصورة مباشرة: ${cleanPublicId}`);
              } catch (deleteDirectError) {
                console.error('فشل في حذف الصورة مباشرة:', deleteDirectError);
              }
            }
          } catch (error) {
            console.error('Error deleting old logo:', error);
            // نتابع العملية حتى لو فشل حذف الصورة القديمة
          }
        }

        // رفع الصورة إلى Cloudinary
        // استخدام وسيط لتجاوز التحقق الدقيق للنوع
        type CloudinaryUploadResult = {
          public_id: string;
          [key: string]: unknown;
        };

        const uploadImage = async (buffer: Buffer, attempt = 1): Promise<CloudinaryUploadResult> => {
          if (attempt > 3) {
            throw new Error('فشل في رفع الصورة بعد عدة محاولات');
          }

          const folderName = `business-logos/${decodedToken.uid}`;
          // استخدام timestamp ميلي ثانية للتأكد من عدم تكرار المعرف
          const uniquePublicId = `business_logo_${decodedToken.uid}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
          
          try {
            // تبسيط عملية الرفع باستخدام upload بدلاً من upload_stream
            const uploadResult = await cloudinary.uploader.upload(
              `data:image/jpeg;base64,${buffer.toString('base64')}`, 
              {
                folder: folderName,
                public_id: uniquePublicId,
                overwrite: true,
                resource_type: 'auto',
                format: 'jpeg', // تعيين الصيغة إلى JPEG دائمًا لتوحيد الصيغة
                transformation: [
                  { width: 500, height: 500, crop: 'fill', gravity: 'center' },
                  { quality: 'auto', fetch_format: 'auto' }
                ],
                timeout: 60000 // مهلة دقيقة واحدة كافية
              }
            );
            
            console.log('Upload success, result:', uploadResult);
            return uploadResult as CloudinaryUploadResult;
          } catch (uploadError) {
            console.error(`Upload function error (attempt ${attempt}):`, uploadError);
            if (attempt < 3) {
              // محاولة أخرى مع انتظار أقل (1 ثانية فقط)
              await new Promise(resolve => setTimeout(resolve, 1000));
              return uploadImage(buffer, attempt + 1);
            }
            throw uploadError;
          }
        };

        try {
          const uploadResponse = await uploadImage(buffer);
          logoPublicId = uploadResponse.public_id;
          console.log('Final logo public_id:', logoPublicId);
        } catch (uploadError) {
          throw new Error('فشل في رفع الصورة: ' + (uploadError instanceof Error ? uploadError.message : 'خطأ غير معروف'));
        }
      } catch (error) {
        console.error('Error uploading logo to Cloudinary:', error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'فشل في رفع الصورة، يرجى المحاولة مرة أخرى أو استخدام صورة مختلفة' },
          { status: 500 }
        );
      }
    }

    const updateData = {
      name,
      email,
      phone: phone || '',
      logo: logoPublicId || null,
      updatedAt: new Date().toISOString(),
    };

    // تحديث البيانات في Firestore
    try {
      await db.collection('businessProfiles').doc(decodedToken.uid).set(updateData, { merge: true });
      
      // حذف البيانات القديمة بعد التحديث الناجح
      await deleteOldBusinessData(decodedToken.uid);
    } catch (error) {
      console.error('Error updating business data in Firestore:', error);
      return NextResponse.json(
        { error: 'Failed to update business data' },
        { status: 500 }
      );
    }

    // إنشاء رابط مؤقت للصورة المحدثة
    if (logoPublicId && logoPublicId.trim() !== '') {
      try {
        console.log('Raw logoPublicId:', logoPublicId);
        
        // التحقق مما إذا كان المعرف هو URL كامل أو معرف فقط
        const isFullUrl = typeof logoPublicId === 'string' && logoPublicId.includes('http');
        let publicId = logoPublicId;
        
        // إذا كان URL كامل، استخراج معرف الصورة
        if (isFullUrl) {
          // نستخرج معرف الصورة من الرابط
          const urlParts = logoPublicId.split('/');
          // نتجاهل الاستعلام في نهاية الرابط
          const rawId = urlParts[urlParts.length - 1].split('?')[0];
          publicId = rawId;
        }
        
        // تخزين معرف الصورة فقط في Firestore
        if (isFullUrl) {
          await db.collection('businessProfiles').doc(decodedToken.uid).update({
            logo: publicId
          });
        }
        
        // التحقق من وجود الصورة في Cloudinary قبل إنشاء الرابط
        try {
          // محاولة جلب معلومات الصورة للتأكد من وجودها
          await cloudinary.api.resource(publicId);
          
          // إنشاء رابط مباشر للصورة
          const transformation = "c_fill,g_center,h_500,w_500,q_auto,f_auto";
          const timestamp = Date.now();
          const baseUrl = `https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/`;
          // تحقق من تنسيق المعرف وإضافة المجلد إذا لزم الأمر
          const fullPublicId = publicId.includes('/') ? publicId : `business-logos/${decodedToken.uid}/${publicId}`;
          const logoUrl = `${baseUrl}${transformation}/${fullPublicId}?_t=${timestamp}`;
          
          console.log('Generated logo URL from publicId:', publicId);
          console.log('Full logo URL:', logoUrl);
          updateData.logo = logoUrl;
        } catch (resourceError) {
          console.error('Error checking image existence in Cloudinary:', resourceError);
          // إذا لم يتم العثور على الصورة، قم بتحديث قاعدة البيانات
          await db.collection('businessProfiles').doc(decodedToken.uid).update({
            logo: null
          });
          updateData.logo = null;
        }
      } catch (error) {
        console.error('Error generating logo URL:', error);
        updateData.logo = null;
      }
    } else {
      updateData.logo = null;
    }

    return NextResponse.json({
      message: 'Profile updated successfully',
      data: updateData,
      success: true
    });
  } catch (error) {
    console.error('Error updating business profile:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 