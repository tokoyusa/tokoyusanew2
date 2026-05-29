
import React, { useState } from 'react';
import { getSupabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag, Lock, User as UserIcon, Ticket, X } from 'lucide-react';
import { safeStorage } from '../services/storage';

interface AuthPageProps {
  onLoginSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [referralCode, setReferralCode] = useState(() => {
    return safeStorage.getItem('digitalstore_referral') || '';
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  // Helper to ensure profile exists and handle first-user admin logic
  const checkProfileReady = async (userId: string, retryCount = 0): Promise<boolean> => {
    const supabase = getSupabase();
    if (!supabase) return false;

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('id', userId)
        .single();

      if (profile) {
        return true;
      }

      if (retryCount < 5) {
        // Wait 1 second and retry
        await new Promise(resolve => setTimeout(resolve, 1000));
        return checkProfileReady(userId, retryCount + 1);
      }
      
      return false;
    } catch (err) {
      if (retryCount < 5) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return checkProfileReady(userId, retryCount + 1);
      }
      return false;
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabase = getSupabase();
    if (!supabase) {
      setError("Koneksi database tidak tersedia.");
      setLoading(false);
      return;
    }

    try {
      const resetUrl = window.location.origin + window.location.pathname + '#/reset-password';
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetUrl,
      });

      if (error) throw error;

      setSuccess("Tautan reset password telah dikirim ke email Anda. Silakan periksa inbox (dan kotak spam) Anda.");
    } catch (err: any) {
      console.error("Forgot password error:", err);
      setError(err.message || "Gagal mengirim email reset password.");
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    const supabase = getSupabase();
    if (!supabase) {
      setError("Koneksi database tidak tersedia.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        // LOGIN FLOW
        const { data, error: authError } = await (supabase.auth as any).signInWithPassword({ email, password });
        if (authError) throw authError;
        
        if (data.user) {
          const isReady = await checkProfileReady(data.user.id);
          if (!isReady) {
             throw new Error("Gagal mengambil data profil. Silakan coba login kembali beberapa saat lagi.");
          }
        }
      } else {
        // SIGNUP FLOW
        const { data, error: authError } = await (supabase.auth as any).signUp({ 
            email, 
            password,
            options: { data: { full_name: fullName } } 
        });
        if (authError) throw authError;

        if (data.user && data.session) {
             // Profile will be created by Trigger. 
             // We wait for it to be ready.
             const isReady = await checkProfileReady(data.user.id);
             if (!isReady) {
               console.warn("Trigger slow or failed, user might need to login again.");
             }
             // Store referral if exists in safeStorage (will be handled by a secondary sync or manual update if needed)
             const refCode = referralCode || safeStorage.getItem('digitalstore_referral');
             if (refCode && refCode.trim() !== '') {
               await supabase.from('profiles').update({ referred_by: refCode.trim().toUpperCase() }).eq('id', data.user.id);
               safeStorage.removeItem('digitalstore_referral');
             }
        } else if (data.user && !data.session) {
             // Email Confirmation Enabled (user requested this OFF but we handle it anyway)
             setSuccess("Pendaftaran berhasil! Silakan cek email Anda untuk konfirmasi sebelum login.");
             setIsLogin(true); 
             setLoading(false);
             return;
        }
      }
      
      await onLoginSuccess();
      
    } catch (err: any) {
      console.error("Auth process error:", err);
      let userMessage = err.message || "Terjadi kesalahan saat masuk.";
      
      if (userMessage.includes("Failed to fetch")) {
        userMessage = "Tidak dapat terhubung ke database. Harap periksa koneksi internet Anda atau pastikan URL Supabase di pengaturan Vercel/Settings sudah benar.";
      } else if (userMessage.includes("Lock")) {
        userMessage = "Sesi terganggu oleh jendela lain. Silakan muat ulang halaman.";
      }
      
      setError(userMessage);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md relative overflow-hidden">
        <button 
           onClick={() => navigate('/')} 
           className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors bg-slate-700/50 p-1 rounded-full z-20"
           title="Kembali ke Toko"
        >
           <X size={20} />
        </button>

        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/10 rounded-full blur-3xl"></div>

        <div className="flex justify-center mb-6 relative z-10">
           <div className="bg-slate-900 p-4 rounded-full border border-slate-700 shadow-lg">
             <ShoppingBag className="text-primary w-10 h-10" />
           </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center mb-2 text-white">
          {isForgotPassword ? 'Reset Password' : (isLogin ? 'Selamat Datang Kembali' : 'Bergabung Sekarang')}
        </h2>
        <p className="text-center text-slate-400 mb-8 text-sm">
          {isForgotPassword ? 'Masukkan email Anda untuk menerima tautan reset password' : (isLogin ? 'Masuk untuk mengelola pesanan Anda' : 'Buat akun untuk mulai berbelanja')}
        </p>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-lg text-sm mb-6 text-center">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg text-sm mb-6 text-center">
            {success}
          </div>
        )}

        {isForgotPassword ? (
          <form onSubmit={handleForgotPassword} className="space-y-4 relative z-10">
            <div className="relative">
              <UserIcon className="absolute left-3 top-3.5 text-slate-500" size={18} />
              <input 
                type="email" 
                required 
                placeholder="Email Address"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all shadow-lg mt-2"
            >
              {loading ? 'Mengirim...' : 'Kirim Tautan Reset'}
            </button>
            <button 
              type="button" 
              onClick={() => { setIsForgotPassword(false); setError(null); setSuccess(null); }}
              className="w-full text-slate-400 hover:text-white text-sm transition-colors mt-2"
            >
              Kembali ke Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} className="space-y-4 relative z-10">
            {!isLogin && (
              <div className="relative">
                <UserIcon className="absolute left-3 top-3.5 text-slate-500" size={18} />
                <input 
                  type="text" 
                  required 
                  placeholder="Nama Lengkap"
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
            )}
            
            <div className="relative">
              <UserIcon className="absolute left-3 top-3.5 text-slate-500" size={18} />
              <input 
                type="email" 
                required 
                placeholder="Email Address"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-500" size={18} />
              <input 
                type="password" 
                required 
                minLength={6}
                placeholder="Password"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all" 
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {isLogin && (
              <div className="text-right">
                <button 
                  type="button" 
                  onClick={() => { setIsForgotPassword(true); setError(null); setSuccess(null); }}
                  className="text-sm font-semibold text-primary hover:text-blue-400 transition-colors py-1"
                >
                  Lupa Password? Klik di sini
                </button>
              </div>
            )}

            {!isLogin && (
              <div className="relative">
                  <Ticket className="absolute left-3 top-3.5 text-slate-500" size={18} />
                  <input 
                    type="text" 
                    placeholder="Kode Referral (Opsional)"
                    className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all uppercase" 
                    value={referralCode}
                    onChange={e => setReferralCode(e.target.value)}
                  />
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-blue-500/25 mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Memproses...
                </span>
              ) : (isLogin ? 'Masuk' : 'Daftar')}
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-700/50 text-center relative z-10">
          <p className="text-sm text-slate-400">
            {isForgotPassword ? (
              <>Belum punya akun? <button onClick={() => { setIsLogin(false); setIsForgotPassword(false); }} className="text-primary font-bold">Daftar</button></>
            ) : (
              <>
                {isLogin ? 'Belum punya akun? ' : 'Sudah punya akun? '}
                <button 
                  onClick={() => setIsLogin(!isLogin)} 
                  className="text-primary hover:text-blue-400 font-bold ml-1 transition-colors"
                >
                  {isLogin ? 'Daftar Sekarang' : 'Login'}
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </div>

  );
};

export default AuthPage;
