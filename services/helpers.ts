
export const formatRupiah = (number: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(number);
};

export const generateWhatsAppLink = (phone: string, message: string) => {
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '62' + cleanPhone.slice(1);
  }
  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
};

export const generateAffiliateCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const formatProductName = (name: string | undefined | null): string => {
  if (!name || name.trim() === '') return 'Produk';
  
  let cleanName = name.trim();
  
  // Hapus "1x ", "2x ", dst di awal string
  cleanName = cleanName.replace(/^\d+x\s+/i, '');
  
  // Hapus suffix "(1x)", "(2x)" di akhir string
  cleanName = cleanName.replace(/\s*\(\d+x\)$/i, '');
  
  // Jika setelah dibersihkan tersisa karakter aneh atau kosong, kembalikan 'Produk'
  if (cleanName === '(-)' || cleanName === '()' || cleanName === '') return 'Produk';
  
  return cleanName;
};
