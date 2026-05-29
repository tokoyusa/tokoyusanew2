
export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  role: UserRole;
  affiliate_code?: string;
  referred_by?: string;
  phone?: string;
  balance?: number;
  // User Bank Details for Withdrawal
  bank_name?: string;
  bank_number?: string;
  bank_holder?: string;
}

export interface CommissionLog {
  id: string;
  affiliate_id: string;
  order_id: string;
  amount: number;
  source_buyer: string; // Name of the buyer
  products: string; // Comma separated product names
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  created_at?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  discount_price?: number; // If set, this is the active price
  cost_price?: number; // Harga Modal (COGS)
  category: string; // Keep as string for display
  category_id?: string; // Reference to Category record
  image_url: string;
  file_url: string; // Link to download or access
  is_active: boolean;
  created_at?: string;
  // Specific fields for Source Code category
  framework?: string;
  database_tech?: string;
  cms_deployment?: string;
  demo_url?: string;
  support_duration?: string;
}

export interface Voucher {
  id: string;
  code: string;
  discount_type: 'percentage' | 'nominal';
  discount_value: number;
  product_id?: string;
  is_active: boolean;
  created_at?: string;
}

export interface Order {
  id: string;
  user_id: string;
  total_amount: number; // Final amount paid
  subtotal?: number; // Amount before discount
  discount_amount?: number;
  voucher_code?: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  commission_paid?: boolean; // New field to track if affiliate has been paid
  payment_method: string;
  payment_proof?: string;
  items: OrderItem[];
  buyer_email?: string;
  product_name?: string;
  affiliate_code?: string;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export interface OrderItem {
  id?: string;
  product_id: string;
  product_name: string;
  price: number;
  cost_price?: number; // Stored at time of purchase for accurate profit calc
  file_url?: string; // Stored at time of purchase
  quantity?: number;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  bank_info: string;
  created_at: string;
  updated_at?: string;
  admin_note?: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export interface StoreSettings {
  store_name: string;
  store_description: string;
  whatsapp_number: string;
  email_contact: string;
  address: string;
  tripay_api_key?: string;
  tripay_private_key?: string;
  tripay_merchant_code?: string;
  affiliate_commission_rate?: number; // Percentage (e.g., 10 for 10%)
  bank_accounts: {
    bank: string;
    number: string;
    name: string;
  }[];
  e_wallets: {
    provider: 'DANA' | 'OVO' | 'GOPAY' | 'SHOPEEPAY' | 'LINKAJA';
    number: string;
    name: string;
  }[];
  qris_url?: string; // Generated or uploaded QRIS image URL
  logo_url?: string;
  min_withdrawal?: number;
  pakasir_api_key?: string;
  pakasir_project_slug?: string;
  facebook_pixel_id?: string;
  payment_methods_active?: {
    transfer?: boolean;
    ewallet?: boolean;
    qris?: boolean;
    pakasir?: boolean;
  };
}

export interface CartItem extends Product {
  quantity: number; // usually 1 for digital products
}

// Supabase Local Config
export interface SupabaseConfig {
  url: string;
  anonKey: string;
}
