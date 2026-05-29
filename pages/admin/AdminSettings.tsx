
import React, { useState, useEffect } from 'react';
import { StoreSettings } from '../../types';
import { 
  Save, RefreshCw, Upload, Loader2, Image as ImageIcon, Wallet, 
  Database, Terminal, AlertCircle, History, Settings, Layers, 
  Package, Ticket, Users, ChevronRight, LayoutDashboard,
  ShieldCheck, X, CreditCard, Zap
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSupabase, BANK_MIGRATION_SQL, COST_PRICE_MIGRATION_SQL, HISTORY_MIGRATION_SQL, GUEST_ORDER_MIGRATION_SQL, AUTO_COMMISSION_MIGRATION_SQL } from '../../services/supabase';
import { safeStorage } from '../../services/storage';

// Import Admin Sub-components
import AdminCategories from './AdminCategories';
import AdminProducts from './AdminProducts';
import AdminVouchers from './AdminVouchers';
import AdminAffiliates from './AdminAffiliates';
import AdminUsers from './AdminUsers';
import AdminWithdrawals from './AdminWithdrawals';

interface AdminSettingsProps {
  settings: StoreSettings;
  onUpdate: (s: StoreSettings) => void;
}

type SettingsTab = 'general' | 'payment' | 'database' | 'categories' | 'products' | 'vouchers' | 'affiliates' | 'users' | 'withdrawals';

const AdminSettings: React.FC<AdminSettingsProps> = ({ settings, onUpdate }) => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialTab = (queryParams.get('tab') as SettingsTab) || 'general';

  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [localSettings, setLocalSettings] = useState<StoreSettings>({
      ...settings,
      e_wallets: settings.e_wallets || [], // Ensure it exists
      payment_methods_active: settings.payment_methods_active || {
        transfer: true,
        ewallet: true,
        qris: true,
        pakasir: true
      }
  });
  const [uploading, setUploading] = useState(false);
  const [showSql, setShowSql] = useState(false);
  const [activeSql, setActiveSql] = useState('');
  const navigate = useNavigate();
  const supabase = getSupabase();

  useEffect(() => {
    const tab = queryParams.get('tab') as SettingsTab;
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [location.search]);

  const handleTabChange = (tab: SettingsTab) => {
    setActiveTab(tab);
    navigate(`/admin/settings?tab=${tab}`);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, key: keyof StoreSettings) => {
    setLocalSettings({ ...localSettings, [key]: e.target.value });
  };
  
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>, key: keyof StoreSettings) => {
     setLocalSettings({ ...localSettings, [key]: parseFloat(e.target.value) || 0 });
  };

  const handleCheckChange = (e: React.ChangeEvent<HTMLInputElement>, key: keyof StoreSettings) => {
    setLocalSettings({ ...localSettings, [key]: e.target.checked });
  };

  const setMethodActive = (method: string, active: boolean) => {
    setLocalSettings({
      ...localSettings,
      payment_methods_active: {
        ...localSettings.payment_methods_active,
        [method]: active
      }
    });
  };

  // --- Bank Helpers ---
  const handleBankChange = (index: number, field: string, value: string) => {
    const newBanks = [...localSettings.bank_accounts];
    newBanks[index] = { ...newBanks[index], [field]: value };
    setLocalSettings({ ...localSettings, bank_accounts: newBanks });
  };

  const addBank = () => {
    setLocalSettings({
      ...localSettings,
      bank_accounts: [...localSettings.bank_accounts, { bank: '', number: '', name: '' }]
    });
  };

  const removeBank = (index: number) => {
    const newBanks = localSettings.bank_accounts.filter((_, i) => i !== index);
    setLocalSettings({ ...localSettings, bank_accounts: newBanks });
  };

  // --- E-Wallet Helpers ---
  const handleWalletChange = (index: number, field: string, value: string) => {
    const newWallets = [...localSettings.e_wallets];
    newWallets[index] = { ...newWallets[index], [field]: value };
    setLocalSettings({ ...localSettings, e_wallets: newWallets });
  };

  const addWallet = () => {
    setLocalSettings({
      ...localSettings,
      e_wallets: [...localSettings.e_wallets, { provider: 'DANA', number: '', name: '' }]
    });
  };

  const removeWallet = (index: number) => {
    const newWallets = localSettings.e_wallets.filter((_, i) => i !== index);
    setLocalSettings({ ...localSettings, e_wallets: newWallets });
  };

  const saveAll = () => {
    onUpdate(localSettings);
    alert('Pengaturan disimpan!');
  };

  const resetDatabase = () => {
    if(confirm("Ini akan menghapus koneksi database dari browser ini. Lanjutkan?")) {
      safeStorage.removeItem('digitalstore_supabase_config');
      window.location.reload();
    }
  }

  // --- Image Upload Helpers ---

  const fileToBase64 = (file: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const resizeImage = (file: File, maxWidth: number = 400): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxWidth) {
             width = Math.round((width * maxWidth) / height);
             height = maxWidth;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
           ctx.drawImage(img, 0, 0, width, height);
        }

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob failed'));
        }, 'image/jpeg', 0.6);
      };
      img.onerror = reject;
    });
  };

  const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const resizedBlob = await resizeImage(file, 400);
      const base64 = await fileToBase64(resizedBlob);
      setLocalSettings(prev => ({ ...prev, qris_url: base64 }));
    } catch (err) {
      console.error("Error processing QRIS", err);
      alert("Gagal memproses gambar.");
    } finally {
      setUploading(false);
    }
  };

  const showSqlModal = (sql: string) => {
      setActiveSql(sql);
      setShowSql(true);
  };

  const menuItems = [
    { id: 'general', label: 'Umum', icon: Settings },
    { id: 'payment', label: 'Pembayaran', icon: Wallet },
    { id: 'categories', label: 'Kategori', icon: Layers },
    { id: 'products', label: 'Produk', icon: Package },
    { id: 'vouchers', label: 'Voucher', icon: Ticket },
    { id: 'affiliates', label: 'Affiliate', icon: Users },
    { id: 'withdrawals', label: 'Manage Penarikan', icon: CreditCard },
    { id: 'users', label: 'Manage User', icon: ShieldCheck },
    { id: 'database', label: 'Database & Tools', icon: Database },
  ];

  return (
    <div className="py-6 min-h-screen">
      <div className="flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden sticky top-24">
            <div className="p-4 border-b border-slate-700">
               <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Pengaturan</h2>
            </div>
            <nav className="p-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id as SettingsTab)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all mb-1 ${
                    activeTab === item.id 
                    ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                    : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={18} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  {activeTab === item.id && <ChevronRight size={14} />}
                </button>
              ))}
            </nav>
            
            <div className="p-4 border-t border-slate-700 mt-2">
               <button 
                 onClick={() => navigate('/admin')}
                 className="w-full flex items-center gap-3 p-2 text-slate-500 hover:text-slate-300 transition-colors text-xs"
               >
                 <LayoutDashboard size={14} /> Kembali ke Dashboard
               </button>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0">
           {/* Tab Content Header */}
           <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-3">
                 {menuItems.find(i => i.id === activeTab)?.label}
              </h1>
              {(activeTab === 'general' || activeTab === 'payment') && (
                <button onClick={saveAll} className="bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-primary/20">
                  <Save size={20} /> Simpan Perubahan
                </button>
              )}
           </div>

           {/* Dynamic Tabs */}
           <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              {activeTab === 'general' && (
                <div className="grid md:grid-cols-1 gap-8">
                   <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
                      <h2 className="text-lg font-bold border-b border-slate-700 pb-2">Informasi Umum Toko</h2>
                      <div>
                        <label className="block text-sm mb-1 font-medium text-slate-300">Nama Toko</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-3 focus:border-primary outline-none" value={localSettings.store_name} onChange={(e) => handleChange(e, 'store_name')} />
                      </div>
                      <div>
                        <label className="block text-sm mb-1 font-medium text-slate-300">Deskripsi</label>
                        <textarea rows={3} className="w-full bg-slate-900 border border-slate-600 rounded p-3 focus:border-primary outline-none" value={localSettings.store_description} onChange={(e) => handleChange(e, 'store_description')} />
                      </div>
                      <div>
                        <label className="block text-sm mb-1 font-medium text-slate-300">Nomor WhatsApp Admin (628...)</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 rounded p-3 focus:border-primary outline-none" value={localSettings.whatsapp_number} onChange={(e) => handleChange(e, 'whatsapp_number')} />
                      </div>
                      <div>
                        <label className="block text-sm mb-1 font-medium text-slate-300">Facebook Pixel ID (Opsional)</label>
                        <input 
                          type="text" 
                          placeholder="Contoh: 123456789012345"
                          className="w-full bg-slate-900 border border-slate-600 rounded p-3 focus:border-primary outline-none" 
                          value={localSettings.facebook_pixel_id || ''} 
                          onChange={(e) => handleChange(e, 'facebook_pixel_id')} 
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Masukkan ID Pixel Anda untuk melacak pengunjung dan konversi.</p>
                      </div>

                      <div className="pt-4 border-t border-slate-700">
                         <label className="block text-sm mb-2 font-medium text-slate-300">Logo Aplikasi / Website</label>
                         <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-slate-900 rounded-lg border border-slate-700 flex items-center justify-center overflow-hidden">
                                {localSettings.logo_url ? (
                                    <img src={localSettings.logo_url} className="w-full h-full object-contain" alt="Logo" />
                                ) : (
                                    <ImageIcon className="text-slate-700" size={24} />
                                )}
                            </div>
                            <label className={`bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-lg cursor-pointer flex items-center gap-2 transition-all ${uploading ? 'opacity-50' : ''}`}>
                                {uploading ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16} />}
                                <span className="text-xs font-bold">Upload Logo</span>
                                <input 
                                    type="file" 
                                    className="hidden" 
                                    accept="image/*" 
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setUploading(true);
                                            try {
                                                const resized = await resizeImage(file, 200);
                                                const base64 = await fileToBase64(resized);
                                                setLocalSettings({...localSettings, logo_url: base64});
                                            } finally { setUploading(false); }
                                        }
                                    }} 
                                />
                            </label>
                            {localSettings.logo_url && (
                                <button onClick={() => setLocalSettings({...localSettings, logo_url: ''})} className="text-red-400 text-xs hover:underline">Hapus Logo</button>
                            )}
                         </div>
                         <p className="text-[10px] text-slate-500 mt-2">Format PNG/JPG disarankan. Akan otomatis dikompres.</p>
                      </div>
                   </div>

                   <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4">
                      <h2 className="text-lg font-bold border-b border-slate-700 pb-2 flex items-center gap-2">
                        <Users size={20} className="text-indigo-400" /> Pengaturan Komisi Affiliate
                      </h2>
                      <div>
                        <label className="block text-sm mb-1 font-medium text-slate-300">Komisi Affiliate (% dari PROFIT/Keuntungan)</label>
                        <p className="text-xs text-slate-400 mb-3 italic">Persentase yang diterima affiliate dari (Harga Jual - Harga Modal) per transaksi.</p>
                        <div className="relative max-w-[200px]">
                          <input 
                            type="number" 
                            min="0" 
                            max="100"
                            className="w-full bg-slate-900 border border-slate-600 rounded p-3 pr-10 focus:border-primary outline-none" 
                            value={localSettings.affiliate_commission_rate || 0} 
                            onChange={(e) => handleNumberChange(e, 'affiliate_commission_rate')} 
                          />
                          <span className="absolute right-4 top-3.5 text-slate-400 font-bold">%</span>
                        </div>
                        
                        <div className="mt-4 bg-blue-500/10 p-4 rounded-lg text-xs text-blue-300 border border-blue-500/20">
                            <p className="font-bold flex items-center gap-2 mb-1"><AlertCircle size={14}/> Simulasi Perhitungan:</p>
                            <p>Harga Modal: Rp 10.000, Harga Jual: Rp 15.000, Komisi: 10%</p>
                            <p className="mt-1">Profit: Rp 5.000 -&gt; Komisi Affiliate: 10% x 5.000 = <strong>Rp 500</strong></p>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-700">
                        <label className="block text-sm mb-1 font-medium text-slate-300">Minimal Penarikan Saldo (Rp)</label>
                        <p className="text-xs text-slate-500 mb-2">Batas minimal saldo yang bisa ditarik oleh affiliate.</p>
                        <input 
                           type="number" 
                           className="w-full max-w-[200px] bg-slate-900 border border-slate-600 rounded p-3 focus:border-primary outline-none" 
                           value={localSettings.min_withdrawal || 0} 
                           onChange={(e) => handleNumberChange(e, 'min_withdrawal')} 
                        />
                      </div>
                   </div>
                </div>
              )}

              {activeTab === 'payment' && (
                <div className="space-y-8">
                  {/* Status Toggles Section */}
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                       <ShieldCheck size={20} className="text-green-400" /> Status Metode Pembayaran
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { id: 'transfer', label: 'Transfer Bank Manual' },
                          { id: 'ewallet', label: 'E-Wallet Manual' },
                          { id: 'qris', label: 'QRIS Manual' },
                          { id: 'pakasir', label: 'Pakasir (Otomatis)' },
                        ].map((method) => (
                          <div key={method.id} className="bg-slate-900/50 p-4 rounded-xl border border-slate-700 flex items-center justify-between">
                             <span className="text-sm font-medium text-slate-300">{method.label}</span>
                             <button 
                                onClick={() => setMethodActive(method.id, !((localSettings.payment_methods_active as any)?.[method.id] ?? true))}
                                className={`w-12 h-6 rounded-full transition-all relative ${((localSettings.payment_methods_active as any)?.[method.id] ?? true) ? 'bg-primary' : 'bg-slate-700'}`}
                             >
                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${((localSettings.payment_methods_active as any)?.[method.id] ?? true) ? 'left-7' : 'left-1'}`} />
                             </button>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* Pakasir Configuration */}
                  <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                       <Zap size={20} className="text-yellow-400" /> Konfigurasi Pakasir (Otomatis)
                    </h2>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm mb-1 font-medium text-slate-300">Pakasir Project Slug</label>
                        <input 
                          type="text" 
                          placeholder="Contoh: my-store"
                          className="w-full bg-slate-900 border border-slate-600 rounded p-3 focus:border-primary outline-none" 
                          value={localSettings.pakasir_project_slug || ''} 
                          onChange={(e) => handleChange(e, 'pakasir_project_slug')} 
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1 font-medium text-slate-300">Pakasir API Key</label>
                        <input 
                          type="password" 
                          placeholder="Masukkan API Key Pakasir"
                          className="w-full bg-slate-900 border border-slate-600 rounded p-3 focus:border-primary outline-none" 
                          value={localSettings.pakasir_api_key || ''} 
                          onChange={(e) => handleChange(e, 'pakasir_api_key')} 
                        />
                      </div>
                    </div>
                    <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700 rounded-xl">
                      <h3 className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                        <Terminal size={14} /> Link Webhook Pakasir
                      </h3>
                      <p className="text-xs text-slate-500 mb-2">Salin dan tempel URL ini ke pengaturan Webhook di Dashboard Pakasir Anda:</p>
                      <div className="flex items-center gap-2">
                        <code className="bg-black p-2 rounded flex-1 text-xs text-green-400 break-all">
                          {window.location.origin}/api/webhook/pakasir
                        </code>
                        <button 
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/api/webhook/pakasir`);
                            alert("Webhook URL copied!");
                          }}
                          className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-white"
                        >
                          <Save size={14} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Manual Payment Section */}
                  <div className="grid md:grid-cols-2 gap-8">
                     {/* Bank Accounts */}
                     <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                           <h2 className="text-lg font-bold">Transfer Bank Manual</h2>
                           <button onClick={addBank} className="text-[10px] uppercase font-bold bg-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-600">Tambah</button>
                        </div>
                        <div className="space-y-4">
                           {localSettings.bank_accounts.map((bank, i) => (
                             <div key={i} className="bg-slate-900 p-4 rounded-xl relative group border border-slate-700/50">
                                <button onClick={() => removeBank(i)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Terminal size={12}/></button>
                                <div className="space-y-3">
                                   <input placeholder="Nama Bank (BCA/BRI)" className="w-full bg-transparent border-b border-slate-700 p-1 focus:border-primary outline-none" value={bank.bank} onChange={(e) => handleBankChange(i, 'bank', e.target.value)} />
                                   <input placeholder="Nomor Rekening" className="w-full bg-transparent border-b border-slate-700 p-1 focus:border-primary outline-none" value={bank.number} onChange={(e) => handleBankChange(i, 'number', e.target.value)} />
                                   <input placeholder="Atas Nama" className="w-full bg-transparent border-b border-slate-700 p-1 focus:border-primary outline-none" value={bank.name} onChange={(e) => handleBankChange(i, 'name', e.target.value)} />
                                </div>
                             </div>
                           ))}
                           {localSettings.bank_accounts.length === 0 && <p className="text-slate-500 text-sm italic">Belum ada rekening bank.</p>}
                        </div>
                     </div>

                     {/* E-Wallets */}
                     <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <div className="flex justify-between items-center mb-6">
                           <h2 className="text-lg font-bold">Lokal E-Wallet</h2>
                           <button onClick={addWallet} className="text-[10px] uppercase font-bold bg-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-600">Tambah</button>
                        </div>
                        <div className="space-y-4">
                           {localSettings.e_wallets.map((wallet, i) => (
                             <div key={i} className="bg-slate-900 p-4 rounded-xl relative group border border-slate-700/50">
                                <button onClick={() => removeWallet(i)} className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Terminal size={12}/></button>
                                <div className="space-y-3">
                                   <select className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-sm outline-none" value={wallet.provider} onChange={(e) => handleWalletChange(i, 'provider', e.target.value)}>
                                     <option value="DANA">DANA</option>
                                     <option value="OVO">OVO</option>
                                     <option value="GOPAY">GOPAY</option>
                                     <option value="SHOPEEPAY">SHOPEEPAY</option>
                                   </select>
                                   <input placeholder="Nomor HP" className="w-full bg-transparent border-b border-slate-700 p-1 focus:border-primary outline-none" value={wallet.number} onChange={(e) => handleWalletChange(i, 'number', e.target.value)} />
                                   <input placeholder="Atas Nama" className="w-full bg-transparent border-b border-slate-700 p-1 focus:border-primary outline-none" value={wallet.name} onChange={(e) => handleWalletChange(i, 'name', e.target.value)} />
                                </div>
                             </div>
                           ))}
                           {localSettings.e_wallets.length === 0 && <p className="text-slate-500 text-sm italic">Belum ada e-wallet.</p>}
                        </div>
                     </div>

                     {/* QRIS Upload */}
                     <div className="col-span-1 md:col-span-2 bg-slate-800 p-6 rounded-xl border border-slate-700">
                        <h2 className="text-lg font-bold mb-4">Static QRIS (Opsional)</h2>
                        <div className="flex flex-col md:flex-row gap-6 items-center">
                           <div className="w-full md:w-48 h-48 bg-slate-900 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center overflow-hidden">
                              {localSettings.qris_url ? (
                                <img src={localSettings.qris_url} className="w-full h-full object-contain" alt="QRIS" />
                              ) : (
                                <ImageIcon className="text-slate-700" size={48} />
                              )}
                           </div>
                           <div className="flex-1 space-y-4">
                              <p className="text-xs text-slate-400">Upload gambar QRIS statis Toko Anda. Gambar akan dikompres otomatis agar halaman checkout tetap cepat.</p>
                              <label className={`w-fit bg-slate-700 hover:bg-slate-600 px-6 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 transition-all ${uploading ? 'opacity-50' : ''}`}>
                                {uploading ? <Loader2 className="animate-spin" size={18}/> : <Upload size={18} />}
                                <span className="font-bold text-sm">Upload QRIS Baru</span>
                                <input type="file" className="hidden" accept="image/*" onChange={handleQrisUpload} disabled={uploading} />
                              </label>
                              {localSettings.qris_url && (
                                <button onClick={() => setLocalSettings({...localSettings, qris_url: ''})} className="text-red-400 text-xs hover:underline">Hapus Gambar</button>
                              )}
                           </div>
                        </div>
                     </div>
                  </div>
                </div>
              )}

              {activeTab === 'categories' && <AdminCategories />}
              {activeTab === 'products' && <AdminProducts />}
              {activeTab === 'vouchers' && <AdminVouchers />}
              {activeTab === 'affiliates' && <AdminAffiliates />}
              {activeTab === 'withdrawals' && <AdminWithdrawals />}
              {activeTab === 'users' && <AdminUsers />}

              {activeTab === 'database' && (
                <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 space-y-8 animate-in zoom-in-95 duration-300">
                   <div className="max-w-2xl">
                      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <Database className="text-blue-400" /> Database Management
                      </h2>
                      <p className="text-slate-400 text-sm mb-8">Halaman ini digunakan untuk me-maintenance tabel dan skema database Supabase Anda jika terjadi update fitur.</p>
                      <div className="bg-emerald-500/10 text-emerald-400 p-4 rounded-xl border border-emerald-500/25 mb-6 text-xs leading-relaxed">
                        <strong>Update Kolom Orders (PENTING):</strong> Jika Anda belum menambahkan kolom <code>buyer_email</code> (Email Pembeli), <code>product_name</code> (Nama Produk), dan <code>affiliate_code</code> (Kode Affiliate/Referrer) pada tabel <code>orders</code> di database Supabase Anda, silakan pilih tab <strong>"Kolom Pembeli & Produk"</strong> di bawah ini, salin kodenya, dan jalankan di SQL Editor dashboard Supabase Anda.
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl hover:border-emerald-500/50 transition-all group">
                            <h3 className="font-bold mb-2 flex items-center gap-2">
                               <CreditCard size={16} className="text-emerald-500" /> Kolom Pembeli & Produk
                            </h3>
                            <p className="text-[10px] text-slate-500 mb-4">Menambahkan kolom guest_info, subtotal, discount_amount, buyer_email, product_name, dan affiliate_code pada tabel orders.</p>
                            <button onClick={() => showSqlModal(GUEST_ORDER_MIGRATION_SQL)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">Lihat SQL</button>
                         </div>
                         <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl hover:border-blue-500/50 transition-all group">
                            <h3 className="font-bold mb-2 flex items-center gap-2">
                               <ShieldCheck size={16} className="text-blue-500" /> Profil & Keamanan
                            </h3>
                            <p className="text-[10px] text-slate-500 mb-4">Migrasi tabel profil dan setup Row Level Security (RLS) awal.</p>
                            <button onClick={() => showSqlModal(BANK_MIGRATION_SQL)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">Lihat SQL</button>
                         </div>

                         <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl hover:border-blue-500/50 transition-all group">
                            <h3 className="font-bold mb-2 flex items-center gap-2">
                               <Package size={16} className="text-indigo-500" /> Update Produk
                            </h3>
                            <p className="text-[10px] text-slate-500 mb-4">Menambahkan kolom 'cost_price' (Harga Modal) untuk sistem profit.</p>
                            <button onClick={() => showSqlModal(COST_PRICE_MIGRATION_SQL)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">Lihat SQL</button>
                         </div>

                         <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl hover:border-yellow-500/50 transition-all group">
                            <h3 className="font-bold mb-2 flex items-center gap-2">
                               <History size={16} className="text-yellow-500" /> Riwayat Komisi
                            </h3>
                            <p className="text-[10px] text-slate-500 mb-4">Membuat tabel log untuk mencatat setiap komisi yang masuk ke affiliate.</p>
                            <button onClick={() => showSqlModal(HISTORY_MIGRATION_SQL)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">Lihat SQL</button>
                         </div>

                         <div className="p-4 bg-slate-900 border border-slate-700 rounded-xl hover:border-emerald-500/50 transition-all group animate-pulse">
                            <h3 className="font-bold mb-2 flex items-center gap-2">
                               <Zap size={16} className="text-emerald-400" /> Otomatisasi Komisi
                            </h3>
                            <p className="text-[10px] text-slate-500 mb-4">Membuat Trigger agar komisi otomatis masuk ke saldo affiliator setelah transaksi selesai.</p>
                            <button onClick={() => showSqlModal(AUTO_COMMISSION_MIGRATION_SQL)} className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs font-bold transition-colors">Lihat SQL</button>
                         </div>
                         
                         <div className="p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                            <h3 className="font-bold mb-2 text-red-400">Danger Zone</h3>
                            <p className="text-[10px] text-slate-500 mb-4">Reset koneksi database yang tersimpan di browser ini.</p>
                            <button onClick={resetDatabase} className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-bold transition-colors">Reset Local Cache</button>
                         </div>
                      </div>

                      {showSql && (
                        <div className="mt-8">
                           <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 relative shadow-inner">
                              <div className="flex justify-between items-center mb-4">
                                 <span className="text-[10px] uppercase font-bold text-slate-600 font-mono tracking-widest">Supabase SQL Editor</span>
                                 <div className="flex gap-2">
                                    <button onClick={() => { navigator.clipboard.writeText(activeSql); alert("Copied!"); }} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400" title="Salin"><Save size={14}/></button>
                                    <button onClick={() => setShowSql(false)} className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-400" title="Tutup"><X size={14}/></button>
                                 </div>
                              </div>
                              <div className="max-h-[300px] overflow-y-auto">
                                 <pre className="text-xs font-mono text-green-400/80 leading-relaxed whitespace-pre-wrap">{activeSql}</pre>
                              </div>
                           </div>
                           <p className="mt-4 text-[10px] text-slate-500 italic">Salin kode di atas dan tempelkan ke SQL Editor di Dashboard Supabase untuk menjalankan perubahan skema.</p>
                        </div>
                      )}
                   </div>
                </div>
              )}
           </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
