
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { getSupabase, getStoredConfig, initSupabase } from './services/supabase';
import { UserRole, UserProfile, CartItem, Product, StoreSettings } from './types';
import { initPixel, trackPixelEvent } from './services/pixel';

// Pages
import HomePage from './pages/HomePage';
import ProductDetail from './pages/ProductDetail';
import CartPage from './pages/CartPage';
import ProfilePage from './pages/ProfilePage';
import AuthPage from './pages/AuthPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminSettings from './pages/admin/AdminSettings';
import AdminAffiliates from './pages/admin/AdminAffiliates';
import AdminVouchers from './pages/admin/AdminVouchers';
import AdminCategories from './pages/admin/AdminCategories';
import AdminWithdrawals from './pages/admin/AdminWithdrawals';
import AdminUsers from './pages/admin/AdminUsers';
import SetupPage from './pages/SetupPage';
import PWAInstallPrompt from './components/PWAInstallPrompt';

const DEFAULT_SETTINGS: StoreSettings = {
  store_name: 'Digital Store',
  store_description: 'Pusat Produk Digital Terbaik',
  whatsapp_number: '',
  email_contact: '',
  address: '',
  bank_accounts: [],
  e_wallets: [],
  qris_url: ''
};

const App: React.FC = () => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  
  // Check config synchronously on init to avoid flash of SetupPage
  const [dbConfigured, setDbConfigured] = useState(() => !!getStoredConfig());

  // Separate session check logic
  const checkSession = async () => {
    try {
      const supabase = getSupabase();
      if (!supabase) {
        if (!getStoredConfig()) {
           setDbConfigured(false);
        }
        return;
      }

      // Check Session
      const { data: { session }, error: sessionError } = await (supabase.auth as any).getSession();
      
      if (session) {
        // Fetch Profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
        
        if (profile) {
          let currentRole = profile.role;
          setUser({ ...profile, email: session.user.email! });
          
          // AUTO-PROMOTE LOGIC: If this is the only user, promote to admin
          const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
          
          if (count === 1 && profile.role !== 'admin') {
             const { error } = await supabase.from('profiles').update({ role: 'admin' }).eq('id', session.user.id);
             if (!error) {
                currentRole = 'admin';
                setUser({ ...profile, role: 'admin', email: session.user.email! });
             }
          }
        } else {
          // PROFILE MISSING RECOVERY: Create if doesn't exist
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([{ 
                id: session.user.id, 
                email: session.user.email,
                role: 'user'
            }])
            .select()
            .single();
          
          if (!createError && newProfile) {
             setUser({ ...newProfile, email: session.user.email! });
          }
        }
      }
      
      // Fetch Settings
      const { data: settingsData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'store_settings')
        .single();
        
      if (settingsData) {
        setSettings({ ...DEFAULT_SETTINGS, ...settingsData.value });
      }

    } catch (error) {
      console.error("Session check error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const config = getStoredConfig();
    if (!config) {
      setDbConfigured(false);
      setLoading(false);
      return;
    }
    
    const client = initSupabase();
    if (!client) {
      setDbConfigured(false);
      setLoading(false);
      return;
    }

    setDbConfigured(true);
    checkSession();

    const { data: authListener } = (client.auth as any).onAuthStateChange(async (_event: any, session: any) => {
      if (session) {
          setTimeout(async () => {
             const { data: profile } = await client
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
             if(profile) setUser({ ...profile, email: session.user.email! });
          }, 500);
      } else {
        setUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };

  }, [dbConfigured]); 

  useEffect(() => {
    if (settings.store_name) {
      document.title = settings.store_name;
    }
    if (settings.logo_url) {
      const favicon = document.getElementById('favicon') as HTMLLinkElement;
      const appleIcon = document.getElementById('apple-touch-icon') as HTMLLinkElement;
      if (favicon) favicon.href = settings.logo_url;
      if (appleIcon) appleIcon.href = settings.logo_url;
    }
    
    // Initialize Meta Pixel if ID is provided
    if (settings.facebook_pixel_id) {
      initPixel(settings.facebook_pixel_id);
    }
  }, [settings.store_name, settings.logo_url, settings.facebook_pixel_id]);

  const addToCart = (product: Product) => {
    trackPixelEvent('AddToCart', {
      content_name: product.name,
      content_ids: [product.id],
      content_type: 'product',
      value: product.discount_price || product.price,
      currency: 'IDR'
    });
    setCart((prev) => {
      const existing = prev.find((p) => p.id === product.id);
      if (existing) return prev; 
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((p) => p.id !== id));
  };

  const clearCart = () => setCart([]);

  const updateSettings = (newSettings: StoreSettings) => {
    setSettings(newSettings);
    const supabase = getSupabase();
    if (supabase && user?.role === UserRole.ADMIN) {
      supabase.from('settings').upsert({
        key: 'store_settings',
        value: newSettings
      }).then(({ error }) => {
        if (error) console.error("Error saving settings", error);
      });
    }
  };

  const handleConfigured = () => {
    initSupabase();
    setLoading(true);
    setDbConfigured(true);
  };

  if (!dbConfigured) {
    return <SetupPage onConfigured={handleConfigured} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Router>
      <PWAInstallPrompt />
      <Layout user={user} setUser={setUser} cartCount={cart.length} settings={settings}>
        <Routes>
          {/* PUBLIC ROUTES: Open to everyone */}
          <Route 
            path="/" 
            element={<HomePage addToCart={addToCart} settings={settings} />} 
          />
          
          <Route 
            path="/product/:id" 
            element={<ProductDetail addToCart={addToCart} user={user} settings={settings} />} 
          />
          
          <Route 
            path="/cart" 
            element={<CartPage cart={cart} removeFromCart={removeFromCart} clearCart={clearCart} user={user} settings={settings} />} 
          />
          
          {/* PROTECTED ROUTES */}
          <Route 
            path="/profile" 
            element={user ? <ProfilePage user={user} /> : <Navigate to="/login" replace />} 
          />
          
          {/* AUTH ROUTE */}
          <Route 
            path="/login" 
            element={!user ? <AuthPage onLoginSuccess={checkSession} /> : <Navigate to="/" replace />} 
          />

          <Route 
            path="/reset-password" 
            element={<ResetPasswordPage />} 
          />
          
          {/* ADMIN ROUTES */}
          <Route path="/admin/dashboard" element={user?.role === UserRole.ADMIN ? <AdminDashboard /> : <Navigate to="/" />} />
          <Route path="/admin/products" element={user?.role === UserRole.ADMIN ? <AdminProducts /> : <Navigate to="/" />} />
          <Route path="/admin/categories" element={user?.role === UserRole.ADMIN ? <AdminCategories /> : <Navigate to="/" />} />
          <Route path="/admin/orders" element={user?.role === UserRole.ADMIN ? <AdminOrders /> : <Navigate to="/" />} />
          <Route path="/admin/vouchers" element={user?.role === UserRole.ADMIN ? <AdminVouchers /> : <Navigate to="/" />} />
          <Route path="/admin/affiliates" element={user?.role === UserRole.ADMIN ? <AdminAffiliates /> : <Navigate to="/" />} />
          <Route path="/admin/withdrawals" element={user?.role === UserRole.ADMIN ? <AdminWithdrawals /> : <Navigate to="/" />} />
          <Route path="/admin/users" element={user?.role === UserRole.ADMIN ? <AdminUsers /> : <Navigate to="/" />} />
          <Route path="/admin/settings" element={user?.role === UserRole.ADMIN ? <AdminSettings settings={settings} onUpdate={updateSettings} /> : <Navigate to="/" />} />
          
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </Router>
  );
};

export default App;
