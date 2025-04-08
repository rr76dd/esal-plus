import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default cloudinary;

const SUPPORTED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const uploadImage = async (file: File): Promise<string> => {
  try {
    if (!file) {
      throw new Error('لم يتم اختيار ملف');
    }

    // التحقق من نوع الملف
    if (!SUPPORTED_FORMATS.includes(file.type.toLowerCase())) {
      throw new Error('صيغة الملف غير مدعومة. الصيغ المدعومة هي: JPG, JPEG, PNG');
    }

    // التحقق من حجم الملف
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('حجم الملف يجب أن يكون أقل من 5 ميجابايت');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '');
    
    // إضافة مجلد خاص للشعارات
    formData.append('folder', 'business-logos');

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error('فشل في رفع الصورة');
    }

    const data = await response.json();
    
    if (!data.secure_url) {
      throw new Error('لم يتم استلام رابط الصورة');
    }

    return data.secure_url;
  } catch (error) {
    console.error('Error uploading image to Cloudinary:', error);
    throw error;
  }
}; 