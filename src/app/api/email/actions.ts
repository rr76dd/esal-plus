'use server';

import { Resend } from 'resend';

// تكوين خدمة Resend باستخدام مفتاح API من متغيرات البيئة
const resend = new Resend(process.env.RESEND_API_KEY);

// إنشاء محتوى HTML لرسالة تذكير الدفع
const createPaymentReminderHtml = (
  invoiceNumber: string, 
  businessName: string, 
  clientName: string,
  amount: number,
  dueDate: string | undefined,
  paymentLink: string | undefined
): string => {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #000; margin: 15px 0 5px;">تذكير بدفع الفاتورة</h2>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin: 0 0 10px;">مرحباً ${clientName}،</p>
          <p style="margin: 0 0 10px;">هذه رسالة تذكير بخصوص الفاتورة رقم <strong>${invoiceNumber}</strong> من ${businessName}.</p>
          <p style="margin: 0 0 10px;">المبلغ المستحق: <strong>${amount.toLocaleString()} ريال</strong></p>
          ${dueDate ? `<p style="margin: 0 0 10px;">تاريخ الاستحقاق: <strong>${dueDate}</strong></p>` : ''}
          <div style="text-align: center; margin: 20px 0;">
            ${paymentLink ? `<a href="${paymentLink}" style="display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; text-decoration: none; font-weight: bold; border-radius: 5px;">دفع الفاتورة الآن</a>` : ''}
          </div>
          <p style="margin: 15px 0 0; font-size: 13px; color: #777;">نشكرك على تعاونك.</p>
        </div>
        <div style="text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 15px;">
          <p style="margin: 0;">هذه رسالة آلية، يرجى عدم الرد عليها.</p>
          <p style="margin: 10px 0 0;">&copy; ${new Date().getFullYear()} إيصال بلس - جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  `;
};

// إرسال بريد إلكتروني تذكير بالدفع (فعل خادم)
export async function sendPaymentReminderEmail(
  email: string,
  invoiceNumber: string,
  businessName: string,
  clientName: string,
  amount: number,
  dueDate?: string,
  paymentLink?: string
): Promise<boolean> {
  try {
    const subject = `تذكير بدفع الفاتورة رقم ${invoiceNumber}`;

    const { data, error } = await resend.emails.send({
      from: 'EsalPlus <onboarding@resend.dev>',
      to: [email],
      subject: subject,
      html: createPaymentReminderHtml(invoiceNumber, businessName, clientName, amount, dueDate, paymentLink),
    });

    if (error) {
      console.error('Resend API error:', error);
      return false;
    }

    console.log('Payment reminder email sent successfully:', data);
    return true;
  } catch (error) {
    console.error('Error sending payment reminder email:', error);
    return false;
  }
}

// إنشاء محتوى HTML للبريد الإلكتروني OTP
const createOTPEmailHtml = (otp: string, isRegistration: boolean): string => {
  return `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #000; margin: 15px 0 5px;">منصة إيصال بلس</h2>
        </div>
        <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
          <p style="margin: 0 0 10px;">${isRegistration ? 'مرحباً بك في منصة إيصال بلس!' : 'مرحباً بك مجدداً في منصة إيصال بلس!'}</p>
          <p style="margin: 0 0 10px;">${isRegistration ? 'نشكرك على إنشاء حساب جديد في منصتنا.' : 'نشكرك على استخدام منصتنا.'}</p>
          <p style="margin: 0;">رمز التحقق الخاص بك هو:</p>
          <div style="text-align: center; margin: 20px 0;">
            <div style="display: inline-block; padding: 10px 20px; background-color: #000; color: #fff; font-size: 24px; font-weight: bold; letter-spacing: 5px; border-radius: 5px;">${otp}</div>
          </div>
          <p style="margin: 0;">يرجى إدخال هذا الرمز في الصفحة المفتوحة لإكمال عملية ${isRegistration ? 'إنشاء الحساب' : 'تسجيل الدخول'}.</p>
          <p style="margin: 15px 0 0; font-size: 13px; color: #777;">ملاحظة: هذا الرمز صالح لمدة 10 دقائق فقط وسيتم إلغاؤه بعد ذلك.</p>
        </div>
        <div style="text-align: center; font-size: 12px; color: #777; border-top: 1px solid #eee; padding-top: 15px;">
          <p style="margin: 0;">هذه رسالة آلية، يرجى عدم الرد عليها.</p>
          <p style="margin: 10px 0 0;">&copy; ${new Date().getFullYear()} إيصال بلس - جميع الحقوق محفوظة</p>
        </div>
      </div>
    </div>
  `;
};

// إرسال بريد إلكتروني OTP (فعل خادم)
export async function sendOTPEmail(
  email: string,
  otp: string,
  isRegistration: boolean = false
): Promise<boolean> {
  try {
    const subject = isRegistration 
      ? 'رمز التحقق لإنشاء حساب جديد في إيصال بلس' 
      : 'رمز التحقق لتسجيل الدخول إلى إيصال بلس';

    const { data, error } = await resend.emails.send({
      from: 'EsalPlus <onboarding@resend.dev>',
      to: [email],
      subject: subject,
      html: createOTPEmailHtml(otp, isRegistration),
    });

    if (error) {
      console.error('Resend API error:', error);
      return false;
    }

    console.log('Email sent successfully:', data);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
} 