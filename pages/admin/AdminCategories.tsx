
import React, { useEffect, useState } from 'react';
import { getSupabase, CATEGORY_MIGRATION_SQL } from '../../services/supabase';
import { Category } from '../../types';
import { Layers, Plus, Trash2, X, AlertTriangle, Save, Edit3, Loader2 } from 'lucide-react';

const AdminCategories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [tableError, setTableError] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const [formData, setFormData] = useState({
    name: '',
    slug: ''
  });

  const supabase = getSupabase();

  const fetchCategories = async () => {
    if (!supabase) {
      console.warn('Supabase client not initialized');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const { data, error } = await supabase.from('categories').select('*').order('created_at', { ascending: false });
      
      if (error) {
        console.error('Fetch categories error:', error);
        if (
          error.message.includes('relation "public.categories" does not exist') || 
          error.message.includes('Could not find the table') ||
          error.message.includes('schema cache')
        ) {
            setTableError(true);
        } else {
            // alert("Error fetching categories: " + error.message);
        }
      } else if (data) {
        setCategories(data as Category[]);
        setTableError(false);
      }
    } catch (err) {
      console.error('Critical fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleNameChange = (name: string) => {
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setFormData({ name, slug });
  };

  const openEdit = (category: Category) => {
    setEditId(category.id);
    setFormData({ name: category.name, slug: category.slug });
    setIsModalOpen(true);
  };

  const openCreate = () => {
    setEditId(null);
    setFormData({ name: '', slug: '' });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Always get a fresh instance to be sure
    const currentSupabase = getSupabase();
    
    if (!currentSupabase) {
      showToast("Aplikasi belum terhubung ke Supabase. Silakan setup di halaman Settings/Database.", "error");
      return;
    }
    
    if (submitting) return;

    const name = formData.name.trim();
    if (!name) {
      showToast("Nama kategori harus diisi", "error");
      return;
    }

    setSubmitting(true);
    console.log('AdminCategories: Starting submission...', { editId, name });
    
    try {
      // Ensure slug is clean
      const finalSlug = (formData.slug || name).toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

      if (!finalSlug) {
        showToast("Slug tidak valid. Gunakan karakter alfanumerik.", "error");
        setSubmitting(false);
        return;
      }

      const payload = {
         name: name,
         slug: finalSlug,
         is_active: true
      };

      console.log('AdminCategories: Payload:', payload);

      let result;
      if (editId) {
        result = await currentSupabase.from('categories').update(payload).eq('id', editId);
      } else {
        // Use array for insert to be more standard
        result = await currentSupabase.from('categories').insert([payload]).select();
      }
      
      console.log('AdminCategories: Result:', result);

      if (result.error) {
        // Log the full error to help identify if it's RLS or something else
        console.error('Supabase Error Details:', {
          code: result.error.code,
          message: result.error.message,
          details: result.error.details,
          hint: result.error.hint
        });
        throw result.error;
      }
      
      console.log('AdminCategories: Success!');
      
      // Clear form and state
      setFormData({ name: '', slug: '' });
      setEditId(null);
      setIsModalOpen(false);
      
      // Refresh list
      await fetchCategories();
      
      showToast(editId ? "Berhasil diperbarui!" : "Berhasil ditambah!", "success");
      
    } catch (error: any) {
      console.error('AdminCategories: Error:', error);
      
      let errorMsg = error.message || "Terjadi kesalahan tidak diketahui";
      
      if (errorMsg.includes('new row violates row-level security policy')) {
        errorMsg = "Akses Ditolak (RLS): Database menolak akses. Pastikan Anda sudah menjalankan SQL terbaru (Update #2) di Dashboard Supabase.";
      } else if (errorMsg.includes('duplicate key value')) {
        errorMsg = "Gagal: Nama atau Slug ini sudah digunakan.";
      } else if (errorMsg.includes('relation "public.categories" does not exist')) {
        errorMsg = "Tabel 'categories' belum ada. Silakan jalankan SQL di bawah.";
        setTableError(true);
      }
      
      showToast("Gagal: " + errorMsg, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 1. Set matching products' category_id to NULL first to prevent foreign key errors
      const { error: updateError } = await supabase
        .from('products')
        .update({ category_id: null })
        .eq('category_id', id);

      if (updateError) {
        console.warn('Gagal mengosongkan category_id pada produk:', updateError);
      }

      // 2. Perform deletion directly on client (uses logged-in Admin session)
      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Success
      await fetchCategories();
      showToast("Kategori berhasil didelete.", "success");
    } catch (err: any) {
      console.error("Gagal menghapus kategori:", err);
      showToast("Gagal: " + (err.message || "Pastikan Anda adalah Admin dan RLS policy di-enable"), "error");
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: boolean) => {
    if (!supabase) return;
    await supabase.from('categories').update({ is_active: !currentStatus }).eq('id', id);
    fetchCategories();
  };

  return (
    <div className="font-sans">
      <div className="flex justify-end mb-4">
        <button 
          onClick={openCreate}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
        >
          <Plus size={20} /> Tambah Kategori
        </button>
      </div>

      {tableError && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-lg mb-6">
           <div className="flex items-center gap-2 text-yellow-500 font-bold mb-2">
              <AlertTriangle size={20} /> Tabel Kategori Belum Dibuat
           </div>
           <p className="text-sm text-yellow-200 mb-2">
              Database belum memiliki tabel kategori. Silakan jalankan kode SQL ini di Dashboard Supabase.
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
               Sudah Dijalankan? Refresh
             </button>
           </div>
           
           {showSql && (
             <div className="bg-slate-950 p-3 mt-2 rounded font-mono text-[10px] text-green-400 relative overflow-x-auto border border-slate-800">
               <pre>{CATEGORY_MIGRATION_SQL}</pre>
               <button 
                  onClick={() => { navigator.clipboard.writeText(CATEGORY_MIGRATION_SQL); alert("Copied!"); }}
                  className="absolute top-2 right-2 bg-slate-800 text-white px-2 py-1 rounded text-[10px]"
               >Copy</button>
             </div>
           )}
        </div>
      )}

      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden backdrop-blur-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-900/50 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
            <tr>
              <th className="p-4">Nama Kategori</th>
              <th className="p-4">Slug</th>
              <th className="p-4">Status</th>
              <th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {loading ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500 text-sm">Loading data...</td></tr>
            ) : categories.length === 0 ? (
                <tr><td colSpan={4} className="p-8 text-center text-slate-500 text-sm">Belum ada kategori.</td></tr>
            ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-700/50 transition-colors">
                    <td className="p-4">
                      <span className="font-bold text-white text-sm">
                        {cat.name}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-slate-400">
                      {cat.slug}
                    </td>
                    <td className="p-4">
                      <button 
                         onClick={() => toggleStatus(cat.id, cat.is_active)}
                         className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${cat.is_active ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}
                      >
                         {cat.is_active ? 'Aktif' : 'Nonaktif'}
                      </button>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button onClick={() => openEdit(cat)} className="p-2 text-indigo-400 hover:bg-slate-700 rounded transition-colors"><Edit3 size={16} /></button>
                      <button onClick={() => setDeleteId(cat.id)} className="p-2 text-red-400 hover:bg-slate-700 rounded transition-colors"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="bg-slate-800 rounded-xl max-w-md w-full p-6 border border-slate-700 shadow-2xl">
             <div className="flex justify-between items-center mb-6 border-b border-slate-700 pb-3">
                <h2 className="text-xl font-bold text-white">{editId ? 'Edit Kategori' : 'Tambah Kategori Baru'}</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-white transition-colors"><X /></button>
             </div>
             
             <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Nama Kategori</label>
                   <input 
                      type="text" 
                      required 
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600" 
                      placeholder="Contoh: Digital Assets"
                      value={formData.name}
                      onChange={e => handleNameChange(e.target.value)}
                   />
                </div>

                <div>
                   <label className="block text-xs font-bold text-slate-400 uppercase mb-2">URL Slug (Auto)</label>
                   <input 
                      type="text" 
                      required 
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-lg p-3 text-slate-400 font-mono text-sm focus:border-indigo-500 outline-none transition-all" 
                      placeholder="digital-assets"
                      value={formData.slug}
                      onChange={e => setFormData({...formData, slug: e.target.value})}
                   />
                </div>
                
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg mt-2 flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
                >
                  {submitting ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  {editId ? 'Update Kategori' : 'Simpan Kategori'}
                </button>
             </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-800 rounded-xl max-w-sm w-full p-6 border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Hapus Kategori</h3>
            <p className="text-slate-400 text-sm mb-6">Apakah Anda yakin ingin menghapus kategori ini? Semua produk yang menggunakan kategori ini akan dikosongkan kategorinya.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-all"
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

export default AdminCategories;
