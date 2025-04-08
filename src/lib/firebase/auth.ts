import { auth } from './config';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import Cookies from 'js-cookie';

export const signIn = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const token = await userCredential.user.getIdToken();
    Cookies.set('firebase-token', token, { expires: 7 }); // Token expires in 7 days
    return userCredential.user;
  } catch (error) {
    if (error instanceof FirebaseError) {
      throw new Error(error.message);
    }
    throw new Error('حدث خطأ أثناء تسجيل الدخول');
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    Cookies.remove('firebase-token');
  } catch (error) {
    if (error instanceof FirebaseError) {
      throw new Error(error.message);
    }
    throw new Error('حدث خطأ أثناء تسجيل الخروج');
  }
};

export const getToken = async () => {
  const user = auth.currentUser;
  if (user) {
    return await user.getIdToken();
  }
  return null;
}; 