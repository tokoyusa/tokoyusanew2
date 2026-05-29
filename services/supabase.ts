
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfig } from '../types';
import { safeStorage } from './storage';

const CONFIG_KEY = 'digitalstore_supabase_config';

export const getStoredConfig = (): SupabaseConfig | null => {
  // 1. Check Environment Variables first (For Vercel Production)
  const env = (import.meta as any).env;
  const envUrl = env?.VITE_SUPABASE_URL;
  const envKey = env?.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey && typeof envUrl === 'string' && typeof envKey === 'string' && envUrl.trim() !== '' && envKey.trim() !== '') {
     return { url: envUrl.trim(), anonKey: envKey.trim() };
  }

  // 2. Check Local Storage (For Manual Setup)
  try {
    const stored = safeStorage.getItem(CONFIG_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed.url === 'string' && typeof parsed.anonKey === 'string') {
        return { url: parsed.url.trim(), anonKey: parsed.anonKey.trim() };
      }
    }
  } catch (e) {
    console.error("Failed to parse stored Supabase config:", e);
    try {
      safeStorage.removeItem(CONFIG_KEY);
    } catch (clearErr) {}
  }
  return null;
};

export const saveConfig = (config: SupabaseConfig) => {
  safeStorage.setItem(CONFIG_KEY, JSON.stringify(config));
};

export const resetConfig = () => {
  safeStorage.removeItem(CONFIG_KEY);
};

let supabase: SupabaseClient | null = null;
let currentUrl: string | null = null;
let currentKey: string | null = null;

// Function to initialize or re-initialize the client
export const initSupabase = () => {
  const config = getStoredConfig();
  
  // If the config is the same as already initialized, reuse the instance
  if (supabase && config?.url === currentUrl && config?.anonKey === currentKey) {
    return supabase;
  }

  if (config && config.url && config.anonKey && config.url.trim().startsWith('http')) {
    try {
      currentUrl = config.url;
      currentKey = config.anonKey;
      
      supabase = createClient(config.url, config.anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          storageKey: 'digitalstore_supabase_auth',
          storage: safeStorage,
          debug: false
        },
        global: {
          headers: { 'x-application-name': 'digital-store-pro' }
        },
        db: {
          schema: 'public'
        }
      });
    } catch (e) {
      console.error("Failed to initialize Supabase", e);
      supabase = null;
    }
  } else {
    supabase = null;
    currentUrl = null;
    currentKey = null;
  }
  return supabase;
};

initSupabase();

export const getSupabase = () => {
  if (!supabase) {
    const client = initSupabase();
    if (!client) {
      console.warn("Supabase client is not initialized. Please check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    }
    return client;
  }
  return supabase;
};

export const GUEST_ORDER_MIGRATION_SQL = `ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_info JSONB;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_email TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS affiliate_code TEXT;`;

export const BANK_MIGRATION_SQL = `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bank_holder TEXT;`;

export const HISTORY_MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS commission_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  affiliate_id UUID REFERENCES profiles(id),
  order_id UUID REFERENCES orders(id),
  amount NUMERIC NOT NULL,
  source_buyer TEXT,
  products TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);`;

export const COST_PRICE_MIGRATION_SQL = `ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC DEFAULT 0;`;

export const SOURCE_CODE_MIGRATION_SQL = `ALTER TABLE products ADD COLUMN IF NOT EXISTS framework TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS database_tech TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cms_deployment TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS demo_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS support_duration TEXT;`;

export const WITHDRAWAL_MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending',
  bank_info TEXT,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawals;
CREATE POLICY "Users view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert withdrawals" ON public.withdrawals;
CREATE POLICY "Users can insert withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manages all withdrawals" ON public.withdrawals;
CREATE POLICY "Admin manages all withdrawals" ON public.withdrawals USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
`;

export const VOUCHER_MIGRATION_SQL = `CREATE TABLE IF NOT EXISTS vouchers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL,
  discount_value NUMERIC NOT NULL,
  product_id UUID REFERENCES public.products(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);`;

export const CATEGORY_MIGRATION_SQL = `
-- 1. Pastikan ekstensi UUID tersedia
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Buat tabel categories jika belum ada
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tambahkan kolom relasi ke tabel produk jika belum ada
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') THEN
    ALTER TABLE public.products ADD COLUMN category_id UUID REFERENCES public.categories(id);
  END IF;
END $$;

-- 4. Aktifkan Keamanan Tingkat Baris (RLS)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- 5. Kebijakan: Semua orang bisa melihat kategori aktif
DROP POLICY IF EXISTS "Categories viewable by all" ON public.categories;
CREATE POLICY "Categories viewable by all" ON public.categories FOR SELECT USING (true);

-- 6. Kebijakan: Admin (atau email Anda) bisa melakukan apa saja
DROP POLICY IF EXISTS "Admin manages categories" ON public.categories;
CREATE POLICY "Admin manages categories" ON public.categories 
FOR ALL 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);
`;

export const FIX_AFFILIATE_AND_QRIS_SQL = `-- No specific fix needed if using full schema, but keeping for compatibility
SELECT 1;`;

export const AUTO_COMMISSION_MIGRATION_SQL = `-- AUTOMATISASI KOMISI AFFILIATE (PENTING)
-- 1. Buat fungsi untuk menghitung komisi secara otomatis di database
CREATE OR REPLACE FUNCTION public.process_affiliate_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_user_referred_by TEXT;
  v_user_full_name TEXT;
  v_aff_id UUID;
  v_aff_name TEXT;
  v_rate NUMERIC;
  v_store_settings JSONB;
  v_total_sell_price NUMERIC := 0;
  v_total_cost_price NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_net_profit NUMERIC := 0;
  v_commission NUMERIC := 0;
  v_items_json JSONB;
  v_exists_log BOOLEAN;
  v_product_names TEXT;
BEGIN
  -- Trigger berjalan ketika status menjadi 'completed' baik pada INSERT atau UPDATE
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status <> 'completed') AND NOT COALESCE(NEW.commission_paid, FALSE) THEN
    -- Tentukan affiliate_code yang digunakan (Prioritaskan dari kolom order langsung)
    v_user_referred_by := TRIM(NEW.affiliate_code);
    
    -- Ambil data profil pembeli jika user_id ada
    IF NEW.user_id IS NOT NULL THEN
      SELECT full_name INTO v_user_full_name
      FROM public.profiles
      WHERE id = NEW.user_id;
      
      -- Jika affiliate_code di order kosong, ambil fallback dari profile pembeli
      IF v_user_referred_by IS NULL OR v_user_referred_by = '' THEN
        SELECT referred_by INTO v_user_referred_by
        FROM public.profiles
        WHERE id = NEW.user_id;
      END IF;
    END IF;

    -- Pastikan nama terisi (jika guest, pakai info nama pembeli/email)
    IF v_user_full_name IS NULL OR v_user_full_name = '' THEN
      IF NEW.guest_info IS NOT NULL AND NEW.guest_info->>'name' IS NOT NULL THEN
        v_user_full_name := NEW.guest_info->>'name';
      ELSE
        v_user_full_name := COALESCE(NEW.buyer_email, 'Pembeli');
      END IF;
    END IF;

    -- Jika kita memiliki kode referral yang tidak kosong
    IF v_user_referred_by IS NOT NULL AND v_user_referred_by <> '' THEN
      -- Cari data id dan nama affiliator berdasarkan affiliate_code
      SELECT id, full_name INTO v_aff_id, v_aff_name
      FROM public.profiles
      WHERE UPPER(affiliate_code) = UPPER(TRIM(v_user_referred_by));

      -- KEAMANAN: Memastikan komisi TIDAK masuk ke pembeli itu sendiri (Self-Referral Prevention)
      IF v_aff_id IS NOT NULL AND (NEW.user_id IS NULL OR v_aff_id <> NEW.user_id) THEN
        -- Ambil Rate Komisi dari pengaturan toko
        SELECT value INTO v_store_settings
        FROM public.settings
        WHERE key = 'store_settings';

        v_rate := COALESCE((v_store_settings->>'affiliate_commission_rate')::NUMERIC, 0);

        IF v_rate > 0 THEN
          -- Hitung total harga jual & harga modal dari items JSONB
          v_items_json := NEW.items;
          
          IF v_items_json IS NOT NULL AND jsonb_typeof(v_items_json) = 'array' THEN
            SELECT 
              COALESCE(SUM((item->>'price')::NUMERIC * COALESCE((item->>'quantity')::NUMERIC, 1)), 0),
              COALESCE(SUM(COALESCE((item->>'cost_price')::NUMERIC, 0) * COALESCE((item->>'quantity')::NUMERIC, 1)), 0),
              string_agg(item->>'product_name', ', ')
            INTO v_total_sell_price, v_total_cost_price, v_product_names
            FROM jsonb_array_elements(v_items_json) AS item;
          END IF;

          v_discount := COALESCE(NEW.discount_amount, 0);
          v_net_profit := (v_total_sell_price - v_total_cost_price) - v_discount;
          v_commission := CASE WHEN v_net_profit > 0 THEN FLOOR(v_net_profit * (v_rate / 100)) ELSE 0 END;

          IF v_commission > 0 THEN
            -- Cek apakah log komisi untuk order_id ini sudah ada
            SELECT EXISTS(
              SELECT 1 FROM public.commission_history 
              WHERE order_id = NEW.id
            ) INTO v_exists_log;

            IF NOT v_exists_log THEN
              -- Tambah Saldo ke Affiliator
              UPDATE public.profiles
              SET balance = COALESCE(balance, 0) + v_commission
              WHERE id = v_aff_id;

              -- Catat Riwayat Komisi
              INSERT INTO public.commission_history (affiliate_id, order_id, amount, source_buyer, products)
              VALUES (
                v_aff_id, 
                NEW.id, 
                v_commission, 
                v_user_full_name, 
                COALESCE(v_product_names, COALESCE(NEW.product_name, 'Produk'))
              );
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;

    -- Tandai komisi lunas agar tidak diproses berulang kali
    NEW.commission_paid := TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind trigger ke tabel orders
DROP TRIGGER IF EXISTS trigger_process_affiliate_commission ON public.orders;
CREATE TRIGGER trigger_process_affiliate_commission
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.process_affiliate_commission();
`;

export const FULL_SQL_SCHEMA = `
-- ==============================================================================
--         FULL SQL SCHEMA FOR DIGITAL STORE PRO & AFFILIATE PORTAL
-- ==============================================================================
-- Target Platform: Supabase PostgreSQL (Database SQL Editor)
-- Description: Unifies core ecommerce variables, digital products, 
--              affiliate profiles, vouchers, order systems, withdrawal logs,
--              realtime triggers, indexing, RLS, and referential cascades.
-- ==============================================================================

-- 1. EXTENSIONS SETUP
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. CORE TABLE DEFINITIONS

-- Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users NOT NULL PRIMARY KEY,
  email TEXT,
  role TEXT DEFAULT 'user', -- Options: 'user', 'admin'
  full_name TEXT,
  affiliate_code TEXT UNIQUE,
  referred_by TEXT, -- Stores the affiliate_code of referring user
  phone TEXT,
  balance NUMERIC DEFAULT 0 NOT NULL, -- Commission earnings balance
  bank_name TEXT,
  bank_number TEXT,
  bank_holder TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Categories Table (Ecommerce grouping)
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Products Table (Digital downloadable items)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  discount_price NUMERIC,
  cost_price NUMERIC DEFAULT 0 NOT NULL,
  category TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  image_url TEXT,
  file_url TEXT,
  framework TEXT,
  database_tech TEXT,
  cms_deployment TEXT,
  demo_url TEXT,
  support_duration TEXT,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Vouchers Table (Promo and discount codes)
CREATE TABLE IF NOT EXISTS public.vouchers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL, -- Options: 'fixed', 'percentage'
  discount_value NUMERIC NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Orders Table (Checkout receipts)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  total_amount NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  discount_amount NUMERIC DEFAULT 0 NOT NULL,
  voucher_code TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  commission_paid BOOLEAN DEFAULT false NOT NULL,
  payment_method TEXT NOT NULL,
  payment_proof TEXT,
  items JSONB NOT NULL,
  guest_info JSONB,
  buyer_email TEXT,
  product_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Commission History Table (Affiliate ledger)
CREATE TABLE IF NOT EXISTS public.commission_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  affiliate_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  source_buyer TEXT,
  products TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Withdrawals Table (Payout disbursement log)
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  bank_info TEXT,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Settings Table (Global app parameter store)
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- 3. COLUMN UPDATES (Safely ensure columns exist for existing databases)
DO $$ 
BEGIN 
  -- Profiles
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='bank_name') THEN
    ALTER TABLE public.profiles ADD COLUMN bank_name TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='bank_number') THEN
    ALTER TABLE public.profiles ADD COLUMN bank_number TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='bank_holder') THEN
    ALTER TABLE public.profiles ADD COLUMN bank_holder TEXT;
  END IF;

  -- Products
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='cost_price') THEN
    ALTER TABLE public.products ADD COLUMN cost_price NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='category_id') THEN
    ALTER TABLE public.products ADD COLUMN category_id UUID REFERENCES public.categories(id);
  END IF;
  
  -- Source Code Fields
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='framework') THEN
    ALTER TABLE public.products ADD COLUMN framework TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='database_tech') THEN
    ALTER TABLE public.products ADD COLUMN database_tech TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='cms_deployment') THEN
    ALTER TABLE public.products ADD COLUMN cms_deployment TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='demo_url') THEN
    ALTER TABLE public.products ADD COLUMN demo_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='support_duration') THEN
    ALTER TABLE public.products ADD COLUMN support_duration TEXT;
  END IF;

  -- Orders
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='guest_info') THEN
    ALTER TABLE public.orders ADD COLUMN guest_info JSONB;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='subtotal') THEN
    ALTER TABLE public.orders ADD COLUMN subtotal NUMERIC;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='discount_amount') THEN
    ALTER TABLE public.orders ADD COLUMN discount_amount NUMERIC DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='buyer_email') THEN
    ALTER TABLE public.orders ADD COLUMN buyer_email TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='product_name') THEN
    ALTER TABLE public.orders ADD COLUMN product_name TEXT;
  END IF;

  -- Vouchers
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='vouchers' AND column_name='product_id') THEN
    ALTER TABLE public.vouchers ADD COLUMN product_id UUID REFERENCES public.products(id);
  END IF;
END $$;

-- 4. PERFORMANCE-OPTIMIZING INDEXES
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON public.vouchers(code);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_affiliate_id ON public.commission_history(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);

-- 5. ROW LEVEL SECURITY (RLS) CONTROL
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- 6. ACCESS MANAGEMENT POLICIES

-- Profiles
DROP POLICY IF EXISTS "Profiles viewable by users" ON public.profiles;
CREATE POLICY "Profiles viewable by users" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Profiles updateable by owners" ON public.profiles;
CREATE POLICY "Profiles updateable by owners" ON public.profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "Profiles insertable by auth" ON public.profiles;
CREATE POLICY "Profiles insertable by auth" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Categories
DROP POLICY IF EXISTS "Categories viewable by all" ON public.categories;
CREATE POLICY "Categories viewable by all" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manages categories" ON public.categories;
CREATE POLICY "Admin manages categories" ON public.categories 
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Products
DROP POLICY IF EXISTS "Products viewable by all" ON public.products;
CREATE POLICY "Products viewable by all" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manages products" ON public.products;
CREATE POLICY "Admin manages products" ON public.products FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admin deletes products" ON public.products;
CREATE POLICY "Admin deletes products" ON public.products FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Vouchers
DROP POLICY IF EXISTS "Vouchers viewable by all" ON public.vouchers;
CREATE POLICY "Vouchers viewable by all" ON public.vouchers FOR SELECT USING (is_active = true);
DROP POLICY IF EXISTS "Admin manages vouchers" ON public.vouchers;
CREATE POLICY "Admin manages vouchers" ON public.vouchers FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Admin deletes vouchers" ON public.vouchers;
CREATE POLICY "Admin deletes vouchers" ON public.vouchers FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Orders
DROP POLICY IF EXISTS "Users view own orders" ON public.orders;
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
DROP POLICY IF EXISTS "Public can insert orders" ON public.orders;
CREATE POLICY "Public can insert orders" ON public.orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Admin manages orders" ON public.orders;
CREATE POLICY "Admin manages orders" ON public.orders FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Commission History
DROP POLICY IF EXISTS "Users view own commissions" ON public.commission_history;
CREATE POLICY "Users view own commissions" ON public.commission_history FOR SELECT USING (auth.uid() = affiliate_id);
DROP POLICY IF EXISTS "Admin manages commissions" ON public.commission_history;
CREATE POLICY "Admin manages commissions" ON public.commission_history USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Withdrawals
DROP POLICY IF EXISTS "Users view own withdrawals" ON public.withdrawals;
CREATE POLICY "Users view own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert withdrawals" ON public.withdrawals;
CREATE POLICY "Users insert withdrawals" ON public.withdrawals FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admin manages withdrawals" ON public.withdrawals;
CREATE POLICY "Admin manages withdrawals" ON public.withdrawals USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Settings
DROP POLICY IF EXISTS "Settings viewable by all" ON public.settings;
CREATE POLICY "Settings viewable by all" ON public.settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manages settings" ON public.settings;
CREATE POLICY "Admin manages settings" ON public.settings USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 7. DYNAMIC AUTOMATION TRIGGERS & PROCEDURES

-- Safe Affiliate Balance Incrementation
CREATE OR REPLACE FUNCTION public.increment_balance(user_id UUID, amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles
  SET balance = COALESCE(balance, 0) + amount
  WHERE id = user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Profile Auto-Creation upon Auth Signup (with Auto First-User Admin role assignment)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_count INT;
  target_role TEXT;
  base_code TEXT;
  new_code TEXT;
BEGIN
  -- Compute existing count to flag first user as Admin automatically
  SELECT count(*) INTO user_count FROM public.profiles;
  
  IF user_count = 0 THEN
    target_role := 'admin';
  ELSE
    target_role := 'user';
  END IF;

  -- Generate readable referral tracking key
  base_code := UPPER(REGEXP_REPLACE(COALESCE(new.raw_user_meta_data->>'full_name', SPLIT_PART(new.email, '@', 1)), '[^a-zA-Z0-9]', '', 'g'));
  IF base_code = '' OR base_code IS NULL THEN
    base_code := 'USER';
  END IF;
  base_code := SUBSTRING(base_code, 1, 8);
  new_code := base_code || FLOOR(RANDOM() * 900 + 100)::TEXT;

  INSERT INTO public.profiles (id, email, full_name, role, affiliate_code)
  VALUES (
    new.id, 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'full_name', SPLIT_PART(new.email, '@', 1)), 
    target_role,
    new_code
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind User Registration Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 8. INITIAL BOOTSTRAP DATA (STORE CONFIGURATION)
INSERT INTO public.settings (key, value)
VALUES ('store_settings', '{
  "store_name": "Digital Store Pro",
  "store_description": "Exclusive Source Codes & Premium Digital Assets",
  "whatsapp_number": "628",
  "logo_url": "",
  "affiliate_commission_rate": 10,
  "min_withdrawal": 50000,
  "bank_accounts": [],
  "e_wallets": [],
  "payment_methods_active": {
    "transfer": true,
    "ewallet": true,
    "qris": true,
    "pakasir": true
  }
}')
ON CONFLICT (key) DO NOTHING;

-- 9. REFERENTIAL DELETION STRATEGIES (SAFETY NET FOR RELATIONSHIPS)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Reset product references to prevent blocking category deletions
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'products' 
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%category%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.products DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;

    -- Reset voucher references to prevent blocking product deletions
    FOR r IN (
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_schema = 'public' 
          AND table_name = 'vouchers' 
          AND constraint_type = 'FOREIGN KEY'
          AND constraint_name LIKE '%product%'
    ) LOOP
        EXECUTE 'ALTER TABLE public.vouchers DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE public.products 
  ADD CONSTRAINT fk_products_category_id 
  FOREIGN KEY (category_id) 
  REFERENCES public.categories(id) 
  ON DELETE SET NULL;

ALTER TABLE public.vouchers 
  ADD CONSTRAINT fk_vouchers_product_id 
  FOREIGN KEY (product_id) 
  REFERENCES public.products(id) 
  ON DELETE SET NULL;


-- ==============================================================================
--         AUTOMATIC AFFILIATE COMMISSION TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_affiliate_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_user_referred_by TEXT;
  v_user_full_name TEXT;
  v_aff_id UUID;
  v_aff_name TEXT;
  v_rate NUMERIC;
  v_store_settings JSONB;
  v_total_sell_price NUMERIC := 0;
  v_total_cost_price NUMERIC := 0;
  v_discount NUMERIC := 0;
  v_net_profit NUMERIC := 0;
  v_commission NUMERIC := 0;
  v_items_json JSONB;
  v_exists_log BOOLEAN;
  v_product_names TEXT;
BEGIN
  -- Trigger berjalan ketika status menjadi 'completed' baik pada INSERT atau UPDATE
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS NULL OR OLD.status <> 'completed') AND NOT COALESCE(NEW.commission_paid, FALSE) THEN
    -- Tentukan affiliate_code yang digunakan (Prioritaskan dari kolom order langsung)
    v_user_referred_by := TRIM(NEW.affiliate_code);
    
    -- Ambil data profil pembeli jika user_id ada
    IF NEW.user_id IS NOT NULL THEN
      SELECT full_name INTO v_user_full_name
      FROM public.profiles
      WHERE id = NEW.user_id;
      
      -- Jika affiliate_code di order kosong, ambil fallback dari profile pembeli
      IF v_user_referred_by IS NULL OR v_user_referred_by = '' THEN
        SELECT referred_by INTO v_user_referred_by
        FROM public.profiles
        WHERE id = NEW.user_id;
      END IF;
    END IF;

    -- Pastikan nama terisi (jika guest, pakai info nama pembeli/email)
    IF v_user_full_name IS NULL OR v_user_full_name = '' THEN
      IF NEW.guest_info IS NOT NULL AND NEW.guest_info->>'name' IS NOT NULL THEN
        v_user_full_name := NEW.guest_info->>'name';
      ELSE
        v_user_full_name := COALESCE(NEW.buyer_email, 'Pembeli');
      END IF;
    END IF;

    -- Jika kita memiliki kode referral yang tidak kosong
    IF v_user_referred_by IS NOT NULL AND v_user_referred_by <> '' THEN
      -- Cari data id dan nama affiliator berdasarkan affiliate_code
      SELECT id, full_name INTO v_aff_id, v_aff_name
      FROM public.profiles
      WHERE UPPER(affiliate_code) = UPPER(TRIM(v_user_referred_by));

      -- KEAMANAN: Memastikan komisi TIDAK masuk ke pembeli itu sendiri (Self-Referral Prevention)
      IF v_aff_id IS NOT NULL AND (NEW.user_id IS NULL OR v_aff_id <> NEW.user_id) THEN
        -- Ambil Rate Komisi dari pengaturan toko
        SELECT value INTO v_store_settings
        FROM public.settings
        WHERE key = 'store_settings';

        v_rate := COALESCE((v_store_settings->>'affiliate_commission_rate')::NUMERIC, 0);

        IF v_rate > 0 THEN
          -- Hitung total harga jual & harga modal dari items JSONB
          v_items_json := NEW.items;
          
          IF v_items_json IS NOT NULL AND jsonb_typeof(v_items_json) = 'array' THEN
            SELECT 
              COALESCE(SUM((item->>'price')::NUMERIC * COALESCE((item->>'quantity')::NUMERIC, 1)), 0),
              COALESCE(SUM(COALESCE((item->>'cost_price')::NUMERIC, 0) * COALESCE((item->>'quantity')::NUMERIC, 1)), 0),
              string_agg(item->>'product_name', ', ')
            INTO v_total_sell_price, v_total_cost_price, v_product_names
            FROM jsonb_array_elements(v_items_json) AS item;
          END IF;

          v_discount := COALESCE(NEW.discount_amount, 0);
          v_net_profit := (v_total_sell_price - v_total_cost_price) - v_discount;
          v_commission := CASE WHEN v_net_profit > 0 THEN FLOOR(v_net_profit * (v_rate / 100)) ELSE 0 END;

          IF v_commission > 0 THEN
            -- Cek apakah log komisi untuk order_id ini sudah ada
            SELECT EXISTS(
              SELECT 1 FROM public.commission_history 
              WHERE order_id = NEW.id
            ) INTO v_exists_log;

            IF NOT v_exists_log THEN
              -- Tambah Saldo ke Affiliator
              UPDATE public.profiles
              SET balance = COALESCE(balance, 0) + v_commission
              WHERE id = v_aff_id;

              -- Catat Riwayat Komisi
              INSERT INTO public.commission_history (affiliate_id, order_id, amount, source_buyer, products)
              VALUES (
                v_aff_id, 
                NEW.id, 
                v_commission, 
                v_user_full_name, 
                COALESCE(v_product_names, COALESCE(NEW.product_name, 'Produk'))
              );
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;

    -- Tandai komisi lunas agar tidak diproses berulang kali
    NEW.commission_paid := TRUE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger ke tabel orders
DROP TRIGGER IF EXISTS trigger_process_affiliate_commission ON public.orders;
CREATE TRIGGER trigger_process_affiliate_commission
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE public.process_affiliate_commission();
`;;

/**
 * SQL SCHEMA Alias for compatibility
 */
export const SQL_SCHEMA = FULL_SQL_SCHEMA;
