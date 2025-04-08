export function formatHijriDate(date: Date): string {
  const hijriDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
  
  return hijriDate;
} 