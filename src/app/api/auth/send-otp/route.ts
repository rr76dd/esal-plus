import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, sendOTPEmail } from '@/lib/email';
import { storeOTP } from '@/lib/otpUtils';

export async function POST(request: NextRequest) {
  try {
    const { email, isRegistration = false } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'البريد الإلكتروني مطلوب' },
        { status: 400 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP
    storeOTP(email, otp, isRegistration);

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, isRegistration);

    if (!emailSent) {
      return NextResponse.json(
        { success: false, error: 'فشل في إرسال رمز التحقق' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم إرسال رمز التحقق بنجاح'
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ أثناء إرسال رمز التحقق' },
      { status: 500 }
    );
  }
} 