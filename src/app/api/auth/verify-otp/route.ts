import { NextRequest, NextResponse } from 'next/server';
import { verifyStoredOTP } from '@/lib/otpUtils';
import { auth } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
  try {
    const { email, otp, password, fullName, isRegistration } = await request.json();

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: 'البريد الإلكتروني ورمز التحقق مطلوبان' },
        { status: 400 }
      );
    }

    // Verify OTP
    const isValid = verifyStoredOTP(email, otp);

    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'رمز التحقق غير صالح أو منتهي الصلاحية' },
        { status: 400 }
      );
    }

    // If registration, create a new account
    if (isRegistration) {
      if (!password || !fullName) {
        return NextResponse.json(
          { success: false, error: 'معلومات التسجيل غير مكتملة' },
          { status: 400 }
        );
      }

      try {
        // Create user in Firebase
        const userRecord = await auth.createUser({
          email,
          password,
          displayName: fullName,
        });

        // Set custom claims to include userType
        await auth.setCustomUserClaims(userRecord.uid, {
          userType: 'FREE'
        });

        return NextResponse.json({
          success: true,
          message: 'تم إنشاء الحساب بنجاح',
          userId: userRecord.uid,
          userType: 'FREE'
        });
      } catch (error: unknown) {
        console.error('Error creating user:', error);
        
        // Translate Firebase error messages
        let errorMessage = 'فشل في إنشاء الحساب';
        
        if (error instanceof Error && 'code' in error && error.code === 'auth/email-already-exists') {
          errorMessage = 'البريد الإلكتروني مستخدم بالفعل';
        }
        
        return NextResponse.json(
          { success: false, error: errorMessage },
          { status: 400 }
        );
      }
    } else {
      // For login, we just verify the OTP is correct
      // The actual login will be handled by the client
      return NextResponse.json({
        success: true,
        message: 'تم التحقق بنجاح',
        email,
      });
    }
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ أثناء التحقق من الرمز' },
      { status: 500 }
    );
  }
} 