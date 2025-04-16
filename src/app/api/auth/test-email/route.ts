import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, sendOTPEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'البريد الإلكتروني مطلوب' },
        { status: 400 }
      );
    }

    // Generate OTP
    const otp = generateOTP();

    // Send OTP email
    const emailSent = await sendOTPEmail(email, otp, true);

    if (!emailSent) {
      return NextResponse.json(
        { success: false, error: 'فشل في إرسال رمز التحقق' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'تم إرسال رمز التحقق بنجاح',
      otp: otp // عادة لا نعيد الـ OTP في البيئة الإنتاجية، ولكن هذا للاختبار فقط
    });
  } catch (error) {
    console.error('Error sending test OTP:', error);
    return NextResponse.json(
      { success: false, error: 'حدث خطأ أثناء إرسال رمز التحقق' },
      { status: 500 }
    );
  }
} 