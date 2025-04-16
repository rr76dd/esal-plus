/**
 * Migration script to add userType field to all existing users
 * Run this script with: npx ts-node src/scripts/migrateUsersToAddUserType.ts
 */

import { db, auth } from '../lib/firebase/admin';
import { UserType } from '../lib/userTypeUtils';

async function migrateUsers() {
  try {
    console.log('Starting user migration to add userType field...');
    
    // 1. Get all users from Firestore
    const usersRef = db.collection('users');
    const userSnapshot = await usersRef.get();
    
    if (userSnapshot.empty) {
      console.log('No users found in the database.');
      return;
    }
    
    // 2. Update each user document
    const updatePromises = userSnapshot.docs.map(async (userDoc) => {
      const userData = userDoc.data();
      
      // Only update if userType is not already set
      if (!userData.userType) {
        console.log(`Updating user ${userDoc.id} with email ${userData.email || 'unknown'}`);
        
        // Update Firestore document
        await usersRef.doc(userDoc.id).update({
          userType: UserType.FREE,
          updatedAt: new Date()
        });
        
        // Also update Firebase Auth custom claims if possible
        if (userData.uid) {
          try {
            const user = await auth.getUser(userData.uid);
            const currentClaims = user.customClaims || {};
            
            await auth.setCustomUserClaims(userData.uid, {
              ...currentClaims,
              userType: UserType.FREE
            });
          } catch (error) {
            console.error(`Failed to update auth claims for user ${userData.uid}:`, error);
          }
        }
        
        return { id: userDoc.id, success: true };
      }
      
      return { id: userDoc.id, skipped: true };
    });
    
    const results = await Promise.all(updatePromises);
    const updatedCount = results.filter(r => r.success).length;
    const skippedCount = results.filter(r => r.skipped).length;
    
    console.log(`Migration complete: ${updatedCount} users updated, ${skippedCount} users skipped.`);
  } catch (error) {
    console.error('Error during migration:', error);
  }
}

// Execute the migration
migrateUsers()
  .then(() => {
    console.log('Migration script completed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  }); 