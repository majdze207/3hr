const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = 'syriastore-secret-2024-change-me';
const ADMIN_EMAILS = ['admin@syriastore.com'];

const db = new Database('syriastore.db');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ==================== الجداول ====================
db.exec(`
CREATE TABLE IF NOT EXISTS countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL,
  flag_emoji TEXT,
  delivery_weeks_min INTEGER DEFAULT 3,
  delivery_weeks_max INTEGER DEFAULT 6,
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  name TEXT DEFAULT '',
  password_hash TEXT NOT NULL,
  banned INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  price_usd REAL NOT NULL,
  shipping_fee_usd REAL DEFAULT 0,
  image_url TEXT DEFAULT '',
  stock INTEGER DEFAULT 0,
  country_id INTEGER NOT NULL,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  user_id INTEGER,
  user_name TEXT NOT NULL,
  rating INTEGER NOT NULL,
  comment TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_name TEXT,
  country_id INTEGER,
  country_name TEXT,
  items_json TEXT NOT NULL,
  total_usd REAL NOT NULL,
  wallet_address TEXT,
  tx_ref TEXT,
  status TEXT DEFAULT 'awaiting_confirmation',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_name TEXT,
  message TEXT NOT NULL,
  reply TEXT,
  status TEXT DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  replied_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

// ==================== البذور (Seed) ====================
function seed() {
  // الإعدادات
  const setSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  setSetting.run('usdt_wallet_address', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0');
  setSetting.run('network', 'BEP20');
  setSetting.run('announcement', 'مرحباً بكم في سورياستور — شحن من 3 إلى 6 أسابيع 🚚');

  // الأدمن
  const adminExists = db.prepare('SELECT id FROM accounts WHERE email = ?').get('admin@syriastore.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO accounts (email, phone, name, password_hash, is_admin) VALUES (?, ?, ?, ?, 1)')
      .run('admin@syriastore.com', '0900000000', 'المدير', hash);
    console.log('✅ حساب الأدمن: admin@syriastore.com / admin123');
  }

  // الدول
  const cCount = db.prepare('SELECT COUNT(*) c FROM countries').get().c;
  if (cCount === 0) {
    const ins = db.prepare('INSERT INTO countries (name_ar, name_en, flag_emoji, delivery_weeks_min, delivery_weeks_max, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
    ins.run('السعودية', 'Saudi Arabia', '🇸🇦', 3, 5, 1);
    ins.run('الإمارات', 'UAE', '🇦🇪', 2, 4, 2);
    ins.run('ألمانيا', 'Germany', '🇩🇪', 4, 6, 3);
    ins.run('أمريكا', 'USA', '🇺🇸', 4, 6, 4);
  }

  // المنتجات
  const pCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (pCount === 0) {
    const sa = db.prepare('SELECT id FROM countries WHERE name_en = ?').get('Saudi Arabia').id;
    const ae = db.prepare('SELECT id FROM countries WHERE name_en = ?').get('UAE').id;
    const de = db.prepare('SELECT id FROM countries WHERE name_en = ?').get('Germany').id;
    const us = db.prepare('SELECT id FROM countries WHERE name_en = ?').get('USA').id;

    const ins = db.prepare('INSERT INTO products (title, description, notes, price_usd, shipping_fee_usd, image_url, stock, country_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    ins.run('سامسونج جالاكسي S24 ألترا',
      'هاتف ذكي بشاشة 6.8 بوصة، معالج Snapdragon 8 Gen 3، كاميرا 200 ميجابكسل، بطارية 5000 مللي أمبير.',
      'المنتج أصلي بضمان دولي لمدة سنة.',
      1350, 25,
      'https://images.unsplash.com/photo-1610945265064-0e34e5519bbf?w=600',
      15, sa);

    ins.run('سماعات أبل إيربودز برو 2',
      'سماعات لاسلكية بعزل ضوضاء نشط، صوت مكاني، عمر بطارية 6 ساعات + 30 ساعة مع العلبة.',
      'تشمل الشاحن MagSafe الأصلي.',
      229, 15,
      'https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=600',
      28, sa);

    ins.run('ماك بوك إير M3',
      'لابتوب بشاشة 13.6 بوصة، معالج Apple M3، ذاكرة 16GB، تخزين 512GB SSD، وزن خفيف 1.24 كجم.',
      'يأتي بنظام macOS Sonoma وأصلي مغلق.',
      1299, 30,
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600',
      8, ae);

    ins.run('ساعة أبل واتش سيريس 9',
      'ساعة ذكية بشاشة Retina دائمة العرض، قياس الأكسجين في الدم، تخطيط القلب ECG.',
      'متوفرة بمقاسين 41mm و45mm.',
      419, 12,
      'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600',
      22, ae);

    ins.run('كاميرا كانون EOS R6 Mark II',
      'كاميرا احترافية بدون مرآة بدقة 24.2 ميجابكسل، تصوير فيديو 4K 60fps، تركيز تلقائي متقدم.',
      'تشمل العدسة RF 24-105mm f/4L IS USM.',
      2799, 45,
      'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=600',
      5, de);

    ins.run('مكنسة روبوت شاومي X10+',
      'مكنسة روبوت ذاتية الشحن، شفط بقوة 4000Pa، رادار LDS لتخطيط المنزل، تعمل بالتطبيق.',
      'تشمل قاعدة تفريغ ذاتي.',
      649, 35,
      'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=600',
      12, de);

    ins.run('آيفون 15 برو ماكس 256GB',
      'هاتف بمعالج A17 Pro، هيكل تيتانيوم، كاميرا 48MP، شاشة Super Retina XDR 6.7 بوصة.',
      'يأتي مغلق بضمان أبل الدولي.',
      1199, 28,
      'https://images.unsplash.com/photo-1592286927505-1def25115558?w=600',
      18, us);

    ins.run('مقلاة هوائية فيليبس XXL',
      'مقلاة هوائية بسعة 7.3 لتر، تقنية Rapid Air، 7 برامج طبخ مسبقة، شاشة رقمية.',
      'قوة 2225 واط - ضمان سنة.',
      299, 22,
      'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600',
      30, us);
  }

  // التقييمات
  const rCount = db.prepare('SELECT COUNT(*) c FROM reviews').get().c;
  if (rCount === 0) {
    const products = db.prepare('SELECT id FROM products').all();
    const samples = [
      ['أ. محمد', 5, 'منتج ممتاز وصل بأسرع من المتوقع، أنصح به بشدة.'],
      ['س***م', 4, 'جودة عالية لكن التغليف كان بسيطاً.'],
      ['ر***ة', 5, 'تجربة شراء رائعة، المنتج مطابق للوصف تماماً.'],
      ['خ***ر', 4, 'سعر مناسب مقارنة بالسوق المحلي.'],
      ['ن***ل', 5, 'وصلني بحالة ممتازة، شكراً للفريق.'],
      ['ح***ن', 3, 'المنتج جيد لكن تأخر الشحن قليلاً.'],
      ['ل***ى', 5, 'أفضل متجر تعاملت معه، دعم ممتاز.'],
      ['ع***ز', 4, 'المنتج أصلي 100%، سأكرر الشراء.'],
      ['م***د', 5, 'خدمة توصيل محترمة والمنتج فوق التوقعات.'],
      ['ف***ط', 4, 'قيمة ممتازة مقابل السعر.'],
      ['ي***ر', 5, 'أنصح الجميع بالشراء من هنا.'],
      ['د***ا', 3, 'المنتج جيد لكن السعر مرتفع قليلاً.'],
      ['ه***م', 5, 'وصل خلال 4 أسابيع بحالة ممتازة.'],
      ['ب***ر', 4, 'تجربة تسوق سلسة من البداية للنهاية.'],
      ['ط***ق', 5, 'الدفع بالكريبتو سهل جداً.'],
      ['ز***ي', 4, 'منتج أصلي وخدمة عملاء متعاونة.'],
      ['إ***س', 5, 'منتظر أشتري مرة تانية، شكراً.']
    ];
    const ins = db.prepare('INSERT INTO reviews (product_id, user_name, rating, comment) VALUES (?, ?, ?, ?)');
    samples.forEach((s, i) => {
      const p = products[i % products.length];
      ins.run(p.id, s[0], s[1], s[2]);
    });
  }
}
seed();

// ==================== Middleware ====================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ detail: 'غير مصرح' });
  try {
    const d = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    const u = db.prepare('SELECT id, email, phone, name, is_admin, banned FROM accounts WHERE id = ?').get(d.id);
    if (!u) return res.status(401).json({ detail: 'حساب غير موجود' });
    if (u.banned) return res.status(403).json({ detail: 'هذا الحساب محظور' });
    req.user = u;
    next();
  } catch (e) {
    return res.status(401).json({ detail: 'انتهت الجلسة، يرجى تسجيل الدخول' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ detail: 'مطلوب صلاحيات المدير' });
  next();
}

function maskName(name) {
  if (!name || name.length === 0) return 'م***';
  const clean = name.replace(/[.\s]/g, '');
  if (clean.length <= 2) return clean.charAt(0) + '***';
  return clean.charAt(0) + '***' + clean.charAt(clean.length - 1);
}

// ==================== المصادقة ====================
app.post('/api/store-auth/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ detail: 'كلمة المرور 6 أحرف على الأقل' });
  if (!email && !phone) return res.status(400).json({ detail: 'البريد أو الهاتف مطلوب' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const isAdmin = email && ADMIN_EMAILS.includes(email.toLowerCase()) ? 1 : 0;
    const r = db.prepare('INSERT INTO accounts (email, phone, name, password_hash, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(email || null, phone || null, name || '', hash, isAdmin);
    const u = db.prepare('SELECT id, email, phone, name, is_admin FROM accounts WHERE id = ?').get(r.lastInsertRowid);
    const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: u });
  } catch (e) {
    if (e.code && e.code.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(400).json({ detail: 'البريد أو الهاتف مسجل مسبقاً' });
    }
    res.status(500).json({ detail: 'خطأ في التسجيل' });
  }
});

app.post('/api/store-auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ detail: 'املأ جميع الحقول' });
  const u = db.prepare('SELECT * FROM accounts WHERE email = ? OR phone = ?').get(identifier, identifier);
  if (!u) return res.status(401).json({ detail: 'بيانات الدخول غير صحيحة' });
  if (u.banned) return res.status(403).json({ detail: 'هذا الحساب محظور' });
  if (!bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ detail: 'بيانات الدخول غير صحيحة' });
  const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: u.id, email: u.email, phone: u.phone, name: u.name, is_admin: u.is_admin } });
});

app.get('/api/store-auth/me', auth, (req, res) => res.json({ user: req.user }));

// ==================== الدول ====================
app.get('/api/countries', (req, res) => {
  res.json(db.prepare('SELECT * FROM countries WHERE active = 1 ORDER BY sort_order').all());
});

// ==================== المنتجات ====================
app.get('/api/products', (req, res) => {
  const { country_id, search } = req.query;
  let sql = 'SELECT p.*, c.name_ar as country_name FROM products p JOIN countries c ON p.country_id = c.id WHERE p.active = 1';
  const params = [];
  if (country_id) { sql += ' AND p.country_id = ?'; params.push(country_id); }
  if (search) { sql += ' AND (p.title LIKE ? OR p.description LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  sql += ' ORDER BY p.created_at DESC';
  const products = db.prepare(sql).all(...params);
  // إضافة متوسط التقييم
  products.forEach(p => {
    const stats = db.prepare('SELECT AVG(rating) avg, COUNT(*) count FROM reviews WHERE product_id = ?').get(p.id);
    p.rating_avg = stats.avg ? parseFloat(stats.avg.toFixed(1)) : 0;
    p.rating_count = stats.count;
  });
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare('SELECT p.*, c.name_ar as country_name, c.delivery_weeks_min, c.delivery_weeks_max FROM products p JOIN countries c ON p.country_id = c.id WHERE p.id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ detail: 'المنتج غير موجود' });
  const stats = db.prepare('SELECT AVG(rating) avg, COUNT(*) count FROM reviews WHERE product_id = ?').get(p.id);
  p.rating_avg = stats.avg ? parseFloat(stats.avg.toFixed(1)) : 0;
  p.rating_count = stats.count;
  const reviews = db.prepare('SELECT id, user_name, rating, comment, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC').all(p.id);
  p.reviews = reviews.map(r => ({ ...r, user_name: maskName(r.user_name) }));
  res.json(p);
});

// ==================== التقييمات ====================
app.post('/api/reviews', auth, (req, res) => {
  const { product_id, rating, comment } = req.body;
  if (!product_id || !rating || rating < 1 || rating > 5) return res.status(400).json({ detail: 'بيانات غير صحيحة' });
  const name = req.user.name || req.user.email?.split('@')[0] || req.user.phone || 'مستخدم';
  db.prepare('INSERT INTO reviews (product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(product_id, req.user.id, name, rating, comment || '');
  res.json({ success: true });
});

// ==================== الطلبات ====================
app.post('/api/orders', auth, (req, res) => {
  const { items, country_id, country_name, tx_ref, wallet_address } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ detail: 'السلة فارغة' });
  if (!tx_ref || tx_ref.trim().length < 6) return res.status(400).json({ detail: 'رقم عملية التحويل (TXID) مطلوب' });

  let subtotal = 0;
  items.forEach(it => { subtotal += it.price_usd * it.quantity + (it.shipping_fee_usd || 0) * it.quantity; });

  const userName = req.user.name || req.user.email?.split('@')[0] || req.user.phone || 'عميل';

  const r = db.prepare('INSERT INTO orders (user_id, user_name, country_id, country_name, items_json, total_usd, wallet_address, tx_ref, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(req.user.id, userName, country_id || null, country_name || '', JSON.stringify(items), subtotal, wallet_address || '', tx_ref, 'awaiting_confirmation');

  res.json({ success: true, orderId: r.lastInsertRowid });
});

app.get('/api/orders/mine', auth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  orders.forEach(o => { o.items = JSON.parse(o.items_json); });
  res.json(orders);
});

// ==================== الدعم ====================
app.post('/api/support', auth, (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ detail: 'الرسالة مطلوبة' });
  const userName = req.user.name || req.user.email?.split('@')[0] || req.user.phone || 'عميل';
  const r = db.prepare('INSERT INTO support_messages (user_id, user_name, message) VALUES (?, ?, ?)').run(req.user.id, userName, message.trim());
  res.json({ success: true, id: r.lastInsertRowid });
});

app.get('/api/support/mine', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id));
});

// ==================== الإعدادات العامة ====================
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM site_settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

// ==================== الأدمن ====================
app.get('/api/admin/stats', auth, adminOnly, (req, res) => {
  res.json({
    total_orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    pending_orders: db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'awaiting_confirmation'").get().c,
    active_products: db.prepare('SELECT COUNT(*) c FROM products WHERE active = 1').get().c,
    open_support: db.prepare("SELECT COUNT(*) c FROM support_messages WHERE status = 'open'").get().c
  });
});

app.get('/api/admin/orders', auth, adminOnly, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  orders.forEach(o => { o.items = JSON.parse(o.items_json); });
  res.json(orders);
});

app.put('/api/admin/orders/:id', auth, adminOnly, (req, res) => {
  const { status } = req.body;
  const valid = ['awaiting_confirmation', 'accepted', 'rejected', 'shipped', 'delivered'];
  if (!valid.includes(status)) return res.status(400).json({ detail: 'حالة غير صحيحة' });
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/products', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT p.*, c.name_ar as country_name FROM products p JOIN countries c ON p.country_id = c.id ORDER BY p.id DESC').all());
});

app.post('/api/admin/products', auth, adminOnly, (req, res) => {
  const { title, description, notes, price_usd, shipping_fee_usd, image_url, stock, country_id, active } = req.body;
  if (!title || !price_usd || !country_id) return res.status(400).json({ detail: 'العنوان والسعر والدولة مطلوبة' });
  const r = db.prepare('INSERT INTO products (title, description, notes, price_usd, shipping_fee_usd, image_url, stock, country_id, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(title, description || '', notes || '', price_usd, shipping_fee_usd || 0, image_url || '', stock || 0, country_id, active !== false ? 1 : 0);
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/admin/products/:id', auth, adminOnly, (req, res) => {
  const { title, description, notes, price_usd, shipping_fee_usd, image_url, stock, country_id, active } = req.body;
  db.prepare('UPDATE products SET title=?, description=?, notes=?, price_usd=?, shipping_fee_usd=?, image_url=?, stock=?, country_id=?, active=? WHERE id=?')
    .run(title, description, notes, price_usd, shipping_fee_usd, image_url, stock, country_id, active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/products/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/reviews', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT r.*, p.title as product_title FROM reviews r JOIN products p ON r.product_id = p.id ORDER BY r.created_at DESC').all());
});

app.delete('/api/admin/reviews/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/countries', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM countries ORDER BY sort_order').all());
});

app.post('/api/admin/countries', auth, adminOnly, (req, res) => {
  const { name_ar, name_en, flag_emoji, delivery_weeks_min, delivery_weeks_max } = req.body;
  if (!name_ar || !name_en) return res.status(400).json({ detail: 'الاسم العربي والإنجليزي مطلوبان' });
  const r = db.prepare('INSERT INTO countries (name_ar, name_en, flag_emoji, delivery_weeks_min, delivery_weeks_max) VALUES (?, ?, ?, ?, ?)')
    .run(name_ar, name_en, flag_emoji || '🌐', delivery_weeks_min || 3, delivery_weeks_max || 6);
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/admin/countries/:id', auth, adminOnly, (req, res) => {
  const { name_ar, name_en, flag_emoji, delivery_weeks_min, delivery_weeks_max, active } = req.body;
  db.prepare('UPDATE countries SET name_ar=?, name_en=?, flag_emoji=?, delivery_weeks_min=?, delivery_weeks_max=?, active=? WHERE id=?')
    .run(name_ar, name_en, flag_emoji, delivery_weeks_min, delivery_weeks_max, active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/countries/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM countries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/accounts', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT id, email, phone, name, banned, is_admin, created_at FROM accounts ORDER BY id DESC').all());
});

app.put('/api/admin/accounts/:id', auth, adminOnly, (req, res) => {
  const { banned } = req.body;
  db.prepare('UPDATE accounts SET banned = ? WHERE id = ?').run(banned ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/accounts/:id', auth, adminOnly, (req, res) => {
  if (req.params.id == req.user.id) return res.status(400).json({ detail: 'لا يمكن حذف حسابك الحالي' });
  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/support', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT s.*, a.email as user_email, a.phone as user_phone FROM support_messages s JOIN accounts a ON s.user_id = a.id ORDER BY s.created_at DESC').all());
});

app.post('/api/admin/support/:id/reply', auth, adminOnly, (req, res) => {
  const { reply } = req.body;
  if (!reply || !reply.trim()) return res.status(400).json({ detail: 'الرد مطلوب' });
  db.prepare("UPDATE support_messages SET reply = ?, status = 'answered', replied_at = CURRENT_TIMESTAMP WHERE id = ?")
    .run(reply.trim(), req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/settings', auth, adminOnly, (req, res) => {
  const rows = db.prepare('SELECT * FROM site_settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

app.put('/api/admin/settings', auth, adminOnly, (req, res) => {
  const { usdt_wallet_address, network, announcement } = req.body;
  const upsert = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
  if (usdt_wallet_address !== undefined) upsert.run('usdt_wallet_address', usdt_wallet_address);
  if (network !== undefined) upsert.run('network', network);
  if (announcement !== undefined) upsert.run('announcement', announcement);
  res.json({ success: true });
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('   🇸🇾  سورياستور يعمل بنجاح');
  console.log('   🌐  http://localhost:' + PORT);
  console.log('   👤  الأدمن: admin@syriastore.com');
  console.log('   🔑  كلمة السر: admin123');
  console.log('════════════════════════════════════════');
  console.log('');
});
