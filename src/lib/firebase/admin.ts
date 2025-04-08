import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// طباعة معلومات التكوين للتصحيح (تأكد من إزالتها في الإنتاج)
console.log('Firebase Admin Config:', {
  projectId: process.env.FIREBASE_PROJECT_ID,
  hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET
});

// للتأكد من عدم تهيئة التطبيق أكثر من مرة
if (!getApps().length) {
  try {
    // استخدام معلومات الاعتماد بشكل صحيح بدون تحويل صريح للنوع
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
    console.log('Firebase Admin initialized successfully');
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    // محاولة تهيئة أبسط في حالة فشل التهيئة العادية
    initializeApp();
  }
}

export const auth = getAuth();
export const db = getFirestore();
export const storage = getStorage();

// وظيفة التحقق من رمز المصادقة
export async function verifyToken(token: string) {
  try {
    const decodedToken = await auth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying token:', error);
    throw new Error('Unauthorized');
  }
} 