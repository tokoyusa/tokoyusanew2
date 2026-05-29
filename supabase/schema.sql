-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  role text default 'user',
  full_name text,
  affiliate_code text unique,
  referred_by text,
  phone text,
  balance numeric default 0,
  bank_name text,
  bank_number text,
  bank_holder text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists public.categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  slug text not null unique,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. PRODUCTS TABLE
create table if not exists public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  price numeric not null,
  discount_price numeric,
  cost_price numeric default 0, 
  category text,
  category_id uuid references public.categories(id),
  image_url text,
  file_url text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. VOUCHERS TABLE
create table if not exists public.vouchers (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique,
  discount_type text not null, 
  discount_value numeric not null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. ORDERS TABLE
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id),
  total_amount numeric not null,
  subtotal numeric,
  discount_amount numeric default 0,
  voucher_code text,
  status text default 'pending', 
  commission_paid boolean default false,
  payment_method text,
  payment_proof text,
  items jsonb,
  guest_info jsonb, 
  buyer_email text,
  product_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. COMMISSION HISTORY TABLE
create table if not exists public.commission_history (
  id uuid default uuid_generate_v4() primary key,
  affiliate_id uuid references public.profiles(id),
  order_id uuid references public.orders(id),
  amount numeric not null,
  source_buyer text,
  products text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. WITHDRAWALS TABLE
create table if not exists public.withdrawals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  amount numeric not null,
  bank_info text not null,
  status text default 'pending', 
  admin_note text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 8. SETTINGS TABLE
create table if not exists public.settings (
  key text primary key,
  value jsonb
);

-- 9. SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.vouchers enable row level security;
alter table public.orders enable row level security;
alter table public.commission_history enable row level security;
alter table public.withdrawals enable row level security;
alter table public.settings enable row level security;

-- Policies
-- Categories
drop policy if exists "Categories viewable by all" on public.categories;
create policy "Categories viewable by all" on public.categories for select using (true);

drop policy if exists "Admin manages categories" on public.categories;
create policy "Admin manages categories" on public.categories 
for all to authenticated
using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));
drop policy if exists "Profiles viewable by users" on public.profiles;
create policy "Profiles viewable by users" on public.profiles for select using (true);

drop policy if exists "Profiles updateable by owners" on public.profiles;
create policy "Profiles updateable by owners" on public.profiles for update using (auth.uid() = id);

drop policy if exists "Profiles insertable by auth" on public.profiles;
create policy "Profiles insertable by auth" on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Admins can update all profiles" on public.profiles;
create policy "Admins can update all profiles" on public.profiles for update to authenticated using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Products viewable by all" on public.products;
create policy "Products viewable by all" on public.products for select using (true);

drop policy if exists "Admin manages products" on public.products;
create policy "Admin manages products" on public.products using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Vouchers viewable by all" on public.vouchers;
create policy "Vouchers viewable by all" on public.vouchers for select using (is_active = true);

drop policy if exists "Admin manages vouchers" on public.vouchers;
create policy "Admin manages vouchers" on public.vouchers using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Users view own orders" on public.orders;
create policy "Users view own orders" on public.orders for select using (auth.uid() = user_id);

drop policy if exists "Public can insert orders" on public.orders;
create policy "Public can insert orders" on public.orders for insert with check (true);

drop policy if exists "Admin manages orders" on public.orders;
create policy "Admin manages orders" on public.orders using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Users view own commissions" on public.commission_history;
create policy "Users view own commissions" on public.commission_history for select using (auth.uid() = affiliate_id);

drop policy if exists "Admin manages commissions" on public.commission_history;
create policy "Admin manages commissions" on public.commission_history using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Users view own withdrawals" on public.withdrawals;
create policy "Users view own withdrawals" on public.withdrawals for select using (auth.uid() = user_id);

drop policy if exists "Users can insert withdrawals" on public.withdrawals;
create policy "Users can insert withdrawals" on public.withdrawals for insert with check (auth.uid() = user_id);

drop policy if exists "Admin manages withdrawals" on public.withdrawals;
create policy "Admin manages withdrawals" on public.withdrawals using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "Settings viewable by all" on public.settings;
create policy "Settings viewable by all" on public.settings for select using (true);

drop policy if exists "Admin manages settings" on public.settings;
create policy "Admin manages settings" on public.settings using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 10. FUNCTIONS & TRIGGERS
create or replace function increment_balance(user_id uuid, amount numeric)
returns void as $$
begin
  update public.profiles
  set balance = coalesce(balance, 0) + amount
  where id = user_id;
end;
$$ language plpgsql security definer;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  user_count int;
  target_role text;
  base_code text;
  new_code text;
begin
  -- Search for total profiles to determine if first user
  -- We use security definer to bypass RLS for this count
  select count(*) into user_count from public.profiles;
  
  if user_count = 0 then
    target_role := 'admin';
  else
    target_role := 'user';
  end if;

  -- Generate a base affiliate code
  base_code := upper(regexp_replace(coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), '[^a-zA-Z0-9]', '', 'g'));
  if base_code = '' or base_code is null then
    base_code := 'USER';
  end if;
  base_code := substring(base_code, 1, 8);
  new_code := base_code || floor(random() * 900 + 100)::text;
  
  insert into public.profiles (id, email, full_name, role, affiliate_code)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', target_role, new_code)
  on conflict (id) do update 
  set email = excluded.email,
      full_name = coalesce(public.profiles.full_name, excluded.full_name);
      
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- 11. AUTOMATIC AFFILIATE COMMISSION TRIGGER
create or replace function public.process_affiliate_commission()
returns trigger as $$
declare
  v_user_referred_by text;
  v_user_full_name text;
  v_aff_id uuid;
  v_aff_name text;
  v_rate numeric;
  v_store_settings jsonb;
  v_total_sell_price numeric := 0;
  v_total_cost_price numeric := 0;
  v_discount numeric := 0;
  v_net_profit numeric := 0;
  v_commission numeric := 0;
  v_items_json jsonb;
  v_exists_log boolean;
  v_product_names text;
begin
  -- Trigger berjalan ketika status menjadi 'completed' baik pada INSERT atau UPDATE
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is null or old.status <> 'completed') and not coalesce(new.commission_paid, false) then
    -- Tentukan affiliate_code yang digunakan (Prioritaskan dari kolom order langsung)
    v_user_referred_by := trim(new.affiliate_code);
    
    -- Ambil data profil pembeli jika user_id ada
    if new.user_id is not null then
      select full_name into v_user_full_name
      from public.profiles
      where id = new.user_id;
      
      -- Jika affiliate_code di order kosong, ambil fallback dari profile pembeli
      if v_user_referred_by is null or v_user_referred_by = '' then
        select referred_by into v_user_referred_by
        from public.profiles
        where id = new.user_id;
      end if;
    end if;

    -- Pastikan nama terisi (jika guest, pakai info nama pembeli/email)
    if v_user_full_name is null or v_user_full_name = '' then
      if new.guest_info is not null and new.guest_info->>'name' is not null then
        v_user_full_name := new.guest_info->>'name';
      else
        v_user_full_name := coalesce(new.buyer_email, 'Pembeli');
      end if;
    end if;

    -- Jika kita memiliki kode referral yang tidak kosong
    if v_user_referred_by is not null and v_user_referred_by <> '' then
      -- Cari data id dan nama affiliator berdasarkan affiliate_code
      select id, full_name into v_aff_id, v_aff_name
      from public.profiles
      where upper(affiliate_code) = upper(trim(v_user_referred_by));

      -- KEAMANAN: Memastikan komisi TIDAK masuk ke pembeli itu sendiri (Self-Referral Prevention)
      if v_aff_id is not null and (new.user_id is null or v_aff_id <> new.user_id) then
        -- Ambil Rate Komisi dari pengaturan toko
        select value into v_store_settings
        from public.settings
        where key = 'store_settings';

        v_rate := coalesce((v_store_settings->>'affiliate_commission_rate')::numeric, 0);

        if v_rate > 0 then
          -- Hitung total harga jual & harga modal dari items JSONB
          v_items_json := new.items;
          
          if v_items_json is not null and jsonb_typeof(v_items_json) = 'array' then
            select 
              coalesce(sum((item->>'price')::numeric * coalesce((item->>'quantity')::numeric, 1)), 0),
              coalesce(sum(coalesce((item->>'cost_price')::numeric, 0) * coalesce((item->>'quantity')::numeric, 1)), 0),
              string_agg(item->>'product_name', ', ')
            into v_total_sell_price, v_total_cost_price, v_product_names
            from jsonb_array_elements(v_items_json) as item;
          end if;

          v_discount := coalesce(new.discount_amount, 0);
          v_net_profit := (v_total_sell_price - v_total_cost_price) - v_discount;
          v_commission := case when v_net_profit > 0 then floor(v_net_profit * (v_rate / 100)) else 0 end;

          if v_commission > 0 then
            -- Cek apakah log komisi untuk order_id ini sudah ada
            select exists(
              select 1 from public.commission_history 
              where order_id = new.id
            ) into v_exists_log;

            if not v_exists_log then
              -- Tambah Saldo ke Affiliator
              update public.profiles
              set balance = coalesce(balance, 0) + v_commission
              where id = v_aff_id;

              -- Catat Riwayat Komisi
              insert into public.commission_history (affiliate_id, order_id, amount, source_buyer, products)
              values (
                v_aff_id, 
                new.id, 
                v_commission, 
                v_user_full_name, 
                coalesce(v_product_names, coalesce(new.product_name, 'Produk'))
              );
            end if;
          end if;
        end if;
      end if;
    end if;

    -- Tandai komisi lunas agar tidak diproses berulang kali
    new.commission_paid := true;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Bind trigger ke tabel orders
drop trigger if exists trigger_process_affiliate_commission on public.orders;
create trigger trigger_process_affiliate_commission
  before insert or update on public.orders
  for each row execute procedure public.process_affiliate_commission();

