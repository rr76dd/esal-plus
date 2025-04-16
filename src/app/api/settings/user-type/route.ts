import { NextRequest, NextResponse } from 'next/server';
import { db, auth } from '@/lib/firebase/admin';
import { UserType } from '@/lib/userTypeUtils';

/**
 * Update user type API endpoint
 * Requires authorization token
 */
export async function POST(request: NextRequest) {
  try {
    const { userType } = await request.json();
    
    // Validate userType
    if (!userType || !Object.values(UserType).includes(userType as UserType)) {
      return NextResponse.json(
        { success: false, error: 'نوع المستخدم غير صالح' },
        { status: 400 }
      );
    }

    // Get the token from authorization header
    const token = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح بالوصول' },
        { status: 401 }
      );
    }

    // Verify Firebase token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Update user document in Firestore
    const userRef = db.collection('users').where('uid', '==', userId);
    const userDocs = await userRef.get();

    if (userDocs.empty) {
      // User doesn't exist in Firestore, create a new document
      await db.collection('users').add({
        uid: userId,
        email: decodedToken.email,
        userType,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } else {
      // Update existing user document
      const userDoc = userDocs.docs[0];
      await userDoc.ref.update({
        userType,
        updatedAt: new Date()
      });
    }

    // Update user claims in Firebase Auth
    const user = await auth.getUser(userId);
    const currentClaims = user.customClaims || {};
    
    await auth.setCustomUserClaims(userId, {
      ...currentClaims,
      userType
    });

    return NextResponse.json({
      success: true,
      message: 'تم تحديث نوع المستخدم بنجاح',
      userType
    });
  } catch (error) {
    console.error('Error updating user type:', error);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ أثناء تحديث نوع المستخدم' },
      { status: 500 }
    );
  }
}

/**
 * Get current user type
 * Requires authorization token
 */
export async function GET(request: NextRequest) {
  try {
    // Get the token from authorization header
    const token = request.headers.get('Authorization')?.split('Bearer ')[1];
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح بالوصول' },
        { status: 401 }
      );
    }

    // Verify Firebase token
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get user from Firebase Auth
    const user = await auth.getUser(userId);
    const userType = user.customClaims?.userType || UserType.FREE;

    return NextResponse.json({
      success: true,
      userType
    });
  } catch (error) {
    console.error('Error getting user type:', error);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ أثناء جلب نوع المستخدم' },
      { status: 500 }
    );
  }
} 