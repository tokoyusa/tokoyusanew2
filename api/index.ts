import express from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

dotenv.config();

// Lazily initialize Supabase Admin client
let supabaseAdminClient: any = null;
function getSupabaseAdmin() {
  if (!supabaseAdminClient) {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      console.error('SUPABASE_URL:', url ? 'Defined' : 'UNDEFINED');
      console.error('SUPABASE_KEY:', key ? 'Defined' : 'UNDEFINED');
      throw new Error('Supabase configuration missing (VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE)');
    }
    supabaseAdminClient = createClient(url, key);
  }
  return supabaseAdminClient;
}

// Helper to get Pakasir config from Database
async function getPakasirConfig() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'store_settings')
    .single();

  if (error || !data) {
    console.error('Failed to fetch store settings for Pakasir:', error);
    return { project: null, api_key: null };
  }

  return {
    project: data.value.pakasir_project_slug,
    api_key: data.value.pakasir_api_key
  };
}

async function createServer() {
  const app = express();
  app.use(express.json());

  // API Health Check
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      env: process.env.VERCEL ? 'vercel' : 'local'
    });
  });

  // --- Pakasir Payment Integration ---
  app.post('/api/create-pakasir-transaction', async (req, res) => {
    try {
      const { method, order_id, amount } = req.body;
      
      if (!method) {
        return res.status(400).json({ error: 'Payment method is required' });
      }

      console.log('Backend: Creating Pakasir Transaction...', { order_id, amount, method });

      const { project, api_key } = await getPakasirConfig();

      if (!project || !api_key) {
        return res.status(400).json({ 
          error: 'Konfigurasi Pakasir belum lengkap.', 
          message: 'Silakan isi Project Slug dan API Key di Panel Admin > Pengaturan.' 
        });
      }

      console.log(`Calling Pakasir API for project: ${project}`);
      const response = await axios.post(`https://app.pakasir.com/api/transactioncreate/${method}`, {
        project,
        order_id,
        amount: Math.round(amount),
        api_key
      });

      console.log('Pakasir API Response Success');
      res.json(response.data);
    } catch (error: any) {
      console.error('Pakasir Route Error:', error.response?.data || error.message);
      res.status(500).json({ 
        error: 'Gagal membuat transaksi otomatis', 
        details: error.response?.data || error.message,
        hint: 'Periksa log di Vercel Dashboard untuk detail lebih lanjut.'
      });
    }
  });

  app.post('/api/webhook/pakasir', async (req, res) => {
    const { amount, order_id, status, project: webhookProject } = req.body;
    console.log(`Received Pakasir Webhook: Order ${order_id}, Status ${status}`);
    
    const { project } = await getPakasirConfig();

    // Verify project slug to prevent unauthorized webhooks (basic check)
    if (webhookProject !== project) {
      console.warn(`Webhook project mismatch: received ${webhookProject}, expected ${project}`);
      return res.status(403).json({ error: 'Unauthorized project slug' });
    }

    if (status === 'completed') {
      try {
        const supabase = getSupabaseAdmin();
        const { data: order, error: fetchError } = await supabase
          .from('orders')
          .select('id, total_amount')
          .eq('id', order_id)
          .single();

        if (fetchError || !order) {
           console.error('Order not found for webhook:', order_id);
           return res.status(404).json({ error: 'Order not found' });
        }

        const { error: updateError } = await supabase
          .from('orders')
          .update({ status: 'completed' })
          .eq('id', order_id);
        
        if (updateError) {
          console.error('Supabase update error:', updateError);
          return res.status(500).json({ error: 'Failed to update order' });
        }
        
        console.log(`Order ${order_id} marked as completed via webhook.`);
      } catch (err) {
        console.error('Webhook processing error:', err);
        return res.status(500).json({ error: 'Internal error' });
      }
    }
    
    res.json({ status: 'ok' });
  });

  app.get('/api/pakasir-transaction/:order_id', async (req, res) => {
    const { order_id } = req.params;
    const { amount } = req.query; 
    const { project: slug, api_key } = await getPakasirConfig();

    if (!slug || !api_key) {
      return res.status(500).json({ error: 'Configuration missing' });
    }

    try {
      const response = await axios.get(`https://app.pakasir.com/api/transactiondetail?project=${slug}&amount=${amount}&order_id=${order_id}&api_key=${api_key}`);
      const data = response.data;

      // BACKUP: If polling shows completed, update DB immediately from server
      if (data.transaction && data.transaction.status === 'completed') {
        const supabase = getSupabaseAdmin();
        await supabase.from('orders').update({ status: 'completed' }).eq('id', order_id);
        console.log(`Order ${order_id} marked as completed via server-side polling.`);
      }

      res.json(data);
    } catch (error: any) {
      console.error('Pakasir Detail Error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch transaction detail' });
    }
  });

  // --- Dynamic Manifest and Store Info ---
  app.get('/manifest.json', async (req, res) => {
    try {
      const supabase = getSupabaseAdmin();
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'store_settings')
        .single();
      
      if (error) {
        console.error('Manifest DB Fetch Error:', error);
      }

      const settings = data?.value || {};
      const storeName = settings.store_name || "Digital Store";
      const shortName = settings.store_name ? settings.store_name.substring(0, 12).trim() : "Store";
      const iconPath = "/logo.png";
      
      const manifest = {
        id: "/",
        name: storeName,
        short_name: shortName,
        description: settings.store_description || "Premium Digital Product Store",
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#3b82f6",
        orientation: "portrait",
        icons: [
          {
            src: iconPath,
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: iconPath,
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: iconPath,
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: iconPath,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      };
      
      res.header('Content-Type', 'application/manifest+json; charset=utf-8');
      res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(JSON.stringify(manifest));
    } catch (error) {
      console.error('Manifest generation critical error:', error);
      const defaultManifest = {
        name: "Digital Store",
        short_name: "Store",
        description: "Premium Digital Product Store",
        start_url: "/",
        display: "standalone",
        background_color: "#0f172a",
        theme_color: "#3b82f6",
        icons: [
          {
            src: "https://cdn-icons-png.flaticon.com/512/3081/3081559.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          }
        ]
      };
      res.header('Content-Type', 'application/manifest+json; charset=utf-8');
      res.send(JSON.stringify(defaultManifest));
    }
  });

  const serveIcon = async (req: express.Request, res: express.Response) => {
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'store_settings')
        .single();
      
      const settings = data?.value || {};
      const iconData = settings.logo_url;
      
      if (iconData) {
        if (iconData.startsWith('data:image')) {
          const base64Data = iconData.split(',')[1];
          const img = Buffer.from(base64Data, 'base64');
          res.writeHead(200, {
            'Content-Type': 'image/png',
            'Content-Length': img.length,
            'Cache-Control': 'public, max-age=31536000'
          });
          return res.end(img);
        }
        return res.redirect(iconData);
      }
    } catch (e) {
      console.error('Icon serving error:', e);
    }
    res.redirect('https://cdn-icons-png.flaticon.com/512/3081/3081559.png');
  };

  app.get('/favicon.ico', serveIcon);
  app.get('/logo.png', serveIcon);
  app.get('/icon.png', serveIcon);

  app.post('/api/admin/delete-category', async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Sesi kedaluwarsa atau tidak valid.' });
      }
      
      const token = authHeader.substring(7);
      const supabase = getSupabaseAdmin();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Sesi admin tidak valid.' });
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak. Anda bukan Admin.' });
      }

      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID harus ditentukan.' });

      // Explicitly set matching products category_id to NULL first to prevent foreign key errors
      await supabase.from('products').update({ category_id: null }).eq('category_id', id);
      
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;

      res.json({ success: true, message: 'Kategori berhasil dihapus.' });
    } catch (error: any) {
      console.error('Failed to delete category via API:', error);
      res.status(500).json({ error: 'Gagal menghapus kategori: ' + error.message });
    }
  });

  app.post('/api/admin/delete-product', async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Sesi kedaluwarsa atau tidak valid.' });
      }
      
      const token = authHeader.substring(7);
      const supabase = getSupabaseAdmin();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Sesi admin tidak valid.' });
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak. Anda bukan Admin.' });
      }

      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID harus ditentukan.' });

      // Explicitly set matching vouchers product_id to NULL first to prevent foreign key errors
      await supabase.from('vouchers').update({ product_id: null }).eq('product_id', id);
      
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;

      res.json({ success: true, message: 'Produk berhasil dihapus.' });
    } catch (error: any) {
      console.error('Failed to delete product via API:', error);
      res.status(500).json({ error: 'Gagal menghapus produk: ' + error.message });
    }
  });

  app.post('/api/admin/delete-voucher', async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Sesi kedaluwarsa atau tidak valid.' });
      }
      
      const token = authHeader.substring(7);
      const supabase = getSupabaseAdmin();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Sesi admin tidak valid.' });
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile || profile.role !== 'admin') {
        return res.status(403).json({ error: 'Akses ditolak. Anda bukan Admin.' });
      }

      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID harus ditentukan.' });

      const { error } = await supabase.from('vouchers').delete().eq('id', id);
      if (error) throw error;

      res.json({ success: true, message: 'Voucher berhasil dihapus.' });
    } catch (error: any) {
      console.error('Failed to delete voucher via API:', error);
      res.status(500).json({ error: 'Gagal menghapus voucher: ' + error.message });
    }
  });

  app.post('/api/pakasir/disburse', async (req, res) => {
    const { amount, bank_info, id } = req.body;
    const { project, api_key } = await getPakasirConfig();

    if (!project || !api_key) {
      return res.status(500).json({ error: 'Konfigurasi Pakasir belum lengkap di Admin Panel.' });
    }

    try {
      res.status(501).json({ 
        error: 'Pencairan Otomatis via Pakasir',
        message: 'Fitur ini memerlukan API Disbursement dari Pakasir. Pastikan Akun Pakasir Anda mendukung "Disbursement" dan hubungi Admin Pakasir untuk detail endpoint-nya.'
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Safe client-side log proxy to capture console errors, warnings, and unhandled rejections on user's browser
  app.post('/api/log', (req, res) => {
    try {
      const { type, message, stack, url, userAgent } = req.body;
      const logLine = `[BROWSER LOG] [${new Date().toISOString()}] [${(type || 'LOG').toUpperCase()}] ${message}${stack ? '\nStack: ' + stack : ''} (URL: ${url}, UA: ${userAgent})\n`;
      fs.appendFileSync(path.join(process.cwd(), 'server.log'), logLine, 'utf-8');
      console.log(logLine.trim());
      res.sendStatus(200);
    } catch (err) {
      res.sendStatus(500);
    }
  });

  // Vite middleware for development (ONLY)
  const isProdBuild = process.env.NODE_ENV === 'production' && fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'));
  
  if (!isProdBuild && !process.env.VERCEL) {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware...");
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Fallback catch-all to serve index.html transformed by Vite in development!
    app.get('*all', async (req, res, next) => {
      const url = req.originalUrl;
      if (url.startsWith('/api/')) {
        return next();
      }
      try {
        const indexHtmlPath = path.join(process.cwd(), 'index.html');
        if (fs.existsSync(indexHtmlPath)) {
          let html = fs.readFileSync(indexHtmlPath, 'utf-8');
          html = await vite.transformIndexHtml(url, html);
          res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
        } else {
          res.status(404).send('index.html not found in workspace root');
        }
      } catch (err: any) {
        vite.ssrFixStacktrace(err);
        console.error('Error transforming index.html with Vite:', err);
        res.status(500).send(err.message);
      }
    });

  } else if (!process.env.VERCEL) {
    console.log("Starting server in PRODUCTION mode with Static Assets...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

const appPromise = createServer();

// Startup logic for Local and Cloud Run
if (!process.env.VERCEL) {
  const PORT = 3000;
  appPromise.then(app => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running at http://0.0.0.0:${PORT} (ENV: ${process.env.NODE_ENV})`);
    });
  }).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

// Vercel Serverless Function Handler
export default async (req: any, res: any) => {
  try {
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const app = await appPromise;
    return app(req, res);
  } catch (error: any) {
    console.error('Vercel Critical Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Backend Failure', 
        message: error.message,
        path: req.url
      });
    }
  }
};
