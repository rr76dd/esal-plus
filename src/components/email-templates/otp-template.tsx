import * as React from 'react';

interface OTPEmailTemplateProps {
  otp: string;
  isRegistration: boolean;
}

export const OTPEmailTemplate: React.FC<Readonly<OTPEmailTemplateProps>> = ({
  otp,
  isRegistration,
}) => (
  <div dir="rtl" style={{ fontFamily: 'Arial, sans-serif', lineHeight: 1.6, color: '#333' }}>
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', border: '1px solid #eee', borderRadius: '10px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h2 style={{ color: '#000', margin: '15px 0 5px' }}>منصة إيصال بلس</h2>
      </div>
      <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '5px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 10px' }}>
          {isRegistration ? 'مرحباً بك في منصة إيصال بلس!' : 'مرحباً بك مجدداً في منصة إيصال بلس!'}
        </p>
        <p style={{ margin: '0 0 10px' }}>
          {isRegistration ? 'نشكرك على إنشاء حساب جديد في منصتنا.' : 'نشكرك على استخدام منصتنا.'}
        </p>
        <p style={{ margin: '0' }}>رمز التحقق الخاص بك هو:</p>
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <div
            style={{
              display: 'inline-block',
              padding: '10px 20px',
              backgroundColor: '#000',
              color: '#fff',
              fontSize: '24px',
              fontWeight: 'bold',
              letterSpacing: '5px',
              borderRadius: '5px',
            }}
          >
            {otp}
          </div>
        </div>
        <p style={{ margin: '0' }}>
          يرجى إدخال هذا الرمز في الصفحة المفتوحة لإكمال عملية {isRegistration ? 'إنشاء الحساب' : 'تسجيل الدخول'}.
        </p>
        <p style={{ margin: '15px 0 0', fontSize: '13px', color: '#777' }}>
          ملاحظة: هذا الرمز صالح لمدة 10 دقائق فقط وسيتم إلغاؤه بعد ذلك.
        </p>
      </div>
      <div
        style={{
          textAlign: 'center',
          fontSize: '12px',
          color: '#777',
          borderTop: '1px solid #eee',
          paddingTop: '15px',
        }}
      >
        <p style={{ margin: '0' }}>هذه رسالة آلية، يرجى عدم الرد عليها.</p>
        <p style={{ margin: '10px 0 0' }}>&copy; {new Date().getFullYear()} إيصال بلس - جميع الحقوق محفوظة</p>
      </div>
    </div>
  </div>
); 