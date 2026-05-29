
import React, { useEffect, useState } from 'react';
import { getSupabase, COST_PRICE_MIGRATION_SQL, SOURCE_CODE_MIGRATION_SQL } from '../../services/supabase';
import { Product, Category } from '../../types';
import { Plus, Edit, Trash2, X, Upload, Loader2, Image as ImageIcon, AlertCircle, Terminal, AlertTriangle, Layers, Ticket } from 'lucide-react';
import { formatRupiah } from '../../services/helpers';
import { useNavigate } from 'react-router-dom';

const AdminProducts: React.FC = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  
  // Database Schema Error State
  const [dbError, setDbError] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    discount_price: 0,
    cost_price: 0, 
    category: '',
    category_id: '',
    image_url: '',
    file_url: '',
    framework: '',
    database_tech: '',
    cms_deployment: '',
    demo_url: '',
    support_duration: ''
  });

  // Source Code Options
  const FRAMEWORKS = ['React', 'Vue', 'Angular', 'Node.js', 'Next.js', 'Laravel', 'Django', 'Flask', 'Express', 'Spring Boot', 'ASP.NET', 'Ruby on Rails', 'Flutter', 'React Native', 'Svelte', 'Lainnya'];
  const DATABASES = ['Supabase', 'Firebase', 'MongoDB', 'MySQL', 'PostgreSQL', 'SQLite', 'Redis', 'Oracle DB', 'MariaDB', 'MS SQL Server', 'Lainnya'];
  const DEPLOYMENTS = ['Wordpress', 'Vercel', 'Netlify', 'Blogspot', 'Google Apps Script', 'Heroku', 'AWS', 'Docker', 'DigitalOcean', 'GitHub Pages', 'Firebase Hosting', 'Lainnya'];

  const supabase = getSupabase();

  const fetchProducts = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      
      if (error) {
         console.error("Fetch Error:", error);
         // Check if error relates to missing column
         if (error.message.includes('cost_price') || error.message.includes('framework')) {
            setDbError(true);
         }
      } else if (data) {
         setProducts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    if (!supabase) return;
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data as Category[]);
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
        showToast("Koneksi Database (Supabase) belum terkonfigurasi!", "error");
        return;
    }

    // Payload construction
    const payload = {
       name: formData.name,
       description: formData.description,
       price: Number(formData.price), // Ensure number
       discount_price: formData.discount_price ? Number(formData.discount_price) : null,
       cost_price: Number(formData.cost_price), // Ensure number
       category: formData.category,
       category_id: (formData.category_id && formData.category_id !== 'custom') ? formData.category_id : null,
       image_url: formData.image_url,
       file_url: formData.file_url,
       is_active: true,
       framework: formData.framework || null,
       database_tech: formData.database_tech || null,
       cms_deployment: formData.cms_deployment || null,
       demo_url: formData.demo_url || null,
       support_duration: formData.support_duration || null
    };

    try {
      let error;
      if (editingId) {
        const res = await supabase.from('products').update(payload).eq('id', editingId);
        error = res.error;
      } else {
        const res = await supabase.from('products').insert(payload);
        error = res.error;
      }

      if (error) throw error;
      
      setIsModalOpen(false);
      resetForm();
      fetchProducts();
      showToast(editingId ? "Produk berhasil diperbarui!" : "Produk berhasil ditambahkan!", "success");
    } catch (error: any) {
      console.error("Submit Error:", error);
      const msg = error.message.toLowerCase();
      if (msg.includes('cost_price') || msg.includes('framework') || msg.includes('column') || msg.includes('database_tech')) {
          setDbError(true);
          setIsModalOpen(false);
          showToast("GAGAL MENYIMPAN: Struktur database belum lengkap. Silakan jalankan sql editor di atas.", "error");
      } else {
          showToast("Gagal menyimpan produk: " + error.message, "error");
      }
    }
  };

  const handleEdit = (p: Product) => {
    setFormData({
      name: p.name,
      description: p.description || '',
      price: p.price,
      discount_price: p.discount_price || 0,
      cost_price: p.cost_price || 0,
      category: p.category || '',
      category_id: p.category_id || '',
      image_url: p.image_url || '',
      file_url: p.file_url || '',
      framework: p.framework || '',
      database_tech: p.database_tech || '',
      cms_deployment: p.cms_deployment || '',
      demo_url: p.demo_url || '',
      support_duration: p.support_duration || ''
    });
    setEditingId(p.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!supabase) return;
    setLoading(true);
    try {
      // 1. Set matching vouchers' product_id to NULL first to prevent foreign key errors
      const { error: updateError } = await supabase
        .from('vouchers')
        .update({ product_id: null })
        .eq('product_id', id);

      if (updateError) {
        console.warn('Gagal mengosongkan product_id pada vouchers:', updateError);
      }

      // 2. Perform deletion directly on client (uses logged-in Admin session)
      const { error: deleteError } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw deleteError;
      }

      // Success
      await fetchProducts();
      showToast("Produk berhasil dihapus.", "success");
    } catch (err: any) {
      console.error("Gagal menghapus produk:", err);
      showToast("Gagal menghapus produk: " + (err.message || "Pastikan Anda adalah Admin dan RLS policy di-enable"), "error");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ 
      name: '', 
      description: '', 
      price: 0, 
      discount_price: 0, 
      cost_price: 0, 
      category: '', 
      category_id: '', 
      image_url: '', 
      file_url: '',
      framework: '',
      database_tech: '',
      cms_deployment: '',
      demo_url: '',
      support_duration: ''
    });
    setEditingId(null);
    setUploadStatus('');
  };

  const copySql = (sql: string) => {
     navigator.clipboard.writeText(sql);
     alert("SQL Disalin! Silakan jalankan di Supabase SQL Editor.");
  };

  // Helper to convert file/blob to Base64
  const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  // Helper to resize image client-side before upload
  const resizeImage = (file: File, maxWidth: number = 800): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg', 0.7); // Compress to JPEG 70% quality
      };
      img.onerror = reject;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'image_url' | 'file_url') => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      
      try {
          let fileToUpload: File | Blob = file;
          let fileName = `${Date.now()}_${file.name.replace(/\s/g, '_')}`;

          // Only resize if it is the product image (not the downloadable file)
          if (field === 'image_url' && file.type.startsWith('image/')) {
             setUploadStatus('Mengompres gambar...');
             try {
                fileToUpload = await resizeImage(file);
                fileName = fileName.replace(/\.[^/.]+$/, "") + ".jpg";
             } catch (resizeErr) {
                console.warn("Resize failed, using original", resizeErr);
             }
          }

          setUploadStatus('Mengupload ke server...');

          // 1. Try Supabase Storage first
          const bucket = field === 'image_url' ? 'images' : 'files';
          
          const { data, error } = await supabase!.storage.from(bucket).upload(fileName, fileToUpload);
          
          if (!error && data) {
              const { data: { publicUrl } } = supabase!.storage.from(bucket).getPublicUrl(fileName);
              setFormData(prev => ({ ...prev, [field]: publicUrl }));
          } else {
              console.warn(`Storage upload failed (${error?.message}), falling back to Base64.`);
              if (field === 'file_url' && file.size > 2 * 1024 * 1024) {
                 alert("File terlalu besar untuk disimpan langsung di database (>2MB). Mohon setup Storage Bucket di Supabase atau gunakan link Google Drive.");
                 throw new Error("File too big for Base64 fallback");
              }
              setUploadStatus('Menyimpan ke database...');
              const base64 = await fileToBase64(fileToUpload);
              setFormData(prev => ({ ...prev, [field]: base64 }));
          }
      } catch (err: any) {
          console.error("Upload critical error", err);
          if (!err.message.includes("File too big")) {
             try {
                const base64 = await fileToBase64(file);
                setFormData(prev => ({ ...prev, [field]: base64 }));
             } catch(e) {
                alert("Gagal memproses file. Silakan gunakan link manual.");
             }
          }
      } finally {
          setUploading(false);
          setUploadStatus('');
      }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus size={20} /> Tambah Produk
        </button>
      </div>

      {dbError && (
          <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg mb-6 flex flex-col gap-2">
             <div className="flex items-center gap-2 text-red-500 font-bold">
                <AlertTriangle size={20} /> DATABASE ERROR: Kolom 'cost_price' (Harga Modal) tidak ditemukan!
             </div>
             <p className="text-sm text-red-200">
                Fitur tambah/edit produk dan komisi affiliate tidak akan berfungsi sebelum Anda menjalankan perintah SQL di bawah ini.
             </p>
             <div className="bg-slate-950 p-3 rounded font-mono text-xs text-green-400 relative overflow-x-auto">
                 <pre>{COST_PRICE_MIGRATION_SQL}</pre>
                 <button onClick={() => copySql(COST_PRICE_MIGRATION_SQL)} className="absolute top-2 right-2 bg-slate-800 text-white px-2 py-1 rounded">Copy</button>
             </div>

             <p className="text-xs text-indigo-300 mt-2">
                Dan jalankan ini untuk fitur Source Code (Framework, DB, dll):
             </p>
             <div className="bg-slate-950 p-3 rounded font-mono text-xs text-indigo-400 relative overflow-x-auto">
                 <pre>{SOURCE_CODE_MIGRATION_SQL}</pre>
                 <button onClick={() => copySql(SOURCE_CODE_MIGRATION_SQL)} className="absolute top-2 right-2 bg-slate-800 text-white px-2 py-1 rounded">Copy</button>
             </div>
             <button onClick={() => window.location.reload()} className="self-end bg-red-600 text-white px-3 py-1 rounded text-sm mt-2">
                Sudah dijalankan? Refresh Halaman
             </button>
          </div>
      )}

      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-900 text-slate-400 uppercase text-xs">
              <tr>
                <th className="p-4">Nama</th>
                <th className="p-4">Modal</th>
                <th className="p-4">Harga Jual</th>
                <th className="p-4">Profit</th>
                <th className="p-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-indigo-400" size={20} />
                      <span>Sedang memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Belum ada produk.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const finalPrice = p.discount_price || p.price;
                  const cost = p.cost_price || 0;
                  const profit = finalPrice - cost;
                  return (
                    <tr key={p.id} className="hover:bg-slate-750">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={p.image_url || 'https://via.placeholder.com/150'} 
                            className="w-10 h-10 rounded object-cover bg-slate-700" 
                            alt="" 
                            onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=No+Img'; }}
                          />
                          <div>
                             <div className="font-medium">{p.name}</div>
                             {!p.is_active && <span className="text-xs bg-red-500/20 text-red-500 px-1 rounded">Nonaktif</span>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-400">{formatRupiah(cost)}</td>
                      <td className="p-4 text-slate-300">{formatRupiah(finalPrice)}</td>
                      <td className="p-4 font-bold text-green-400">{formatRupiah(profit)}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button 
                            onClick={() => navigate('/admin/vouchers', { state: { presetProductId: p.id } })} 
                            title="Buat Voucher untuk Produk ini"
                            className="p-2 text-indigo-400 hover:bg-slate-700 rounded"
                          >
                            <Ticket size={16} />
                          </button>
                          <button onClick={() => handleEdit(p)} className="p-2 text-blue-400 hover:bg-slate-700 rounded"><Edit size={16} /></button>
                          <button onClick={() => setDeleteId(p.id)} className="p-2 text-red-400 hover:bg-slate-700 rounded"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-700">
            <div className="p-6 border-b border-slate-700 flex justify-between items-center sticky top-0 bg-slate-800 z-10">
              <h2 className="text-xl font-bold">{editingId ? 'Edit Produk' : 'Tambah Produk Baru'}</h2>
              <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                   <label className="block text-sm font-medium mb-1">Nama Produk</label>
                   <input required type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                
                {/* PRICING ROW - Standard Input Types to avoid NaN issues */}
                <div className="col-span-2 md:col-span-1">
                   <label className="block text-sm font-medium mb-1 text-slate-400">Harga Modal (COGS)</label>
                   <input 
                      type="number" 
                      min="0"
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" 
                      value={formData.cost_price} 
                      onChange={e => setFormData({...formData, cost_price: parseFloat(e.target.value) || 0})}
                      onFocus={e => e.target.select()} // Select all on focus for easy edit
                   />
                </div>
                 <div className="col-span-2 md:col-span-1">
                   <label className="block text-sm font-medium mb-1">Harga Jual</label>
                   <input 
                      type="number"
                      required
                      min="0" 
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" 
                      value={formData.price} 
                      onChange={e => setFormData({...formData, price: parseFloat(e.target.value) || 0})} 
                      onFocus={e => e.target.select()}
                   />
                </div>
                
                <div className="col-span-2 md:col-span-1">
                   <label className="block text-sm font-medium mb-1">Harga Diskon (Opsional)</label>
                   <input 
                      type="number" 
                      min="0"
                      className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" 
                      value={formData.discount_price} 
                      onChange={e => setFormData({...formData, discount_price: parseFloat(e.target.value) || 0})} 
                      onFocus={e => e.target.select()}
                   />
                </div>

                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-sm font-medium mb-1">Kategori</label>
                    <div className="flex gap-2">
                       <select 
                          className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none text-sm"
                          value={formData.category_id}
                          onChange={e => {
                             const cat = categories.find(c => c.id === e.target.value);
                             setFormData({...formData, category_id: e.target.value, category: cat ? cat.name : e.target.value});
                          }}
                       >
                          <option value="">Pilih Kategori</option>
                          {categories.map(cat => (
                             <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                          <option value="custom">-- Custom (Teks) --</option>
                       </select>
                       
                       {formData.category_id === 'custom' && (
                          <input 
                             type="text"
                             className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none text-sm"
                             placeholder="Nama Kategori..."
                             value={formData.category}
                             onChange={e => setFormData({...formData, category: e.target.value})}
                          />
                       )}
                    </div>
                  </div>

                {/* SOURCE CODE SPECIAL FIELDS */}
                {formData.category.toLowerCase().includes('source code') && (
                  <div className="col-span-2 bg-slate-900/50 p-4 rounded-lg border border-indigo-500/30 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm mb-2">
                      <Terminal size={16} /> Spesifikasi Source Code
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Frameworks</label>
                        <select 
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs outline-none focus:border-indigo-500"
                          value={formData.framework}
                          onChange={e => setFormData({...formData, framework: e.target.value})}
                        >
                          <option value="">Pilih Framework</option>
                          {FRAMEWORKS.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">DB / Back End</label>
                        <select 
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs outline-none focus:border-indigo-500"
                          value={formData.database_tech}
                          onChange={e => setFormData({...formData, database_tech: e.target.value})}
                        >
                          <option value="">Pilih Database</option>
                          {DATABASES.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">CMS / Deployment</label>
                        <select 
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs outline-none focus:border-indigo-500"
                          value={formData.cms_deployment}
                          onChange={e => setFormData({...formData, cms_deployment: e.target.value})}
                        >
                          <option value="">Pilih CMS/Deployment</option>
                          {DEPLOYMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Support Vendor</label>
                        <input 
                          type="text"
                          placeholder="Contoh: 1 Tahun, Seumur Hidup"
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs outline-none focus:border-indigo-500"
                          value={formData.support_duration}
                          onChange={e => setFormData({...formData, support_duration: e.target.value})}
                        />
                      </div>
                      
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-400 mb-1">Demo Link</label>
                        <input 
                          type="url"
                          placeholder="https://demo-anda.com"
                          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-xs outline-none focus:border-indigo-500"
                          value={formData.demo_url}
                          onChange={e => setFormData({...formData, demo_url: e.target.value})}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="col-span-2">
                   <label className="block text-sm font-medium mb-1">Deskripsi</label>
                   <textarea rows={4} className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>

                {/* IMAGE UPLOAD SECTION */}
                <div className="col-span-2">
                   <label className="block text-sm font-medium mb-1">Gambar Produk</label>
                   
                   <div className="flex flex-col gap-3">
                     <div className="flex gap-2 items-start">
                       <input 
                          type="text" 
                          className="flex-1 bg-slate-900 border border-slate-600 rounded p-2 text-sm focus:ring-1 focus:ring-primary outline-none" 
                          placeholder="https://... (atau upload file)" 
                          value={formData.image_url} 
                          onChange={e => setFormData({...formData, image_url: e.target.value})} 
                       />
                       <label className={`bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded cursor-pointer flex items-center gap-2 transition-colors flex-shrink-0 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                          {uploading && formData.image_url === '' ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          <span className="text-sm">Upload</span>
                          <input type="file" className="hidden" accept="image/*" disabled={uploading} onChange={(e) => handleFileUpload(e, 'image_url')} />
                       </label>
                     </div>
                     
                     {uploading && uploadStatus && (
                        <div className="text-xs text-primary animate-pulse flex items-center gap-1">
                           <Loader2 size={12} className="animate-spin" /> {uploadStatus}
                        </div>
                     )}
                     
                     {/* Preview Image */}
                     {formData.image_url && !formData.image_url.startsWith('data:application') && (
                       <div className="relative w-full h-32 bg-slate-900 rounded border border-slate-700 overflow-hidden flex items-center justify-center">
                          <img 
                            src={formData.image_url} 
                            alt="Preview" 
                            className="h-full object-contain"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} 
                          />
                          <div className="absolute bottom-1 right-1 bg-black/60 px-2 py-1 rounded text-xs text-white">Preview</div>
                       </div>
                     )}
                   </div>
                </div>

                {/* FILE UPLOAD SECTION */}
                <div className="col-span-2">
                   <label className="block text-sm font-medium mb-1">Link File Produk / Download</label>
                   <div className="flex gap-2">
                     <input 
                        type="text" 
                        className="w-full bg-slate-900 border border-slate-600 rounded p-2 focus:ring-1 focus:ring-primary outline-none" 
                        placeholder="https://drive.google.com/..." 
                        value={formData.file_url} 
                        onChange={e => setFormData({...formData, file_url: e.target.value})} 
                      />
                      <label className={`bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded cursor-pointer flex items-center ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                        {uploading && !formData.image_url ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                        <input type="file" className="hidden" disabled={uploading} onChange={(e) => handleFileUpload(e, 'file_url')} />
                     </label>
                   </div>
                   <p className="text-[10px] text-slate-500 mt-1">
                      <AlertCircle size={10} className="inline mr-1" />
                      Untuk file besar {">"} 2MB, disarankan menggunakan link Google Drive/Dropbox.
                   </p>
                </div>
              </div>
              
              <div className="pt-4 flex justify-end gap-2 border-t border-slate-700 mt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-300 hover:text-white transition-colors">Batal</button>
                <button 
                  type="submit" 
                  disabled={uploading}
                  className="px-6 py-2 bg-primary hover:bg-blue-600 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {uploading ? 'Memproses...' : 'Simpan Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-800 rounded-xl max-w-sm w-full p-6 border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-white mb-2">Hapus Produk</h3>
            <p className="text-slate-400 text-sm mb-6">Apakah Anda yakin ingin menghapus produk ini? Semua kode promo/voucher terkait produk ini juga akan disesuaikan.</p>
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

export default AdminProducts;
