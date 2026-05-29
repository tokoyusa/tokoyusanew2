
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getSupabase, VOUCHER_MIGRATION_SQL } from '../../services/supabase';
import { Voucher, Product } from '../../types';
import { formatRupiah } from '../../services/helpers';
import { Ticket, Plus, Trash2, X, Terminal, AlertTriangle, Save, Package } from 'lucide-react';

const AdminVouchers: React.FC = () => {
  const location = useLocation();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [tableError, setTableError] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage' as 'percentage' | 'nominal',
    discount_value: 0,
    product_id: ''
  });

  const supabase = getSupabase();

  const fetchVouchers = async () => {
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
    
    // Fetch products for reference
    const { data: productsData } = await supabase.from('products').select('id, name');
    if (productsData) setProducts(productsData as Product[]);
    
    if (error) {
       // Detect both missing table AND schema cache errors
       if (
         error.message.includes('relation "public.vouchers" does not exist') || 
         error.message.includes('Could not find the table') ||
         error.message.includes('schema cache')
       ) {
          setTableError(true);
       }
    } else if (data) {
       setVouchers(data as Voucher[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVouchers();
    
    // Check if we have a preset product from navigation
    const state = location.state as { presetProductId?: string };
    if (state?.presetProductId) {
       setFormData(prev => ({ ...prev, product_id: state.presetProductId }));
       setIsModalOpen(true);
    }
  }, [location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;

    try {
      const payload = {
         code: formData.code.toUpperCase().replace(/\s/g, ''),
         discount_type: formData.discount_type,
         discount_value: formData.discount_value,
         product_id: formData.product_id || null,
         is_active: true
      };

      const { error } = await supabase.from('vouchers').insert(payload);
      
      if (error) throw error;
      
      setIsModalOpen(false);
      setFormData({ code: '', discount_type: 'percentage', discount_value: 0, product_id: '' });
      fetchVouchers();
      showToast("Voucher berhasil disimpan!", "success");
    } catch (error: any) {
      if (
         error.message.includes('relation "public.vouchers" does not exist') || 
         error.message.includes('Could not find the table') ||
         error.message.includes('schema cache')
      ) {
          setTableError(true);
          setIsModalOpen(false);
          showToast("Gagal menyimpan: Tabel database belum siap.", "error");
      } else {
          showToast("Gagal menyimpan voucher: " + error.message, "error");
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    setLoading(true);
    try {
      // Perform deletion directly on client (vouchers are independent, no foreign key cascade needed)
      const { error: deleteError } = await supabase
        .from('vouchers')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Success
      await fetchVouchers();
      showToast("Voucher berhasil dihapus.", "success");
    } catch (err: any) {
      console.error("Gagal menghapus voucher:", err);
      showToast("Gagal menghapus voucher: " + (err.message || "Pastikan Anda adalah Admin dan RLS policy di-enable"), "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    if (!supabase) return;
    await supabase.from('vouchers').update({ is_active: !currentStatus }).eq('id', id);
    fetchVouchers();
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} /> Buat Voucher
        </button>
      </div>

      {tableError && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg mb-6 animate-pulse">
           <div className="flex items-center gap-2 text-yellow-500 font-bold mb-2">
              <AlertTriangle size={20} /> Tabel Voucher Belum Dibuat
           </div>
           <p className="text-sm text-yellow-200 mb-2">
              Database belum memiliki tabel voucher. Silakan copy & jalankan kode di bawah ini di Supabase SQL Editor.
           </p>
           <div className="flex gap-2">
             <button 
               onClick={() => setShowSql(!showSql)} 
               className="text-xs bg-yellow-600 hover:bg-yellow-500 text-white px-3 py-1 rounded"
             >
               {showSql ? 'Sembunyikan SQL' : 'Lihat SQL'}
             </button>
             <button 
               onClick={() => window.location.reload()} 
               className="text-xs bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded"
             >
               Sudah Dijalankan? Refresh App
             </button>
           </div>
           
           {showSql && (
             <div className="bg-slate-950 p-3 mt-2 rounded font-mono text-xs text-green-400 relative overflow-x-auto">
               <pre>{VOUCHER_MIGRATION_SQL}</pre>
               <button 
                  onClick={() => { navigator.clipboard.writeText(VOUCHER_MIGRATION_SQL); alert("Copied!"); }}
                  className="absolute top-2 right-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px]"
               >Copy</button>
             </div>
           )}
        </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
            <tr>
              <th className="p-4">Kode Voucher</th>
              <th className="p-4">Berlaku Untuk</th>
              <th className="p-4">Diskon</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading...</td></tr>
            ) : vouchers.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Belum ada voucher.</td></tr>
            ) : (
                vouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-750">
                    <td className="p-4">
                      <span className="font-mono bg-slate-900 border border-slate-700 px-2 py-1 rounded text-primary font-bold">
                        {v.code}
                      </span>
                    </td>
                    <td className="p-4">
                      {v.product_id ? (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-400">
                          <Package size={12} />
                          <span className="max-w-[150px] truncate">
                            {products.find(p => p.id === v.product_id)?.name || 'Produk Spesifik'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] bg-slate-700 px-2 py-0.5 rounded text-slate-300 uppercase font-bold">Semua Produk</span>
                      )}
                    </td>
                    <td className="p-4 font-medium text-white">
                      {v.discount_type === 'percentage' ? `${v.discount_value}%` : formatRupiah(v.discount_value)}
                    </td>
                    <td className="p-4">
                      <button 
                         onClick={() => toggleStatus(v.id, v.is_active)}
                         className={`px-2 py-1 rounded text-xs font-bold uppercase ${v.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}
                      >
                         {v.is_active ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="p-4 text-right">
                      <button onClick={() => setDeleteId(v.id)} className="p-2 text-red-400 hover:bg-slate-700 rounded"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700">
             <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                <h2 className="text-xl font-bold">Buat Voucher Baru</h2>
                <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400" /></button>
             </div>
             
             <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                   <label className="block text-sm font-medium mb-1">Kode Voucher</label>
                   <input 
                      type="text" 
                      required 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 font-mono uppercase focus:border-primary outline-none" 
                      placeholder="CONTOH: MERDEKA45"
                      value={formData.code}
                      onChange={e => setFormData({...formData, code: e.target.value})}
                   />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2">
                       <label className="block text-sm font-medium mb-1">Berlaku Untuk</label>
                       <select 
                          className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                          value={formData.product_id}
                          onChange={e => setFormData({...formData, product_id: e.target.value})}
                       >
                          <option value="">Semua Produk</option>
                          <optgroup label="Pilih Produk Spesifik">
                            {products.map(p => (
                               <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </optgroup>
                       </select>
                    </div>

                   <div>
                      <label className="block text-sm font-medium mb-1">Tipe Diskon</label>
                      <select 
                         className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                         value={formData.discount_type}
                         onChange={e => setFormData({...formData, discount_type: e.target.value as any})}
                      >
                         <option value="percentage">Persentase (%)</option>
                         <option value="nominal">Nominal (Rp)</option>
                      </select>
                   </div>
                   <div>
                      <label className="block text-sm font-medium mb-1">Nilai</label>
                      <input 
                         type="number" 
                         required 
                         min="1"
                         className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:border-primary outline-none"
                         value={formData.discount_value}
                         onChange={e => setFormData({...formData, discount_value: parseInt(e.target.value)})}
                      />
                   </div>
                </div>

                <div className="bg-blue-500/10 p-3 rounded text-xs text-blue-200">
                   {formData.discount_type === 'percentage' 
                      ? `User akan mendapat diskon ${formData.discount_value}% dari total belanja.`
                      : `User akan mendapat potongan harga ${formatRupiah(formData.discount_value)}.`
                   }
                </div>
                
                <button 
                  type="submit" 
                  className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-2 rounded mt-2 flex items-center justify-center gap-2"
                >
                  <Save size={18} /> Simpan Voucher
                </button>
             </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-800 rounded-xl max-w-sm w-full p-6 border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Hapus Voucher</h3>
            <p className="text-slate-400 text-sm mb-6">Apakah Anda yakin ingin menghapus kode voucher ini? Semua transaksi lama terkait kode ini tetap aman di database.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-all text-white font-medium"
              >
                Batal
              </button>
              <button 
                onClick={() => {
                  const id = deleteId;
                  setDeleteId(null);
                  handleDelete(id);
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition-all shadow-lg shadow-red-600/20 font-bold"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 bg-slate-900 border border-slate-700 text-white px-4 py-3 rounded-xl shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className={`w-2 h-2 rounded-full ${toast.type === 'success' ? 'bg-green-500 font-bold' : toast.type === 'error' ? 'bg-red-500 font-bold' : 'bg-yellow-500'}`} />
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}
    </div>
  );
};

export default AdminVouchers;
