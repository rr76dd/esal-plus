// Store OTPs temporarily in memory (in a production environment, use Redis or similar)
type OTPRecord = {
  otp: string;
  createdAt: number;
  email: string;
  isRegistration: boolean;
};

const otpStore: Record<string, OTPRecord> = {};

// OTP expiration time in milliseconds (10 minutes)
export const OTP_EXPIRY = 10 * 60 * 1000;

export function storeOTP(email: string, otp: string, isRegistration: boolean = false) {
  otpStore[email] = {
    otp,
    createdAt: Date.now(),
    email,
    isRegistration
  };
}

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