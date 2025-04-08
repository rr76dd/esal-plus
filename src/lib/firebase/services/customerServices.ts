import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db, auth } from '../config';
import { Timestamp } from 'firebase/firestore';

export interface Customer {
  id?: string;
  fullName: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date;
  userId?: string;
}

class CustomerServices {
  private collection = 'customers';
  private customersCache: Customer[] | null = null;
  private lastCacheTime: number = 0;
  private cacheDuration = 60000; // Cache valid for 1 minute

  // Helper method to check if cache is valid
  private isCacheValid(): boolean {
    return this.customersCache !== null && 
           (Date.now() - this.lastCacheTime) < this.cacheDuration;
  }

  // Clear cache when customers are modified
  private clearCache(): void {
    this.customersCache = null;
  }

  async createCustomer(customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<string> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');

      // محاولة تحديث رمز المصادقة للتأكد من أنه غير منتهي الصلاحية
      try {
        await user.getIdToken(true);
      } catch (tokenError) {
        console.error('Error refreshing token:', tokenError);
        throw new Error('فشل في تحديث جلسة المستخدم، يرجى تسجيل الدخول مرة أخرى');
      }

      const newCustomer: Customer = {
        ...customer,
        createdAt: new Date(),
        updatedAt: new Date(),
        userId: user.uid
      };

      // محاولة إضافة العميل مع إعادة المحاولة في حالة الفشل
      let retries = 3;
      let docRef;
      
      while (retries >= 0) {
        try {
          docRef = await addDoc(collection(db, this.collection), newCustomer);
          break;
        } catch (err: Error | unknown) {
          if (retries === 0) {
            // معالجة خطأ الصلاحيات
            const firebaseError = err as { code?: string, message?: string };
            if (firebaseError.code === 'permission-denied' || firebaseError.message?.includes('Missing or insufficient permissions')) {
              throw new Error('ليس لديك صلاحية إضافة عميل جديد، يرجى تسجيل الدخول مرة أخرى أو الاتصال بالمسؤول');
            }
            throw err;
          }
          
          retries--;
          console.log(`محاولة إعادة إضافة العميل، محاولات متبقية: ${retries}`);
          
          // محاولة تجديد الرمز قبل إعادة المحاولة
          const firebaseError = err as { code?: string, message?: string };
          if (firebaseError.code === 'permission-denied' || firebaseError.message?.includes('Missing or insufficient permissions')) {
            try {
              await user.getIdToken(true);
            } catch (tokenError) {
              console.error('Error refreshing token during retry:', tokenError);
            }
          }
          
          // الانتظار قبل إعادة المحاولة
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }

      // Clear cache when a new customer is created
      this.clearCache();
      
      if (!docRef) throw new Error('فشل في إضافة العميل إلى قاعدة البيانات');
      
      return docRef.id;
    } catch (error: Error | unknown) {
      console.error('Error creating customer:', error);
      
      // رسائل خطأ محددة بناءً على نوع الخطأ
      const firebaseError = error as { code?: string, message?: string };
      if (firebaseError.code === 'permission-denied' || firebaseError.message?.includes('Missing or insufficient permissions')) {
        throw new Error('ليس لديك صلاحية إضافة عميل جديد، يرجى تسجيل الدخول مرة أخرى أو الاتصال بالمسؤول');
      }
      
      throw new Error(error instanceof Error ? 
        error.message : 'حدث خطأ غير متوقع أثناء إنشاء العميل');
    }
  }

  async getAllCustomers(): Promise<Customer[]> {
    try {
      // Return cached customers if available and not expired
      if (this.isCacheValid() && this.customersCache) {
        console.log('Using cached customers data');
        return this.customersCache;
      }

      const user = auth.currentUser;
      if (!user) throw new Error('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');

      // تحديث رمز المصادقة والمحاولة عدة مرات إذا فشلت العملية
      let retries = 0;
      const maxRetries = 3;
      
      while (retries < maxRetries) {
        try {
          // تحديث التوكن وتخزينه في العنصر الأصلي
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

      // استبدال الاستعلام المركب باستعلام أبسط (إزالة orderBy التي تسبب الحاجة إلى فهرس)
      const q = query(
        collection(db, this.collection),
        where('userId', '==', user.uid)
      );

      try {
        const snapshot = await getDocs(q);
        // يمكننا ترتيب النتائج في الذاكرة بدلاً من Firestore
        const customers = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Customer))
          .sort((a, b) => {
            // ترتيب تنازلي حسب تاريخ الإنشاء
            const dateA = a.createdAt instanceof Timestamp 
              ? a.createdAt.toMillis() 
              : new Date(a.createdAt).getTime();
            const dateB = b.createdAt instanceof Timestamp 
              ? b.createdAt.toMillis() 
              : new Date(b.createdAt).getTime();
            return dateB - dateA;
          });
        
        // Cache the results
        this.customersCache = customers;
        this.lastCacheTime = Date.now();
        
        return customers;
      } catch (err) {
        console.error('Error in query execution:', err);
        const firebaseError = err as { code?: string, message?: string };
        if (firebaseError.code === 'permission-denied' || firebaseError.message?.includes('Missing or insufficient permissions')) {
          console.error('Permission error when fetching customers:', err);
          throw new Error('ليس لديك صلاحية لعرض العملاء، يرجى تسجيل الدخول مرة أخرى أو الاتصال بالمسؤول');
        }
        throw err;
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
      
      // إعادة رسالة خطأ مفصلة للمساعدة في استكشاف المشكلات
      if (error instanceof Error) {
        if (error.message.includes('not authenticated') || 
            error.message.includes('غير مسجل الدخول') || 
            error.message.includes('permissions')) {
          throw new Error('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');
        }
      }
      
      // Return empty array instead of throwing to prevent UI errors
      return [];
    }
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    try {
      const docRef = doc(db, this.collection, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Customer;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting customer:', error);
      throw error;
    }
  }

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');

      // محاولة تحديث رمز المصادقة للتأكد من أنه غير منتهي الصلاحية
      try {
        await user.getIdToken(true);
      } catch (tokenError) {
        console.error('Error refreshing token:', tokenError);
        throw new Error('فشل في تحديث جلسة المستخدم، يرجى تسجيل الدخول مرة أخرى');
      }

      const docRef = doc(db, this.collection, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) throw new Error('العميل غير موجود');

      // التحقق من أن المستخدم هو مالك هذا العميل
      const customerData = docSnap.data();
      if (customerData.userId !== user.uid) {
        throw new Error('لا يمكنك تعديل هذا العميل لأنك لست المالك');
      }

      // محاولة تحديث العميل مع إعادة المحاولة في حالة الفشل
      let retries = 2;
      
      while (retries >= 0) {
        try {
          await updateDoc(docRef, {
            ...customer,
            updatedAt: new Date()
          });
          break;
        } catch (err) {
          if (retries === 0) {
            const firebaseError = err as { code?: string, message?: string };
            if (firebaseError.code === 'permission-denied' || firebaseError.message?.includes('Missing or insufficient permissions')) {
              throw new Error('ليس لديك صلاحية لتعديل هذا العميل، يرجى تسجيل الدخول مرة أخرى أو الاتصال بالمسؤول');
            }
            throw err;
          }
          
          retries--;
          // الانتظار قبل إعادة المحاولة
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Clear cache when a customer is updated
      this.clearCache();
    } catch (error) {
      console.error('Error updating customer:', error);
      throw error instanceof Error ? error : new Error('حدث خطأ غير متوقع أثناء تحديث العميل');
    }
  }

  async deleteCustomer(id: string): Promise<void> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');

      // محاولة تحديث رمز المصادقة للتأكد من أنه غير منتهي الصلاحية
      try {
        await user.getIdToken(true);
      } catch (tokenError) {
        console.error('Error refreshing token:', tokenError);
        throw new Error('فشل في تحديث جلسة المستخدم، يرجى تسجيل الدخول مرة أخرى');
      }

      const docRef = doc(db, this.collection, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) throw new Error('العميل غير موجود');

      // التحقق من أن المستخدم هو مالك هذا العميل
      const customerData = docSnap.data();
      if (customerData.userId !== user.uid) {
        throw new Error('لا يمكنك حذف هذا العميل لأنك لست المالك');
      }

      // محاولة حذف العميل مع إعادة المحاولة في حالة الفشل
      let retries = 2;
      
      while (retries >= 0) {
        try {
          await deleteDoc(docRef);
          break;
        } catch (err) {
          if (retries === 0) {
            const firebaseError = err as { code?: string, message?: string };
            if (firebaseError.code === 'permission-denied' || firebaseError.message?.includes('Missing or insufficient permissions')) {
              throw new Error('ليس لديك صلاحية لحذف هذا العميل، يرجى تسجيل الدخول مرة أخرى أو الاتصال بالمسؤول');
            }
            throw err;
          }
          
          retries--;
          // الانتظار قبل إعادة المحاولة
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Clear cache when a customer is deleted
      this.clearCache();
    } catch (error) {
      console.error('Error deleting customer:', error);
      throw error instanceof Error ? error : new Error('حدث خطأ غير متوقع أثناء حذف العميل');
    }
  }
  
  async getCustomerInvoiceCount(customerId: string): Promise<number> {
    if (!customerId) return 0;
    
    const user = auth.currentUser;
    if (!user) throw new Error('User not authenticated');
    
    try {
      // First try to get customer details to use for fallback query
      const customer = await this.getCustomerById(customerId);
      if (!customer) return 0;
      
      // جلب جميع الفواتير ثم التصفية في الذاكرة بدلاً من استخدام استعلامات معقدة
      const snapshot = await getDocs(collection(db, 'invoices'));
      const invoices = snapshot.docs.map(doc => doc.data());
      
      // فلترة الفواتير للمستخدم الحالي وللعميل المحدد
      let matchingInvoices = invoices.filter(inv => 
        inv.userId === user.uid && inv.customerId === customerId
      );
      
      // إذا لم نجد فواتير باستخدام customerId، نبحث باستخدام اسم العميل (للتوافق مع الإصدارات السابقة)
      if (matchingInvoices.length === 0 && customer.fullName) {
        matchingInvoices = invoices.filter(inv => 
          inv.userId === user.uid && inv.clientName === customer.fullName
        );
      }
      
      return matchingInvoices.length;
    } catch (error) {
      console.error('Error counting invoices for customer:', error);
      return 0; // Return 0 on error instead of throwing
    }
  }

  async getAllCustomersWithInvoiceCounts(): Promise<(Customer & { invoiceCount: number })[]> {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error('المستخدم غير مسجل الدخول، يرجى تسجيل الدخول مرة أخرى');

      // Get all customers
      const customers = await this.getAllCustomers();
      if (customers.length === 0) return [];

      try {
        // جلب جميع الفواتير ثم التصفية في الذاكرة
        const invoicesSnapshot = await getDocs(collection(db, 'invoices'));
        const invoices = invoicesSnapshot.docs
          .map(doc => doc.data())
          .filter(inv => inv.userId === user.uid); // تصفية بحسب المستخدم في الذاكرة
        
        // Count invoices for each customer
        return customers.map(customer => {
          // Count by customerId (newer way)
          let invoiceCount = invoices.filter(inv => inv.customerId === customer.id).length;
          
          // If no matches by id, try by name (older invoices)
          if (invoiceCount === 0 && customer.fullName) {
            invoiceCount = invoices.filter(inv => inv.clientName === customer.fullName).length;
          }
          
          return {
            ...customer,
            invoiceCount
          };
        });
      } catch (error) {
        // في حالة فشل استرجاع الفواتير، نعيد العملاء بدون عدد الفواتير
        console.error('Error fetching invoices:', error);
        return customers.map(customer => ({
          ...customer,
          invoiceCount: 0
        }));
      }
    } catch (error) {
      console.error('Error fetching customers with invoice counts:', error);
      return []; // Return empty array instead of throwing
    }
  }
}

export const customerServices = new CustomerServices(); 