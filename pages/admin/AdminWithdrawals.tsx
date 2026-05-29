
import React, { useEffect, useState } from 'react';
import { getSupabase, WITHDRAWAL_MIGRATION_SQL } from '../../services/supabase';
import { Withdrawal, StoreSettings } from '../../types';
import { 
  CreditCard, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Search, 
  ChevronRight, 
  User, 
  Download,
  Settings,
  Zap,
  RefreshCw
} from 'lucide-react';
import { formatRupiah } from '../../services/helpers';

const AdminWithdrawals: React.FC = () => {
    const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
    const [loading, setLoading] = useState(true);
    const [settings, setSettings] = useState<StoreSettings | null>(null);
    const [dbError, setDbError] = useState(false);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'completed'>('pending');
    const [search, setSearch] = useState('');
    const [processingId, setProcessingId] = useState<string | null>(null);

    const supabase = getSupabase();

    const fetchWithdrawals = async () => {
        if (!supabase) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('withdrawals')
                .select('*, profiles(full_name, email)')
                .order('created_at', { ascending: false });

            if (error) {
                if (error.message.includes('relation "withdrawals" does not exist')) {
                    setDbError(true);
                }
                throw error;
            }
            setWithdrawals(data || []);
        } catch (err) {
            console.error("Fetch Withdrawals Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const fetchSettings = async () => {
        if (!supabase) return;
        const { data } = await supabase.from('settings').select('*').eq('key', 'store_settings').single();
        if (data) setSettings(data.value);
    };

    useEffect(() => {
        fetchWithdrawals();
        fetchSettings();
    }, []);

    const updateStatus = async (id: string, userId: string, amount: number, newStatus: 'approved' | 'rejected' | 'completed', currentStatus: string) => {
        if (!supabase) return;
        setProcessingId(id);
        try {
            // Case 1: approving a pending request -> subtract balance now
            if (newStatus === 'approved' && currentStatus === 'pending') {
                const { error: balError } = await supabase.rpc('increment_balance', { 
                    user_id: userId, 
                    amount: -amount 
                });
                if (balError) throw balError;
            }

            // Case 2: rejecting an already approved request -> refund balance
            if (newStatus === 'rejected' && currentStatus === 'approved') {
                await supabase.rpc('increment_balance', { 
                    user_id: userId, 
                    amount: amount 
                });
            }

            const { error } = await supabase
                .from('withdrawals')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);

            if (error) throw error;
            
            alert(`Permintaan berhasil di-${newStatus}`);
            fetchWithdrawals();
        } catch (err: any) {
            alert("Gagal update status: " + err.message);
        } finally {
            setProcessingId(null);
        }
    };

    const saveMinWithdrawal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supabase || !settings) return;
        
        try {
            const { error } = await supabase.from('settings').upsert({
                key: 'store_settings',
                value: settings
            });
            if (error) throw error;
            alert("Pengaturan minimal penarikan disimpan!");
        } catch (err: any) {
            alert("Gagal simpan: " + err.message);
        }
    };

    const copySql = () => {
        navigator.clipboard.writeText(WITHDRAWAL_MIGRATION_SQL);
        alert("SQL Disalin! Silakan jalankan di Supabase SQL Editor.");
    };

    const filtered = withdrawals.filter(w => {
        const matchesFilter = filter === 'all' || w.status === filter;
        const matchesSearch = 
            w.profiles?.full_name?.toLowerCase().includes(search.toLowerCase()) || 
            w.profiles?.email?.toLowerCase().includes(search.toLowerCase()) ||
            w.bank_info.toLowerCase().includes(search.toLowerCase());
        return matchesFilter && matchesSearch;
    });

    if (dbError) {
        return (
            <div className="p-6">
                <div className="bg-red-900/30 border border-red-500 rounded-xl p-6 text-center max-w-2xl mx-auto">
                    <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
                    <h2 className="text-xl font-bold text-white mb-2">Gagal Memuat Menu Penarikan</h2>
                    <p className="text-slate-400 mb-6">
                        Tabel 'withdrawals' belum ada di database Anda. Silakan jalankan perintah SQL berikut di SQL Editor Supabase Anda:
                    </p>
                    <div className="bg-slate-950 p-4 rounded-lg text-left font-mono text-xs text-green-400 relative overflow-hidden group">
                        <pre className="max-h-60 overflow-y-auto">{WITHDRAWAL_MIGRATION_SQL}</pre>
                        <button 
                            onClick={copySql}
                            className="absolute top-2 right-2 bg-slate-800 text-white px-3 py-1 rounded text-[10px] hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            Copy SQL
                        </button>
                    </div>
                    <button 
                        onClick={() => window.location.reload()}
                        className="mt-6 bg-primary hover:bg-blue-600 text-white px-6 py-2 rounded-lg font-bold transition-all"
                    >
                        Sudah saya jalankan, segarkan halaman
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                   <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                       <CreditCard className="text-primary" /> Kelola Penarikan
                   </h1>
                   <p className="text-slate-400 text-sm">Validasi dan proses penarikan saldo affiliate.</p>
                </div>

                {settings && (
                    <form onSubmit={saveMinWithdrawal} className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-xl border border-slate-700">
                        <Settings size={18} className="text-slate-400" />
                        <div className="flex flex-col">
                            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Min. Penarikan</label>
                            <input 
                                type="number" 
                                className="bg-transparent text-white font-bold outline-none border-b border-primary/30 focus:border-primary text-sm w-32"
                                value={settings.min_withdrawal || 0}
                                onChange={e => setSettings({...settings, min_withdrawal: Number(e.target.value)})}
                            />
                        </div>
                        <button className="bg-primary/20 hover:bg-primary/30 text-primary p-2 rounded-lg transition-colors">
                            <Download size={18} />
                        </button>
                    </form>
                )}
            </div>

            {/* Filter Bar */}
            <div className="bg-slate-800/30 p-2 rounded-xl border border-slate-800 flex flex-wrap items-center gap-2">
                {(['all', 'pending', 'approved', 'completed', 'rejected'] as const).map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                            filter === f ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                    >
                        {f}
                    </button>
                ))}
                <div className="flex-1 min-w-[200px] relative ml-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input 
                        type="text"
                        placeholder="Cari user atau info bank..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-10 pr-4 text-xs text-white outline-none focus:border-primary transition-colors"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* List Table */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-800/50 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                            <tr>
                                <th className="px-6 py-4">User</th>
                                <th className="px-6 py-4">Bank / Tujuan</th>
                                <th className="px-6 py-4">Jumlah</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Tanggal</th>
                                <th className="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-sm">
                            {filtered.map(w => (
                                <tr key={w.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
                                                <User size={16} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-white leading-tight">{w.profiles?.full_name || 'No Name'}</div>
                                                <div className="text-[10px] text-slate-500">{w.profiles?.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-slate-300">
                                            <CreditCard size={14} className="text-slate-500" />
                                            <span className="text-xs">{w.bank_info}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-bold text-white">
                                        {formatRupiah(w.amount)}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                            w.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500' :
                                            w.status === 'approved' ? 'bg-blue-500/10 text-blue-500' :
                                            w.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                                            'bg-red-500/10 text-red-500'
                                        }`}>
                                            {w.status === 'pending' && <Clock size={10} />}
                                            {w.status === 'approved' && <RefreshCw size={10} className="animate-spin" />}
                                            {w.status === 'completed' && <CheckCircle size={10} />}
                                            {w.status === 'rejected' && <XCircle size={10} />}
                                            {w.status}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        {new Date(w.created_at).toLocaleDateString()}<br/>
                                        {new Date(w.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {w.status === 'pending' && (
                                            <div className="flex items-center justify-end gap-2">
                                                <button 
                                                    disabled={processingId === w.id}
                                                    onClick={() => updateStatus(w.id, w.user_id, w.amount, 'approved', w.status)}
                                                    className="p-2 bg-blue-500/10 hover:bg-blue-500 text-blue-500 hover:text-white rounded-lg transition-all"
                                                    title="Setujui (Proses pembayaran)"
                                                >
                                                    <CheckCircle size={18} />
                                                </button>
                                                <button 
                                                    disabled={processingId === w.id}
                                                    onClick={() => updateStatus(w.id, w.user_id, w.amount, 'rejected', w.status)}
                                                    className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                                                    title="Tolak (Refund Saldo)"
                                                >
                                                    <XCircle size={18} />
                                                </button>
                                            </div>
                                        )}
                                        {w.status === 'approved' && (
                                            <div className="flex flex-col items-end gap-2">
                                                <button 
                                                    disabled={processingId === w.id}
                                                    onClick={async () => {
                                                        const confirm = window.confirm("Cairkan penarikan ini otomatis via Pakasir?");
                                                        if (!confirm) return;
                                                        try {
                                                            const res = await fetch('/api/pakasir/disburse', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ amount: w.amount, bank_info: w.bank_info, id: w.id })
                                                            });
                                                            const data = await res.json();
                                                            if (res.status === 200) {
                                                                alert("Pencairan berhasil!");
                                                                updateStatus(w.id, w.user_id, w.amount, 'completed', 'approved');
                                                            } else {
                                                                alert(`INFO: ${data.message || data.error}\n\n(Catatan: Anda tetap bisa konfirmasi manual di bawah jika transfer sudah dilakukan sendiri)`);
                                                            }
                                                        } catch (err: any) {
                                                            alert("Kesalahan koneksi: " + err.message);
                                                        }
                                                    }}
                                                    className="bg-primary hover:bg-blue-600 text-white px-3 py-1.5 rounded inline-flex items-center gap-1.5 text-xs font-bold transition-colors shadow-lg shadow-primary/20"
                                                >
                                                    <Zap size={14} className="fill-white" /> Cairkan (Pakasir)
                                                </button>

                                                <button 
                                                    disabled={processingId === w.id}
                                                    onClick={() => updateStatus(w.id, w.user_id, w.amount, 'completed', w.status)}
                                                    className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded inline-flex items-center gap-1.5 text-xs font-bold transition-colors"
                                                >
                                                    <CheckCircle size={14} /> Konfirmasi Manual
                                                </button>
                                                <p className="text-[9px] text-slate-500 italic">Saldo dipotong saat status Disetujui</p>
                                            </div>
                                        )}
                                        {w.status === 'completed' && (
                                            <div className="text-green-500 flex items-center justify-end gap-1 font-bold text-xs">
                                                <CheckCircle size={14} /> Berhasil
                                            </div>
                                        )}
                                        {w.status === 'rejected' && (
                                            <div className="text-red-500 flex items-center justify-end gap-1 font-bold text-xs">
                                                <XCircle size={14} /> Ditolak
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {filtered.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                                        <AlertCircle className="mx-auto mb-2 opacity-20" size={48} />
                                        <p>Tidak ada pengajuan penarikan ditemukan.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
};

export default AdminWithdrawals;
