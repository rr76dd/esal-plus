import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import { firebaseApp } from './firebase';

const db = getFirestore(firebaseApp);

// Invoices Collection
export const invoicesCollection = collection(db, 'invoices');

// Users Collection
export const usersCollection = collection(db, 'users');

interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  total: number;
  status: 'draft' | 'paid' | 'unpaid';
  createdAt: Date;
  businessName: string;
  phone: string;
  email: string;
  address?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  dueDate?: string;
  items: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  notes: string;
  paymentLink?: string;
}

interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  address?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Invoice Services
export const invoiceServices = {
  // Create a new invoice
  createInvoice: async (invoiceData: Omit<Invoice, 'id' | 'createdAt'>) => {
    try {
      const docRef = await addDoc(invoicesCollection, {
        ...invoiceData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  },

  // Get all invoices
  getAllInvoices: async () => {
    try {
      const q = query(invoicesCollection, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Invoice[];
    } catch (error) {
      console.error('Error getting invoices:', error);
      throw error;
    }
  },

  // Get a single invoice
  getInvoice: async (id: string) => {
    try {
      const docRef = doc(invoicesCollection, id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Invoice;
      }
      return null;
    } catch (error) {
      console.error('Error getting invoice:', error);
      throw error;
    }
  },

  // Update an invoice
  updateInvoice: async (id: string, data: Partial<Invoice>) => {
    try {
      const docRef = doc(invoicesCollection, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  },

  // Delete an invoice
  deleteInvoice: async (id: string) => {
    try {
      const docRef = doc(invoicesCollection, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  }
};

// User Services
export const userServices = {
  // Create a new user
  createUser: async (userData: Omit<User, 'id' | 'createdAt'>) => {
    try {
      const docRef = await addDoc(usersCollection, {
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  },

  // Get user by email
  getUserByEmail: async (email: string) => {
    try {
      const q = query(usersCollection, where('email', '==', email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        return { id: doc.id, ...doc.data() } as User;
      }
      return null;
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  },

  // Update user
  updateUser: async (id: string, data: Partial<User>) => {
    try {
      const docRef = doc(usersCollection, id);
      await updateDoc(docRef, {
        ...data,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }
}; 