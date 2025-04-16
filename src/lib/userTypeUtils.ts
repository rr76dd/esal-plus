// User Type utilities

/**
 * User type enum
 */
export enum UserType {
  FREE = 'FREE',
  PLUS = 'PLUS'
}

/**
 * Check if a user is a PLUS user
 * @param userType - The user's type
 * @returns boolean indicating whether the user is a PLUS user
 */
export function isPlusUser(userType: UserType | string | undefined): boolean {
  return userType === UserType.PLUS;
}

/**
 * Check if a feature is accessible to a user based on their user type
 * @param userType - The user's type
 * @param requiredType - The required user type for the feature
 * @returns boolean indicating whether the user can access the feature
 */
export function canAccessFeature(
  userType: UserType | string | undefined, 
  requiredType: UserType = UserType.FREE
): boolean {
  if (!userType) return false;
  
  // If feature requires PLUS, user must be PLUS
  if (requiredType === UserType.PLUS) {
    return userType === UserType.PLUS;
  }
  
  // FREE features are accessible by all users
  return true;
}

/**
 * Get limitation values based on user type
 * @param userType - The user's type
 */
export function getUserLimits(userType: UserType | string | undefined) {
  const isPlus = userType === UserType.PLUS;
  
  return {
    maxInvoices: isPlus ? Infinity : 10,
    maxClients: isPlus ? Infinity : 5,
    customBranding: isPlus,
    advancedReporting: isPlus,
    exportOptions: isPlus ? ['PDF', 'EXCEL', 'CSV'] : ['PDF']
  };
} 