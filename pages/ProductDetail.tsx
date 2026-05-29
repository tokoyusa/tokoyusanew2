
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSupabase } from '../services/supabase';
import { Product, UserProfile, StoreSettings } from '../types';
import { formatRupiah } from '../services/helpers';
import { trackPixelEvent } from '../services/pixel';
import { ShoppingCart, ArrowLeft, Share2, Link as LinkIcon, Check, ShieldCheck, Zap, Download, MessageCircle, Terminal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ProductDetailProps {
  addToCart: (product: Product) => void;
  user: UserProfile | null;
  settings: StoreSettings;
}

const ProductDetail: React.FC<ProductDetailProps> = ({ addToCart, user, settings }) => {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProduct = async () => {
      const supabase = getSupabase();
      if (!supabase || !id) return;
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
        
      if (!error) {
        setProduct(data);
        trackPixelEvent('ViewContent', {
          content_name: data.name,
          content_ids: [data.id],
          content_type: 'product',
          value: data.discount_price || data.price,
          currency: 'IDR'
        });
      }
      setLoading(false);
    };
    fetchProduct();
    window.scrollTo(0, 0);
  }, [id]);

  const handleShare = () => {
     navigator.share({ title: product?.name, url: window.location.href }).catch(()=> {
         navigator.clipboard.writeText(window.location.href);
         alert("Link produk disalin!");
     });
  };

  const handleAffiliateShare = () => {
     if (!user?.affiliate_code || !product) return;
     
     const currentUrl = window.location.href.split('?')[0];
     const affiliateUrl = `${currentUrl}?ref=${user.affiliate_code}`;
     
     navigator.clipboard.writeText(affiliateUrl);
     setCopied(true);
     setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a]">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );
  
  if (!product) return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-400">
      Produk tidak ditemukan
    </div>
  );

  const finalPrice = product.discount_price || product.price;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-[#0f172a] min-h-screen pb-20"
    >
      {/* Header / Navigation */}
      <div className="sticky top-0 z-50 bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <button 
            onClick={() => navigate(-1)} 
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex gap-2">
            <button 
              onClick={handleShare}
              className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
            >
              <Share2 size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-4">
        {/* Product Hero Section */}
        <div className="flex flex-col gap-6">
          
          {/* Image Container */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="relative aspect-video md:aspect-[21/9] rounded-2xl overflow-hidden shadow-2xl border border-slate-800"
          >
            <img 
              src={product.image_url || 'https://via.placeholder.com/1200x600?text=Digital+Product'} 
              alt={product.name} 
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6">
              <span className="px-3 py-1 bg-primary text-white text-xs font-bold rounded-full uppercase tracking-widest mb-3 inline-block">
                {product.category}
              </span>
              <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight drop-shadow-lg">
                {product.name}
              </h1>
            </div>
          </motion.div>

          {/* Price & Action Bar */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div>
              <div className="flex items-baseline gap-3">
                <span className="text-4xl font-black text-white">{formatRupiah(finalPrice)}</span>
                {product.discount_price && (
                  <span className="text-xl text-slate-500 line-through decoration-primary decoration-2">{formatRupiah(product.price)}</span>
                )}
              </div>
              <p className="text-slate-400 text-sm mt-1">Pembayaran otomatis & instan</p>
            </div>

            <div className="w-full md:w-auto flex flex-col gap-3">
              <button 
                onClick={() => {
                  addToCart(product);
                  navigate('/cart');
                }}
                className="group relative w-full md:w-64 bg-accent hover:bg-amber-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-[0.98]"
              >
                <Zap size={22} fill="currentColor" />
                <span>BELI SEKARANG</span>
              </button>

              <button 
                onClick={() => addToCart(product)}
                className="group relative w-full md:w-64 bg-primary hover:bg-blue-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-[0_0_20px_rgba(59,130,246,0.2)] hover:scale-[1.02] active:scale-[0.98]"
              >
                <ShoppingCart size={22} />
                <span>Tambah Ke Keranjang</span>
              </button>
              
              {user?.affiliate_code && (
                <button 
                  onClick={handleAffiliateShare}
                  className="w-full bg-slate-900 border border-slate-700 hover:border-green-500/50 hover:bg-slate-800 text-white py-2 rounded-lg flex items-center justify-center gap-2 transition-all text-sm"
                >
                  {copied ? <Check size={16} className="text-green-500" /> : <LinkIcon size={16} />}
                  <span className={copied ? 'text-green-500' : ''}>
                    {copied ? 'Link Disalin' : 'Salin Link Affiliate'}
                  </span>
                </button>
              )}
            </div>
          </motion.div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Terpercaya</h4>
                <p className="text-slate-500 text-xs text-nowrap">100% Produk Original</p>
              </div>
            </div>
            <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
              <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center text-accent">
                <Zap size={20} />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Instan</h4>
                <p className="text-slate-500 text-xs text-nowrap">Langsung dikirim via email</p>
              </div>
            </div>
            <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
              <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center text-green-500">
                <Download size={20} />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm">Akses Selamanya</h4>
                <p className="text-slate-500 text-xs text-nowrap">Sekali beli akses permanen</p>
              </div>
            </div>
          </div>

          {/* Technical Specs for Source Code */}
          {(product.framework || product.database_tech || product.cms_deployment || product.demo_url || product.support_duration) && (
            <motion.div 
               initial={{ y: 20, opacity: 0 }}
               whileInView={{ y: 0, opacity: 1 }}
               viewport={{ once: true }}
               className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <div className="col-span-1 md:col-span-2 flex items-center gap-4 mt-6 mb-2">
                <h2 className="text-xl font-bold text-white whitespace-nowrap flex items-center gap-2">
                  <Terminal className="text-primary" size={20} /> Spesifikasi Teknis
                </h2>
                <div className="h-px w-full bg-slate-800" />
              </div>
              
              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-4">
                {product.framework && (
                  <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
                    <span className="text-slate-400 text-sm">Framework</span>
                    <span className="text-white font-bold bg-primary/20 px-3 py-1 rounded-lg text-xs leading-none">{product.framework}</span>
                  </div>
                )}
                {product.database_tech && (
                  <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
                    <span className="text-slate-400 text-sm">Database</span>
                    <span className="text-white font-bold bg-slate-700 px-3 py-1 rounded-lg text-xs leading-none">{product.database_tech}</span>
                  </div>
                )}
                {product.cms_deployment && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-sm">Deployment</span>
                    <span className="text-white font-bold text-xs">{product.cms_deployment}</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-800/40 p-5 rounded-2xl border border-slate-700/50 space-y-4">
                {product.support_duration && (
                  <div className="flex justify-between items-center border-b border-slate-700/50 pb-3">
                    <span className="text-slate-400 text-sm">Support</span>
                    <span className="text-green-400 font-bold text-sm leading-none flex items-center gap-1">
                      <ShieldCheck size={14} /> {product.support_duration}
                    </span>
                  </div>
                )}
                {product.demo_url && (
                  <div className="space-y-2 pt-1">
                    <span className="text-slate-400 text-sm block">Live Demo</span>
                    <a 
                      href={product.demo_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all"
                    >
                      <LinkIcon size={14} /> LIHAT DEMO LINK
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Full Description Section */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            whileInView={{ y: 0, opacity: 1 }}
            viewport={{ once: true }}
            className="mt-4"
          >
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold text-white whitespace-nowrap">Deskripsi Produk</h2>
              <div className="h-px w-full bg-slate-800" />
            </div>
            
            <div className="prose prose-invert max-w-none">
              <div className="bg-slate-800/20 p-8 rounded-2xl border border-slate-800/50 leading-relaxed text-slate-300">
                <p className="whitespace-pre-line text-lg leading-relaxed">
                  {product.description}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Social Proof Placeholder */}
          <div className="mt-12 text-center p-12 rounded-3xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
            <h3 className="text-xl font-bold text-white mb-2">Ingin Bertanya Lebih Lanjut?</h3>
            <p className="text-slate-400 mb-6">Hubungi tim support kami melalui WhatsApp untuk konsultasi produk.</p>
            <a 
              href={`https://wa.me/${settings.whatsapp_number}?text=Halo Admin, saya ingin bertanya tentang produk ${product.name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 bg-[#25D366] text-white font-bold rounded-full hover:bg-[#128C7E] transition-colors shadow-lg shadow-green-500/20"
            >
              <MessageCircle size={18} />
              Chat Admin
            </a>
          </div>

        </div>
      </div>
      
      {/* Footer Branding */}
      <div className="mt-20 py-12 border-t border-slate-800 text-center">
        <p className="text-slate-600 text-sm">© 2024 DigitalStorePro. All Rights Reserved.</p>
      </div>
    </motion.div>
  );
};

export default ProductDetail;
