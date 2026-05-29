
import React, { useEffect, useState } from 'react';
import { getSupabase, FIX_AFFILIATE_AND_QRIS_SQL, HISTORY_MIGRATION_SQL } from '../../services/supabase';
import { Order, OrderItem } from '../../types';
import { formatRupiah, formatProductName } from '../../services/helpers';
import { ClipboardList, Filter, ChevronDown, CheckCircle, XCircle, Clock, Loader2, DollarSign, AlertTriangle } from 'lucide-react';

const AdminOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [showSql, setShowSql] = useState(false);
  const [activeSql, setActiveSql] = useState('');

  const supabase = getSupabase();

  const fetchOrders = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, profiles(full_name, email)')
      .order('created_at', { ascending: false });

    if (data) {
        setOrders(data as Order[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // PROSES KOMISI DIPISAH (ASYNC & NON-BLOCKING)
  const processCommissionInternal = async (order: Order, quiet = true) => {
    if (!supabase) return;
    if (order.commission_paid && quiet) return;
    
    try {
        let affiliateCode = order.affiliate_code || null;
        let buyerName = 'Pembeli';
        let buyerUserId = order.user_id;

        // Ambil info pembeli dari profiles jika ada
        if (buyerUserId) {
            const { data: userProfile } = await supabase
                .from('profiles')
                .select('full_name, referred_by')
                .eq('id', buyerUserId)
                .single();
                
            if (userProfile) {
                buyerName = userProfile.full_name || 'Pembeli';
                if (!affiliateCode) {
                    affiliateCode = userProfile.referred_by || null;
                }
            }
        }

        // Kalau masih kosong, cek guest_info
        if (buyerName === 'Pembeli' && order.guest_info) {
            const gInfo = typeof order.guest_info === 'string' ? JSON.parse(order.guest_info) : order.guest_info;
            if (gInfo && gInfo.name) {
                buyerName = gInfo.name;
            } else if (order.buyer_email) {
                buyerName = order.buyer_email;
            }
        } else if (buyerName === 'Pembeli' && order.buyer_email) {
            buyerName = order.buyer_email;
        }

        if (!affiliateCode) {
            console.log("No referral code associated with this order");
            return;
        }

        const { data: affiliate, error: affError } = await supabase
            .from('profiles')
            .select('id, affiliate_code')
            .ilike('affiliate_code', affiliateCode.trim()) // Case-insensitive lookup
            .single();
        
        if (affError || !affiliate) {
            if (!quiet) alert("Affiliate dengan kode '" + affiliateCode + "' tidak ditemukan di database. Pastikan kode benar.");
            return;
        }

        // KEAMANAN: Memastikan komisi TIDAK masuk ke pembeli itu sendiri (Self-Referral Prevention)
        if (buyerUserId && affiliate.id === buyerUserId) {
            console.log("Self-referral detected. Commission skipped.");
            await supabase.from('orders').update({ commission_paid: true }).eq('id', order.id);
            return;
        }

        const { data: settings } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'store_settings')
            .single();
        
        const rate = Number(settings?.value?.affiliate_commission_rate) || 0;
        if (rate <= 0) {
            if (!quiet) alert("Rate komisi di pengaturan adalah 0%. Silakan ubah di menu Pengaturan.");
            return;
        }

        let totalSellPrice = 0;
        let totalCostPrice = 0;
        let productNames: string[] = [];

        const items = order.items || [];
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;

        if (Array.isArray(parsedItems)) {
            parsedItems.forEach((item: any) => {
                 const price = Number(item.price) || 0;
                 // Jika cost_price kosong/null, anggap 0 agar profit tetap ada
                 const cost = Number(item.cost_price === null || item.cost_price === undefined ? 0 : item.cost_price);
                 const qty = Number(item.quantity) || 1;
                 
                 totalSellPrice += (price * qty);
                 totalCostPrice += (cost * qty);
                 productNames.push(`${item.product_name || 'Produk'}`);
            });
        }

        const discount = Number(order.discount_amount) || 0;
        // Rumus: (Harga Jual - Harga Modal) - Diskon Voucher
        const netProfit = (totalSellPrice - totalCostPrice) - discount;
        
        // Proteksi: Jika profit <=0, tetap beri komisi minimal dari harga jual (opsional) 
        // atau biarkan 0 jika Anda ingin komisi hanya dari profit bersih. 
        // Di sini saya pastikan komisi hanya jika netProfit > 0.
        const commission = netProfit > 0 ? Math.floor(netProfit * (rate / 100)) : 0;

        if (commission > 0) {
            // 1. Cek duplikasi
            const { data: existingLog } = await supabase
                .from('commission_history')
                .select('id')
                .eq('order_id', order.id)
                .single();
            
            if (existingLog && quiet) {
                await supabase.from('orders').update({ commission_paid: true }).eq('id', order.id);
                return;
            }

            // 2. Tambah Saldo
            const { error: rpcError } = await supabase.rpc('increment_balance', { 
                user_id: affiliate.id, 
                amount: commission 
            });

            if (rpcError) throw rpcError;

            // 3. Catat Riwayat
            await supabase.from('commission_history').insert({
                affiliate_id: affiliate.id,
                order_id: order.id,
                amount: commission,
                source_buyer: buyerName,
                products: productNames.join(', ')
            });

            // 4. Tandai Selesai
            await supabase.from('orders').update({ commission_paid: true }).eq('id', order.id);
            
            if (!quiet) alert("SUKSES! Komisi sebesar " + formatRupiah(commission) + " telah ditambahkan ke saldo affiliate.");
        } else {
            // Jika profit 0 atau minus, tandai tetap lunas tapi saldo tidak bertambah
            await supabase.from('orders').update({ commission_paid: true }).eq('id', order.id);
            if (!quiet) alert("Komisi Rp 0 karena Profit Bersih <= 0. (Jual: " + totalSellPrice + ", Modal: " + totalCostPrice + ", Diskon: " + discount + ")");
        }
    } catch (err: any) {
        console.error("Komisi Error:", err);
        if (!quiet) alert("Gagal proses komisi: " + err.message);
    }
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
     if (!supabase) return;
     setUpdatingId(orderId);
     
     // 1. UPDATE STATUS TERLEBIH DAHULU (PRIORITAS UTAMA)
     const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select('*, profiles(full_name)')
        .single();
     
     if (error) {
        alert("Gagal update status: " + error.message);
        setUpdatingId(null);
        return;
     }

     // 2. JIKA BERHASIL, UPDATE UI SEGERA
     setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus as any } : o));
     setUpdatingId(null);

     // 3. JALANKAN KOMISI DI BACKGROUND (TIDAK DITUNGGU / NON-BLOCKING)
     if (newStatus === 'completed' && data) {
        processCommissionInternal(data as Order);
     }
  };

  const filteredOrders = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  return (
    <div className="py-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ClipboardList className="text-primary" /> Manajemen Pesanan
        </h1>
        
        <div className="flex items-center gap-2 bg-slate-800 p-1 rounded-lg border border-slate-700">
           <div className="flex items-center text-xs text-slate-500 mr-4 ml-2">
              <AlertTriangle size={14} className="mr-1" /> Komisi diproses saat pesanan 'Selesai'
           </div>
           <Filter size={16} className="text-slate-400 ml-2" />
           <select 
             className="bg-transparent text-sm p-2 outline-none text-slate-200"
             value={filter}
             onChange={(e) => setFilter(e.target.value)}
           >
              <option value="all">Semua Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Proses</option>
              <option value="completed">Selesai</option>
              <option value="cancelled">Cancel</option>
           </select>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-4">ID / Tanggal</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Produk</th>
                <th className="p-4">Total</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Loading...</td></tr>
              ) : filteredOrders.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500">Tidak ada pesanan.</td></tr>
              ) : (
                filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-750">
                        <td className="p-4 align-top">
                           <span className="font-mono text-xs bg-slate-900 px-2 py-1 rounded text-slate-300">#{order.id.slice(0,8)}</span>
                           <div className="text-xs text-slate-500 mt-1">{new Date(order.created_at).toLocaleDateString()}</div>
                        </td>
                        <td className="p-4 align-top">
                           <div className="font-medium text-white">{order.profiles?.full_name || 'Buyer'}</div>
                           <div className="text-xs text-slate-500">{order.buyer_email || order.profiles?.email || 'N/A'}</div>
                           {order.affiliate_code && (
                             <div className="inline-flex items-center text-[10px] mt-1 text-sky-400 bg-sky-500/10 px-1.5 py-0.5 rounded font-mono">
                               Affiliate: {order.affiliate_code}
                             </div>
                           )}
                        </td>
                        <td className="p-4 align-top">
                           {order.items && order.items.length > 0 ? (
                              <ul className="text-sm text-slate-300 space-y-1">
                                  {order.items.map((item, idx) => (
                                      <li key={idx} className="flex gap-1 items-start">
                                          <span className="text-slate-500 whitespace-nowrap">{item.quantity || 1}x</span>
                                          <span className="text-slate-300">{formatProductName(item.product_name)}</span>
                                      </li>
                                  ))}
                              </ul>
                           ) : (
                              <span className="text-sm text-slate-300">{order.product_name || 'N/A'}</span>
                           )}
                        </td>
                        <td className="p-4 align-top font-bold text-slate-200">
                           {formatRupiah(order.total_amount)}
                        </td>
                        <td className="p-4 align-top">
                           <div className="flex flex-col items-center gap-2">
                             <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                 order.status === 'completed' ? 'text-green-500 bg-green-500/10' : 
                                 order.status === 'processing' ? 'text-blue-500 bg-blue-500/10' : 
                                 order.status === 'cancelled' ? 'text-red-500 bg-red-500/10' : 
                                 'text-yellow-500 bg-yellow-500/10'
                             }`}>
                                {order.status}
                             </span>
                             {order.status === 'completed' && (
                                <button 
                                  onClick={() => processCommissionInternal(order, false)}
                                  className={`text-[9px] flex items-center gap-1 font-bold uppercase tracking-tighter ${order.commission_paid ? 'text-slate-600' : 'text-primary hover:underline'}`}
                                  title={order.commission_paid ? "Sudah dibayar" : "Klik untuk paksa proses komisi"}
                                >
                                   {order.commission_paid ? <CheckCircle size={10} /> : <DollarSign size={10} />}
                                   {order.commission_paid ? 'Paid' : 'Process Commission'}
                                </button>
                             )}
                           </div>
                        </td>
                        <td className="p-4 align-top">
                            <div className="relative">
                                {updatingId === order.id ? (
                                    <Loader2 size={16} className="animate-spin text-primary" />
                                ) : (
                                    <select 
                                        className="bg-slate-900 border border-slate-600 text-xs rounded p-1 outline-none focus:border-primary w-full"
                                        value={order.status}
                                        onChange={(e) => updateStatus(order.id, e.target.value)}
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="processing">Proses</option>
                                        <option value="completed">Selesai</option>
                                        <option value="cancelled">Cancel</option>
                                    </select>
                                )}
                            </div>
                        </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminOrders;
