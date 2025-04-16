import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../config';
import { auth } from '../config';
import { Timestamp } from 'firebase/firestore';
import { sendPaymentReminderEmail } from '@/app/api/email/actions';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id?: string;
  businessName: string;
  phone: string;
  email: string;
  address?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientAddress?: string;
  customerId?: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
  status: 'unpaid' | 'partially_paid' | 'paid';
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  total: number;
  notes: string;
  paymentLink?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date;
  userId?: string;
  logo?: string;
  lastReminderSent?: Date;
  reminderHistory?: { date: Date; type: string }[];
}

class InvoiceServices {
  private collection = 'invoices';

  async createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<string> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');

      // تحديث رمز المصادقة والمحاولة عدة مرات إذا فشلت العملية
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          await user.getIdToken(true);
          break; // تم الحصول على التوكن بنجاح
        } catch (tokenError) {
          retries++;
          console.error(`محاولة تحديث التوكن #${retries} فشلت:`, tokenError);
          if (retries >= maxRetries) {
            throw new Error('فشل تحديث رمز المصادقة، يرجى تسجيل الدخول مرة أخرى');
          }
          // انتظار قبل المحاولة مرة أخرى
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const newInvoice: Invoice = {
        ...invoice,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: user.uid
      };

      const docRef = await addDoc(collection(db, this.collection), newInvoice);
      return docRef.id;
    } catch (error) {
      console.error('Error creating invoice:', error);
      
      // رفع خطأ مفهوم ومترجم للمستخدم
      if (error instanceof Error) {
        if (error.message.includes('not authenticated') || 
            error.message.includes('غير مسجل الدخول')) {
          throw new Error('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');
        }
        
        if (error.message.includes('permission') || 
            error.message.includes('صلاحية')) {
          throw new Error('ليس لديك صلاحية لإنشاء فاتورة، يرجى تسجيل الدخول مرة أخرى أو الاتصال بالمسؤول');
        }
      }
      
      throw error;
    }
  }

  async getAllInvoices(): Promise<Invoice[]> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    try {
      // Refresh token to ensure authentication is current
      await user.getIdToken(true);
    } catch (tokenError) {
      console.error('Error refreshing token:', tokenError);
    }

    try {
      // Use a simpler query without orderBy to avoid index issues
      const q = query(
        collection(db, this.collection),
        where('userId', '==', user.uid)
      );

      const querySnapshot = await getDocs(q);
      
      // Sort in memory instead of using Firestore orderBy
      return querySnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Invoice))
        .sort((a, b) => {
          // Sort by creation date (newest first)
          const dateA = a.createdAt instanceof Timestamp 
            ? a.createdAt.toMillis() 
            : new Date(a.createdAt).getTime();
          const dateB = b.createdAt instanceof Timestamp 
            ? b.createdAt.toMillis() 
            : new Date(b.createdAt).getTime();
          return dateB - dateA;
        });
    } catch (error) {
      console.error('Error fetching invoices:', error);
      const firebaseError = error as { code?: string, message?: string };
      if (firebaseError.code === 'permission-denied' || firebaseError.message?.includes('Missing or insufficient permissions')) {
        throw new Error('ليس لديك صلاحية لعرض الفواتير، يرجى تسجيل الدخول مرة أخرى');
      }
      throw error;
    }
  }

  async getInvoiceById(id: string): Promise<Invoice | null> {
    try {
      const docRef = doc(db, this.collection, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Invoice;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting invoice:', error);
      throw error;
    }
  }

  async updateInvoice(id: string, invoice: Partial<Invoice>): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const docRef = doc(db, this.collection, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error('Invoice not found');

    const existingInvoice = docSnap.data() as Invoice;
    if (existingInvoice.userId !== user.uid) throw new Error('Unauthorized');

    await updateDoc(docRef, {
      ...invoice,
      updatedAt: new Date()
    });
  }

  async deleteInvoice(id: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');

    const docRef = doc(db, this.collection, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) throw new Error('Invoice not found');

    const invoice = docSnap.data() as Invoice;
    if (invoice.userId !== user.uid) throw new Error('Unauthorized');

    await deleteDoc(docRef);
  }

  async sendPaymentReminder(invoiceId: string): Promise<boolean> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');

      // الحصول على بيانات الفاتورة
      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) throw new Error('الفاتورة غير موجودة');
      
      // التحقق من أن الفاتورة تنتمي للمستخدم الحالي
      if (invoice.userId !== user.uid) throw new Error('ليس لديك صلاحية للوصول إلى هذه الفاتورة');

      // التحقق من أن الفاتورة غير مدفوعة
      if (invoice.status === 'paid') throw new Error('الفاتورة مدفوعة بالفعل');

      // التحقق من وجود بريد إلكتروني للعميل
      if (!invoice.clientEmail) throw new Error('لا يوجد بريد إلكتروني للعميل');

      // إرسال التذكير عبر البريد الإلكتروني باستخدام فعل الخادم
      const emailSent = await sendPaymentReminderEmail(
        invoice.clientEmail,
        invoice.invoiceNumber,
        invoice.businessName,
        invoice.clientName,
        invoice.total,
        invoice.dueDate,
        invoice.paymentLink
      );

      // تحديث الفاتورة بإضافة سجل التذكير
      if (emailSent) {
        await this.updateInvoice(invoiceId, {
          lastReminderSent: new Date(),
          reminderHistory: Array.isArray(invoice.reminderHistory) 
            ? [...invoice.reminderHistory, { date: new Date(), type: 'email' }]
            : [{ date: new Date(), type: 'email' }]
        });
      }

      return emailSent;
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      throw error;
    }
  }
}

export const invoiceServices = new InvoiceServices(); 