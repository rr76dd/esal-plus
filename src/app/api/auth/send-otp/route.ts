import { NextRequest, NextResponse } from 'next/server';
import { generateOTP, sendOTPEmail } from '@/lib/email';

// Store OTPs temporarily in memory (in a production environment, use Redis or similar)
type OTPRecord = {
  otp: string;
  createdAt: number;
  email: string;
  isRegistration: boolean;
};

const otpStore: Record<string, OTPRecord> = {};

// OTP expiration time in milliseconds (10 minutes)
const OTP_EXPIRY = 10 * 60 * 1000;

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
    
    // Store OTP with creation time
    otpStore[email] = {
      otp,
      createdAt: Date.now(),
      email,
      isRegistration
    };

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

// Export OTP verification logic to be used by other API routes
export function verifyStoredOTP(email: string, providedOTP: string): boolean {
  const record = otpStore[email];
  
  if (!record) {
    return false;
  }
  
  // Check if OTP has expired
  if (Date.now() - record.createdAt > OTP_EXPIRY) {
    delete otpStore[email]; // Remove expired OTP
    return false;
  }
  
  const isValid = record.otp === providedOTP;
  
  if (isValid) {
    delete otpStore[email]; // Remove used OTP
  }
  
  return isValid;
} 