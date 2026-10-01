BigInt.prototype.toJSON = function() { return Number(this); };

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@libsql/client');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== متغيرات البيئة ====================
const JWT_SECRET = process.env.JWT_SECRET || 'wasalni-dev-secret-change-me';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@gmail.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';
const ADMIN_PANEL_PATH = process.env.ADMIN_PANEL_PATH || 'panel-secret';
const WALLET_TRC20 = process.env.WALLET_TRC20 || 'TXYZabcdefghijklmnopqrstuvwxyz123456';
const WALLET_BEP20 = process.env.WALLET_BEP20 || '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0';
const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

// ==================== قاعدة البيانات ====================
let db;
if (TURSO_URL && TURSO_TOKEN) {
  console.log('☁️  الاتصال بـ Turso:', TURSO_URL);
  db = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN, intMode: 'number' });
} else {
  console.log('📂 قاعدة بيانات محلية (file:local.db)');
  db = createClient({ url: 'file:local.db', intMode: 'number' });
}

// ==================== Helpers ====================
async function run(sql, args = []) {
  return await db.execute({ sql, args });
}
async function get(sql, args = []) {
  const r = await db.execute({ sql, args });
  return r.rows[0] || null;
}
async function all(sql, args = []) {
  const r = await db.execute({ sql, args });
  return r.rows || [];
}

// ==================== إنشاء الجداول ====================
async function initDb() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE, phone TEXT UNIQUE, name TEXT NOT NULL,
      password_hash TEXT NOT NULL, banned INTEGER DEFAULT 0, is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS countries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL, name_en TEXT NOT NULL, flag TEXT DEFAULT '🌐',
      active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS regions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      country_id INTEGER NOT NULL, name_ar TEXT NOT NULL,
      delivery_fee_usd REAL DEFAULT 0, active INTEGER DEFAULT 1
    )`,
    `CREATE TABLE IF NOT EXISTS stores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name_ar TEXT NOT NULL, name_en TEXT NOT NULL, icon TEXT DEFAULT '🛒',
      url_hint TEXT DEFAULT '', active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL, user_name TEXT,
      country_id INTEGER, region_id INTEGER,
      receiver_name TEXT NOT NULL, receiver_phone TEXT NOT NULL, full_address TEXT NOT NULL,
      store_name TEXT, product_title TEXT NOT NULL, product_url TEXT NOT NULL,
      product_image TEXT, customer_description TEXT, quantity INTEGER DEFAULT 1,
      admin_quote_price REAL, admin_quote_shipping REAL, admin_quote_customs REAL,
      admin_quote_notes TEXT, quote_sent_at DATETIME, quote_approved_at DATETIME,
      product_price_usd REAL DEFAULT 0, weight_kg REAL DEFAULT 1, shipping_method TEXT DEFAULT 'air',
      shipping_cost_usd REAL DEFAULT 0, customs_usd REAL DEFAULT 0,
      commission_usd REAL DEFAULT 0, delivery_fee_usd REAL DEFAULT 0, total_usd REAL DEFAULT 0,
      admin_adjusted_usd REAL, admin_customs_usd REAL,
      wallet_network TEXT, tx_ref TEXT, tx_proof_url TEXT,
      status TEXT DEFAULT 'pending_quote', notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS order_tracking (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL, status TEXT NOT NULL,
      note TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS pricing (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      network TEXT NOT NULL, address TEXT NOT NULL,
      active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS testimonials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT, title TEXT, description TEXT,
      image_url TEXT DEFAULT '', video_url TEXT DEFAULT '',
      active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS content (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS contact_methods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL, label TEXT NOT NULL, value TEXT NOT NULL,
      icon TEXT DEFAULT '💬', active INTEGER DEFAULT 1, sort_order INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS support_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL, user_name TEXT,
      message TEXT NOT NULL, reply TEXT, status TEXT DEFAULT 'open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, replied_at DATETIME
    )`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL, order_id INTEGER,
      title TEXT NOT NULL, body TEXT DEFAULT '',
      read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  for (const sql of tables) {
    try { await db.execute(sql); } catch (e) { console.log('⚠️ جدول:', e.message); }
  }

  // ترحيلات (ALTER TABLE)
  const migrations = [
    'ALTER TABLE orders ADD COLUMN customer_description TEXT',
    'ALTER TABLE orders ADD COLUMN admin_quote_price REAL',
    'ALTER TABLE orders ADD COLUMN admin_quote_shipping REAL',
    'ALTER TABLE orders ADD COLUMN admin_quote_customs REAL',
    'ALTER TABLE orders ADD COLUMN admin_quote_notes TEXT',
    'ALTER TABLE orders ADD COLUMN quote_sent_at DATETIME',
    'ALTER TABLE orders ADD COLUMN quote_approved_at DATETIME'
  ];
  for (const m of migrations) {
    try { await db.execute(m); } catch (e) { /* العمود موجود مسبقاً */ }
  }

  console.log('✅ الجداول جاهزة');
}

// ==================== الحالات ====================
const STATUS_LABELS = {
  pending_quote: '📩 طلب عرض سعر',
  quote_sent: '💰 وصل عرض السعر — بانتظار موافقتك',
  quote_rejected: '❌ رفضت عرض السعر',
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

// ==================== Seed ====================
async function seed() {
  // الإعدادات
  const settingsSeed = [
    ['per_kg_air', '5'],
    ['per_kg_sea', '2'],
    ['customs_percent', '5'],
    ['usdt_rate', '1']
  ];
  for (const [k, v] of settingsSeed) {
    try { await run('INSERT OR IGNORE INTO pricing (key, value) VALUES (?, ?)', [k, v]); } catch (e) {}
  }

  const contentSeed = [
    ['site_name', 'وصلني'],
    ['site_tagline', 'وسيطك للتسوق من أمازون والعالم — نوصلك إلى سوريا'],
    ['hero_title', '🛒 تسوّق من أي متجر عالمي... ونوصلك إلى سوريا'],
    ['hero_subtitle', 'الصق رابط المنتج، اكتب طلبك بالتفصيل، ونرسل لك السعر النهائي — دفع بالكريبتو وتوصيل إلى بابك.'],
    ['about_text', 'وصلني هي منصة وساطة تسوق ولوجستيات دولية، تتيح لأهلنا في سوريا الشراء من أكبر المتاجر العالمية (Amazon, AliExpress, eBay وغيرها) ودفع المبلغ بالكريبتو USDT، ثم تتبع شحنتهم مرحلة بمرحلة حتى الاستلام في سوريا.'],
    ['terms_text', 'الشروط والأحكام:\n\n1. المنصة تعمل كوسيط تسوق ولوجستيات، وليست متجراً مباشراً.\n2. العميل مسؤول عن صحة المعلومات المُدخلة (الاسم، العنوان، رقم الهاتف).\n3. مدة التسليم تقديرية: من 3 إلى 6 أسابيع حسب الوزن والدولة المصدرة.\n4. الأسعار المعروضة تقديرية وتُثبَّت نهائياً بعد عرض السعر من الإدارة.\n5. الدفع بالكريبتو USDT فقط (شبكات TRC20 / BEP20).'],
    ['refund_text', 'سياسة الاسترجاع والضمان:\n\n1. في حال عدم وصول الشحنة خلال 8 أسابيع، يتم استرجاع كامل المبلغ بالـ USDT.\n2. في حال تلف المنتج أثناء الشحن، يتم تعويض العميل بقيمته الكاملة.\n3. لا يمكن الاسترجاع في حال كان المنتج مطابقاً للمواصفات ولم يحصل أي ضرر.\n4. طلبات الإلغاء قبل الشراء من المتجر: استرجاع كامل بدون خصومات.\n5. بعد الشراء من المتجر وقبل الشحن: استرجاع بنسبة 70%.\n6. بعد الشحن: لا يمكن الإلغاء.'],
    ['legal_text', 'الإشعار القانوني وسياسة الخصوصية:\n\n1. جميع البيانات المُدخلة (الاسم، الهاتف، العنوان) تُستخدم فقط لتنفيذ الطلب ولا يتم مشاركتها مع أي طرف ثالث.\n2. المنصة تحفظ البيانات بأمان ويمكن للعميل طلب حذف حسابه في أي وقت.\n3. التعاملات المالية بالكريبتو غير قابلة للعكس بعد التأكيد، إلا وفقاً لسياسة الاسترجاع.\n4. المنصة لا تتحمل أي مسؤولية عن التأخير الناتج عن إجراءات جمركية أو ظروف قاهرة.\n5. استخدام المنصة يعني الموافقة الكاملة على هذه الشروط.'],
    ['warranty_note', 'ضمان استرجاع كامل للـ USDT عند عدم وصول الشحنة.']
  ];
  for (const [k, v] of contentSeed) {
    try { await run('INSERT OR IGNORE INTO content (key, value) VALUES (?, ?)', [k, v]); } catch (e) {}
  }

  // حساب الأدمن
  try {
    const existingAdmin = await get('SELECT id FROM accounts WHERE email = ?', [ADMIN_EMAIL]);
    if (!existingAdmin) {
      const hash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
      await run('INSERT INTO accounts (email, phone, name, password_hash, is_admin) VALUES (?, ?, ?, ?, 1)',
        [ADMIN_EMAIL, '0900000000', 'مدير وصلني', hash]);
      console.log('✅ تم إنشاء حساب الأدمن:', ADMIN_EMAIL);
    } else {
      await run('UPDATE accounts SET is_admin = 1 WHERE email = ?', [ADMIN_EMAIL]);
      console.log('✅ الأدمن موجود:', ADMIN_EMAIL);
    }
  } catch (e) { console.log('⚠️ الأدمن:', e.message); }

  // الدول
  try {
    const cCount = (await get('SELECT COUNT(*) as c FROM countries')).c;
    if (cCount === 0) {
      const countries = [
        ['سوريا', 'Syria', '🇸🇾', 1],
        ['لبنان', 'Lebanon', '🇱🇧', 2],
        ['العراق', 'Iraq', '🇮🇶', 3],
        ['الأردن', 'Jordan', '🇯🇴', 4]
      ];
      for (const [ar, en, flag, so] of countries) {
        await run('INSERT INTO countries (name_ar, name_en, flag, sort_order) VALUES (?, ?, ?, ?)', [ar, en, flag, so]);
      }
    }
  } catch (e) { console.log('⚠️ الدول:', e.message); }

  // المحافظ السورية
  try {
    const syria = await get("SELECT id FROM countries WHERE name_en='Syria'");
    if (syria) {
      const rCount = (await get('SELECT COUNT(*) as c FROM regions WHERE country_id=?', [syria.id])).c;
      if (rCount === 0) {
        const gov = ['دمشق','ريف دمشق','حلب','حمص','حماة','اللاذقية','طرطوس','إدلب','دير الزور','الرقة','الحسكة','درعا','السويداء','القنيطرة'];
        for (const name of gov) {
          await run('INSERT INTO regions (country_id, name_ar, delivery_fee_usd) VALUES (?, ?, 0)', [syria.id, name]);
        }
      }
    }
  } catch (e) { console.log('⚠️ المحافظ:', e.message); }

  // المتاجر
  try {
    const sCount = (await get('SELECT COUNT(*) as c FROM stores')).c;
    if (sCount === 0) {
      const stores = [
        ['أمازون', 'Amazon', '🅰️', 'amazon.com', 1],
        ['علي إكسبريس', 'AliExpress', '🅰️', 'aliexpress.com', 2],
        ['إي باي', 'eBay', '🅴', 'ebay.com', 3],
        ['وول مارت', 'Walmart', '🆆', 'walmart.com', 4],
        ['متجر مخصص', 'Custom', '🌐', '', 5]
      ];
      for (const [ar, en, ic, hint, so] of stores) {
        await run('INSERT INTO stores (name_ar, name_en, icon, url_hint, sort_order) VALUES (?, ?, ?, ?, ?)', [ar, en, ic, hint, so]);
      }
    }
  } catch (e) { console.log('⚠️ المتاجر:', e.message); }

  // المحافظ
  try {
    const wCount = (await get('SELECT COUNT(*) as c FROM wallets')).c;
    if (wCount === 0) {
      await run('INSERT INTO wallets (network, address, sort_order) VALUES (?, ?, ?)', ['TRC20', WALLET_TRC20, 1]);
      await run('INSERT INTO wallets (network, address, sort_order) VALUES (?, ?, ?)', ['BEP20', WALLET_BEP20, 2]);
      console.log('✅ تم إدخال المحافظ');
    }
  } catch (e) { console.log('⚠️ المحافظ:', e.message); }

  // طرق التواصل
  try {
    const cmCount = (await get('SELECT COUNT(*) as c FROM contact_methods')).c;
    if (cmCount === 0) {
      await run('INSERT INTO contact_methods (type, label, value, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
        ['whatsapp', 'واتساب الأعمال', '+963900000000', '📱', 1]);
      await run('INSERT INTO contact_methods (type, label, value, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
        ['telegram', 'قناة تلغرام', 'wasalni', '✈️', 2]);
    }
  } catch (e) { console.log('⚠️ التواصل:', e.message); }

  // إثباتات التسليم
  try {
    const tCount = (await get('SELECT COUNT(*) as c FROM testimonials')).c;
    if (tCount === 0) {
      const testi = [
        ['أحمد من دمشق', 'آيفون 15 برو', 'وصلني الجهاز بأسبوعين فقط، مغلق وبتغليف أصلي.', 'https://images.unsplash.com/photo-1592286927505-1def25115558?w=400'],
        ['سارة من حلب', 'لابتوب ماك بوك', 'وصل اللابتوب بحالة ممتازة، فريق وصلني محترف.', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400']
      ];
      for (const [name, title, desc, img] of testi) {
        await run('INSERT INTO testimonials (customer_name, title, description, image_url) VALUES (?, ?, ?, ?)',
          [name, title, desc, img]);
      }
    }
  } catch (e) { console.log('⚠️ الإثباتات:', e.message); }

  console.log('✅ Seed اكتمل');
}

// ==================== Middleware ====================
app.use(cors());
app.use(express.json({ limit: '12mb' }));
app.use(express.static(path.join(__dirname, 'public')));

async function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ detail: 'غير مصرح' });
  try {
    const d = jwt.verify(h.replace('Bearer ', ''), JWT_SECRET);
    const u = await get('SELECT id, email, phone, name, is_admin, banned FROM accounts WHERE id = ?', [d.id]);
    if (!u) return res.status(401).json({ detail: 'حساب غير موجود' });
    if (u.banned) return res.status(403).json({ detail: 'هذا الحساب محظور' });
    req.user = u;
    next();
  } catch (e) { return res.status(401).json({ detail: 'انتهت الجلسة' }); }
}

function adminOnly(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ detail: 'صلاحيات المدير مطلوبة' });
  next();
}

const RE_EMAIL = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
const RE_PHONE = /^09\d{8}$/;
const RE_PASSWORD = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_\-+=\[\]{};:'",.<>\/?\\|`~]).{8,}$/;

// ==================== المصادقة ====================
app.post('/api/auth/register', async (req, res) => {
  const { name, email, phone, password } = req.body;
  if (!name || name.trim().length < 3) return res.status(400).json({ detail: 'الاسم مطلوب' });
  if (!email || !RE_EMAIL.test(email)) return res.status(400).json({ detail: 'البريد يجب أن ينتهي بـ @gmail.com' });
  if (!phone || !RE_PHONE.test(phone)) return res.status(400).json({ detail: 'رقم الهاتف 10 أرقام يبدأ بـ 09' });
  if (!password || !RE_PASSWORD.test(password)) return res.status(400).json({ detail: 'كلمة المرور: 8+ أحرف وأرقام ورموز' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const isAdmin = (email.toLowerCase().trim() === ADMIN_EMAIL) ? 1 : 0;
    const result = await run(
      'INSERT INTO accounts (email, phone, name, password_hash, is_admin) VALUES (?, ?, ?, ?, ?)',
      [email.toLowerCase(), phone, name.trim(), hash, isAdmin]
    );
    const u = await get('SELECT id, email, phone, name, is_admin FROM accounts WHERE id = ?', [result.lastInsertRowid]);
    const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: u });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      if (e.message.includes('email')) return res.status(400).json({ detail: 'البريد مسجل مسبقاً' });
      if (e.message.includes('phone')) return res.status(400).json({ detail: 'الهاتف مسجل مسبقاً' });
    }
    res.status(500).json({ detail: 'خطأ في التسجيل: ' + e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) return res.status(400).json({ detail: 'املأ الحقول' });
  try {
    const u = await get('SELECT * FROM accounts WHERE email = ? OR phone = ?', [identifier.toLowerCase(), identifier]);
    if (!u) return res.status(401).json({ detail: 'بيانات الدخول غير صحيحة' });
    if (u.banned) return res.status(403).json({ detail: 'هذا الحساب محظور' });
    if (!bcrypt.compareSync(password, u.password_hash)) return res.status(401).json({ detail: 'بيانات الدخول غير صحيحة' });
    const token = jwt.sign({ id: u.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: u.id, email: u.email, phone: u.phone, name: u.name, is_admin: u.is_admin } });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  const user = { ...req.user };
  if (user.is_admin) user.admin_path = ADMIN_PANEL_PATH;
  res.json({ user });
});

// ==================== البيانات العامة ====================
app.get('/api/public/data', async (req, res) => {
  try {
    const content = {};
    const contentRows = await all('SELECT * FROM content');
    contentRows.forEach(r => content[r.key] = r.value);

    const pricing = {};
    const pricingRows = await all('SELECT * FROM pricing');
    pricingRows.forEach(r => pricing[r.key] = parseFloat(r.value) || 0);

    const countries = await all('SELECT * FROM countries WHERE active = 1 ORDER BY sort_order');
    const regions = await all(`SELECT r.*, c.name_ar as country_name FROM regions r JOIN countries c ON r.country_id = c.id WHERE r.active = 1 ORDER BY r.name_ar`);
    const stores = await all('SELECT * FROM stores WHERE active = 1 ORDER BY sort_order');
    const wallets = await all('SELECT * FROM wallets WHERE active = 1 ORDER BY sort_order');
    const testimonials = await all('SELECT * FROM testimonials WHERE active = 1 ORDER BY sort_order, id DESC');
    const contact_methods = await all('SELECT * FROM contact_methods WHERE active = 1 ORDER BY sort_order');

    res.json({ content, pricing, countries, regions, stores, wallets, testimonials, contact_methods, status_labels: STATUS_LABELS });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== الطلبات ====================
function genOrderNumber() {
  const d = new Date();
  const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  const rnd = Math.floor(1000 + Math.random() * 9000);
  return 'WS-' + ymd + '-' + rnd;
}

app.post('/api/orders', auth, async (req, res) => {
  const { region_id, receiver_name, receiver_phone, full_address,
    store_name, product_title, product_url, customer_description, quantity = 1 } = req.body;

  if (!receiver_name || receiver_name.trim().split(/\s+/).length < 3)
    return res.status(400).json({ detail: 'الاسم الثلاثي للمستلم مطلوب' });
  if (!receiver_phone || !RE_PHONE.test(receiver_phone))
    return res.status(400).json({ detail: 'رقم هاتف المستلم 10 أرقام يبدأ بـ 09' });
  if (!full_address || full_address.trim().length < 5)
    return res.status(400).json({ detail: 'العنوان الكامل مطلوب' });
  if (!product_title || !product_url)
    return res.status(400).json({ detail: 'عنوان المنتج ورابطه مطلوبان' });
  if (!customer_description || customer_description.trim().length < 5)
    return res.status(400).json({ detail: 'اكتب وصف ما تريده بالتفصيل' });
  if (!region_id) return res.status(400).json({ detail: 'المحافظة مطلوبة' });

  try {
    const region = await get('SELECT * FROM regions WHERE id = ?', [region_id]);
    if (!region) return res.status(400).json({ detail: 'المحافظة غير موجودة' });
    const country = await get('SELECT * FROM countries WHERE id = ?', [region.country_id]);

    const orderNumber = genOrderNumber();
    const userName = req.user.name || 'عميل';

    const result = await run(`INSERT INTO orders
      (order_number, user_id, user_name, country_id, region_id,
       receiver_name, receiver_phone, full_address,
       store_name, product_title, product_url, customer_description, quantity,
       product_price_usd, weight_kg, shipping_method,
       shipping_cost_usd, customs_usd, commission_usd, delivery_fee_usd, total_usd, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [orderNumber, req.user.id, userName, country ? country.id : null, region.id,
       receiver_name.trim(), receiver_phone, full_address.trim(),
       store_name || '', product_title.trim(), product_url.trim(),
       customer_description.trim(), Math.max(1, parseInt(quantity)),
       0, 1, 'air', 0, 0, 0, 0, 0, 'pending_quote']);

    const orderId = result.lastInsertRowid;

    await run('INSERT INTO order_tracking (order_id, status, note) VALUES (?, ?, ?)',
      [orderId, 'pending_quote', 'استلمنا طلبك وسنرسل لك عرض السعر قريباً']);
    await run('INSERT INTO notifications (user_id, order_id, title, body) VALUES (?, ?, ?, ?)',
      [req.user.id, orderId, '📩 تم إنشاء طلبك', `طلبك #${orderNumber} — سنرسل لك السعر قريباً`]);

    res.json({ success: true, order_id: orderId, order_number: orderNumber });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.get('/api/orders/mine', auth, async (req, res) => {
  try {
    const orders = await all(`SELECT o.*, r.name_ar as region_name, c.name_ar as country_name
      FROM orders o LEFT JOIN regions r ON o.region_id = r.id
      LEFT JOIN countries c ON o.country_id = c.id
      WHERE o.user_id = ? ORDER BY o.created_at DESC`, [req.user.id]);
    for (const o of orders) {
      o.tracking = await all('SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC', [o.id]);
    }
    res.json(orders);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.get('/api/orders/:id', auth, async (req, res) => {
  try {
    const o = await get(`SELECT o.*, r.name_ar as region_name, c.name_ar as country_name
      FROM orders o LEFT JOIN regions r ON o.region_id = r.id
      LEFT JOIN countries c ON o.country_id = c.id WHERE o.id = ?`, [req.params.id]);
    if (!o) return res.status(404).json({ detail: 'الطلب غير موجود' });
    if (o.user_id !== req.user.id && !req.user.is_admin) return res.status(403).json({ detail: 'غير مصرح' });
    o.tracking = await all('SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC', [o.id]);
    res.json(o);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.post('/api/orders/:id/approve-quote', auth, async (req, res) => {
  try {
    const o = await get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!o) return res.status(404).json({ detail: 'الطلب غير موجود' });
    if (o.status !== 'quote_sent') return res.status(400).json({ detail: 'لا يوجد عرض سعر للموافقة' });

    await run(`UPDATE orders SET status = 'awaiting_payment',
      quote_approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [o.id]);
    await run('INSERT INTO order_tracking (order_id, status, note) VALUES (?, ?, ?)',
      [o.id, 'awaiting_payment', 'وافقت على عرض السعر — بانتظار الدفع']);
    await run('INSERT INTO notifications (user_id, order_id, title, body) VALUES (?, ?, ?, ?)',
      [o.user_id, o.id, '✅ وافقت على السعر', `الرجاء تحويل $${o.total_usd.toFixed(2)} USDT لإتمام الطلب`]);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.post('/api/orders/:id/reject-quote', auth, async (req, res) => {
  try {
    const o = await get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!o) return res.status(404).json({ detail: 'الطلب غير موجود' });
    if (o.status !== 'quote_sent') return res.status(400).json({ detail: 'لا يوجد عرض سعر' });

    await run(`UPDATE orders SET status = 'quote_rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [o.id]);
    await run('INSERT INTO order_tracking (order_id, status, note) VALUES (?, ?, ?)',
      [o.id, 'quote_rejected', 'رفض الزبون عرض السعر']);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.post('/api/orders/:id/submit-payment', auth, async (req, res) => {
  const { wallet_network, tx_ref, tx_proof_url } = req.body;
  try {
    const o = await get('SELECT * FROM orders WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!o) return res.status(404).json({ detail: 'الطلب غير موجود' });
    if (!tx_ref || tx_ref.trim().length < 6) return res.status(400).json({ detail: 'رقم التحويل (TxID) مطلوب' });

    await run('UPDATE orders SET wallet_network=?, tx_ref=?, tx_proof_url=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [wallet_network || '', tx_ref.trim(), tx_proof_url || '', req.params.id]);
    await run('INSERT INTO order_tracking (order_id, status, note) VALUES (?, ?, ?)',
      [o.id, 'awaiting_payment', 'تم إرسال إثبات الدفع — بانتظار مراجعة الإدارة']);
    await run('INSERT INTO notifications (user_id, order_id, title, body) VALUES (?, ?, ?, ?)',
      [req.user.id, o.id, 'تم استلام إثبات الدفع', 'سنراجع التحويل ونؤكد الطلب قريباً']);

    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== الإشعارات ====================
app.get('/api/notifications', auth, async (req, res) => {
  try {
    const list = await all('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 30', [req.user.id]);
    res.json(list);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.post('/api/notifications/read-all', auth, async (req, res) => {
  try {
    await run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.user.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== الدعم ====================
app.post('/api/support', auth, async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ detail: 'الرسالة مطلوبة' });
  try {
    const userName = req.user.name || 'عميل';
    const result = await run('INSERT INTO support_messages (user_id, user_name, message) VALUES (?, ?, ?)',
      [req.user.id, userName, message.trim()]);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.get('/api/support/mine', auth, async (req, res) => {
  try {
    const list = await all('SELECT * FROM support_messages WHERE user_id = ? ORDER BY created_at ASC', [req.user.id]);
    res.json(list);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.get('/api/contact-methods', async (req, res) => {
  try {
    const list = await all('SELECT * FROM contact_methods WHERE active = 1 ORDER BY sort_order');
    res.json(list);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== الأدمن ====================
app.get('/api/admin/stats', auth, adminOnly, async (req, res) => {
  try {
    const stats = {
      total_orders: (await get('SELECT COUNT(*) as c FROM orders')).c,
      pending_quote: (await get("SELECT COUNT(*) as c FROM orders WHERE status = 'pending_quote'")).c,
      awaiting_payment: (await get("SELECT COUNT(*) as c FROM orders WHERE status = 'awaiting_payment'")).c,
      in_progress: (await get("SELECT COUNT(*) as c FROM orders WHERE status IN ('payment_received','purchased','warehouse_foreign','international_shipping','arrived_syria','out_for_delivery')")).c,
      delivered: (await get("SELECT COUNT(*) as c FROM orders WHERE status = 'delivered'")).c,
      open_support: (await get("SELECT COUNT(*) as c FROM support_messages WHERE status = 'open'")).c,
      total_accounts: (await get('SELECT COUNT(*) as c FROM accounts')).c,
      total_revenue: (await get("SELECT COALESCE(SUM(total_usd),0) as s FROM orders WHERE status IN ('delivered','out_for_delivery','arrived_syria')")).s
    };
    res.json(stats);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.get('/api/admin/orders', auth, adminOnly, async (req, res) => {
  try {
    const orders = await all(`SELECT o.*, r.name_ar as region_name, u.email as user_email, u.phone as user_phone
      FROM orders o LEFT JOIN regions r ON o.region_id = r.id
      LEFT JOIN accounts u ON o.user_id = u.id ORDER BY o.created_at DESC`);
    for (const o of orders) {
      o.tracking = await all('SELECT * FROM order_tracking WHERE order_id = ? ORDER BY created_at ASC', [o.id]);
    }
    res.json(orders);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.post('/api/admin/orders/:id/send-quote', auth, adminOnly, async (req, res) => {
  const { amazon_price, shipping_cost, customs, notes } = req.body;
  try {
    const o = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!o) return res.status(404).json({ detail: 'الطلب غير موجود' });

    const ap = parseFloat(amazon_price) || 0;
    const sc = parseFloat(shipping_cost) || 0;
    const cu = parseFloat(customs) || 0;
    const total = ap + sc + cu;

    await run(`UPDATE orders SET admin_quote_price = ?, admin_quote_shipping = ?, admin_quote_customs = ?,
      admin_quote_notes = ?, total_usd = ?, status = 'quote_sent',
      quote_sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [ap, sc, cu, notes || '', +total.toFixed(2), req.params.id]);

    await run('INSERT INTO order_tracking (order_id, status, note) VALUES (?, ?, ?)',
      [o.id, 'quote_sent', `تم إرسال عرض السعر: $${total.toFixed(2)}`]);
    await run('INSERT INTO notifications (user_id, order_id, title, body) VALUES (?, ?, ?, ?)',
      [o.user_id, o.id, '💰 وصل عرض السعر', `طلبك #${o.order_number}: الإجمالي $${total.toFixed(2)} USDT`]);

    res.json({ success: true, total });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.put('/api/admin/orders/:id', auth, adminOnly, async (req, res) => {
  const { status, notes, tracking_note } = req.body;
  try {
    const o = await get('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (!o) return res.status(404).json({ detail: 'الطلب غير موجود' });
    if (status && !STATUS_LABELS[status]) return res.status(400).json({ detail: 'حالة غير صحيحة' });

    const newNotes = notes !== undefined ? notes : o.notes;
    await run(`UPDATE orders SET status = COALESCE(?, status), notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [status || null, newNotes, req.params.id]);

    if (status && status !== o.status) {
      await run('INSERT INTO order_tracking (order_id, status, note) VALUES (?, ?, ?)',
        [o.id, status, tracking_note || STATUS_LABELS[status]]);
      await run('INSERT INTO notifications (user_id, order_id, title, body) VALUES (?, ?, ?, ?)',
        [o.user_id, o.id, 'تحديث حالة الطلب', `طلبك #${o.order_number}: ${STATUS_LABELS[status]}`]);
    }

    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

app.delete('/api/admin/orders/:id', auth, adminOnly, async (req, res) => {
  try {
    await run('DELETE FROM orders WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== المحافظ ====================
app.get('/api/admin/wallets', auth, adminOnly, async (req, res) => {
  try { res.json(await all('SELECT * FROM wallets ORDER BY sort_order')); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});
app.post('/api/admin/wallets', auth, adminOnly, async (req, res) => {
  const { network, address, sort_order } = req.body;
  if (!network || !address) return res.status(400).json({ detail: 'الشبكة والعنوان مطلوبان' });
  try {
    const r = await run('INSERT INTO wallets (network, address, sort_order) VALUES (?, ?, ?)', [network, address, sort_order || 0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.put('/api/admin/wallets/:id', auth, adminOnly, async (req, res) => {
  const { network, address, active, sort_order } = req.body;
  try {
    await run('UPDATE wallets SET network=?, address=?, active=?, sort_order=? WHERE id=?',
      [network, address, active ? 1 : 0, sort_order || 0, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.delete('/api/admin/wallets/:id', auth, adminOnly, async (req, res) => {
  try { await run('DELETE FROM wallets WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== طرق التواصل ====================
app.get('/api/admin/contact-methods', auth, adminOnly, async (req, res) => {
  try { res.json(await all('SELECT * FROM contact_methods ORDER BY sort_order')); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});
app.post('/api/admin/contact-methods', auth, adminOnly, async (req, res) => {
  const { type, label, value, icon, sort_order } = req.body;
  if (!type || !label || !value) return res.status(400).json({ detail: 'النوع والاسم والقيمة مطلوبة' });
  try {
    const r = await run('INSERT INTO contact_methods (type, label, value, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
      [type, label, value, icon || '💬', sort_order || 0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.put('/api/admin/contact-methods/:id', auth, adminOnly, async (req, res) => {
  const { type, label, value, icon, active, sort_order } = req.body;
  try {
    await run('UPDATE contact_methods SET type=?, label=?, value=?, icon=?, active=?, sort_order=? WHERE id=?',
      [type, label, value, icon, active ? 1 : 0, sort_order || 0, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.delete('/api/admin/contact-methods/:id', auth, adminOnly, async (req, res) => {
  try { await run('DELETE FROM contact_methods WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== المتاجر ====================
app.get('/api/admin/stores', auth, adminOnly, async (req, res) => {
  try { res.json(await all('SELECT * FROM stores ORDER BY sort_order')); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});
app.post('/api/admin/stores', auth, adminOnly, async (req, res) => {
  const { name_ar, name_en, icon, url_hint, sort_order } = req.body;
  if (!name_ar || !name_en) return res.status(400).json({ detail: 'الاسم مطلوب' });
  try {
    const r = await run('INSERT INTO stores (name_ar, name_en, icon, url_hint, sort_order) VALUES (?, ?, ?, ?, ?)',
      [name_ar, name_en, icon || '🛒', url_hint || '', sort_order || 0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.put('/api/admin/stores/:id', auth, adminOnly, async (req, res) => {
  const { name_ar, name_en, icon, url_hint, active, sort_order } = req.body;
  try {
    await run('UPDATE stores SET name_ar=?, name_en=?, icon=?, url_hint=?, active=?, sort_order=? WHERE id=?',
      [name_ar, name_en, icon, url_hint, active ? 1 : 0, sort_order || 0, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.delete('/api/admin/stores/:id', auth, adminOnly, async (req, res) => {
  try { await run('DELETE FROM stores WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== الإثباتات ====================
app.get('/api/admin/testimonials', auth, adminOnly, async (req, res) => {
  try { res.json(await all('SELECT * FROM testimonials ORDER BY sort_order, id DESC')); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});
app.post('/api/admin/testimonials', auth, adminOnly, async (req, res) => {
  const { customer_name, title, description, image_url, video_url, sort_order } = req.body;
  try {
    const r = await run('INSERT INTO testimonials (customer_name, title, description, image_url, video_url, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [customer_name || '', title || '', description || '', image_url || '', video_url || '', sort_order || 0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.put('/api/admin/testimonials/:id', auth, adminOnly, async (req, res) => {
  const { customer_name, title, description, image_url, video_url, active, sort_order } = req.body;
  try {
    await run('UPDATE testimonials SET customer_name=?, title=?, description=?, image_url=?, video_url=?, active=?, sort_order=? WHERE id=?',
      [customer_name, title, description, image_url, video_url, active ? 1 : 0, sort_order || 0, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.delete('/api/admin/testimonials/:id', auth, adminOnly, async (req, res) => {
  try { await run('DELETE FROM testimonials WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== المحتوى ====================
app.get('/api/admin/content', auth, adminOnly, async (req, res) => {
  try {
    const rows = await all('SELECT * FROM content');
    const obj = {}; rows.forEach(r => obj[r.key] = r.value);
    res.json(obj);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.put('/api/admin/content', auth, adminOnly, async (req, res) => {
  try {
    for (const k of Object.keys(req.body)) {
      await run('INSERT OR REPLACE INTO content (key, value) VALUES (?, ?)', [k, String(req.body[k] || '')]);
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== الدول والمحافظ ====================
app.get('/api/admin/countries', auth, adminOnly, async (req, res) => {
  try {
    const countries = await all('SELECT * FROM countries ORDER BY sort_order');
    for (const c of countries) {
      c.regions = await all('SELECT * FROM regions WHERE country_id = ? ORDER BY name_ar', [c.id]);
    }
    res.json(countries);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.post('/api/admin/countries', auth, adminOnly, async (req, res) => {
  const { name_ar, name_en, flag, sort_order } = req.body;
  if (!name_ar || !name_en) return res.status(400).json({ detail: 'الاسم مطلوب' });
  try {
    const r = await run('INSERT INTO countries (name_ar, name_en, flag, sort_order) VALUES (?, ?, ?, ?)',
      [name_ar, name_en, flag || '🌐', sort_order || 0]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.put('/api/admin/countries/:id', auth, adminOnly, async (req, res) => {
  const { name_ar, name_en, flag, active, sort_order } = req.body;
  try {
    await run('UPDATE countries SET name_ar=?, name_en=?, flag=?, active=?, sort_order=? WHERE id=?',
      [name_ar, name_en, flag, active ? 1 : 0, sort_order || 0, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.delete('/api/admin/countries/:id', auth, adminOnly, async (req, res) => {
  try { await run('DELETE FROM countries WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});

app.post('/api/admin/regions', auth, adminOnly, async (req, res) => {
  const { country_id, name_ar } = req.body;
  if (!country_id || !name_ar) return res.status(400).json({ detail: 'الدولة والاسم مطلوبان' });
  try {
    const r = await run('INSERT INTO regions (country_id, name_ar, delivery_fee_usd) VALUES (?, ?, 0)', [country_id, name_ar]);
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.put('/api/admin/regions/:id', auth, adminOnly, async (req, res) => {
  const { name_ar, active } = req.body;
  try {
    await run('UPDATE regions SET name_ar=?, active=? WHERE id=?', [name_ar, active ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.delete('/api/admin/regions/:id', auth, adminOnly, async (req, res) => {
  try { await run('DELETE FROM regions WHERE id = ?', [req.params.id]); res.json({ success: true }); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== الحسابات ====================
app.get('/api/admin/accounts', auth, adminOnly, async (req, res) => {
  try { res.json(await all('SELECT id, email, phone, name, banned, is_admin, created_at FROM accounts ORDER BY id DESC')); }
  catch (e) { res.status(500).json({ detail: e.message }); }
});
app.put('/api/admin/accounts/:id', auth, adminOnly, async (req, res) => {
  try {
    await run('UPDATE accounts SET banned = ? WHERE id = ?', [req.body.banned ? 1 : 0, req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.delete('/api/admin/accounts/:id', auth, adminOnly, async (req, res) => {
  try {
    if (req.params.id == req.user.id) return res.status(400).json({ detail: 'لا يمكن حذف حسابك' });
    await run('DELETE FROM accounts WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== الدعم ====================
app.get('/api/admin/support', auth, adminOnly, async (req, res) => {
  try {
    const list = await all(`SELECT s.*, a.email as user_email, a.phone as user_phone
      FROM support_messages s JOIN accounts a ON s.user_id = a.id ORDER BY s.created_at DESC`);
    res.json(list);
  } catch (e) { res.status(500).json({ detail: e.message }); }
});
app.post('/api/admin/support/:id/reply', auth, adminOnly, async (req, res) => {
  const { reply } = req.body;
  if (!reply) return res.status(400).json({ detail: 'الرد مطلوب' });
  try {
    await run("UPDATE support_messages SET reply=?, status='answered', replied_at=CURRENT_TIMESTAMP WHERE id=?",
      [reply.trim(), req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== البث ====================
app.post('/api/admin/broadcast', auth, adminOnly, async (req, res) => {
  const { title, body } = req.body;
  if (!title) return res.status(400).json({ detail: 'العنوان مطلوب' });
  try {
    const users = await all('SELECT id FROM accounts WHERE banned = 0');
    for (const u of users) {
      await run('INSERT INTO notifications (user_id, title, body) VALUES (?, ?, ?)', [u.id, title, body || '']);
    }
    res.json({ success: true, count: users.length });
  } catch (e) { res.status(500).json({ detail: e.message }); }
});

// ==================== Catch-all ====================
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ==================== تشغيل السيرفر ====================
(async () => {
  try {
    await initDb();
    await seed();
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n════════════════════════════════════════');
      console.log('   📦  وصلني — منصة الوساطة اللوجستية');
      console.log('   🌐  http://localhost:' + PORT);
      console.log('   👤  الأدمن: ' + ADMIN_EMAIL);
      console.log('   🔐  مسار الأدمن السري: /' + ADMIN_PANEL_PATH);
      console.log('   ☁️  Turso: ' + (TURSO_URL ? 'مفعّل' : 'محلي'));
      console.log('════════════════════════════════════════\n');
    });
  } catch (e) {
    console.error('❌ فشل تشغيل السيرفر:', e);
    process.exit(1);
  }
})();
