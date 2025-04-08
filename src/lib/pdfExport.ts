import { Invoice } from "./firebase/services/invoiceServices";
import { Timestamp } from 'firebase/firestore';

interface ExportToPdfOptions {
  elementToExport?: HTMLElement;
  invoice: Invoice & { createdAt: Timestamp };
  onProgress?: (message: string) => void;
  onError?: (error: Error | unknown) => void;
  onSuccess?: () => void;
}

interface Html2CanvasModule {
  default: (element: HTMLElement, options?: {
    scale?: number;
    useCORS?: boolean;
    logging?: boolean;
    allowTaint?: boolean;
    backgroundColor?: string;
    removeContainer?: boolean;
  }) => Promise<HTMLCanvasElement>;
}

interface JsPDFModule {
  default: new (orientation?: string, unit?: string, format?: string) => {
    internal: {
      pageSize: {
        getWidth: () => number;
        getHeight: () => number;
      };
    };
    addImage: (data: string, type: string, x: number, y: number, width: number, height: number) => void;
    save: (filename: string) => void;
  };
}

function formatDate(date: Date | Timestamp) {
  try {
    const finalDate = date instanceof Date ? date : date.toDate();
    return finalDate.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}

const statusLabels = {
  unpaid: 'غير مدفوعة',
  partially_paid: 'مدفوعة جزئيا',
  paid: 'مدفوعة',
};

export async function exportInvoiceToPdf({ 
  invoice,
  onProgress,
  onError,
  onSuccess
}: ExportToPdfOptions): Promise<void> {
  let isCompleted = false; // تتبع ما إذا تم استكمال العملية بنجاح

  try {
    onProgress?.('جاري تحميل المكتبات...');
    
    // إضافة الخطوط العربية كـ base64
    const tajawalFontStyle = document.createElement('style');
    tajawalFontStyle.textContent = `
      @font-face {
        font-family: 'TheYearofTheCamel';
        src: url('/fonts/ArbFONTS-TheYearofTheCamel-Regular.otf') format('opentype');
        font-weight: normal;
        font-style: normal;
      }
      @font-face {
        font-family: 'TheYearofTheCamel';
        src: url('/fonts/ArbFONTS-TheYearofTheCamel-Bold.otf') format('opentype');
        font-weight: bold;
        font-style: normal;
      }
      @font-face {
        font-family: 'TheYearofTheCamel';
        src: url('/fonts/ArbFONTS-TheYearofTheCamel-Medium.otf') format('opentype');
        font-weight: 500;
        font-style: normal;
      }
      @font-face {
        font-family: 'saudi_riyal';
        src: url('data:font/truetype;charset=utf-8;base64,AAEAAAALAIAAAwAwT1MvMg8SBhQAAAC8AAAAYGNtYXAXVtKOAAABHAAAAFRnYXNwAAAAEAAAAXAAAAAIZ2x5ZgAhPjEAAAF4AAABGGhlYWQGGf9tAAACkAAAADZoaGVhB8IDxwAAAsAAAAAkaG10eAoAADAAAALkAAAAFGxvY2EAKACYAAADAAAAAChtYXhwAAkALwAAAxgAAAAgbmFtZZlKCfsAAAM4AAABhnBvc3QAAwAAAAAE4AAAACAAAwOXAZAABQAAApkCzAAAAI8CmQLMAAAB6wAzAQkAAAAAAAAAAAAAAAAAAAABEAAAAAAAAAAAAAAAAAAAAABAAADpAQPA/8AAQAPAAEAAAAABAAAAAAAAAAAAAAAgAAAAAAADAAAAAwAAABwAAQADAAAAHAADAAEAAAAcAAQAOAAAAAoACAACAAIAAQAg6QH//f//AAAAAAAg6QH//f//AAH/4xcDAAMAAQAAAAAAAAAAAAAAAQAB//8ADwABAAAAAAAAAAAAAgAANzkBAAAAAAEAAAAAAAAAAAACAAA3OQEAAAAAAQAAAAAAAAAAAAIAADc5AQAAAAAB//8AAAQAAsAAJQAAASImJyY0NzYyFxYUBw4BIyImNTQ2MzIWFxYUBw4BIyImNTQ2MzIWAQAHCwUGBgYSBgYGBQsHCQwMCQcLBQYGBQsHCQwMCQkMA4AGBgYSBgYGBhIGBgwJCQwGBgYSBgYGDAkJDAwAAAABAAAAAQAA2Y49il8PPPUACwQAAAAAANJ4C0YAAAAA0ngLRgAA/AAEAALAAAAACAACAAAAAAAAAAEAAAPA/8AAAAQAAAAAAAQAAAEAAAAAAAAAAAAAAAAAAAAFAAAAAAAAAAAAAAAAAgAAAAQAAAAAAAAAAAAKABQAHgBKAAEAAAAFACYAAQAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAOAK4AAQAAAAAAAQAHAAAAAQAAAAAAAgAHAGAAAQAAAAAAAwAHADYAAQAAAAAABAAHAHUAAQAAAAAABQALABUAAQAAAAAABgAHAEsAAQAAAAAACgAaAIoAAwABBAkAAQAOAAcAAwABBAkAAgAOAGcAAwABBAkAAwAOAD0AAwABBAkABAAOAHwAAwABBAkABQAWACAAAwABBAkABgAOAFIAAwABBAkACgA0AKRpY29tb29uAGkAYwBvAG0AbwBvAG5WZXJzaW9uIDEuMABWAGUAcgBzAGkAbwBuACAAMQAuADBpY29tb29uAGkAYwBvAG0AbwBvAG5pY29tb29uAGkAYwBvAG0AbwBvAG5SZWd1bGFyAFIAZQBnAHUAbABhAHJpY29tb29uAGkAYwBvAG0AbwBvAG5Gb250IGdlbmVyYXRlZCBieSBJY29Nb29uLgBGAG8AbgB0ACAAZwBlAG4AZQByAGEAdABlAGQAIABiAHkAIABJAGMAbwBNAG8AbwBuAC4AAAADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
    `;
    document.head.appendChild(tajawalFontStyle);
    
    // إضافة أنماط CSS عامة لتجاوز دالة oklch
    const globalStyle = document.createElement('style');
    globalStyle.textContent = `
      * {
        color: #000000 !important;
        background-color: #ffffff !important;
        border-color: #e5e7eb !important;
        --tw-text-opacity: 1 !important;
        --tw-bg-opacity: 1 !important;
        --tw-border-opacity: 1 !important;
        color-scheme: light !important;
        font-family: 'TheYearofTheCamel', Arial, sans-serif !important;
      }
      .text-orange-800, [class*="text-orange"] { color: #9a3412 !important; }
      .text-yellow-800, [class*="text-yellow"] { color: #854d0e !important; }
      .text-green-800, [class*="text-green"] { color: #166534 !important; }
      .bg-orange-100, [class*="bg-orange"] { background-color: #ffedd5 !important; }
      .bg-yellow-100, [class*="bg-yellow"] { background-color: #fef9c3 !important; }
      .bg-green-100, [class*="bg-green"] { background-color: #dcfce7 !important; }
      .text-red-600, [class*="text-red"] { color: #dc2626 !important; }
      .bg-red-50, [class*="bg-red"] { background-color: #fef2f2 !important; }
      .text-gray-500, .text-gray-600, [class*="text-gray"] { color: #6b7280 !important; }
      .bg-gray-50, [class*="bg-gray"] { background-color: #f9fafb !important; }
      .saudi-riyal {
        font-family: 'saudi_riyal', sans-serif !important;
        font-size: 1.1em;
        line-height: 1;
        display: inline-block;
        vertical-align: middle;
      }
    `;
    document.head.appendChild(globalStyle);
    
    // تحميل المكتبات المطلوبة
    const html2canvasModule = await import('html2canvas') as Html2CanvasModule;
    const jspdfModule = await import('jspdf') as JsPDFModule;
    
    const html2canvas = html2canvasModule.default;
    const jsPDF = jspdfModule.default;
    
    onProgress?.('جاري إنشاء محتوى الفاتورة...');
    
    // تهيئة طريقتين لتصدير PDF
    try {
      // الطريقة الأولى: استخدام عنصر HTML مخصص مع CSS بسيط
      // إنشاء عنصر مؤقت بدون استخدام أي تنسيقات Tailwind
      const tempElement = document.createElement('div');
      tempElement.style.cssText = `
        width: 210mm;
        padding: 15mm;
        background-color: #ffffff !important;
        font-family: 'TheYearofTheCamel', Arial, sans-serif !important;
        color: #000000 !important;
        direction: rtl;
      `;
      
      // إنشاء محتوى الفاتورة باستخدام HTML عادي مع أنماط CSS مضمنة
      let invoiceHtml = ``;
      
      // إضافة شعار الشركة إذا كان موجودًا
      if (invoice.logo) {
        invoiceHtml += `
          <div style="text-align: center; display: flex; justify-content: center; align-items: center; margin: 0 auto 40px auto; width: 100%; height: 180px;">
            <img 
              src="${invoice.logo}" 
              alt="Business Logo"
              style="max-height: 180px; max-width: 300px; object-fit: contain; display: block; margin: 0 auto;"
            />
          </div>
        `;
      }
      
      invoiceHtml += `
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="font-size: 28px; margin-bottom: 10px; color: #000000 !important; font-weight: bold;">
            فاتورة #${invoice.invoiceNumber}
          </h1>
          <p style="margin-bottom: 15px; color: #666666 !important; font-size: 16px;">
            ${formatDate(invoice.createdAt)}
          </p>
          <div style="display: flex; justify-content: center; align-items: center;">
            <span style="
              display: flex;
              justify-content: center;
              align-items: center;
              width: 314px;
              height: 28px;
              border-radius: 20px; 
              font-size: 14px;
              font-weight: 500;
              background-color: ${
                invoice.status === 'unpaid' ? '#ffedd5' : 
                invoice.status === 'partially_paid' ? '#fef9c3' : '#dcfce7'
              } !important;
              color: ${
                invoice.status === 'unpaid' ? '#9a3412' : 
                invoice.status === 'partially_paid' ? '#854d0e' : '#166534'
              } !important;
            ">
              ${statusLabels[invoice.status]}
            </span>
          </div>
        </div>
      `;
      
      // إضافة خط أفقي
      invoiceHtml += `<div style="height: 1px; background-color: #e5e7eb; margin: 15px 0 25px 0;"></div>`;
      
      // معلومات المرسل والمستلم
      invoiceHtml += `
        <div style="display: flex; justify-content: space-between; margin-bottom: 35px;">
          <div style="width: 48%;">
            <h3 style="margin-bottom: 12px; color: #111827; font-size: 18px; font-weight: bold; padding-bottom: 5px; border-bottom: 2px solid #f3f4f6;">معلومات المرسل</h3>
            <p style="margin: 8px 0; color: #333333; font-size: 16px;">${invoice.businessName}</p>
            <p style="margin: 8px 0; color: #333333; font-size: 16px;">${invoice.phone}</p>
            <p style="margin: 8px 0; color: #333333; font-size: 16px;">${invoice.email}</p>
            ${invoice.address ? `<p style="margin: 8px 0; color: #333333; font-size: 16px;">${invoice.address}</p>` : ''}
          </div>
          <div style="width: 48%;">
            <h3 style="margin-bottom: 12px; color: #111827; font-size: 18px; font-weight: bold; padding-bottom: 5px; border-bottom: 2px solid #f3f4f6;">معلومات المستلم</h3>
            <p style="margin: 8px 0; color: #333333; font-size: 16px;">${invoice.clientName}</p>
            ${invoice.clientPhone ? `<p style="margin: 8px 0; color: #333333; font-size: 16px;">${invoice.clientPhone}</p>` : ''}
            ${invoice.clientEmail ? `<p style="margin: 8px 0; color: #333333; font-size: 16px;">${invoice.clientEmail}</p>` : ''}
            ${invoice.clientAddress ? `<p style="margin: 8px 0; color: #333333; font-size: 16px;">${invoice.clientAddress}</p>` : ''}
          </div>
        </div>
      `;
      
      // تفاصيل البنود
      invoiceHtml += `
        <div style="margin-bottom: 30px;">
          <h3 style="margin-bottom: 15px; color: #111827; font-size: 18px; font-weight: bold; padding-bottom: 5px; border-bottom: 2px solid #f3f4f6;">تفاصيل البنود</h3>
          <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <thead>
              <tr style="background-color: #f9fafb;">
                <th style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #374151; font-weight: 600; font-size: 15px;">الوصف</th>
                <th style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb; color: #374151; font-weight: 600; font-size: 15px;">الكمية</th>
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #374151; font-weight: 600; font-size: 15px;">سعر الوحدة</th>
                <th style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #374151; font-weight: 600; font-size: 15px;">المجموع</th>
              </tr>
            </thead>
            <tbody>
      `;
      
      // إضافة بنود الفاتورة
      invoice.items.forEach((item, index) => {
        const isEven = index % 2 === 0;
        invoiceHtml += `
          <tr style="background-color: ${isEven ? '#ffffff' : '#f9fafb'};">
            <td style="padding: 12px; text-align: right; border-bottom: 1px solid #e5e7eb; color: #333333; font-size: 15px;">${item.description}</td>
            <td style="padding: 12px; text-align: center; border-bottom: 1px solid #e5e7eb; color: #333333; font-size: 15px;">${item.quantity}</td>
            <td style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #333333; font-size: 15px;">
              ${item.unitPrice.toLocaleString()} <span style="font-family: 'saudi_riyal' !important;">&#xE900;</span>
            </td>
            <td style="padding: 12px; text-align: left; border-bottom: 1px solid #e5e7eb; color: #333333; font-weight: 500; font-size: 15px;">
              ${item.total.toLocaleString()} <span style="font-family: 'saudi_riyal' !important;">&#xE900;</span>
            </td>
          </tr>
        `;
      });
      
      invoiceHtml += `
            </tbody>
          </table>
        </div>
      `;
      
      // الحسابات
      invoiceHtml += `
        <div style="margin-top: 30px; background-color: #f9fafb; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #e5e7eb;">
            <span style="color: #4b5563; font-size: 16px;">المجموع الفرعي:</span>
            <span style="color: #4b5563; font-size: 16px; font-weight: 500;">${invoice.subtotal.toLocaleString()} <span style="font-family: 'saudi_riyal' !important;">&#xE900;</span></span>
          </div>
      `;
      
      // الخصم إذا كان موجودًا
      if (invoice.discount > 0) {
        const discountAmount = invoice.discountType === 'percentage' 
          ? (invoice.subtotal * invoice.discount / 100) 
          : invoice.discount;
        
        invoiceHtml += `
          <div style="display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px dashed #e5e7eb; color: #dc2626;">
            <span style="font-size: 16px;">الخصم ${invoice.discountType === 'percentage' ? `(${invoice.discount}%)` : ''}:</span>
            <span style="font-size: 16px; font-weight: 500;">- ${discountAmount.toLocaleString()} <span style="font-family: 'saudi_riyal' !important;">&#xE900;</span></span>
          </div>
        `;
      }
      
      // المجموع النهائي
      invoiceHtml += `
          <div style="display: flex; justify-content: space-between; margin-top: 15px; padding-top: 12px; border-top: 2px solid #e5e7eb;">
            <span style="color: #111827; font-size: 18px; font-weight: bold;">المجموع النهائي:</span>
            <span style="color: #111827; font-size: 20px; font-weight: bold;">${invoice.total.toLocaleString()} <span style="font-family: 'saudi_riyal' !important;">&#xE900;</span></span>
          </div>
        </div>
      `;
      
      // إضافة الملاحظات إذا كانت موجودة
      if (invoice.notes) {
        invoiceHtml += `
          <div style="margin-top: 35px; background-color: #f9fafb; border-radius: 8px; padding: 15px; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);">
            <h3 style="margin-bottom: 10px; color: #111827; font-size: 18px; font-weight: bold;">ملاحظات</h3>
            <p style="white-space: pre-wrap; color: #4b5563; font-size: 15px;">${invoice.notes}</p>
          </div>
        `;
      }
      
      // إضافة التذييل
      invoiceHtml += `
        <div style="margin-top: 40px; text-align: center; padding-top: 15px; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 14px;">تم إنشاء هذه الفاتورة بواسطة منصة إيصال بلس</p>
        </div>
      `;
      
      // إضافة المحتوى للعنصر المؤقت
      tempElement.innerHTML = invoiceHtml;
      
      // إضافة العنصر إلى DOM بشكل مؤقت وإخفائه
      tempElement.style.position = 'absolute';
      tempElement.style.left = '-9999px';
      document.body.appendChild(tempElement);
      
      onProgress?.('جاري تجهيز الفاتورة للتصدير...');
      
      // إضافة CSS لضمان طباعة الألوان بشكل صحيح
      const printStyle = document.createElement('style');
      printStyle.textContent = `
        @media print {
          body, html {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `;
      tempElement.appendChild(printStyle);
      
      // انتظار تحميل الخطوط والصور
      const fontLoaded = new Promise<void>(resolve => {
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(() => resolve());
        } else {
          // إذا لم يكن متاحًا API لـ fonts، انتظر وقت قصير
          setTimeout(resolve, 500);
        }
      });
      
      // انتظار تحميل الصور
      const images = tempElement.querySelectorAll('img');
      const imagesLoaded = Promise.all(Array.from(images).map(img => {
        return new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
          } else {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }
        });
      }));
      
      // انتظار تحميل الخطوط والصور معًا
      await Promise.all([fontLoaded, imagesLoaded]);
      
      // انتظار لإعطاء وقت للمتصفح لعرض العنصر
      await new Promise(resolve => setTimeout(resolve, 800));
      
      onProgress?.('جاري تحويل الفاتورة إلى صورة...');
      
      // إنشاء Canvas
      const canvas = await html2canvas(tempElement, {
        scale: 3, // زيادة الدقة
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      onProgress?.('جاري إنشاء ملف PDF...');
      
      // إنشاء PDF
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // حساب النسب
      const canvasRatio = canvas.width / canvas.height;
      const pageRatio = pdfWidth / pdfHeight;
      
      let renderWidth, renderHeight;
      
      if (canvasRatio >= pageRatio) {
        // العرض أكبر من الطول
        renderWidth = pdfWidth;
        renderHeight = pdfWidth / canvasRatio;
      } else {
        // الطول أكبر من العرض
        renderHeight = pdfHeight - 10;
        renderWidth = renderHeight * canvasRatio;
      }
      
      // إضافة الصورة إلى PDF
      pdf.addImage(
        imgData, 
        'JPEG', 
        (pdfWidth - renderWidth) / 2, 
        5, 
        renderWidth, 
        renderHeight
      );
      
      // حفظ PDF
      pdf.save(`فاتورة-${invoice.invoiceNumber}.pdf`);
      
      // إزالة العنصر المؤقت
      document.body.removeChild(tempElement);
      
      // التحقق من عدم استدعاء دالة النجاح مسبقًا
      if (!isCompleted) {
        isCompleted = true;
        onSuccess?.();
      }
      
      // إزالة الأنماط العالمية بعد الانتهاء
      document.head.removeChild(globalStyle);
      document.head.removeChild(tajawalFontStyle);
      
      return; // الخروج من الدالة لمنع تنفيذ الكود التالي
    } catch (error) {
      console.error('فشلت الطريقة الأولى لتصدير PDF:', error);
      
      // الطريقة الثانية: تصدير عنصر HTML بشكل مباشر
      onProgress?.('جاري محاولة طريقة بديلة...');
      
      const doc = new jsPDF('p', 'mm', 'a4');
      
      // إنشاء عنصر HTML بسيط للتصدير
      const simpleElement = document.createElement('div');
      simpleElement.style.cssText = `
        width: 190mm;
        padding: 15mm;
        margin: 0;
        background: white;
        font-family: 'TheYearofTheCamel', Arial, sans-serif;
        color: black;
        direction: rtl;
      `;
      
      simpleElement.innerHTML = `
        ${invoice.logo ? `
          <div style="text-align: center; display: flex; justify-content: center; align-items: center; margin: 0 auto 40px auto; width: 100%; height: 180px;">
            <img src="${invoice.logo}" alt="Business Logo" style="max-height: 180px; max-width: 300px; object-fit: contain; display: block; margin: 0 auto;" />
          </div>
        ` : ''}
        
        <div style="text-align: center; margin-bottom: 20px; color: black;">
          <h1 style="font-size: 28px; margin-bottom: 10px; color: black; font-weight: bold;">فاتورة #${invoice.invoiceNumber}</h1>
          <p style="color: #555; font-size: 16px;">${formatDate(invoice.createdAt)}</p>
          <div style="display: flex; justify-content: center; align-items: center; margin: 15px 0;">
            <span style="
              display: flex;
              justify-content: center;
              align-items: center;
              width: 314px;
              height: 28px;
              border-radius: 20px; 
              font-size: 14px;
              font-weight: 500;
              background: ${
                invoice.status === 'unpaid' ? '#ffedd5' : 
                invoice.status === 'partially_paid' ? '#fef9c3' : '#dcfce7'
              }; 
              color: ${
                invoice.status === 'unpaid' ? '#9a3412' : 
                invoice.status === 'partially_paid' ? '#854d0e' : '#166534'
              };
            ">
              ${statusLabels[invoice.status]}
            </span>
          </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-bottom: 25px;">
          <div style="width: 48%;">
            <h3 style="color: black; font-size: 18px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">معلومات المرسل</h3>
            <p style="color: black; font-size: 16px; margin: 5px 0;">${invoice.businessName}</p>
            <p style="color: black; font-size: 16px; margin: 5px 0;">${invoice.phone}</p>
            <p style="color: black; font-size: 16px; margin: 5px 0;">${invoice.email}</p>
          </div>
          <div style="width: 48%;">
            <h3 style="color: black; font-size: 18px; font-weight: bold; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px;">معلومات المستلم</h3>
            <p style="color: black; font-size: 16px; margin: 5px 0;">${invoice.clientName}</p>
            ${invoice.clientPhone ? `<p style="color: black; font-size: 16px; margin: 5px 0;">${invoice.clientPhone}</p>` : ''}
            ${invoice.clientEmail ? `<p style="color: black; font-size: 16px; margin: 5px 0;">${invoice.clientEmail}</p>` : ''}
          </div>
        </div>
        
        <div style="margin: 20px 0; background: #f9fafb; padding: 15px; border-radius: 8px;">
          <h3 style="color: black; font-size: 18px; font-weight: bold; margin-bottom: 10px;">المجموع النهائي</h3>
          <p style="font-size: 22px; font-weight: bold; color: black; margin: 5px 0;">${invoice.total.toLocaleString()} <span style="font-family: 'saudi_riyal' !important;">&#xE900;</span></p>
        </div>
        
        <div style="margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px; text-align: center;">
          <p style="color: #777; font-size: 14px;">تم إنشاء هذه الفاتورة بواسطة منصة إيصال بلس</p>
        </div>
      `;
      
      document.body.appendChild(simpleElement);
      simpleElement.style.position = 'fixed';
      simpleElement.style.left = '-9999px';
      
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const canvas2 = await html2canvas(simpleElement, {
        scale: 3,
        backgroundColor: '#ffffff',
        logging: false
      });
      
      const imgData2 = canvas2.toDataURL('image/jpeg');
      
      const pdfWidth2 = doc.internal.pageSize.getWidth();
      
      doc.addImage(
        imgData2, 
        'JPEG', 
        0, 
        0, 
        pdfWidth2, 
        (canvas2.height * pdfWidth2) / canvas2.width
      );
      
      doc.save(`فاتورة-${invoice.invoiceNumber}.pdf`);
      
      document.body.removeChild(simpleElement);
      
      // التحقق من عدم استدعاء دالة النجاح مسبقًا
      if (!isCompleted) {
        isCompleted = true;
        onSuccess?.();
      }
      
      // إزالة الأنماط العالمية بعد الانتهاء
      document.head.removeChild(globalStyle);
      document.head.removeChild(tajawalFontStyle);
    }
    
  } catch (error) {
    console.error('خطأ في تصدير الفاتورة:', error);
    
    if (!isCompleted) {
      onError?.(error);
    }
    
    // محاولة أخيرة باستخدام نص بسيط فقط
    try {
      const doc = new (await import('jspdf')).default('p', 'mm', 'a4');
      doc.setFont('courier', 'normal');
      doc.setTextColor(0, 0, 0);
      
      // إضافة نص بسيط
      doc.text(`فاتورة #${invoice.invoiceNumber}`, 105, 20, { align: 'center' });
      doc.text(`المجموع: ${invoice.total} `, 105, 30, { align: 'center' });
      
      doc.save(`فاتورة-${invoice.invoiceNumber}.pdf`);
      
      // التحقق من عدم استدعاء دالة النجاح مسبقًا
      if (!isCompleted) {
        isCompleted = true;
        onSuccess?.();
      }
    } catch (finalError) {
      console.error('فشلت جميع المحاولات لتصدير الفاتورة:', finalError);
      
      if (!isCompleted) {
        onError?.(finalError);
      }
    }
  }
}