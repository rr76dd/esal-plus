'use client';

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Search, Edit, Trash2, Eye, MoreVertical, FileText } from 'lucide-react';
import { customerServices, Customer } from '@/lib/firebase/services/customerServices';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Timestamp } from 'firebase/firestore';
import { LoadingIndicator } from '@/components/LoadingIndicator';

interface CustomerWithInvoiceCount extends Omit<Customer, 'createdAt' | 'id'> {
  id: string;
  createdAt: Timestamp;
  invoiceCount: number;
}

export default function ClientsPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerWithInvoiceCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showStatusMenu, setShowStatusMenu] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/auth/login');
        return;
      }

      const fetchCustomers = async () => {
        try {
          setLoading(true);
          
          // Use the optimized method to get customers with their invoice counts
          const allCustomers = await customerServices.getAllCustomers();
          
          if (allCustomers.length === 0) {
            setLoading(false);
            setCustomers([]);
            return;
          }

          // Get all invoices for this user in a single batch
          const processedCustomers: CustomerWithInvoiceCount[] = [];
          for (const customer of allCustomers) {
            if (customer.id) {
              // Get invoice count using the existing method
              let invoiceCount = 0;
              try {
                invoiceCount = await customerServices.getCustomerInvoiceCount(customer.id);
              } catch (err) {
                console.error(`Error fetching invoice count for customer ${customer.id}:`, err);
              }

              processedCustomers.push({
                ...customer,
                id: customer.id,
                createdAt: customer.createdAt instanceof Timestamp 
                  ? customer.createdAt 
                  : Timestamp.fromDate(new Date(customer.createdAt)),
                invoiceCount
              });
            }
          }
          
          setCustomers(processedCustomers);
          setLoading(false);
        } catch (error) {
          console.error('Error fetching customers:', error);
          setCustomers([]);
          setLoading(false);
        }
      };

      fetchCustomers();
    });

    return () => unsubscribe();
  }, [router]);

  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch = 
      customer.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (customer.email && customer.email.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const handleDeleteCustomer = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا العميل؟')) return;
    
    try {
      await customerServices.deleteCustomer(id);
      setCustomers(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Error deleting customer:', error);
      alert('حدث خطأ أثناء حذف العميل');
    }
  };

  const handleEditCustomer = (customer: CustomerWithInvoiceCount) => {
    router.push(`/clients/${customer.id}/edit`);
  };

  const handleViewCustomer = (customer: CustomerWithInvoiceCount) => {
    router.push(`/clients/${customer.id}`);
  };

  const handleViewCustomerInvoices = (customer: CustomerWithInvoiceCount) => {
    router.push(`/clients/${customer.id}#invoices`);
  };

  const handleAddClient = () => {
    router.push('/clients/create');
  };

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4 pt-6">
        <h1 className="text-3xl font-bold">العملاء</h1>
        <Button 
          className="flex items-center gap-2 bg-black hover:bg-black/90 text-white w-full sm:w-auto justify-center"
          onClick={handleAddClient}
        >
          <Plus className="w-4 h-4" />
          إضافة عميل جديد
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>البحث عن العملاء</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="البحث باسم العميل أو البريد الإلكتروني..."
                  className="w-full pr-10 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-right">
                <tr>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">الاسم الكامل</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">البريد الإلكتروني</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">رقم الجوال</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">عدد الفواتير</th>
                  <th className="px-6 py-4 text-sm font-medium text-gray-500">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredCustomers.length > 0 ? (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm">{customer.fullName}</td>
                      <td className="px-6 py-4 text-sm">{customer.email || '-'}</td>
                      <td className="px-6 py-4 text-sm">{customer.phone || '-'}</td>
                      <td className="px-6 py-4 text-sm">{customer.invoiceCount}</td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Button 
                              id={`client_btn_${customer.id}`}
                              variant="outline" 
                              size="sm"
                              onClick={() => setShowStatusMenu(showStatusMenu === `action_${customer.id}` ? null : `action_${customer.id}`)}
                              className="bg-black hover:bg-black/90 text-white border-0"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                            
                            {showStatusMenu === `action_${customer.id}` && (
                              <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50" onClick={() => setShowStatusMenu(null)}>
                                <div 
                                  className="absolute bg-white border shadow-xl rounded-md z-50 w-48 max-h-[80vh] overflow-y-auto"
                                  style={{
                                    position: 'fixed',
                                    top: windowWidth <= 768 
                                      ? "50%" // Center vertically on small screens
                                      : (document.getElementById(`client_btn_${customer.id}`)?.getBoundingClientRect().bottom || 0) + 5,
                                    left: windowWidth <= 768 
                                      ? "50%" // Center horizontally on small screens
                                      : (document.getElementById(`client_btn_${customer.id}`)?.getBoundingClientRect().left || 0) + 100,
                                    transform: windowWidth <= 768 
                                      ? "translate(-50%, -50%)" // Center in both dimensions on small screens
                                      : "translateX(-100%)" // Position to the left of the button on large screens
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="p-2 flex flex-col">
                                    <button 
                                      className="px-3 py-2 text-right text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors"
                                      onClick={() => {
                                        setShowStatusMenu(null);
                                        handleViewCustomer(customer);
                                      }}
                                    >
                                      <Eye className="h-4 w-4" />
                                      عرض العميل
                                    </button>
                                    <button 
                                      className="px-3 py-2 text-right text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors"
                                      onClick={() => {
                                        setShowStatusMenu(null);
                                        handleEditCustomer(customer);
                                      }}
                                    >
                                      <Edit className="h-4 w-4" />
                                      تعديل البيانات
                                    </button>
                                    <button 
                                      className="px-3 py-2 text-right text-sm rounded-md hover:bg-gray-100 flex items-center gap-2 w-full transition-colors"
                                      onClick={() => {
                                        setShowStatusMenu(null);
                                        handleViewCustomerInvoices(customer);
                                      }}
                                    >
                                      <FileText className="h-4 w-4" />
                                      عرض الفواتير
                                    </button>
                                    <div className="border-t my-1"></div>
                                    <button 
                                      className="px-3 py-2 text-right text-sm rounded-md hover:bg-red-50 flex items-center gap-2 w-full transition-colors text-red-600"
                                      onClick={() => {
                                        setShowStatusMenu(null);
                                        handleDeleteCustomer(customer.id);
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      حذف العميل
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm ? 'لا توجد عملاء مطابقة للبحث' : 'لا يوجد عملاء. يرجى إضافة عميل جديد.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 