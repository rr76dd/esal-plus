import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/firebase/admin';
import { UserType, canAccessFeature } from '@/lib/userTypeUtils';

/**
 * Middleware to check if a user has access to a feature based on their user type
 * 
 * Usage:
 * Import this in your API route and wrap your handler with it:
 * 
 * import { withFeatureGuard } from '@/middleware/featureGuard';
 * 
 * export const POST = withFeatureGuard(async (req) => {
 *   // Your handler code
 * }, UserType.PLUS);
 */
export function withFeatureGuard(
  handler: (req: NextRequest) => Promise<NextResponse>,
  requiredUserType: UserType = UserType.FREE
) {
  return async (req: NextRequest) => {
    try {
      // Get the token from authorization header
      const token = req.headers.get('Authorization')?.split('Bearer ')[1];
      if (!token) {
        return NextResponse.json(
          { success: false, error: 'غير مصرح بالوصول' },
          { status: 401 }
        );
      }

      // Verify Firebase token
      const decodedToken = await auth.verifyIdToken(token);
      const userType = decodedToken.userType || UserType.FREE;

      // Check if user has access to this feature
      if (!canAccessFeature(userType, requiredUserType)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'هذه الميزة غير متاحة في حسابك الحالي. يرجى الترقية إلى حساب بلس للوصول إلى هذه الميزة.',
            upgradeRequired: true 
          },
          { status: 403 }
        );
      }

      // User has access, proceed with the handler
      return handler(req);
    } catch (error) {
      console.error('Feature guard error:', error);
      
      // Handle token verification errors
      if (error instanceof Error && error.message.includes('auth')) {
        return NextResponse.json(
          { success: false, error: 'جلسة غير صالحة. يرجى تسجيل الدخول مرة أخرى.' },
          { status: 401 }
        );
      }
      
      return NextResponse.json(
        { success: false, error: 'حدث خطأ أثناء التحقق من صلاحيات الوصول' },
        { status: 500 }
      );
    }
  };
} 