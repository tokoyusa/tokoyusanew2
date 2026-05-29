
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, ShoppingBag, User, List, Settings, LogOut, Menu, X, BarChart, LayoutDashboard, Users, ClipboardList, Ticket, LogIn, ChevronRight, Layers, CreditCard } from 'lucide-react';
import { UserRole, UserProfile, StoreSettings } from '../types';
import { getSupabase } from '../services/supabase';
import { safeStorage } from '../services/storage';

interface LayoutProps {
  children: React.ReactNode;
  user: UserProfile | null;
  setUser: (u: UserProfile | null) => void;
  cartCount: number;
  settings: StoreSettings;
}

const Layout: React.FC<LayoutProps> = ({ children, user, setUser, cartCount, settings }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const supabase = getSupabase();

  // TRACK AFFILIATE REFERRAL CODE
  useEffect(() => {
    // Check both location.search (HASH router) and window.location.search (Standard URL)
    const params = new URLSearchParams(location.search);
    const windowParams = new URLSearchParams(window.location.search);
    
    const refCode = params.get('ref') || windowParams.get('ref');
    
    if (refCode) {
      const cleanRef = refCode.toUpperCase().trim();
      if (cleanRef) {
        safeStorage.setItem('digitalstore_referral', cleanRef);
        console.log("Captured Referral Code:", cleanRef);
      }
    }
  }, [location.search]);

  // Close sidebar on route change
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  const handleLogout = async () => {
    if (supabase) {
      await (supabase.auth as any).signOut();
      setUser(null);
      navigate('/login');
    }
  };

  const isAdmin = user?.role === UserRole.ADMIN;

  const navLinks = [
    { name: 'Toko', path: '/', icon: <Home size={20} /> },
    { name: 'Kategori', path: '/categories', icon: <List size={20} /> },
    { name: 'Keranjang', path: '/cart', icon: <ShoppingBag size={20} />, badge: cartCount },
    { name: 'Akun', path: user ? '/profile' : '/login', icon: user ? <User size={20} /> : <LogIn size={20} /> },
  ];

  const adminLinks = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard size={20} /> },
    { name: 'Pesanan', path: '/admin/orders', icon: <ClipboardList size={20} /> },
    { name: 'Pengaturan', path: '/admin/settings?tab=general', icon: <Settings size={20} /> },
  ];

  const bottomNavLinks = [
    { name: 'Toko', path: '/', icon: <Home size={24} /> },
    { name: 'Kategori', path: '/admin/settings?tab=categories', icon: <Layers size={24} />, adminOnly: true },
    { name: 'Kategori', path: '/categories', icon: <List size={24} />, userOnly: true },
    { name: 'Keranjang', path: '/cart', icon: <ShoppingBag size={32} />, isMain: true, badge: cartCount },
    { name: 'Pesanan', path: isAdmin ? '/admin/orders' : '/profile', icon: <ClipboardList size={24} /> },
    { name: 'Akun', path: user ? '/profile' : '/login', icon: <User size={24} /> },
  ];

  // Adjust bottom nav links based on role to maintain 5 items
  const activeBottomNav = bottomNavLinks.filter(l => {
    if (l.adminOnly && !isAdmin) return false;
    if (l.userOnly && isAdmin) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-20 md:pb-0">
      {/* Top Navbar */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900/95 border-b border-slate-800 backdrop-blur shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Toggle */}
              <button 
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden flex items-center justify-center text-white bg-slate-800 hover:bg-slate-700 p-2 rounded-lg border border-slate-700 transition-colors z-50"
                aria-label="Buka Menu"
              >
                <Menu size={20} />
              </button>

              <Link to="/" className="text-xl font-bold text-primary flex items-center gap-2">
                {settings.logo_url ? (
                    <img src={settings.logo_url} className="h-8 w-auto object-contain" alt="Logo" />
                ) : (
                    <ShoppingBag className="text-primary" />
                )}
                <span className="hidden sm:inline">{settings.store_name || 'DigitalStorePro'}</span>
                <span className="sm:hidden">{settings.store_name?.split(' ')[0] || 'Store'}</span>
              </Link>
            </div>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-4">
                <Link
                  to="/"
                  className={`px-3 py-2 rounded-md text-sm font-medium hover:text-primary transition-colors ${location.pathname === '/' ? 'text-primary' : 'text-slate-400'}`}
                >
                  Toko
                </Link>
                <Link
                  to="/cart"
                  className={`px-3 py-2 rounded-md text-sm font-medium hover:text-primary transition-colors ${location.pathname === '/cart' ? 'get-accent-text' : 'text-slate-400'}`}
                >
                  <div className="flex items-center gap-2">
                    Keranjang
                    {cartCount > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{cartCount}</span>}
                  </div>
                </Link>
                
                {user ? (
                   <Link
                      to="/profile"
                      className={`px-3 py-2 rounded-md text-sm font-medium hover:text-primary transition-colors ${location.pathname === '/profile' ? 'text-primary' : 'text-slate-400'}`}
                    >
                      Akun
                    </Link>
                ) : (
                   <Link
                      to="/login"
                      className="px-4 py-1.5 rounded-full bg-slate-800 hover:bg-primary text-white text-sm font-medium transition-colors"
                    >
                      Login
                    </Link>
                )}

                {/* Desktop Admin Links */}
                {isAdmin && (
                  <div className="flex items-center border-l border-slate-700 pl-4 space-x-2">
                    <span className="text-[10px] bg-accent/20 text-accent font-black px-2 py-0.5 rounded tracking-tighter">ADMIN</span>
                    {adminLinks.map((link) => (
                      <Link
                        key={link.path}
                        to={link.path}
                        className={`px-3 py-2 rounded-md text-sm font-medium hover:text-accent transition-colors ${location.pathname === link.path ? 'bg-slate-800 text-accent' : 'text-slate-400 hover:bg-slate-800'}`}
                      >
                        {link.name}
                      </Link>
                    ))}
                  </div>
                )}

                {user && (
                  <button
                    onClick={handleLogout}
                    className="bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white px-3 py-2 rounded-md text-sm transition-colors ml-4"
                  >
                    Logout
                  </button>
                )}
            </div>
            
            {/* Mobile Account/Logout (Right Side) */}
             <div className="md:hidden flex items-center gap-2">
                  {user ? (
                     <button onClick={handleLogout} className="p-2 text-red-400">
                        <LogOut size={20} />
                     </button>
                  ) : (
                    <Link to="/login" className="p-2 text-slate-400">
                        <LogIn size={20} />
                    </Link>
                  )}
             </div>
          </div>
        </div>
      </nav>

      {/* MOBILE SIDEBAR */}
      <div 
        className={`fixed inset-0 z-[100] flex md:hidden transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      >
           <div 
             className="absolute inset-0 bg-black/80 backdrop-blur-sm"
             onClick={() => setIsSidebarOpen(false)}
           ></div>
           
           <div className={`relative bg-slate-900 w-[85%] max-w-xs h-full shadow-2xl flex flex-col border-r border-slate-800 transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
              <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                 <span className="font-bold text-xl text-white flex items-center gap-2">
                    {settings.logo_url ? (
                        <img src={settings.logo_url} className="h-6 w-auto object-contain" alt="Logo" />
                    ) : (
                        <ShoppingBag className="text-primary" size={20} />
                    )} 
                    Menu
                 </span>
                 <button onClick={() => setIsSidebarOpen(false)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full border border-slate-700">
                    <X size={20} />
                 </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
                 <div className="mb-6">
                    <p className="px-4 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Menu Utama</p>
                    <Link to="/" onClick={() => setIsSidebarOpen(false)} className="flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800">
                      <div className="flex items-center gap-3"><Home size={18} /> Toko</div>
                      <ChevronRight size={16} />
                    </Link>
                    <Link to="/cart" onClick={() => setIsSidebarOpen(false)} className="flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800">
                      <div className="flex items-center gap-3"><ShoppingBag size={18} /> Keranjang {cartCount > 0 && <span className="bg-primary text-white text-[10px] px-1.5 rounded-full">{cartCount}</span>}</div>
                      <ChevronRight size={16} />
                    </Link>
                 </div>

                 {isAdmin && (
                   <div className="mb-6 border-t border-slate-800 pt-4">
                      <p className="px-4 text-xs font-bold text-accent uppercase tracking-wider mb-2 flex items-center gap-2">
                         <LayoutDashboard size={12}/> Administrator
                      </p>
                      {adminLinks.map((link) => (
                        <Link
                          key={link.path}
                          to={link.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className="flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800"
                        >
                           <div className="flex items-center gap-3">
                              {link.icon}
                              {link.name}
                           </div>
                           <ChevronRight size={16} className="text-slate-600" />
                        </Link>
                      ))}
                   </div>
                 )}
              </div>
           </div>
      </div>

      {/* Main Content */}
      <main className="pt-20 px-4 max-w-7xl mx-auto min-h-[85vh]">
        {children}
      </main>

      {/* STYLISH MOBILE BOTTOM NAVIGATION (5 Menus) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
        {/* Floating Background/Blur */}
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 pointer-events-auto rounded-t-2xl shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"></div>
        
        <div className="relative flex justify-around items-end h-20 px-4 pointer-events-auto">
          {activeBottomNav.map((link, i) => (
             <Link
               key={i}
               to={link.path}
               className={`flex flex-col items-center justify-center transition-all duration-300 ${link.isMain ? '-translate-y-6' : 'translate-y-0 h-16'} ${location.pathname === link.path ? 'text-primary' : 'text-slate-500'}`}
             >
               {link.isMain ? (
                 <div className="relative group">
                    <div className="absolute -inset-2 bg-primary/30 blur-xl rounded-full group-hover:bg-primary/50 transition-all animate-pulse duration-1000"></div>
                    <div className="relative w-16 h-16 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_rgba(59,130,246,0.5)] border-4 border-slate-900 group-active:scale-95 transition-transform">
                      {link.icon}
                      {link.badge ? (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-6 h-6 rounded-full flex items-center justify-center font-black border-2 border-slate-900 animate-bounce">
                          {link.badge}
                        </span>
                      ) : null}
                    </div>
                    <span className="absolute left-1/2 -bottom-6 -translate-x-1/2 text-[10px] font-bold text-primary whitespace-nowrap">{link.name}</span>
                 </div>
               ) : (
                 <div className="flex flex-col items-center space-y-1">
                   <div className="relative transition-transform active:scale-90">
                     {link.icon}
                   </div>
                   <span className="text-[10px] font-medium tracking-tight h-4">{link.name}</span>
                   {location.pathname === link.path && <div className="w-1 h-1 rounded-full bg-primary mt-0.5"></div>}
                 </div>
               )}
             </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Layout;
