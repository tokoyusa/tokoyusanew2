
import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { getSupabase } from '../services/supabase';

const PWAInstallPrompt: React.FC = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [logoUrl, setLogoUrl] = useState('https://cdn-icons-png.flaticon.com/512/3081/3081559.png');

    useEffect(() => {
        // Function to check if the app is already installed/running in standalone mode
        const checkStandalone = () => {
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                               (navigator as any).standalone || 
                               document.referrer.includes('android-app://');
            return isStandalone;
        };

        const fetchLogo = async () => {
          if (checkStandalone()) return; // Don't fetch if already installed

          const supabase = getSupabase();
          if (supabase) {
            const { data } = await supabase
              .from('settings')
              .select('value')
              .eq('key', 'store_settings')
              .single();
            if (data?.value?.logo_url) {
              setLogoUrl(data.value.logo_url);
            }
          }
        };
        fetchLogo();

        const handler = (e: any) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
            
            // Show the prompt
            setIsVisible(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // Check if already installed
        window.addEventListener('appinstalled', () => {
            setDeferredPrompt(null);
            setIsVisible(false);
        });

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        
        setIsVisible(false);
        // Show the install prompt
        deferredPrompt.prompt();
        
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        
        // We've used the prompt, and can't use it again, throw it away
        setDeferredPrompt(null);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed top-20 left-4 right-4 z-[100] animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="bg-slate-800/90 backdrop-blur-md border border-primary/30 rounded-2xl p-4 shadow-2xl flex items-center gap-4 relative overflow-hidden group">
                {/* Background pulse */}
                <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
                
                <div className="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 border border-slate-700">
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <Download size={14} className="absolute -bottom-1 -right-1 bg-primary text-white rounded-full p-0.5 border border-slate-800" />
                </div>
                
                <div className="relative flex-1">
                    <h3 className="text-sm font-bold text-white leading-tight">Install Aplikasi</h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Dapatkan pengalaman belanja lebih cepat dan nyaman.</p>
                </div>
                
                <div className="relative flex flex-col gap-2">
                    <button 
                        onClick={handleInstallClick}
                        className="bg-primary hover:bg-blue-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg shadow-primary/20"
                    >
                        Install
                    </button>
                    <button 
                        onClick={() => setIsVisible(false)}
                        className="text-[10px] text-slate-500 hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                        Nanti saja
                    </button>
                </div>

                <button 
                    onClick={() => setIsVisible(false)}
                    className="absolute top-2 right-2 text-slate-500 hover:text-white"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
