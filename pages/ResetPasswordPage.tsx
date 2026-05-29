
import React, { useState, useEffect } from 'react';
import { getSupabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we are in a recovery flow
    const checkHash = () => {
      const hash = window.location.hash;
      if (!hash || !hash.includes('access_token')) {
        // If no token in hash, maybe the session is already established by Supabase client?
        // Let's check if there's a user session
        const supabase = getSupabase();
        if (supabase) {
          supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) {
              // Not coming from a valid reset link or already used
              // navigate('/login');
            }
          });
        }
      }
    };
    checkHash();
  }, [navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }

    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) {
      setError("Koneksi database tidak tersedia.");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      console.error("Reset password error:", err);
      setError(err.message || "Gagal memperbarui password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 w-full max-w-md relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl"></div>
        
        <div className="flex justify-center mb-6">
           <div className="bg-slate-900 p-4 rounded-full border border-slate-700 shadow-lg">
             <Lock className="text-primary w-10 h-10" />
           </div>
        </div>

        <h2 className="text-2xl font-bold text-center mb-2 text-white">Atur Ulang Password</h2>
        <p className="text-center text-slate-400 mb-8 text-sm">
          Silakan masukkan password baru Anda di bawah ini.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg text-sm mb-6 flex items-start gap-2">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success ? (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-6 rounded-xl text-center flex flex-col items-center gap-3">
             <CheckCircle size={48} />
             <p className="font-bold text-lg">Password Berhasil Diubah!</p>
             <p className="text-sm opacity-80">Anda akan dialihkan ke halaman login dalam beberapa detik...</p>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-500" size={18} />
              <input 
                type="password" 
                required 
                minLength={6}
                placeholder="Password Baru"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary outline-none transition-all" 
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-3 top-3.5 text-slate-500" size={18} />
              <input 
                type="password" 
                required 
                minLength={6}
                placeholder="Konfirmasi Password"
                className="w-full bg-slate-900 border border-slate-600 rounded-lg py-3 pl-10 pr-4 focus:border-primary outline-none transition-all" 
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-primary hover:bg-blue-600 text-white font-bold py-3 rounded-lg transition-all shadow-lg mt-2 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Memproses...
                </>
              ) : 'Update Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
