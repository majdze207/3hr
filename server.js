const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'wasalni-secret-2025';
const DB_PATH = process.env.DB_PATH || 'wasalni.db';
const ADMIN_EMAILS = ['admin@gmail.com'];

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE, phone TEXT UNIQUE, name TEXT NOT NULL,
  password_hash TEXT NOT NULL, banned INTEGER DEFAULT 0, is_admin INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS countries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL, name_en TEXT NOT NULL, flag TEXT DEFAULT '🌐',
  active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  country_id INTEGER NOT NULL, name_ar TEXT NOT NULL,
  delivery_fee_usd REAL DEFAULT 0, active INTEGER DEFAULT 1,
  FOREIGN KEY (country_id) REFERENCES countries(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS stores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name_ar TEXT NOT NULL, name_en TEXT NOT NULL, icon TEXT DEFAULT '🛒',
  url_hint TEXT DEFAULT '', active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_number TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL, user_name TEXT,
  country_id INTEGER, region_id INTEGER,
  receiver_name TEXT NOT NULL, receiver_phone TEXT NOT NULL, full_address TEXT NOT NULL,
  store_name TEXT, product_title TEXT NOT NULL, product_url TEXT NOT NULL,
  product_price_usd REAL NOT NULL, quantity INTEGER DEFAULT 1,
  weight_kg REAL NOT NULL, shipping_method TEXT DEFAULT 'air',
  shipping_cost_usd REAL NOT NULL, customs_usd REAL NOT NULL,
  commission_usd REAL NOT NULL, delivery_fee_usd REAL NOT NULL,
  total_usd REAL NOT NULL, admin_adjusted_usd REAL,
  admin_customs_usd REAL,
  wallet_network TEXT, wallet_address TEXT, tx_ref TEXT, tx_proof_url TEXT,
  status TEXT DEFAULT 'awaiting_payment', notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (country_id) REFERENCES countries(id),
  FOREIGN KEY (region_id) REFERENCES regions(id)
);
CREATE TABLE IF NOT EXISTS order_tracking (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL, status TEXT NOT NULL,
  note TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS pricing (
  key TEXT PRIMARY KEY, value TEXT
);
CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  network TEXT NOT NULL, address TEXT NOT NULL,
  active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS testimonials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT, title TEXT, description TEXT,
  image_url TEXT DEFAULT '', video_url TEXT DEFAULT '',
  active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS content (
  key TEXT PRIMARY KEY, value TEXT
);
CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL, user_name TEXT,
  message TEXT NOT NULL, reply TEXT, status TEXT DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP, replied_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL, order_id INTEGER,
  title TEXT NOT NULL, body TEXT DEFAULT '',
  read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES accounts(id) ON DELETE CASCADE
);
`);

try { db.exec('ALTER TABLE orders ADD COLUMN admin_customs_usd REAL'); } catch (e) {}

const STATUS_LABELS = {
  awaiting_payment: '⏳ بانتظار الدفع',
  payment_received: '💵 تم استلام الدفع',
  purchased: '🛍️ تم الشراء من المتجر',
  warehouse_foreign: '📦 وصل المستودع الخارجي',
  international_shipping: '✈️ قيد الشحن الدولي',
  arrived_syria: '🇸🇾 وصل سوريا',
  out_for_delivery: '🚚 قيد التوصيل للمحافظة',
  delivered: '✅ تم التسليم',
  cancelled: '❌ ملغي',
  refunded: '💸 مسترجع'
};
const STATUS_FLOW = ['awaiting_payment','payment_received','purchased','warehouse_foreign','international_shipping','arrived_syria','out_for_delivery','delivered'];

function seed() {
  const setP = db.prepare('INSERT OR IGNORE INTO pricing (key, value) VALUES (?, ?)');
  setP.run('per_kg_air', '5');
  setP.run('per_kg_sea', '2');
  setP.run('customs_percent', '5');
  setP.run('commission_percent', '0');
  setP.run('min_weight_kg', '1');
  setP.run('usdt_rate', '1');
  setP.run('default_shipping_method', 'air');

  const setC = db.prepare('INSERT OR IGNORE INTO content (key, value) VALUES (?, ?)');
  setC.run('site_name', 'وصلني');
  setC.run('site_tagline', 'وسيطك للتسوق من أمازون والعالم — نوصلك إلى سوريا');
  setC.run('hero_title', '🛒 تسوّق من أي متجر عالمي... ونوصلك إلى سوريا');
  setC.run('hero_subtitle', 'الصق رابط المنتج من أمازون أو علي إكسبريس أو إي باي — احسب السعر النهائي وادفع بالكريبتو، ونحن نتكفل بالباقي.');
  setC.run('about_text', 'وصلني هي منصة وساطة تسوق ولوجستيات دولية، تتيح لأهلنا في سوريا الشراء من أكبر المتاجر العالمية (Amazon, AliExpress, eBay وغيرها) ودفع المبلغ بالكريبتو USDT، ثم تتبع شحنتهم مرحلة بمرحلة حتى الاستلام في سوريا.');
  setC.run('terms_text', 'باستخدامك للمنصة فإنك توافق على الشروط والأحكام: أنت مسؤول عن صحة المعلومات المدخلة، ومدة التسليم تتراوح بين 3 إلى 6 أسابيع حسب الوزن والدولة المصدرة وشركة الشحن.');
  setC.run('refund_text', 'نضمن لك استرجاع كامل المبلغ بالـ USDT في حال عدم وصول الشحنة خلال المدة القصوى المحددة (8 أسابيع)، أو في حال تلف المنتج أثناء الشحن.');
  setC.run('whatsapp_number', '+963900000000');
  setC.run('telegram_channel', 'wasalni');
  setC.run('warranty_note', 'ضمان استرجاع كامل للـ USDT عند عدم وصول الشحنة.');

  if (!db.prepare('SELECT id FROM accounts WHERE email = ?').get('admin@gmail.com')) {
    const hash = bcrypt.hashSync('Admin@123', 10);
    db.prepare('INSERT INTO accounts (email, phone, name, password_hash, is_admin) VALUES (?, ?, ?, ?, 1)')
      .run('admin@gmail.com', '0900000000', 'مدير وصلني', hash);
    console.log('✅ الأدمن: admin@gmail.com / Admin@123');
  }

  if (db.prepare('SELECT COUNT(*) c FROM countries').get().c === 0) {
    const ins = db.prepare('INSERT INTO countries (name_ar, name_en, flag, sort_order) VALUES (?, ?, ?, ?)');
    ins.run('سوريا', 'Syria', '🇸🇾', 1);
    ins.run('لبنان', 'Lebanon', '🇱🇧', 2);
    ins.run('العراق', 'Iraq', '🇮🇶', 3);
    ins.run('الأردن', 'Jordan', '🇯🇴', 4);
  }

  const syria = db.prepare("SELECT id FROM countries WHERE name_en='Syria'").get();
  if (syria && db.prepare('SELECT COUNT(*) c FROM regions WHERE country_id=?').get(syria.id).c === 0) {
    const ins = db.prepare('INSERT INTO regions (country_id, name_ar, delivery_fee_usd) VALUES (?, ?, ?)');
    const gov = [
      ['دمشق', 0], ['ريف دمشق', 0], ['حلب', 0], ['حمص', 0],
      ['حماة', 0], ['اللاذقية', 0], ['طرطوس', 0], ['إدلب', 0],
      ['دير الزور', 0], ['الرقة', 0], ['الحسكة', 0], ['درعا', 0], ['السويداء', 0], ['القنيطرة', 0]
    ];
    gov.forEach(([name, fee]) => ins.run(syria.id, name, fee));
  }

  if (db.prepare('SELECT COUNT(*) c FROM stores').get().c === 0) {
    const ins = db.prepare('INSERT INTO stores (name_ar, name_en, icon, url_hint, sort_order) VALUES (?, ?, ?, ?, ?)');
    ins.run('أمازون', 'Amazon', '🅰️', 'amazon.com', 1);
    ins.run('علي إكسبريس', 'AliExpress', '🅰️', 'aliexpress.com', 2);
    ins.run('إي باي', 'eBay', '🅴', 'ebay.com', 3);
    ins.run('وول مارت', 'Walmart', '🆆', 'walmart.com', 4);
    ins.run('متجر مخصص', 'Custom', '🌐', '', 5);
  }

  if (db.prepare('SELECT COUNT(*) c FROM wallets').get().c === 0) {
    const ins = db.prepare('INSERT INTO wallets (network, address, sort_order) VALUES (?, ?, ?)');
    ins.run('TRC20', 'TXYZabcdefghijklmnopqrstuvwxyz123456', 1);
    ins.run('BEP20', '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0', 2);
  }

  if (db.prepare('SELECT COUNT(*) c FROM testimonials').get().c === 0) {
    const ins = db.prepare('INSERT INTO testimonials (customer_name, title, description, image_url) VALUES (?, ?, ?, ?)');
    ins.run('أحمد من دمشق', 'آيفون 15 برو', 'وصلني الجهاز بأسبوعين فقط، مغلق وبتغليف أصلي. تجربة ممتازة.', 'https://images.unsplash.com/photo-1592286927505-1def25115558?w=400');
    ins.run('سارة من حلب', 'لابتوب ماك بوك', 'وصل اللابتوب بحالة ممتازة، فريق وصلني محترف جداً في التعامل والرد.', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400');
    ins.run('محمد من اللاذقية', 'ساعة أبل', 'الشحنة وصلت خلال 3 أسابيع، والسعر أقل من المتوقع. أنصح الجميع.', 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400');
    ins.run('رنا من حمص', 'كاميرا كانون', 'أفضل خدمة شحن جربتها، تتبع دقيق وشفافية كاملة بالأسعار.', 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=400');
  }
}
seed();

app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ detail: 'غير مصرح' });
  try {
    const d = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    const u = db.prepare('SELECT id, email, phone, name, is_admin, banned FROM accounts WHERE id = ?').get(d.id);
    if (!u) return res.status(401).json({ detail: 'حساب غير موجود' });
    if (u.banned) return res.status(403).json({ detail: 'هذا الحساب محظور' });
    req.user = u; next();
  } catch (e) { return res.status(401).json({ detail: 'انتهت الجلسة' }); }
}
function adminOnly(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ detail: 'صلاحيات المدير مطلوبة' });
  next();
}
function maskName(name) {
  if (!name) return 'م***';
  const p = name.trim().split(/\s+/);
  const f = p[0] || '', l = p[p.length - 1] || '';
  if (f.length <= 1) return '***';
  return f.charAt(0) + '***' + (l && l !== f ? l.charAt(0) : '');
}

const RE_EMAIL = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const RE_PHONE = /^09\d{8}$/;
const RE_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};:'",.<>\/?\\|`~]).{8,}$/;

app.post('/api/auth/register', (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || name.trim().length < 3) return res.status(400).json({ detail: 'الاسم مطلوب' });
  if (!email || !RE_EMAIL.test(email)) return res.status(400).json({ detail: 'البريد يجب أن ينتهي بـ @gmail.com' });
  if (!phone || !RE_PHONE.test(phone)) return res.status(400).json({ detail: 'رقم الهاتف 10 أرقام يبدأ بـ 09' });
  if (!password || !RE_PASSWORD.test(password)) return res.status(400).json({ detail: 'كلمة المرور: 8+ أحرف وأرقام ورموز' });
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
      if (e.message.includes('email')) return res.status(400).json({ detail: 'البريد مسجل مسبقاً' });
      if (e.message.includes('phone')) return res.status(400).json({ detail: 'الهاتف مسجل مسبقاً' });
    }
    res.status(500).json({ detail: 'خطأ في التسجيل' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ detail: 'املأ الحقول' });
  const u = db.prepare('SELECT * FROM accounts WHERE email = ? OR phone = ?').get(identifier.toLowerCase(), identifier);
  if (!u) return res.status(401).json({ detail: 'بيانات الدخول غير صحيحة' });
  if (u.banned) return res.status(403).json({ detail: 'هذا الحساب محظور' });
  if (!bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ detail: 'بيانات الدخول غير صحيحة' });
  const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: u.id, email: u.email, phone: u.phone, name: u.name, is_admin: u.is_admin } });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

app.get('/api/public/data', (req, res) => {
  const content = {}; db.prepare('SELECT * FROM content').all().forEach(r => content[r.key] = r.value);
  const pricing = {}; db.prepare('SELECT * FROM pricing').all().forEach(r => pricing[r.key] = parseFloat(r.value) || 0);
  const countries = db.prepare('SELECT * FROM countries WHERE active = 1 ORDER BY sort_order').all();
  const regions = db.prepare('SELECT r.*, c.name_ar as country_name FROM regions r JOIN countries c ON r.country_id = c.id WHERE r.active = 1 ORDER BY r.name_ar').all();
  const stores = db.prepare('SELECT * FROM stores WHERE active = 1 ORDER BY sort_order').all();
  const wallets = db.prepare('SELECT * FROM wallets WHERE active = 1 ORDER BY sort_order').all();
  const testimonials = db.prepare('SELECT * FROM testimonials WHERE active = 1 ORDER BY sort_order, id DESC').all();
  res.json({ content, pricing, countries, regions, stores, wallets, testimonials, status_labels: STATUS_LABELS });
});

app.post('/api/quote', (req, res) => {
  const { product_price_usd, quantity = 1, weight_kg, shipping_method = 'air', region_id } = req.body;

  if (!product_price_usd || product_price_usd <= 0) return res.status(400).json({ detail: 'سعر المنتج مطلوب' });
  if (!weight_kg || weight_kg <= 0) return res.status(400).json({ detail: 'الوزن مطلوب' });
  if (!region_id) return res.status(400).json({ detail: 'المحافظة مطلوبة' });

  const pricing = {};
  db.prepare('SELECT * FROM pricing').all().forEach(r => pricing[r.key] = parseFloat(r.value) || 0);
  const region = db.prepare('SELECT * FROM regions WHERE id = ?').get(region_id);
  if (!region) return res.status(400).json({ detail: 'المحافظة غير موجودة' });

  const qty = Math.max(1, parseInt(quantity));

  const rawWeight = parseFloat(weight_kg) * qty;
  const roundedWeight = Math.ceil(rawWeight);

  const perKg = shipping_method === 'sea' ? pricing.per_kg_sea : pricing.per_kg_air;
  const shippingCost = roundedWeight * perKg;

  const productCost = product_price_usd * qty;

  const customs = productCost * (pricing.customs_percent / 100);

  const deliveryFee = 0;

  const total = productCost + shippingCost + customs;

  res.json({
    product_cost: +productCost.toFixed(2),
    shipping_cost: +shippingCost.toFixed(2),
    customs: +customs.toFixed(2),
    commission: 0,
    delivery_fee: 0,
    total_usd: +total.toFixed(2),
    total_usdt: +total.toFixed(2),
    usdt_rate: 1,
    raw_weight_kg: +rawWeight.toFixed(2),
    rounded_weight_kg: roundedWeight,
    total_weight_kg: roundedWeight,
    per_kg_used: perKg
  });
});

function genOrderNumber() {
  const d = new Date();
  const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return 'WS-' + ymd + '-' + rnd;
}

app.post('/api/orders', auth, (req, res) => {
  const {
    country_id, region_id, receiver_name, receiver_phone, full_address,
    store_name, product_title, product_url,
    product_price_usd, quantity = 1, weight_kg,
    shipping_method = 'air', wallet_network, tx_ref, tx_proof_url
  } = req.body;

  if (!receiver_name || receiver_name.trim().split(/\s+/).length < 3)
    return res.status(400).json({ detail: 'الاسم الثلاثي للمستلم مطلوب' });
  if (!receiver_phone || !RE_PHONE.test(receiver_phone))
    return res.status(400).json({ detail: 'رقم هاتف المستلم 10 أرقام يبدأ بـ 09' });
  if (!full_address || full_address.trim().length < 5)
    return res.status(400).json({ detail: 'العنوان الكامل مطلوب' });
  if (!product_title || !product_url)
    return res.status(400).json({ detail: 'عنوان المنتج ورابطه مطلوبان' });
  if (!product_price_usd || !weight_kg)
    return res.status(400).json({ detail: 'سعر المنتج والوزن مطلوبان' });
  if (!region_id) return res.status(400).json({ detail: 'المحافظة مطلوبة' });

  const pricing = {}; db.prepare('SELECT * FROM pricing').all().forEach(r => pricing[r.key] = parseFloat(r.value) || 0);
  const region = db.prepare('SELECT * FROM regions WHERE id = ?').get(region_id);
  if (!region) return res.status(400).json({ detail: 'المحافظة غير موجودة' });
  const country = db.prepare('SELECT * FROM countries WHERE id = ?').get(country_id || region.country_id);

  const qty = Math.max(1, parseInt(quantity));

  const rawWeight = parseFloat(weight_kg) * qty;
  const roundedWeight = Math.ceil(rawWeight);

  const productCost = product_price_usd * qty;
  const perKg = shipping_method === 'sea' ? pricing.per_kg_sea : pricing.per_kg_air;
  const shippingCost = roundedWeight * perKg;
  const customs = productCost * (pricing.customs_percent / 100);
  const commission = 0;
  const deliveryFee = 0;
  const total = productCost + shippingCost + customs;

  const orderNumber = genOrderNumber();
  const userName = req.user.name || 'عميل';

  const r = db.prepare(`INSERT INTO orders
    (order_number, user_id, user_name, country_id, region_id,
     receiver_name, receiver_phone, full_address,
     store_name, product_title, product_url,
     product_price_usd, quantity, weight_kg, shipping_method,
     shipping_cost_usd, customs_usd, commission_usd, delivery_fee_usd, total_usd,
     wallet_network, tx_ref, tx_proof_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(
      orderNumber, req.user.id, userName, country ? country.id : null, region.id,
      receiver_name.trim(), receiver_phone, full_address.trim(),
      store_name || '', product_title.trim(), product_url.trim(),
      product_price_usd, qty, rawWeight, shipping_method,
      +shippingCost.toFixed(2), +customs.toFixed(2), 0, 0, +total.toFixed(2),
      wallet_network || '', tx_ref || '', tx_proof_url || '', 'awaiting_payment'
    );

  const orderId = r.lastInsertRowid;
  db.prepare('INSERT INTO order_tracking (order_id, status, note) VALUES (?, ?, ?)')
    .run(orderId, 'awaiting_payment', 'تم إنشاء الطلب بنجاح — بانتظار الدفع بالـ USDT');
  db.prepare('INSERT INTO notifications (user_id, order_id, title, body) VALUES (?, ?, ?, ?)')
    .run(req.user.id, orderId, 'تم إنشاء طلبك', `طلبك #${orderNumber} بانتظار تأكيد الدفع`);

  res.json({ success: true, order_id: orderId, order_number: orderNumber, total_usd: +total.toFixed(2) });
});

app.get('/api/orders/mine', auth, (req, res) => {
  const orders = db.prepare(`SELECT o.*, r.name_ar as region_name, c.name_ar as country_name
    FROM orders o
    LEFT JOIN regions r ON o.region_id = r.id
    LEFT JOIN countries c ON o.country_id = c.id
    WHERE o.user_id = ? ORDER BY o.created_at DESC`).all(req.user.id);
  orders.forEach(o => { o.tracking = db.prepare('SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC').all(o.id); });
  res.json(orders);
});

app.get('/api/orders/:id', auth, (req, res) => {
  const o = db.prepare(`SELECT o.*, r.name_ar as region_name, c.name_ar as country_name
    FROM orders o
    LEFT JOIN regions r ON o.region_id = r.id
    LEFT JOIN countries c ON o.country_id = c.id
    WHERE o.id = ?`).get(req.params.id);
  if (!o) return res.status(404).json({ detail: 'الطلب غير موجود' });
  if (o.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ detail: 'غير مصرح' });
  o.tracking = db.prepare('SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC').all(o.id);
  res.json(o);
});

app.post('/api/orders/:id/submit-payment', auth, (req, res) => {
  const { wallet_network, tx_ref, tx_proof_url } = req.body;
  const o = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!o) return res.status(404).json({ detail: 'الطلب غير موجود' });
  if (!tx_ref || tx_ref.trim().length < 6) return res.status(400).json({ detail: 'رقم التحويل (TxID) مطلوب' });
  db.prepare('UPDATE orders SET wallet_network=?, tx_ref=?, tx_proof_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(wallet_network || '', tx_ref.trim(), tx_proof_url || '', req.params.id);
  db.prepare('INSERT INTO order_tracking (order_id, status, note) VALUES (?, ?, ?)')
    .run(o.id, 'awaiting_payment', 'تم إرسال إثبات الدفع — بانتظار مراجعة الإدارة');
  db.prepare('INSERT INTO notifications (user_id, order_id, title, body) VALUES (?, ?, ?, ?)')
    .run(req.user.id, o.id, 'تم استلام إثبات الدفع', 'سنراجع التحويل ونؤكد الطلب قريباً');
  res.json({ success: true });
});

app.get('/api/notifications', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(req.user.id));
});
app.post('/api/notifications/read-all', auth, (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

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

app.get('/api/admin/stats', auth, adminOnly, (req, res) => {
  res.json({
    total_orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    pending_orders: db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'awaiting_payment'").get().c,
    in_progress: db.prepare("SELECT COUNT(*) c FROM orders WHERE status IN ('payment_received','purchased','warehouse_foreign','international_shipping','arrived_syria','out_for_delivery')").get().c,
    delivered: db.prepare("SELECT COUNT(*) c FROM orders WHERE status = 'delivered'").get().c,
    open_support: db.prepare("SELECT COUNT(*) c FROM support_messages WHERE status = 'open'").get().c,
    total_accounts: db.prepare('SELECT COUNT(*) c FROM accounts').get().c,
    total_revenue: db.prepare("SELECT COALESCE(SUM(total_usd),0) s FROM orders WHERE status IN ('delivered','out_for_delivery','arrived_syria')").get().s
  });
});

app.get('/api/admin/orders', auth, adminOnly, (req, res) => {
  const orders = db.prepare(`SELECT o.*, r.name_ar as region_name FROM orders o
    LEFT JOIN regions r ON o.region_id = r.id ORDER BY o.created_at DESC`).all();
  orders.forEach(o => { o.tracking = db.prepare('SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC').all(o.id); });
  res.json(orders);
});

app.put('/api/admin/orders/:id', auth, adminOnly, (req, res) => {
  const { status, admin_adjusted_usd, admin_customs_usd, notes, tracking_note } = req.body;
  const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!o) return res.status(404).json({ detail: 'الطلب غير موجود' });

  if (status && !STATUS_LABELS[status]) return res.status(400).json({ detail: 'حالة غير صحيحة' });

  const newAdjusted = admin_adjusted_usd !== undefined ? admin_adjusted_usd : o.admin_adjusted_usd;
  const newCustoms = admin_customs_usd !== undefined ? admin_customs_usd : o.admin_customs_usd;
  const newNotes = notes !== undefined ? notes : o.notes;

  let newTotal = o.total_usd;
  if (admin_customs_usd !== undefined && admin_customs_usd !== null) {
    const productCost = o.product_price_usd * o.quantity;
    const roundedWeight = Math.ceil(o.weight_kg);
    const pricing = {};
    db.prepare('SELECT * FROM pricing').all().forEach(r => pricing[r.key] = parseFloat(r.value) || 0);
    const perKg = o.shipping_method === 'sea' ? pricing.per_kg_sea : pricing.per_kg_air;
    const shippingCost = roundedWeight * perKg;
    newTotal = productCost + shippingCost + parseFloat(admin_customs_usd);
  }

  db.prepare(`UPDATE orders SET status = COALESCE(?, status), admin_adjusted_usd = ?, admin_customs_usd = ?, total_usd = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(status || null, newAdjusted, newCustoms, +newTotal.toFixed(2), newNotes, req.params.id);

  if (status && status !== o.status) {
    db.prepare('INSERT INTO order_tracking (order_id, status, note) VALUES (?, ?, ?)')
      .run(o.id, status, tracking_note || STATUS_LABELS[status]);
    db.prepare('INSERT INTO notifications (user_id, order_id, title, body) VALUES (?, ?, ?, ?)')
      .run(o.user_id, o.id, 'تحديث حالة الطلب', `طلبك #${o.order_number}: ${STATUS_LABELS[status]}`);
  }

  res.json({ success: true });
});

app.delete('/api/admin/orders/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/pricing', auth, adminOnly, (req, res) => {
  const rows = db.prepare('SELECT * FROM pricing').all();
  const obj = {}; rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});
app.put('/api/admin/pricing', auth, adminOnly, (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO pricing (key, value) VALUES (?, ?)');
  Object.keys(req.body).forEach(k => upsert.run(k, String(req.body[k])));
  res.json({ success: true });
});

app.get('/api/admin/wallets', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM wallets ORDER BY sort_order').all());
});
app.post('/api/admin/wallets', auth, adminOnly, (req, res) => {
  const { network, address, sort_order } = req.body;
  if (!network || !address) return res.status(400).json({ detail: 'الشبكة والعنوان مطلوبان' });
  const r = db.prepare('INSERT INTO wallets (network, address, sort_order) VALUES (?, ?, ?)')
    .run(network, address, sort_order || 0);
  res.json({ success: true, id: r.lastInsertRowid });
});
app.put('/api/admin/wallets/:id', auth, adminOnly, (req, res) => {
  const { network, address, active, sort_order } = req.body;
  db.prepare('UPDATE wallets SET network=?, address=?, active=?, sort_order=? WHERE id=?')
    .run(network, address, active ? 1 : 0, sort_order || 0, req.params.id);
  res.json({ success: true });
});
app.delete('/api/admin/wallets/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM wallets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/stores', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM stores ORDER BY sort_order').all());
});
app.post('/api/admin/stores', auth, adminOnly, (req, res) => {
  const { name_ar, name_en, icon, url_hint, sort_order } = req.body;
  if (!name_ar || !name_en) return res.status(400).json({ detail: 'الاسم العربي والإنجليزي مطلوبان' });
  const r = db.prepare('INSERT INTO stores (name_ar, name_en, icon, url_hint, sort_order) VALUES (?, ?, ?, ?, ?)')
    .run(name_ar, name_en, icon || '🛒', url_hint || '', sort_order || 0);
  res.json({ success: true, id: r.lastInsertRowid });
});
app.put('/api/admin/stores/:id', auth, adminOnly, (req, res) => {
  const { name_ar, name_en, icon, url_hint, active, sort_order } = req.body;
  db.prepare('UPDATE stores SET name_ar=?, name_en=?, icon=?, url_hint=?, active=?, sort_order=? WHERE id=?')
    .run(name_ar, name_en, icon, url_hint, active ? 1 : 0, sort_order || 0, req.params.id);
  res.json({ success: true });
});
app.delete('/api/admin/stores/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM stores WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/testimonials', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT * FROM testimonials ORDER BY sort_order, id DESC').all());
});
app.post('/api/admin/testimonials', auth, adminOnly, (req, res) => {
  const { customer_name, title, description, image_url, video_url, sort_order } = req.body;
  const r = db.prepare('INSERT INTO testimonials (customer_name, title, description, image_url, video_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)')
    .run(customer_name || '', title || '', description || '', image_url || '', video_url || '', sort_order || 0);
  res.json({ success: true, id: r.lastInsertRowid });
});
app.put('/api/admin/testimonials/:id', auth, adminOnly, (req, res) => {
  const { customer_name, title, description, image_url, video_url, active, sort_order } = req.body;
  db.prepare('UPDATE testimonials SET customer_name=?, title=?, description=?, image_url=?, video_url=?, active=?, sort_order=? WHERE id=?')
    .run(customer_name, title, description, image_url, video_url, active ? 1 : 0, sort_order || 0, req.params.id);
  res.json({ success: true });
});
app.delete('/api/admin/testimonials/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/content', auth, adminOnly, (req, res) => {
  const rows = db.prepare('SELECT * FROM content').all();
  const obj = {}; rows.forEach(r => obj[r.key] = r.value);
  res.json(obj);
});
app.put('/api/admin/content', auth, adminOnly, (req, res) => {
  const upsert = db.prepare('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)');
  Object.keys(req.body).forEach(k => upsert.run(k, String(req.body[k] || '')));
  res.json({ success: true });
});

app.get('/api/admin/countries', auth, adminOnly, (req, res) => {
  const countries = db.prepare('SELECT * FROM countries ORDER BY sort_order').all();
  countries.forEach(c => { c.regions = db.prepare('SELECT * FROM regions WHERE country_id = ? ORDER BY name_ar').all(c.id); });
  res.json(countries);
});
app.post('/api/admin/countries', auth, adminOnly, (req, res) => {
  const { name_ar, name_en, flag, sort_order } = req.body;
  if (!name_ar || !name_en) return res.status(400).json({ detail: 'الاسم مطلوب' });
  const r = db.prepare('INSERT INTO countries (name_ar, name_en, flag, sort_order) VALUES (?, ?, ?, ?)')
    .run(name_ar, name_en, flag || '🌐', sort_order || 0);
  res.json({ success: true, id: r.lastInsertRowid });
});
app.put('/api/admin/countries/:id', auth, adminOnly, (req, res) => {
  const { name_ar, name_en, flag, active, sort_order } = req.body;
  db.prepare('UPDATE countries SET name_ar=?, name_en=?, flag=?, active=?, sort_order=? WHERE id=?')
    .run(name_ar, name_en, flag, active ? 1 : 0, sort_order || 0, req.params.id);
  res.json({ success: true });
});
app.delete('/api/admin/countries/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM countries WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/regions', auth, adminOnly, (req, res) => {
  const { country_id, name_ar, delivery_fee_usd } = req.body;
  if (!country_id || !name_ar) return res.status(400).json({ detail: 'الدولة والاسم مطلوبان' });
  const r = db.prepare('INSERT INTO regions (country_id, name_ar, delivery_fee_usd) VALUES (?, ?, ?)')
    .run(country_id, name_ar, delivery_fee_usd || 0);
  res.json({ success: true, id: r.lastInsertRowid });
});
app.put('/api/admin/regions/:id', auth, adminOnly, (req, res) => {
  const { name_ar, delivery_fee_usd, active } = req.body;
  db.prepare('UPDATE regions SET name_ar=?, delivery_fee_usd=?, active=? WHERE id=?')
    .run(name_ar, delivery_fee_usd, active ? 1 : 0, req.params.id);
  res.json({ success: true });
});
app.delete('/api/admin/regions/:id', auth, adminOnly, (req, res) => {
  db.prepare('DELETE FROM regions WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/accounts', auth, adminOnly, (req, res) => {
  res.json(db.prepare('SELECT id, email, phone, name, banned, is_admin, created_at FROM accounts ORDER BY id DESC').all());
});
app.put('/api/admin/accounts/:id', auth, adminOnly, (req, res) => {
  db.prepare('UPDATE accounts SET banned = ? WHERE id = ?').run(req.body.banned ? 1 : 0, req.params.id);
  res.json({ success: true });
});
app.delete('/api/admin/accounts/:id', auth, adminOnly, (req, res) => {
  if (req.params.id == req.user.id) return res.status(400).json({ detail: 'لا يمكن حذف حسابك' });
  db.prepare('DELETE FROM accounts WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/support', auth, adminOnly, (req, res) => {
  res.json(db.prepare(`SELECT s.*, a.email as user_email, a.phone as user_phone
    FROM support_messages s JOIN accounts a ON s.user_id = a.id
    ORDER BY s.created_at DESC`).all());
});
app.post('/api/admin/support/:id/reply', auth, adminOnly, (req, res) => {
  const { reply } = req.body;
  if (!reply) return res.status(400).json({ detail: 'الرد مطلوب' });
  db.prepare("UPDATE support_messages SET reply=?, status='answered', replied_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(reply.trim(), req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/broadcast', auth, adminOnly, (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ detail: 'العنوان مطلوب' });
  const users = db.prepare('SELECT id FROM accounts WHERE banned = 0').all();
  const ins = db.prepare('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)');
  users.forEach(u => ins.run(u.id, title, body || ''));
  res.json({ success: true, count: users.length });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log('\n════════════════════════════════════════');
  console.log('   📦  وصلني — منصة الوساطة اللوجستية');
  console.log('   🌐  http://localhost:' + PORT);
  console.log('   👤  admin@gmail.com  /  Admin@123');
  console.log('════════════════════════════════════════\n');
});
