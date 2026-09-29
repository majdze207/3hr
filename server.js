const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'amazon-syria-2025-secret-key';
const DB_PATH = process.env.DB_PATH || 'amazon_syria.db';
const ADMIN_EMAILS = ['admin@gmail.com'];

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============ الجداول ============
db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  banned INTEGER DEFAULT 0,
  is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  price_usd REAL NOT NULL,
  shipping_fee_usd REAL DEFAULT 0,
  image_url TEXT DEFAULT '',
  stock INTEGER DEFAULT 0,
  discount_percent REAL DEFAULT 0,
  discount_active INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS shipping_companies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_name TEXT,
  receiver_full_name TEXT NOT NULL,
  receiver_phone TEXT NOT NULL,
  region TEXT NOT NULL,
  shipping_company_id INTEGER,
  shipping_company_name TEXT,
  items_json TEXT NOT NULL,
  subtotal_usd REAL NOT NULL,
  shipping_total_usd REAL NOT NULL,
  discount_total_usd REAL DEFAULT 0,
  total_usd REAL NOT NULL,
  wallet_address TEXT,
  tx_ref TEXT,
  status TEXT DEFAULT 'awaiting_confirmation',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (shipping_company_id) REFERENCES shipping_companies(id) ON DELETE SET NULL
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

// ============ البذور ============
function seed() {
  // الإعدادات
  const setS = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  setS.run('usdt_wallet_address', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0');
  setS.run('network', 'BEP20');
  setS.run('announcement', '🚚 شحن من 3 إلى 6 أسابيع لجميع المحافظات السورية');
  setS.run('site_name', 'أمازون سوريا');

  // الأدمن
  const adminExists = db.prepare('SELECT id FROM accounts WHERE email = ?').get('admin@gmail.com');
  if (!adminExists) {
    const hash = bcrypt.hashSync('Admin@123', 10);
    db.prepare('INSERT INTO accounts (email, phone, name, password_hash, is_admin) VALUES (?, ?, ?, ?, 1)')
      .run('admin@gmail.com', '0900000000', 'المدير', hash);
    console.log('✅ الأدمن: admin@gmail.com / Admin@123');
  }

  // الأقسام
  const cCount = db.prepare('SELECT COUNT(*) c FROM categories').get().c;
  if (cCount === 0) {
    const ins = db.prepare('INSERT INTO categories (name_ar, icon, sort_order) VALUES (?, ?, ?)');
    ins.run('مطبخ', '🍳', 1);
    ins.run('تنظيف', '🧹', 2);
    ins.run('عناية بالبشرة', '🧴', 3);
    ins.run('دراسة وكتب', '📚', 4);
    ins.run('إلكترونيات', '📱', 5);
    ins.run('ألعاب وترفيه', '🎮', 6);
  }

  // شركات الشحن
  const sCount = db.prepare('SELECT COUNT(*) c FROM shipping_companies').get().c;
  if (sCount === 0) {
    const ins = db.prepare('INSERT INTO shipping_companies (name, sort_order) VALUES (?, ?)');
    ins.run('أرامكس', 1);
    ins.run('DHL', 2);
    ins.run('البريد السوري', 3);
    ins.run('شركة النقل الوطنية', 4);
  }

  // المنتجات
  const pCount = db.prepare('SELECT COUNT(*) c FROM products').get().c;
  if (pCount === 0) {
    const cats = db.prepare('SELECT id, name_ar FROM categories').all();
    const findCat = (name) => cats.find(c => c.name_ar === name).id;

    const ins = db.prepare('INSERT INTO products (category_id, title, description, notes, price_usd, shipping_fee_usd, image_url, stock, discount_percent, discount_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

    ins.run(findCat('مطبخ'), 'مقلاة هوائية فيليبس XXL',
      'مقلاة هوائية بسعة 7.3 لتر، تقنية Rapid Air، 7 برامج طبخ مسبقة، شاشة رقمية تعمل باللمس. قوة 2225 واط مع ضمان سنة كاملة.',
      'ملاحظة: المنتج أصلي ومستورد من هولندا.',
      299, 22,
      'https://images.unsplash.com/photo-1585515320310-259814833e62?w=600', 30, 15, 1);

    ins.run(findCat('مطبخ'), 'طقم أواني ستانلس ستيل 12 قطعة',
      'طقم أواني طبخ من الستانلس ستيل المقاوم للصدأ، يشمل قدور ومقالي بأحجام مختلفة، مناسب لجميع أنواع المواقد.',
      'ضمان 5 سنوات على الطقم.',
      189, 18,
      'https://images.unsplash.com/photo-1556909212-d5b604d0c90d?w=600', 25, 0, 0);

    ins.run(findCat('تنظيف'), 'مكنسة روبوت شاومي X10+',
      'مكنسة روبوت ذاتية الشحن، شفط بقوة 4000Pa، رادار LDS لتخطيط المنزل، تعمل بالتطبيق مع قاعدة تفريغ ذاتي.',
      'تشمل قاعدة تفريغ ذاتي + فلتر احتياطي.',
      649, 35,
      'https://images.unsplash.com/photo-1518640467707-6811f4a6ab73?w=600', 12, 20, 1);

    ins.run(findCat('تنظيف'), 'مسحوق غسيل أريال 5 كغ',
      'مسحوق غسيل عالي الجودة للغسالات الأوتوماتيكية، إزالة فعالة للبقع الصعبة، رائحة تدوم طويلاً.',
      'عبوة 5 كيلوغرام.',
      35, 10,
      'https://images.unsplash.com/photo-1585837575652-267c041d77d4?w=600', 50, 0, 0);

    ins.run(findCat('عناية بالبشرة'), 'سيروم فيتامين سي The Ordinary',
      'سيروم مركّز بفيتامين سي 20% لتفتيح البشرة وتوحيد اللون، يقلل من علامات التقدم بالعمر.',
      'مناسب لجميع أنواع البشرة.',
      45, 8,
      'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600', 40, 10, 1);

    ins.run(findCat('عناية بالبشرة'), 'كريم مرطب لا روش بوزاي',
      'كريم مرطب للوجه بتركيبة خفيفة سريعة الامتصاص، يناسب البشرة الحساسة، يحتوي على SPF 30.',
      'يحمي من أشعة الشمس ويحافظ على نضارة البشرة.',
      89, 12,
      'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600', 35, 0, 0);

    ins.run(findCat('دراسة وكتب'), 'لابتوب ديل XPS 15',
      'لابتوب بشاشة 15.6 بوصة OLED، معالج Intel Core i7، ذاكرة 16GB، تخزين 512GB SSD، مناسب للدراسة والعمل الاحترافي.',
      'يأتي بنظام Windows 11 أصلي.',
      1899, 45,
      'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600', 8, 0, 0);

    ins.run(findCat('دراسة وكتب'), 'كتاب تعلم البرمجة بلغة Python',
      'كتاب شامل لتعلم لغة Python من الصفر حتى الاحتراف، يشمل 15 مشروعاً عملياً وأمثلة تطبيقية.',
      'الكتاب باللغة العربية 450 صفحة.',
      25, 5,
      'https://images.unsplash.com/photo-1532012197267-da84d127e765?w=600', 60, 0, 0);

    ins.run(findCat('إلكترونيات'), 'آيفون 15 برو ماكس 256GB',
      'هاتف بمعالج A17 Pro، هيكل تيتانيوم، كاميرا 48MP، شاشة Super Retina XDR 6.7 بوصة.',
      'يأتي مغلق بضمان أبل الدولي.',
      1199, 28,
      'https://images.unsplash.com/photo-1592286927505-1def25115558?w=600', 18, 12, 1);

    ins.run(findCat('إلكترونيات'), 'سماعات سوني WH-1000XM5',
      'سماعات لاسلكية فوق الأذن بعزل ضوضاء رائد في الصناعة، عمر بطارية 30 ساعة، صوت عالي الدقة Hi-Res.',
      'تشمل حقيبة حمل ووصلة صوت.',
      379, 15,
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600', 22, 0, 0);

    ins.run(findCat('ألعاب وترفيه'), 'بلايستيشن 5 Slim',
      'جهاز PlayStation 5 نسخة Slim بقرص، معالج رسومات قوي، دعم دقة 4K و 120Hz، SSD فائق السرعة.',
      'يشمل يد تحكم DualSense واحدة.',
      599, 30,
      'https://images.unsplash.com/photo-1606813907291-d86efa9b94db?w=600', 10, 8, 1);

    ins.run(findCat('ألعاب وترفيه'), 'لعبة FIFA 25 PS5',
      'أحدث إصدار من سلسلة FIFA الرياضية، مع أكثر من 19,000 لاعب، دعم الوضع الأونلاين والبطولات.',
      'لعبة أصلية بغلاف عربي.',
      75, 6,
      'https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=600', 45, 0, 0);
  }

  // التقييمات
  const rCount = db.prepare('SELECT COUNT(*) c FROM reviews').get().c;
  if (rCount === 0) {
    const products = db.prepare('SELECT id FROM products').all();
    const samples = [
      ['أحمد محمد', 5, 'منتج ممتاز وصلني بأسرع من المتوقع، التغليف احترافي.'],
      ['سارة علي', 4, 'جودة عالية لكن السعر مرتفع قليلاً مقارنة بالسوق.'],
      ['رنا خالد', 5, 'تجربة شراء رائعة، المنتج مطابق للوصف تماماً.'],
      ['خالد عمر', 4, 'وصلني بحالة ممتازة، شكراً للفريق.'],
      ['نور الهدى', 5, 'أفضل متجر تعاملت معه، خدمة العملاء ممتازة.'],
      ['حسن علي', 3, 'المنتج جيد لكن تأخر الشحن قليلاً.'],
      ['ليلى إبراهيم', 5, 'أنصح الجميع بالشراء من هنا، أصلي 100%.'],
      ['عمر يوسف', 4, 'المنتج أصلي وقيمة ممتازة مقابل السعر.'],
      ['محمود أحمد', 5, 'وصلني بحالة ممتازة، سأكرر الشراء.'],
      ['فاطمة حسن', 4, 'خدمة توصيل محترمة والمنتج فوق التوقعات.'],
      ['ياسر محمود', 5, 'تجربة تسوق سلسة من البداية للنهاية.'],
      ['دينا سمير', 3, 'المنتج جيد لكن التغليف كان بسيطاً.'],
      ['هبة الله', 5, 'وصلني خلال 4 أسابيع بحالة ممتازة.'],
      ['بلال ناصر', 4, 'خدمة عملاء متعاونة ومنتج أصلي.'],
      ['طه ياسين', 5, 'الدفع بالكريبتو كان سهلاً جداً.'],
      ['زينب علي', 4, 'منتج أصلي وسعر مناسب.'],
      ['إسلام فارس', 5, 'منتظر أشتري مرة تانية، شكراً.']
    ];
    const ins = db.prepare('INSERT INTO reviews (product_id, user_name, rating, comment) VALUES (?, ?, ?, ?)');
    samples.forEach((s, i) => {
      const p = products[i % products.length];
      ins.run(p.id, s[0], s[1], s[2]);
    });
  }
}
seed();

// ============ Helpers ============
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function maskName(name) {
  if (!name) return 'م***';
  const parts = name.trim().split(/\s+/);
  const first = parts[0] || '';
  const last = parts[parts.length - 1] || '';
  if (first.length <= 1) return '*'.repeat(3);
  return first.charAt(0) + '***' + (last && last !== first ? last.charAt(0) : '');
}

function effectivePrice(p) {
  if (!p) return 0;
  if (p.discount_active && p.discount_percent > 0) {
    return p.price_usd * (1 - p.discount_percent / 100);
  }
  return p.price_usd;
}

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
    return res.status(401).json({ detail: 'انتهت الجلسة' });
  }
}

function adminOnly(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ detail: 'صلاحيات المدير مطلوبة' });
  next();
}

// ============ التحقق ============
const RE_EMAIL = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const RE_PHONE = /^09\d{8}$/;
const RE_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};:'",.<>\/?\\|`~]).{8,}$/;

function validateRegister({ email, phone, password }) {
  if (!email) return 'البريد الإلكتروني مطلوب';
  if (!RE_EMAIL.test(email)) return 'البريد يجب أن ينتهي بـ @gmail.com';
  if (!phone) return 'رقم الهاتف مطلوب';
  if (!RE_PHONE.test(phone)) return 'رقم الهاتف يجب أن يبدأ بـ 09 ويتكون من 10 أرقام';
  if (!password) return 'كلمة المرور مطلوبة';
  if (password.length < 8) return 'كلمة المرور 8 أحرف على الأقل';
  if (!RE_PASSWORD.test(password)) return 'كلمة المرور يجب أن تحتوي على أحرف وأرقام ورموز';
  return null;
}

// ============ المصادقة ============
app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  const err = validateRegister({ email, phone, password });
  if (err) return res.status(400).json({ detail: err });
  if (!name || name.trim().length < 3) return res.status(400).json({ detail: 'الاسم الثلاثي مطلوب (3 أحرف على الأقل)' });

  try {
    const hash = bcrypt.hashSync(password, 10);
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase()) ? 1 : 0;
    const r = db.prepare('INSERT INTO accounts (email, phone, name, password_hash, is_admin) VALUES (?, ?, ?, ?, ?)')
      .run(email.toLowerCase(), phone, name.trim(), hash, isAdmin);
    const u = db.prepare('SELECT id, email, phone, name, is_admin FROM accounts WHERE id = ?').get(r.lastInsertRowid);
    const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: u });
  } catch (e) {
    if (e.code && e.code.startsWith('SQLITE_CONSTRAINT')) {
      if (e.message.includes('email')) return res.status(400).json({ detail: 'هذا البريد مسجل مسبقاً' });
      if (e.message.includes('phone')) return res.status(400).json({ detail: 'هذا الهاتف مسجل مسبقاً' });
      return res.status(400).json({ detail: 'البيانات مستخدمة مسبقاً' });
    }
    res.status(500).json({ detail: 'خطأ في التسجيل' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ detail: 'املأ جميع الحقول' });
  const u = db.prepare('SELECT * FROM accounts WHERE email = ? OR phone = ?').get(identifier.toLowerCase(), identifier);
  if (!u) return res.status(401).json({ detail: 'بيانات الدخول غير صحيحة' });
  if (u.banned) return res.status(403).json({ detail: 'هذا الحساب محظور' });
  if (!bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ detail: 'بيانات الدخول غير صحيحة' });
  const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: u.id, email: u.email, phone: u.phone, name: u.name, is_admin: u.is_admin } });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

// ============ الأقسام ============
app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort_order, id').all());
});

app.get('/api/admin/categories', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all());
});

app.post('/api/admin/categories', auth, adminOnly, (req, res) => {
  const { name_ar, icon, sort_order } = req.body;
  if (!name_ar) return res.status(400).json({ detail: 'اسم القسم مطلوب' });
  const r = db.prepare('INSERT INTO categories (name_ar, icon, sort_order) VALUES (?, ?, ?)')
    .run(name_ar.trim(), icon || '📦', sort_order || 0);
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/admin/categories/:id', auth, adminOnly, (req, res) => {
  const { name_ar, icon, sort_order, active } = req.body;
  db.prepare('UPDATE categories SET name_ar=?, icon=?, sort_order=?, active=? WHERE id=?')
    .run(name_ar, icon, sort_order, active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/categories/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============ المنتجات ============
app.get('/api/products', (req, res) => {
  const { category_id, search, discount } = req.query;
  let sql = `SELECT p.*, c.name_ar as category_name FROM products p
             JOIN categories c ON p.category_id = c.id WHERE p.active = 1`;
  const params = [];
  if (category_id) { sql += ' AND p.category_id = ?'; params.push(category_id); }
  if (search) { sql += ' AND (p.title LIKE ? OR p.description LIKE ?)'; params.push('%' + search + '%', '%' + search + '%'); }
  if (discount === '1') { sql += ' AND p.discount_active = 1 AND p.discount_percent > 0'; }
  sql += ' ORDER BY p.created_at DESC';
  const products = db.prepare(sql).all(...params);

  products.forEach(p => {
    const st = db.prepare('SELECT AVG(rating) avg, COUNT(*) count FROM reviews WHERE product_id = ?').get(p.id);
    p.rating_avg = st.avg ? parseFloat(st.avg.toFixed(1)) : 0;
    p.rating_count = st.count;
    p.effective_price = parseFloat(effectivePrice(p).toFixed(2));
    p.discount_amount = p.discount_active ? parseFloat((p.price_usd - p.effective_price).toFixed(2)) : 0;
  });
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const p = db.prepare(`SELECT p.*, c.name_ar as category_name FROM products p
                        JOIN categories c ON p.category_id = c.id WHERE p.id = ?`).get(req.params.id);
  if (!p) return res.status(404).json({ detail: 'المنتج غير موجود' });
  const st = db.prepare('SELECT AVG(rating) avg, COUNT(*) count FROM reviews WHERE product_id = ?').get(p.id);
  p.rating_avg = st.avg ? parseFloat(st.avg.toFixed(1)) : 0;
  p.rating_count = st.count;
  p.effective_price = parseFloat(effectivePrice(p).toFixed(2));
  p.discount_amount = p.discount_active ? parseFloat((p.price_usd - p.effective_price).toFixed(2)) : 0;
  const reviews = db.prepare('SELECT id, user_name, rating, comment, created_at FROM reviews WHERE product_id = ? ORDER BY created_at DESC').all(p.id);
  p.reviews = reviews.map(r => ({ ...r, user_name: maskName(r.user_name) }));
  res.json(p);
});

// ============ التقييمات ============
app.post('/api/reviews', auth, (req, res) => {
  const { product_id, rating, comment } = req.body;
  if (!product_id || !rating || rating < 1 || rating > 5) return res.status(400).json({ detail: 'بيانات غير صحيحة' });
  const name = req.user.name || 'مستخدم';
  db.prepare('INSERT INTO reviews (product_id, user_id, user_name, rating, comment) VALUES (?, ?, ?, ?, ?)')
    .run(product_id, req.user.id, name, rating, comment || '');
  res.json({ success: true });
});

// ============ شركات الشحن ============
app.get('/api/shipping-companies', (req, res) => {
  res.json(db.prepare('SELECT * FROM shipping_companies WHERE active = 1 ORDER BY sort_order, id').all());
});

app.get('/api/admin/shipping-companies', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM shipping_companies ORDER BY sort_order, id').all());
});

app.post('/api/admin/shipping-companies', auth, adminOnly, (req, res) => {
  const { name, sort_order } = req.body;
  if (!name) return res.status(400).json({ detail: 'اسم الشركة مطلوب' });
  const r = db.prepare('INSERT INTO shipping_companies (name, sort_order) VALUES (?, ?)')
    .run(name.trim(), sort_order || 0);
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/admin/shipping-companies/:id', auth, adminOnly, (req, res) => {
  const { name, sort_order, active } = req.body;
  db.prepare('UPDATE shipping_companies SET name=?, sort_order=?, active=? WHERE id=?')
    .run(name, sort_order, active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/shipping-companies/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM shipping_companies WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ============ الطلبات ============
app.post('/api/orders', auth, (req, res) => {
  const { items, receiver_full_name, receiver_phone, region, shipping_company_id, tx_ref, wallet_address } = req.body;

  if (!items || items.length === 0) return res.status(400).json({ detail: 'السلة فارغة' });
  if (!receiver_full_name || receiver_full_name.trim().split(/\s+/).length < 3)
    return res.status(400).json({ detail: 'الاسم الثلاثي للمستلم مطلوب' });
  if (!receiver_phone || !RE_PHONE.test(receiver_phone))
    return res.status(400).json({ detail: 'رقم هاتف المستلم يجب أن يبدأ بـ 09 ويتكون من 10 أرقام' });
  if (!region || region.trim().length < 2)
    return res.status(400).json({ detail: 'المنطقة مطلوبة' });
  if (!shipping_company_id) return res.status(400).json({ detail: 'شركة الشحن مطلوبة' });
  if (!tx_ref || tx_ref.trim().length < 6)
    return res.status(400).json({ detail: 'رقم عملية التحويل (TXID) مطلوب' });

  const company = db.prepare('SELECT * FROM shipping_companies WHERE id = ? AND active = 1').get(shipping_company_id);
  if (!company) return res.status(400).json({ detail: 'شركة شحن غير صالحة' });

  let subtotal = 0, shippingTotal = 0, discountTotal = 0;
  const enrichedItems = items.map(it => {
    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(it.id);
    if (!prod) throw new Error('منتج غير موجود');
    const unit = effectivePrice(prod);
    const linePrice = unit * it.quantity;
    const lineShipping = (prod.shipping_fee_usd || 0) * it.quantity;
    subtotal += linePrice;
    shippingTotal += lineShipping;
    if (prod.discount_active) discountTotal += (prod.price_usd - unit) * it.quantity;
    return {
      id: prod.id, title: prod.title, price_usd: unit,
      original_price_usd: prod.price_usd,
      shipping_fee_usd: prod.shipping_fee_usd || 0,
      quantity: it.quantity,
      line_total: parseFloat((linePrice + lineShipping).toFixed(2))
    };
  });

  const total = subtotal + shippingTotal;
  const userName = req.user.name || 'عميل';

  const r = db.prepare(`INSERT INTO orders
    (user_id, user_name, receiver_full_name, receiver_phone, region,
     shipping_company_id, shipping_company_name, items_json,
     subtotal_usd, shipping_total_usd, discount_total_usd, total_usd,
     wallet_address, tx_ref, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      req.user.id, userName,
      receiver_full_name.trim(), receiver_phone, region.trim(),
      company.id, company.name, JSON.stringify(enrichedItems),
      parseFloat(subtotal.toFixed(2)), parseFloat(shippingTotal.toFixed(2)),
      parseFloat(discountTotal.toFixed(2)), parseFloat(total.toFixed(2)),
      wallet_address || '', tx_ref.trim(), 'awaiting_confirmation'
    );

  res.json({ success: true, orderId: r.lastInsertRowid });
});

app.get('/api/orders/mine', auth, (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  orders.forEach(o => { o.items = JSON.parse(o.items_json); });
  res.json(orders);
});

// ============ الدعم ============
app.post('/api/support', auth, (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ detail: 'الرسالة مطلوبة' });
  const userName = req.user.name || 'عميل';
  const r = db.prepare('INSERT INTO support_messages (user_id, user_name, message) VALUES (?, ?, ?)')
    .run(req.user.id, userName, message.trim());
  res.json({ success: true, id: r.lastInsertRowid });
});

app.get('/api/support/mine', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at ASC').all(req.user.id));
});

// ============ الإعدادات العامة ============
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT * FROM site_settings').all();
  const obj = {};
  rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});

// ============ لوحة الأدمن ============
app.get('/api/admin/stats', auth, adminOnly, (req, res) => {
  res.json({
    total_orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    pending_orders: db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'awaiting_confirmation'").get().c,
    active_products: db.prepare('SELECT COUNT(*) c FROM products WHERE active = 1').get().c,
    open_support: db.prepare("SELECT COUNT(*) c FROM support_messages WHERE status = 'open'").get().c,
    total_accounts: db.prepare('SELECT COUNT(*) c FROM accounts').get().c,
    total_revenue: db.prepare("SELECT COALESCE(SUM(total_usd),0) s FROM orders WHERE status IN ('accepted','shipped','delivered')").get().s
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
  res.json(db.prepare(`SELECT p.*, c.name_ar as category_name FROM products p
                       JOIN categories c ON p.category_id = c.id
                       ORDER BY p.id DESC`).all());
});

app.post('/api/admin/products', auth, adminOnly, (req, res) => {
  const { category_id, title, description, notes, price_usd, shipping_fee_usd, image_url, stock, discount_percent, discount_active, active } = req.body;
  if (!title || !price_usd || !category_id) return res.status(400).json({ detail: 'العنوان والسعر والقسم مطلوبة' });
  const r = db.prepare(`INSERT INTO products
    (category_id, title, description, notes, price_usd, shipping_fee_usd, image_url, stock, discount_percent, discount_active, active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(category_id, title, description || '', notes || '', price_usd, shipping_fee_usd || 0,
         image_url || '', stock || 0, discount_percent || 0, discount_active ? 1 : 0, active !== false ? 1 : 0);
  res.json({ success: true, id: r.lastInsertRowid });
});

app.put('/api/admin/products/:id', auth, adminOnly, (req, res) => {
  const { category_id, title, description, notes, price_usd, shipping_fee_usd, image_url, stock, discount_percent, discount_active, active } = req.body;
  db.prepare(`UPDATE products SET category_id=?, title=?, description=?, notes=?, price_usd=?,
    shipping_fee_usd=?, image_url=?, stock=?, discount_percent=?, discount_active=?, active=?
    WHERE id=?`)
    .run(category_id, title, description, notes, price_usd, shipping_fee_usd, image_url, stock,
         discount_percent || 0, discount_active ? 1 : 0, active ? 1 : 0, req.params.id);
  res.json({ success: true });
});

app.delete('/api/admin/products/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/reviews', auth, adminOnly, (req, res) => {
  res.json(db.prepare(`SELECT r.*, p.title as product_title FROM reviews r
                       JOIN products p ON r.product_id = p.id
                       ORDER BY r.created_at DESC`).all());
});

app.delete('/api/admin/reviews/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM reviews WHERE id = ?').run(req.params.id);
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
  res.json(db.prepare(`SELECT s.*, a.email as user_email, a.phone as user_phone FROM support_messages s
                       JOIN accounts a ON s.user_id = a.id
                       ORDER BY s.created_at DESC`).all());
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
  const upsert = db.prepare('INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)');
  ['usdt_wallet_address', 'network', 'announcement', 'site_name'].forEach(k => {
    if (req.body[k] !== undefined) upsert.run(k, req.body[k]);
  });
  res.json({ success: true });
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('   🛒  أمازون سوريا — يعمل بنجاح');
  console.log('   🌐  http://localhost:' + PORT);
  console.log('   👤  الأدمن: admin@gmail.com');
  console.log('   🔑  كلمة السر: Admin@123');
  console.log('════════════════════════════════════════');
});
