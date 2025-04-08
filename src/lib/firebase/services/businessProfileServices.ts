import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export interface BusinessProfile {
  businessName: string;
  email: string;
  phone?: string;
  logo?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const getBusinessProfile = async (): Promise<BusinessProfile | null> => {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      throw new Error('User not authenticated');
    }

    const docRef = doc(db, 'businessProfiles', session.user.email);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate()
      } as BusinessProfile;
    }

    return null;
  } catch (error) {
    console.error('Error fetching business profile:', error);
    throw error;
  }
};

export const updateBusinessProfile = async (profile: Partial<BusinessProfile>): Promise<BusinessProfile> => {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      throw new Error('User not authenticated');
    }

    const docRef = doc(db, 'businessProfiles', session.user.email);
    const now = new Date();
    
    const docSnap = await getDoc(docRef);
    const existingData = docSnap.exists() ? docSnap.data() : {};
    
    const updatedProfile = {
      ...existingData,
      ...profile,
      updatedAt: now,
      createdAt: existingData.createdAt || now
    };

    await setDoc(docRef, updatedProfile);

    return {
      ...updatedProfile,
      createdAt: updatedProfile.createdAt.toDate(),
      updatedAt: updatedProfile.updatedAt.toDate()
    } as BusinessProfile;
  } catch (error) {
    console.error('Error updating business profile:', error);
    throw error;
  }
}; 