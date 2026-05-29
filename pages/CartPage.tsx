
import React, { useState } from 'react';
import { CartItem, UserProfile, StoreSettings, Voucher } from '../types';
import { formatRupiah, generateWhatsAppLink } from '../services/helpers';
import { Trash2, CreditCard, Wallet, QrCode, CheckCircle, Smartphone, Ticket, Loader2, X, UserPlus, Lock, Mail, User, ExternalLink, ShoppingBag, Download, AlertTriangle, Terminal, ShieldCheck, Copy, Clock } from 'lucide-react';
import { getSupabase, GUEST_ORDER_MIGRATION_SQL } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { trackPixelEvent } from '../services/pixel';
import { safeStorage } from '../services/storage';

interface CartPageProps {
  cart: CartItem[];
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  user: UserProfile | null;
  settings: StoreSettings;
}

type PaymentMethod = 'TRANSFER' | 'EWALLET' | 'QRIS' | 'TRIPAY' | 'PAKASIR';

const CartPage: React.FC<CartPageProps> = ({ cart, removeFromCart, clearCart, user, settings }) => {
  const hasAppPremium = cart.some(item => item.category === 'APP PREMIUM');

  const isMethodActive = (id: 'transfer' | 'ewallet' | 'qris' | 'pakasir'): boolean => {
    if (id === 'pakasir' && hasAppPremium) return false;
    if (!settings.payment_methods_active) return true;
    return (settings.payment_methods_active as any)[id] ?? true;
  };

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | ''>('');
  const [showPaymentWarning, setShowPaymentWarning] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>(''); 
  const [processing, setProcessing] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  
  // State for order confirmation
  const [lastOrderTotal, setLastOrderTotal] = useState(0); 
  const [lastOrderItems, setLastOrderItems] = useState<CartItem[]>([]);
  const [lastOrderMethod, setLastOrderMethod] = useState<string>('');
  const [isFreeOrder, setIsFreeOrder] = useState(false);

  // Voucher State
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<Voucher | null>(null);
  const [checkingVoucher, setCheckingVoucher] = useState(false);

  // Guest State
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPassword, setGuestPassword] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  
  // Error Handling State
  const [dbError, setDbError] = useState(false);
  const [pakasirData, setPakasirData] = useState<any>(null);
  const [pollingStatus, setPollingStatus] = useState(false);

  const navigate = useNavigate();
  const supabase = getSupabase();

  // --- POLLING LOGIC FOR PAKASIR ---
  React.useEffect(() => {
    let interval: any;
    
    if (orderSuccess && selectedMethod === 'PAKASIR' && pakasirData && !pollingStatus) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/pakasir-transaction/${orderSuccess}?amount=${pakasirData.amount}`);
          const data = await res.json();
          
          if (data.transaction && data.transaction.status === 'completed') {
            setPollingStatus(true);
            setLastOrderMethod(`${lastOrderMethod} (SUDAH DIBAYAR)`);
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Polling error:", err);
        }
      }, 5000); // Poll every 5 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [orderSuccess, selectedMethod, pakasirData, pollingStatus]);

  // --- CALCULATION LOGIC ---
  const rawSubtotal = cart.reduce((sum, item) => {
    const price = item.discount_price || item.price;
    return sum + (Number(price) * item.quantity);
  }, 0);

  let discountAmount = 0;
  if (appliedVoucher) {
    if (appliedVoucher.product_id) {
       // Only apply to the specific product
       const targetItem = cart.find(item => item.id === appliedVoucher.product_id);
       if (targetItem) {
          const itemPrice = Number(targetItem.discount_price || targetItem.price);
          if (appliedVoucher.discount_type === 'percentage') {
             discountAmount = Math.round(itemPrice * (Number(appliedVoucher.discount_value) / 100));
          } else {
             discountAmount = Number(appliedVoucher.discount_value);
          }
       }
    } else {
      // Global voucher
      if (appliedVoucher.discount_type === 'percentage') {
         discountAmount = Math.round(rawSubtotal * (Number(appliedVoucher.discount_value) / 100));
      } else {
         discountAmount = Number(appliedVoucher.discount_value);
      }
    }
  }

  if (discountAmount > rawSubtotal) discountAmount = rawSubtotal;
  const finalTotal = Math.max(0, rawSubtotal - discountAmount);
  
  // --- VOUCHER HANDLER ---
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim() || !supabase) return;
    setCheckingVoucher(true);
    setAppliedVoucher(null);

    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', voucherCode.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (error || !data) {
       alert("Voucher tidak valid atau sudah kadaluarsa.");
    } else {
       const v = data as Voucher;
       if (v.product_id) {
          const isInCart = cart.some(item => item.id === v.product_id);
          if (!isInCart) {
             alert(`Voucher ini hanya berlaku untuk produk: ${v.product_id}. Silakan tambahkan produk tersebut ke keranjang.`);
             setCheckingVoucher(false);
             return;
          }
       }
       setAppliedVoucher(v);
       alert("Voucher berhasil dipasang!");
    }
    setCheckingVoucher(false);
  };

  const handleRemoveVoucher = () => {
     setAppliedVoucher(null);
     setVoucherCode('');
  };

  const copySql = () => {
     navigator.clipboard.writeText(GUEST_ORDER_MIGRATION_SQL);
     alert("SQL Disalin!");
  };

  // --- CHECKOUT HANDLER ---
  const handleCheckout = async () => {
    if (cart.length === 0) return;
    if (!supabase) return;

    if (finalTotal > 0 && !selectedMethod) {
      setShowPaymentWarning(true);
      return;
    }

    if (!user) {
        if (!guestName || !guestEmail || !guestPassword || !guestPhone) {
            alert("Mohon lengkapi data diri Anda untuk pendaftaran otomatis.");
            return;
        }
    } else if (selectedMethod !== 'QRIS' && selectedMethod !== 'TRIPAY' && selectedMethod !== 'PAKASIR') {
       if (selectedMethod === 'TRANSFER' && settings.bank_accounts.length > 0 && !selectedProvider) {
          alert("Silakan pilih Bank tujuan.");
          return;
       }
       if (selectedMethod === 'EWALLET' && settings.e_wallets.length > 0 && !selectedProvider) {
          alert("Silakan pilih E-Wallet tujuan.");
          return;
       }
    }

    setProcessing(true);
    setDbError(false);

    // Track Meta Pixel InitiateCheckout
    trackPixelEvent('InitiateCheckout', {
      value: finalTotal,
      currency: 'IDR',
      content_ids: cart.map(item => item.id),
      content_type: 'product',
      num_items: cart.length
    });

    try {
      let userId = user?.id;

      // 2. CHECK REFERRAL
      let referredBy = safeStorage.getItem('digitalstore_referral');
      if (user?.referred_by) {
          referredBy = user.referred_by;
      }
      
      // 1. AUTO-REGISTER / LOGIN IF GUEST
      if (!user) {
         const { data: existingUser } = await supabase.from('profiles').select('id, referred_by').eq('email', guestEmail).single();
         
         if (existingUser) {
             const { data: loginData, error: loginError } = await (supabase.auth as any).signInWithPassword({
                 email: guestEmail,
                 password: guestPassword
             });
             
             if (loginError) {
                 alert("Email sudah terdaftar. Gagal login otomatis: " + loginError.message);
                 setProcessing(false);
                 return;
             }
             userId = loginData.user.id;

             // Ensure existing user gets the referral if they don't have one
             if (!existingUser.referred_by && referredBy) {
                await supabase.from('profiles').update({ referred_by: referredBy }).eq('id', userId);
             }
         } else {
             const { data: authData, error: authError } = await (supabase.auth as any).signUp({
                 email: guestEmail,
                 password: guestPassword,
                 options: { data: { full_name: guestName } }
             });

             if (authError) throw authError;
             userId = authData.user?.id;
             
             if (userId) {
                await supabase.from('profiles').insert({
                    id: userId,
                    email: guestEmail,
                    full_name: guestName,
                    phone: guestPhone,
                    role: 'user',
                    referred_by: referredBy // FIX: Added referred_by here for guest auto-registration
                }).select();
             }
         }
      } else {
         // Logged in user: Update referral if missing
         if (userId && referredBy && !user.referred_by) {
            await supabase.from('profiles').update({ referred_by: referredBy }).eq('id', userId);
         }
      }

      // 3. PREPARE METHOD STRING
      let detailedMethod: string = selectedMethod;
      if (finalTotal <= 0) {
          detailedMethod = 'GRATIS / FREE';
      } else if (selectedMethod === 'TRANSFER' || selectedMethod === 'EWALLET') {
          if (selectedProvider) {
              detailedMethod = `${selectedMethod} - ${selectedProvider}`;
          }
      } else if (selectedMethod === 'PAKASIR') {
          detailedMethod = `PAKASIR - ${selectedProvider.toUpperCase()}`;
      }

      const status = finalTotal <= 0 ? 'completed' : 'pending';

      // 4. PREPARE PAYLOAD
      const buyerEmail = user?.email || guestEmail;
      const productNames = cart.map(item => item.name).join(', ');

      // Tentukan affiliate_code yang valid (Cegah self-referral pembeli membeli dari link sendiri)
      let finalAffCode = referredBy || null;
      if (user && user.affiliate_code && finalAffCode && user.affiliate_code.toUpperCase() === finalAffCode.toUpperCase()) {
          finalAffCode = null;
      }

      const payload: any = {
        user_id: userId,
        total_amount: finalTotal,
        subtotal: rawSubtotal,
        discount_amount: discountAmount,
        voucher_code: appliedVoucher?.code || null,
        status: status, 
        payment_method: detailedMethod,
        items: cart.map(item => ({
          product_id: item.id,
          product_name: item.name,
          price: item.discount_price || item.price,
          cost_price: item.cost_price || 0,
          file_url: item.file_url,
          quantity: item.quantity
        })),
        guest_info: !userId ? { name: guestName, whatsapp: guestPhone } : null,
        buyer_email: buyerEmail,
        product_name: productNames,
        affiliate_code: finalAffCode
      };

      // 5. INSERT WITH RESILIENT RETRY FALLBACK
      let orderDataResult;
      let currentPayload = { ...payload };
      let insertSuccess = false;
      let lastError: any = null;

      // Make up to 7 insertion attempts, automatically dropping unsupported columns on failure
      for (let attempt = 0; attempt < 7; attempt++) {
        const { data, error } = await supabase.from('orders').insert(currentPayload).select().single();
        if (!error) {
          orderDataResult = data;
          insertSuccess = true;
          break;
        }
        
        lastError = error;
        const msg = error.message ? error.message.toLowerCase() : '';
        
        // Detect most common column-related errors
        if (msg.includes('affiliate_code')) {
          delete currentPayload.affiliate_code;
        } else if (msg.includes('buyer_email')) {
          delete currentPayload.buyer_email;
        } else if (msg.includes('product_name')) {
          delete currentPayload.product_name;
        } else if (msg.includes('guest_info')) {
          delete currentPayload.guest_info;
          setDbError(true);
        } else if (msg.includes('subtotal')) {
          delete currentPayload.subtotal;
        } else if (msg.includes('discount_amount')) {
          delete currentPayload.discount_amount;
        } else {
          // If it is another type of error, exit the loop so we don't loop endlessly
          break;
        }
      }

      if (!insertSuccess && lastError) {
        throw lastError;
      }

      // 5.5 PAKASIR INTEGRATION
      if (selectedMethod === 'PAKASIR' && finalTotal > 0) {
          try {
              const res = await fetch('/api/create-pakasir-transaction', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      method: selectedProvider,
                      order_id: orderDataResult.id,
                      amount: finalTotal
                  })
              });

              if (!res.ok) {
                  const errorText = await res.text();
                  try {
                      const errorJson = JSON.parse(errorText);
                      throw new Error(errorJson.error || `Server Error ${res.status}`);
                  } catch (e) {
                      throw new Error(`Server returned non-JSON response: ${res.status}. ${errorText.substring(0, 50)}...`);
                  }
              }

              const pakData = await res.json();
              if (pakData.error) throw new Error(pakData.error);
              setPakasirData(pakData.payment);
          } catch (pakError: any) {
              console.error("Pakasir creation failed:", pakError);
              alert("Gagal membuat pembayaran otomatis: " + pakError.message + ". Silakan hubungi admin atau gunakan metode lain.");
              // Don't throw, let them see order success but with manual instructions if needed
          }
      }

      // 6. SUCCESS
      setLastOrderTotal(finalTotal);
      setLastOrderItems(cart);
      setLastOrderMethod(detailedMethod);
      setIsFreeOrder(finalTotal <= 0);
      setOrderSuccess(orderDataResult.id);
      
      // Track Meta Pixel Purchase
      trackPixelEvent('Purchase', {
        value: finalTotal,
        currency: 'IDR',
        content_ids: cart.map(item => item.id),
        content_type: 'product',
        num_items: cart.length
      });

      clearCart();
      setAppliedVoucher(null);
      setVoucherCode('');

      // Redirect if free order
      if (finalTotal <= 0) {
          navigate('/profile', { state: { activeTab: 'orders' } });
      }

    } catch (err: any) {
      alert("Gagal membuat pesanan: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmWA = () => {
    const itemsList = lastOrderItems.map((item, idx) => `${idx + 1}. ${item.name} (x${item.quantity})`).join('\n');
    const message = `Halo Admin, saya sudah melakukan checkout.

*Detail Pesanan:*
${itemsList}

*Total:* ${formatRupiah(lastOrderTotal)}
*Metode Pembayaran:* ${lastOrderMethod}
*ID Pesanan:* ${orderSuccess?.substring(0, 8)}

Mohon segera diproses. Terima kasih.`;
    
    const adminNumber = settings.whatsapp_number || '6281234567890';
    window.open(generateWhatsAppLink(adminNumber, message), '_blank');
  };

  const openFullImage = (url: string) => {
    window.open(url, '_blank');
  };

  if (orderSuccess) {
    return (
      <div className="max-w-md mx-auto py-12 px-4 text-center">
        {dbError && (
             <div className="mb-6 bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg text-left">
                 <div className="flex items-center gap-2 text-yellow-500 font-bold mb-1">
                    <AlertTriangle size={16} /> Perhatian Admin
                 </div>
                 <p className="text-xs text-yellow-200 mb-2">
                    Pesanan berhasil dibuat dengan mode <strong>Fallback</strong>. Database Anda kehilangan kolom <code>guest_info</code>. Jalankan SQL ini agar fitur Guest berjalan normal:
                 </p>
                 <div className="bg-slate-950 p-2 rounded text-[10px] font-mono text-green-400 overflow-x-auto relative">
                    {GUEST_ORDER_MIGRATION_SQL}
                    <button onClick={copySql} className="absolute right-1 top-1 bg-slate-800 text-white px-2 rounded">Copy</button>
                 </div>
             </div>
        )}
      
        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-2xl">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
            <CheckCircle className="text-white w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Pesanan Berhasil!</h2>
          <p className="text-slate-400 mb-6 text-sm">ID: <span className="font-mono text-slate-300">{orderSuccess}</span></p>
          
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 mb-6">
            <p className="text-sm text-slate-400 mb-1">Total Pembayaran</p>
            <p className="text-2xl font-bold text-primary">{formatRupiah(lastOrderTotal)}</p>
            {(isFreeOrder || pollingStatus) && <p className="text-green-500 text-xs font-bold mt-1">LUNAS / PEMBAYARAN DITERIMA</p>}
          </div>

          {(isFreeOrder || pollingStatus) ? (
              <div className="space-y-4">
                  <div className="text-left bg-slate-900/80 rounded-xl p-4 border border-slate-700/50 mb-4">
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <Download size={14} className="text-primary" /> Produk Siap Diunduh
                      </h3>
                      <div className="space-y-3">
                          {lastOrderItems.map((item, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700/30">
                                  <div className="flex-1 min-w-0">
                                      <p className="text-sm font-bold text-white truncate">{item.name}</p>
                                      <p className="text-[10px] text-slate-500">Akses Selamanya</p>
                                  </div>
                                  <a 
                                      href={item.file_url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="shrink-0 bg-primary/20 hover:bg-primary/30 text-primary text-[10px] font-bold px-3 py-2 rounded-lg border border-primary/30 flex items-center gap-1.5 transition-all"
                                  >
                                      <Download size={12} /> UNDUH
                                  </a>
                              </div>
                          ))}
                      </div>
                  </div>

                  <p className="text-slate-400 text-xs text-center px-4">
                      {pollingStatus ? 'Pembayaran Anda telah kami terima secara otomatis! Pesanan kini siap diproses.' : 'Karena total belanja Anda Rp 0, pesanan Anda telah otomatis selesai dan dapat diakses sekarang.'}
                  </p>
                  
                  <div className="pt-2">
                    <button 
                        onClick={() => navigate('/profile', { state: { activeTab: 'orders' } })}
                        className="w-full bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        Ke Halaman Riwayat Pesanan
                    </button>
                  </div>
              </div>
          ) : (
              <div className="space-y-4">
                <p className="text-slate-300 text-sm mb-4">
                    Silakan selesaikan pembayaran dan kirim konfirmasi ke WhatsApp Admin agar pesanan segera diproses.
                </p>

                {selectedMethod === 'QRIS' && settings.qris_url && (
                    <div className="mb-6 flex flex-col items-center">
                        <div className="p-3 bg-white rounded-lg shadow-md max-w-[250px] overflow-hidden relative">
                             <img 
                                src={settings.qris_url} 
                                alt="QRIS" 
                                className="w-full h-auto object-contain"
                                onError={(e) => (e.target as HTMLImageElement).style.display = 'none'}
                             />
                        </div>
                        <button 
                           onClick={() => openFullImage(settings.qris_url!)}
                           className="text-xs text-primary mt-2 flex items-center gap-1 hover:underline"
                        >
                           <ExternalLink size={12} /> Buka Gambar Full Size
                        </button>
                        <p className="text-xs text-slate-400 mt-2">Scan QRIS di atas untuk membayar</p>
                    </div>
                )}

                {selectedMethod === 'PAKASIR' && pakasirData && !pollingStatus && (
                    <div className="mb-6 flex flex-col items-center">
                        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-700 w-full mb-4">
                            <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-3 text-center flex items-center justify-center gap-2">
                                <ShieldCheck size={14} /> Keamanan Pembayaran
                            </h4>
                            
                            {pakasirData.payment_method === 'qris' ? (
                                <div className="flex flex-col items-center">
                                    <div className="bg-white p-3 rounded-xl mb-3 shadow-xl">
                                        <img 
                                            src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(pakasirData.payment_number)}`} 
                                            alt="Pakasir QRIS" 
                                            className="w-48 h-48"
                                        />
                                    </div>
                                    <div className="text-center space-y-1 mb-4">
                                        <p className="text-[10px] text-slate-400 px-4">Silakan screenshot & scan QR ini di aplikasi e-wallet Anda.</p>
                                        <p className="text-xs font-bold text-white">QRIS ini valid untuk semua metode pembayaran.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center mb-6">
                                    <p className="text-xs text-slate-400 mb-2 uppercase tracking-tighter">Nomor Virtual Account {pakasirData.payment_method.split('_')[0].toUpperCase()}</p>
                                    <div className="flex flex-col items-center justify-center gap-3 bg-slate-800/80 py-4 rounded-xl border border-slate-700">
                                        <p className="text-3xl font-mono font-black text-white tracking-[0.2em]">{pakasirData.payment_number}</p>
                                        <button 
                                            onClick={() => {
                                                navigator.clipboard.writeText(pakasirData.payment_number);
                                                window.alert("Nomor VA disalin!");
                                            }}
                                            className="flex items-center gap-2 bg-primary/20 text-primary hover:bg-primary/30 px-4 py-1.5 rounded-full text-[10px] font-bold transition-all border border-primary/30"
                                        >
                                            <Copy size={12} /> SALIN NOMOR VA
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="bg-slate-800/40 rounded-xl p-3 space-y-2 mb-4 border border-slate-700/50">
                                <div className="flex justify-between items-center text-xs">
                                    <span className="text-slate-400">Total Tagihan:</span>
                                    <span className="text-white font-black text-lg">{formatRupiah(pakasirData.total_payment)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[10px] border-t border-slate-700 pt-2">
                                    <span className="text-slate-500 italic">*Termasuk biaya platform Rp {pakasirData.fee}</span>
                                    <span className="text-red-400 font-medium flex items-center gap-1">
                                        <Clock size={10} /> Exp: {new Date(pakasirData.expired_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-[10px] text-green-400 font-bold bg-green-500/10 py-2 rounded-lg border border-green-500/20 animate-pulse">
                                <Loader2 size={12} className="animate-spin" /> MENUNGGU PEMBAYARAN ANDA...
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-500 text-center px-6">Mohon tidak menutup halaman ini. Sistem akan memperbarui status secara otomatis setelah dana Anda terverifikasi oleh Pakasir.</p>
                    </div>
                )}

                {selectedMethod !== 'PAKASIR' && (
                    <button 
                        onClick={handleConfirmWA}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20"
                    >
                        <Smartphone size={20} /> Konfirmasi via WhatsApp
                    </button>
                )}
                
                <button 
                    onClick={() => navigate('/profile', { state: { activeTab: 'orders' } })}
                    className="text-slate-400 text-sm hover:text-white mt-4"
                >
                    Lihat Riwayat Pesanan
                </button>
              </div>
          )}
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-4">
        <div className="bg-slate-800 p-6 rounded-full mb-4 shadow-xl">
           <ShoppingBag className="w-12 h-12 text-slate-500" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Keranjang Kosong</h2>
        <p className="text-slate-400 mb-6">Belum ada produk yang ditambahkan.</p>
        <button onClick={() => window.location.href = '/'} className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-full font-medium transition-colors">
          Mulai Belanja
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
         <ShoppingBag className="text-primary"/> Keranjang Belanja
      </h1>
      
      <div className="flex flex-col lg:flex-row gap-8">
        {/* LEFT: Cart Items */}
        <div className="flex-1 space-y-4">
          <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
            {cart.map((item) => (
              <div key={item.id} className="p-4 flex gap-4 border-b border-slate-700 last:border-0 hover:bg-slate-750 transition-colors">
                <img src={item.image_url || 'https://via.placeholder.com/80'} className="w-20 h-20 object-cover rounded bg-slate-700" alt={item.name} />
                <div className="flex-1">
                  <h3 className="font-bold text-white line-clamp-2">{item.name}</h3>
                  <p className="text-sm text-slate-400 mb-2">{item.category}</p>
                  <div className="flex justify-between items-end">
                    <p className="text-primary font-bold">{formatRupiah(item.discount_price || item.price)}</p>
                    <button 
                      onClick={() => removeFromCart(item.id)}
                      className="text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-400/10 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Voucher Section */}
          <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
             <h3 className="font-bold text-white mb-3 flex items-center gap-2"><Ticket size={18} className="text-accent"/> Voucher Diskon</h3>
             
             {appliedVoucher ? (
                <div className="flex justify-between items-center bg-green-500/10 border border-green-500/20 p-3 rounded-lg">
                   <div>
                      <span className="font-mono font-bold text-green-500">{appliedVoucher.code}</span>
                      <p className="text-xs text-green-400">Diskon {appliedVoucher.discount_type === 'percentage' ? `${appliedVoucher.discount_value}%` : formatRupiah(Number(appliedVoucher.discount_value))}</p>
                   </div>
                   <button onClick={handleRemoveVoucher} className="text-red-400 hover:text-red-300 p-1">
                      <X size={18} />
                   </button>
                </div>
             ) : (
                <div className="flex gap-2">
                   <input 
                      type="text" 
                      placeholder="Masukkan Kode Voucher"
                      className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 uppercase focus:border-primary outline-none"
                      value={voucherCode}
                      onChange={e => setVoucherCode(e.target.value)}
                   />
                   <button 
                      onClick={handleApplyVoucher}
                      disabled={checkingVoucher || !voucherCode}
                      className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded font-medium disabled:opacity-50"
                   >
                      {checkingVoucher ? <Loader2 size={18} className="animate-spin"/> : 'Pakai'}
                   </button>
                </div>
             )}
          </div>
        </div>

        {/* RIGHT: Payment & Summary */}
        <div className="lg:w-96 space-y-6">
            
            {/* Auto-Register Form for Guest */}
            {!user && (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
                    <h2 className="font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
                        <UserPlus size={18} className="text-primary"/> Data Pembeli
                    </h2>
                    <p className="text-xs text-slate-400 mb-4">Isi data ini untuk pendaftaran akun otomatis.</p>
                    
                    <div className="space-y-3">
                        <div className="relative">
                            <User className="absolute left-3 top-3 text-slate-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="Nama Lengkap" 
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 pl-9 text-sm focus:border-primary outline-none"
                                value={guestName}
                                onChange={e => setGuestName(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Smartphone className="absolute left-3 top-3 text-slate-500" size={16} />
                            <input 
                                type="text" 
                                placeholder="No. WhatsApp" 
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 pl-9 text-sm focus:border-primary outline-none"
                                value={guestPhone}
                                onChange={e => setGuestPhone(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-slate-500" size={16} />
                            <input 
                                type="email" 
                                placeholder="Email" 
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 pl-9 text-sm focus:border-primary outline-none"
                                value={guestEmail}
                                onChange={e => setGuestEmail(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-500" size={16} />
                            <input 
                                type="password" 
                                placeholder="Buat Password" 
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 pl-9 text-sm focus:border-primary outline-none"
                                value={guestPassword}
                                onChange={e => setGuestPassword(e.target.value)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Method Selection */}
            {finalTotal > 0 && (
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h2 className="font-bold text-white mb-4 flex items-center gap-2">Metode Pembayaran</h2>
                    <div className="space-y-2">
                        {isMethodActive('transfer') && (settings.bank_accounts?.length ?? 0) > 0 && (
                            <button 
                                onClick={() => { setSelectedMethod('TRANSFER'); setSelectedProvider(''); }}
                                className={`w-full p-3 rounded-lg flex items-center justify-start gap-3 border transition-all text-left ${selectedMethod === 'TRANSFER' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                            >
                                <CreditCard size={20} className="shrink-0" /> 
                                <span className="text-sm">Transfer Bank Manual (Proses Manual, Free Admin)</span>
                            </button>
                        )}
                        
                        {selectedMethod === 'TRANSFER' && isMethodActive('transfer') && (settings.bank_accounts?.length ?? 0) > 0 && (
                            <div className="pl-4 pr-1 mb-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                {settings.bank_accounts?.map((bank, idx) => (
                                    <label key={idx} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                                        <input 
                                            type="radio" 
                                            name="bank_provider" 
                                            value={bank.bank} 
                                            checked={selectedProvider === bank.bank}
                                            onChange={() => setSelectedProvider(bank.bank)}
                                            className="accent-primary"
                                        />
                                        <span className="text-sm text-slate-300">{bank.bank} - {bank.number}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {isMethodActive('ewallet') && (settings.e_wallets?.length ?? 0) > 0 && (
                            <button 
                                onClick={() => { setSelectedMethod('EWALLET'); setSelectedProvider(''); }}
                                className={`w-full p-3 rounded-lg flex items-center justify-start gap-3 border transition-all text-left ${selectedMethod === 'EWALLET' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                            >
                                <Wallet size={20} className="shrink-0" /> 
                                <span className="text-sm">E-Wallet (Proses Manual, Free Admin)</span>
                            </button>
                        )}

                        {selectedMethod === 'EWALLET' && isMethodActive('ewallet') && (settings.e_wallets?.length ?? 0) > 0 && (
                             <div className="pl-4 pr-1 mb-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                {settings.e_wallets?.map((wallet, idx) => (
                                    <label key={idx} className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-slate-700/50">
                                        <input 
                                            type="radio" 
                                            name="wallet_provider" 
                                            value={wallet.provider} 
                                            checked={selectedProvider === wallet.provider}
                                            onChange={() => setSelectedProvider(wallet.provider)}
                                            className="accent-primary"
                                        />
                                        <span className="text-sm text-slate-300">{wallet.provider} - {wallet.number}</span>
                                    </label>
                                ))}
                             </div>
                        )}

                        {isMethodActive('qris') && settings.qris_url && (
                            <button 
                                onClick={() => setSelectedMethod('QRIS')}
                                className={`w-full p-3 rounded-lg flex items-center justify-start gap-3 border transition-all text-left ${selectedMethod === 'QRIS' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                            >
                                <QrCode size={20} className="shrink-0" /> 
                                <span className="text-sm">QRIS Manual (Proses Manual, Free Admin)</span>
                            </button>
                        )}

                        {isMethodActive('pakasir') && !hasAppPremium && (
                            <div className="pt-2 border-t border-slate-700 mt-2 opacity-80">
                                <p className="text-[10px] font-bold text-slate-500 mb-2 uppercase tracking-tight text-center">Pembayaran Otomatis (Pakasir)</p>
                                
                                <div className="grid grid-cols-1 gap-2">
                                <button 
                                    onClick={() => { setSelectedMethod('PAKASIR'); setSelectedProvider('qris'); }}
                                    className={`w-full p-3 rounded-lg flex items-center justify-start gap-3 border transition-all text-left ${selectedMethod === 'PAKASIR' && selectedProvider === 'qris' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                                >
                                    <Smartphone size={20} className="shrink-0 text-primary" /> 
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold">QRIS Otomatis</p>
                                            <span className="text-[8px] bg-primary/20 px-1 rounded text-primary">INSTANT</span>
                                        </div>
                                        <p className="text-[10px] opacity-70">Semua E-Wallet & M-Banking</p>
                                    </div>
                                </button>

                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => { setSelectedMethod('PAKASIR'); setSelectedProvider('bri_va'); }}
                                        className={`p-3 rounded-lg flex flex-col items-center justify-center gap-1 border transition-all text-center ${selectedMethod === 'PAKASIR' && selectedProvider === 'bri_va' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                                    >
                                        <CreditCard size={18} className="text-blue-400" />
                                        <p className="text-[10px] font-bold">BRI VA</p>
                                    </button>

                                    <button 
                                        onClick={() => { setSelectedMethod('PAKASIR'); setSelectedProvider('bni_va'); }}
                                        className={`p-3 rounded-lg flex flex-col items-center justify-center gap-1 border transition-all text-center ${selectedMethod === 'PAKASIR' && selectedProvider === 'bni_va' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                                    >
                                        <CreditCard size={18} className="text-orange-400" />
                                        <p className="text-[10px] font-bold">BNI VA</p>
                                    </button>

                                    <button 
                                        onClick={() => { setSelectedMethod('PAKASIR'); setSelectedProvider('permata_va'); }}
                                        className={`p-3 rounded-lg flex flex-col items-center justify-center gap-1 border transition-all text-center ${selectedMethod === 'PAKASIR' && selectedProvider === 'permata_va' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                                    >
                                        <CreditCard size={18} className="text-purple-400" />
                                        <p className="text-[10px] font-bold">Permata VA</p>
                                    </button>

                                    <button 
                                        onClick={() => { setSelectedMethod('PAKASIR'); setSelectedProvider('cimb_niaga_va'); }}
                                        className={`p-3 rounded-lg flex flex-col items-center justify-center gap-1 border transition-all text-center ${selectedMethod === 'PAKASIR' && selectedProvider === 'cimb_niaga_va' ? 'bg-primary/10 border-primary text-primary' : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'}`}
                                    >
                                        <CreditCard size={18} className="text-red-400" />
                                        <p className="text-[10px] font-bold">CIMB VA</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        )}

            <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 sticky top-24">
                <h2 className="font-bold text-white mb-4">Ringkasan Belanja</h2>
                <div className="space-y-2 text-sm text-slate-400 mb-4 border-b border-slate-700 pb-4">
                    <div className="flex justify-between">
                        <span>Total Harga ({cart.length} item)</span>
                        <span>{formatRupiah(rawSubtotal)}</span>
                    </div>
                    {appliedVoucher && (
                        <div className="flex justify-between text-green-400">
                            <span>Diskon Voucher</span>
                            <span>- {formatRupiah(discountAmount)}</span>
                        </div>
                    )}
                </div>
                
                <div className="flex justify-between items-end mb-6">
                    <span className="font-bold text-white">Total Bayar</span>
                    <span className="text-2xl font-bold text-primary">{formatRupiah(finalTotal)}</span>
                </div>

                <button 
                    onClick={handleCheckout}
                    disabled={processing}
                    className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-primary/25 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {processing ? (
                        <>
                           <Loader2 size={20} className="animate-spin" /> Memproses...
                        </>
                    ) : (
                        <>
                           <CheckCircle size={20} /> 
                           {finalTotal <= 0 ? 'Proses Pesanan Gratis' : 'Bayar Sekarang'}
                        </>
                    )}
                </button>
            </div>
        </div>
      </div>

      {/* Payment Warning Modal */}
      {showPaymentWarning && (
        <div id="payment-warning-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center transform scale-95 scale-in animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-amber-500/25">
              <AlertTriangle size={32} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Pemberitahuan</h3>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              Pilih Metode Pembayaran Dulu Ya Kak!
            </p>
            <button
              id="confirm-payment-warning"
              onClick={() => setShowPaymentWarning(false)}
              className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 text-sm"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
