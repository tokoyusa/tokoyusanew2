
import React, { useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../../types';
import { getSupabase } from '../../services/supabase';
import { Users, Trash2, Search, Mail, Phone, Shield, User as UserIcon, Loader2, AlertCircle } from 'lucide-react';

const AdminUsers: React.FC = () => {
    const [users, setUsers] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteUserObj, setDeleteUserObj] = useState<{ id: string; email: string } | null>(null);
    const [roleChangeUser, setRoleChangeUser] = useState<{ user: UserProfile; newRole: UserRole } | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 4000);
    };

    const supabase = getSupabase();

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .order('role', { ascending: true }); // Admin first usually
            
            if (error) throw error;
            setUsers(data || []);
        } catch (err) {
            console.error("Error fetching users:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const deleteUser = async (id: string, email: string) => {
        try {
            // Note: On Supabase, profiles table deletion might be restricted or cascading
            const { error } = await supabase.from('profiles').delete().eq('id', id);
            if (error) throw error;
            setUsers(users.filter(u => u.id !== id));
            showToast("User dihapus.", "success");
        } catch (err) {
            console.error("Error deleting user:", err);
            showToast("Gagal menghapus user: " + (err as any).message, "error");
        }
    };

    const toggleAdmin = async (user: UserProfile, newRole: UserRole) => {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ role: newRole })
                .eq('id', user.id);
            
            if (error) throw error;
            setUsers(users.map(u => u.id === user.id ? { ...u, role: newRole } : u));
            showToast(`Role ${user.email} berhasil diubah menjadi ${newRole.toUpperCase()}.`, "success");
        } catch (err) {
            console.error("Error updating role:", err);
            showToast("Gagal mengubah role.", "error");
        }
    };

    const filteredUsers = users.filter(u => 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <Users size={24} className="text-primary" /> Kelola Pengguna
                    </h2>
                    <p className="text-sm text-slate-400">Total {users.length} pengguna terdaftar</p>
                </div>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
                    <input 
                        type="text" 
                        placeholder="Cari email atau nama..." 
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-sm focus:border-primary outline-none"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                    <Loader2 size={40} className="animate-spin mb-4" />
                    <p>Memuat data pengguna...</p>
                </div>
            ) : (
                <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-900/50 text-slate-400 uppercase text-[10px] font-bold tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Detail</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50 text-sm">
                                {filteredUsers.map((u) => (
                                    <tr key={u.id} className="hover:bg-slate-700/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${u.role === UserRole.ADMIN ? 'border-accent bg-accent/10' : 'border-slate-600 bg-slate-700'}`}>
                                                    <UserIcon size={20} className={u.role === UserRole.ADMIN ? 'text-accent' : 'text-slate-400'} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-white leading-tight">{u.full_name || 'No Name'}</p>
                                                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                                                        <Mail size={10} /> {u.email}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <p className="text-xs text-slate-400 flex items-center gap-2">
                                                    <Phone size={12} /> {u.phone || '-'}
                                                </p>
                                                <p className="text-xs text-slate-400">
                                                    Saldo: <span className="text-green-400 font-bold">Rp {(u.balance || 0).toLocaleString()}</span>
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${u.role === UserRole.ADMIN ? 'bg-accent/20 text-accent' : 'bg-slate-700 text-slate-400'}`}>
                                                {u.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button 
                                                    onClick={() => setRoleChangeUser({ user: u, newRole: u.role === UserRole.ADMIN ? UserRole.USER : UserRole.ADMIN })}
                                                    className={`p-2 rounded-lg transition-colors ${u.role === UserRole.ADMIN ? 'text-yellow-500 hover:bg-yellow-500/10' : 'text-indigo-400 hover:bg-indigo-400/10'}`}
                                                    title={u.role === UserRole.ADMIN ? "Jadikan User Biasa" : "Jadikan Admin"}
                                                >
                                                    <Shield size={18} />
                                                </button>
                                                <button 
                                                    onClick={() => setDeleteUserObj({ id: u.id, email: u.email })}
                                                    className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Hapus User"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {filteredUsers.length === 0 && (
                        <div className="py-12 text-center text-slate-500">
                            <AlertCircle size={32} className="mx-auto mb-2 opacity-20" />
                            <p>Tidak ada pengguna yang sesuai pencarian.</p>
                        </div>
                    )}
                </div>
            )}

            {/* CONFIRMATION DIALOG FOR ROLE CHANGE */}
            {roleChangeUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-800 rounded-xl max-w-sm w-full p-6 border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">Ubah Role Pengguna</h3>
                        <p className="text-slate-400 text-sm mb-6">Apakah Anda yakin ingin mengubah role pengguna <strong>{roleChangeUser.user.email}</strong> menjadi <strong>{roleChangeUser.newRole.toUpperCase()}</strong>?</p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setRoleChangeUser(null)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-all text-white font-medium"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={() => {
                                    const { user, newRole } = roleChangeUser;
                                    setRoleChangeUser(null);
                                    toggleAdmin(user, newRole);
                                }}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm transition-all shadow-lg shadow-indigo-600/20 font-bold"
                            >
                                Ya, Ubah
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRMATION DIALOG FOR DELETION */}
            {deleteUserObj && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-800 rounded-xl max-w-sm w-full p-6 border border-slate-700 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">Hapus Pengguna</h3>
                        <p className="text-slate-400 text-sm mb-6">Apakah Anda yakin ingin menghapus profil <strong>{deleteUserObj.email}</strong>? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.</p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setDeleteUserObj(null)}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm transition-all text-white font-medium"
                            >
                                Batal
                            </button>
                            <button 
                                onClick={() => {
                                    const { id, email } = deleteUserObj;
                                    setDeleteUserObj(null);
                                    deleteUser(id, email);
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

export default AdminUsers;
