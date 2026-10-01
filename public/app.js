// ==================== الحالة ====================
const state = {
  token: localStorage.getItem('ws_token') || null,
  user: null,
  settings: {},
  notifications: []
};

// ==================== API ====================
async function api(path, method = 'GET', body = null) {
  const h = { 'Content-Type': 'application/json' };
  if (state.token) h['Authorization'] = 'Bearer ' + state.token;
  const o = { method, headers: h };
  if (body) o.body = JSON.stringify(body);
  const r = await fetch(path, o);
  let d = {};
  try { d = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(d.detail || 'حدث خطأ');
  return d;
}

// ==================== أدوات ====================
function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type === 'success' ? '' : type);
  setTimeout(() => t.className = 'toast', 3200);
}
function navigate(path) { location.hash = '#' + path; }
window.navigate = navigate;
function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function fmt(n) { return Number(n || 0).toFixed(2); }
function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

// ==================== الشعارات ====================
function flagSVG(size = '') {
  return `<div class="flag ${size}">
    <div class="g"></div>
    <div class="w"><span class="s">★</span><span class="s">★</span><span class="s">★</span></div>
    <div class="b"></div>
  </div>`;
}
function brandLogo() {
  const name = state.settings.content?.site_name || 'وصلني';
  return `<div class="brand-logo">
    <div class="brand-name">${esc(name)}</div>
    <div class="brand-sub">SHOPPING & LOGISTICS</div>
  </div>`;
}

// ==================== الهيدر ====================
function renderHeader() {
  const u = state.user;
  const unread = state.notifications.filter(n => !n.read).length;
  const nav = `<div class="nav-links" id="navLinks">
    <span data-nav="/" onclick="navigate('/')">الرئيسية</span>
    <span data-nav="/new-order" onclick="navigate('/new-order')">📦 اطلب الآن</span>
    <span data-nav="/orders" onclick="navigate('/orders')">طلباتي</span>
    <span data-nav="/testimonials" onclick="navigate('/testimonials')">إثباتات التسليم</span>
    <span data-nav="/legal" onclick="navigate('/legal')">📜 الشروط والسياسات</span>
    <span data-nav="/help" onclick="navigate('/help')">مركز المساعدة</span>
  </div>`;

  // زر الأدمن يستخدم مسار سري
  const adminBtn = (u && u.is_admin && u.admin_path)
    ? `<button class="hdr-btn" onclick="navigate('/${esc(u.admin_path)}')">⚙️ الإدارة</button>`
    : '';

  const actions = u
    ? `<button class="hdr-btn" onclick="navigate('/notifications')" title="الإشعارات">
         🔔${unread ? `<span class="badge">${unread}</span>` : ''}
       </button>
       <button class="hdr-btn" onclick="navigate('/support')">💬 الدعم</button>
       <button class="hdr-btn primary" onclick="navigate('/new-order')">+ اطلب</button>
       ${adminBtn}
       <button class="hdr-btn" onclick="logout()">👤 ${esc((u.name || 'حسابي').split(' ')[0])}</button>`
    : `<button class="hdr-btn" onclick="navigate('/login')">دخول</button>
       <button class="hdr-btn primary" onclick="navigate('/register')">حساب جديد</button>`;

  document.getElementById('header').innerHTML = `
    <div class="hdr">
      <div class="brand" onclick="navigate('/')">
        ${flagSVG()}
        ${brandLogo()}
      </div>
      ${nav}
      <div class="hdr-actions">${actions}</div>
    </div>`;

  document.querySelectorAll('#navLinks span').forEach(el => {
    if (location.hash.startsWith('#' + el.dataset.nav)) el.classList.add('active');
  });
}

// ==================== الفوتر ====================
function renderFooter() {
  const c = state.settings.content || {};
  const contacts = state.settings.contact_methods || [];
  document.getElementById('footer').innerHTML = `
    ${flagSVG()}
    <h3>${esc(c.site_name || 'وصلني')}</h3>
    <p>${esc(c.site_tagline || 'وسيطك للتسوق من أمازون والعالم — نوصلك إلى سوريا')}</p>
    <div class="links">
      <a onclick="navigate('/new-order')">اطلب الآن</a>
      <a onclick="navigate('/orders')">طلباتي</a>
      <a onclick="navigate('/testimonials')">إثباتات التسليم</a>
      <a onclick="navigate('/legal')">الشروط والسياسات</a>
      <a onclick="navigate('/help')">مركز المساعدة</a>
    </div>
    <div class="social">
      ${contacts.map(cm => {
        let href = '#';
        if (cm.type === 'whatsapp') href = 'https://wa.me/' + cm.value.replace(/[^0-9]/g, '');
        else if (cm.type === 'telegram') href = 'https://t.me/' + cm.value.replace(/^@/, '');
        else if (cm.type === 'email') href = 'mailto:' + cm.value;
        else if (cm.type === 'link') href = cm.value;
        else if (cm.type === 'phone') href = 'tel:' + cm.value;
        return `<a href="${esc(href)}" target="_blank">${cm.icon} ${esc(cm.label)}</a>`;
      }).join('')}
    </div>
    <p style="margin-top:20px">© ${new Date().getFullYear()} ${esc(c.site_name || 'وصلني')} — جميع الحقوق محفوظة</p>`;
}

// ==================== تحميل المستخدم ====================
async function loadMe() {
  if (!state.token) { state.user = null; return; }
  try {
    const d = await api('/api/auth/me');
    state.user = d.user;
    await loadNotifications();
  } catch (e) {
    state.token = null; state.user = null;
    localStorage.removeItem('ws_token');
  }
}
async function loadNotifications() {
  try { state.notifications = await api('/api/notifications'); }
  catch (e) { state.notifications = []; }
}
function logout() {
  state.token = null; state.user = null; state.notifications = [];
  localStorage.removeItem('ws_token');
  renderHeader();
  toast('تم تسجيل الخروج', 'info');
  navigate('/');
}
window.logout = logout;

// ==================== الصفحة الرئيسية ====================
async function renderHome() {
  const c = state.settings.content || {};
  const stores = state.settings.stores || [];
  const testimonials = state.settings.testimonials || [];

  document.getElementById('app').innerHTML = `
    <div class="hero">
      <div class="hero-inner">
        <h1>${esc(c.hero_title || '🛒 تسوّق من أي متجر عالمي... ونوصلك إلى سوريا')}</h1>
        <p>${esc(c.hero_subtitle || 'الصق رابط المنتج، اكتب طلبك بالتفصيل، ونرسل لك السعر النهائي — دفع بالكريبتو وتوصيل إلى بابك.')}</p>
        <div class="hero-btns">
          <button class="cta" onclick="navigate('/new-order')">📦 اطلب الآن</button>
          <button class="cta-sec" onclick="navigate('/help')">💬 كيف يعمل؟</button>
        </div>
      </div>
    </div>

    <div class="features">
      <div class="feat"><div class="ic">📋</div><h4>اطلب بسهولة</h4><p>الصق الرابط واكتب طلبك</p></div>
      <div class="feat"><div class="ic">💰</div><h4>سعر واضح</h4><p>نرسل لك تفصيل كامل قبل الدفع</p></div>
      <div class="feat"><div class="ic">💳</div><h4>دفع USDT</h4><p>سريع وآمن — TRC20 / BEP20</p></div>
      <div class="feat"><div class="ic">🚚</div><h4>تتبع مباشر</h4><p>10 مراحل من الطلب حتى التسليم</p></div>
      <div class="feat"><div class="ic">🛡️</div><h4>ضمان استرجاع</h4><p>استرجاع كامل بالـ USDT عند التأخر</p></div>
    </div>

    <div class="sec-title"><h2>🌍 المتاجر المدعومة</h2></div>
    <div class="stores-grid">
      ${stores.map(s => `
        <div class="store-card">
          <div class="ic">${s.icon || '🛒'}</div>
          <h4>${esc(s.name_ar)}</h4>
          <p>${esc(s.url_hint || s.name_en)}</p>
        </div>`).join('')}
    </div>

    <div class="sec-title"><h2>🎯 كيف يعمل؟</h2></div>
    <div class="policy-grid">
      <div class="policy-card">
        <h4>1️⃣ اطلب</h4>
        <p>الصق رابط المنتج، واكتب لنا كل تفاصيل ما تريده (اللون، الحجم، المواصفات).</p>
      </div>
      <div class="policy-card">
        <h4>2️⃣ نراجع</h4>
        <p>نتحقق من المنتج ونحضّر عرض سعر مفصل: سعر المنتج + الشحن + الجمارك.</p>
      </div>
      <div class="policy-card">
        <h4>3️⃣ توافق وتدفع</h4>
        <p>يوصلك عرض السعر، توافق عليه وتدفع بالـ USDT، ثم نبدأ التنفيذ.</p>
      </div>
      <div class="policy-card green">
        <h4>4️⃣ تتبّع واستلم</h4>
        <p>نتابع معك كل مرحلة من الشراء حتى التسليم في محافظتك.</p>
      </div>
    </div>

    ${testimonials.length ? `
      <div class="sec-title">
        <h2>⭐ إثباتات التسليم</h2>
        <span class="link" onclick="navigate('/testimonials')">عرض الكل ←</span>
      </div>
      <div class="testi-grid">
        ${testimonials.slice(0, 4).map(t => `
          <div class="testi-card">
            <img src="${esc(t.image_url || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400')}" onerror="this.src='https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400'" alt="">
            <div class="testi-body">
              <h4>${esc(t.title)}</h4>
              <div class="who">👤 ${esc(t.customer_name)}</div>
              <div class="stars-gold" style="margin-bottom:8px">★★★★★</div>
              <p>${esc(t.description)}</p>
            </div>
          </div>`).join('')}
      </div>` : ''}

    <div class="sec-title"><h2>🛡️ ضماناتنا</h2></div>
    <div class="policy-grid">
      <div class="policy-card green">
        <h4>💸 ضمان استرجاع كامل</h4>
        <p>${esc((c.refund_text || '').slice(0, 200))}...</p>
        <p style="margin-top:12px"><a onclick="navigate('/legal')" style="cursor:pointer;font-weight:700;color:#F59E0B">اقرأ السياسة كاملة ←</a></p>
      </div>
      <div class="policy-card">
        <h4>📜 الشروط والأحكام</h4>
        <p>${esc((c.terms_text || '').slice(0, 200))}...</p>
        <p style="margin-top:12px"><a onclick="navigate('/legal')" style="cursor:pointer;font-weight:700;color:#F59E0B">اقرأ الشروط كاملة ←</a></p>
      </div>
      <div class="policy-card">
        <h4>🎯 من نحن</h4>
        <p>${esc(c.about_text || 'وصلني هي منصة وساطة تسوق ولوجستيات دولية.')}</p>
      </div>
    </div>
  `;
}

// ==================== صفحة الشروط والسياسات ====================
async function renderLegal() {
  const c = state.settings.content || {};
  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>📜 الشروط والسياسات</h2></div>

    <div class="summary" style="margin-top:0">
      <h3>📋 الشروط والأحكام</h3>
      <p style="color:#475569;line-height:2;font-size:14px">${nl2br(c.terms_text || 'لا توجد شروط منشورة حالياً.')}</p>
    </div>

    <div class="summary" style="margin-top:20px">
      <h3>💸 سياسة الاسترجاع والضمان</h3>
      <p style="color:#475569;line-height:2;font-size:14px">${nl2br(c.refund_text || 'لا توجد سياسة استرجاع منشورة حالياً.')}</p>
    </div>

    <div class="summary" style="margin-top:20px">
      <h3>⚖️ الإشعار القانوني وسياسة الخصوصية</h3>
      <p style="color:#475569;line-height:2;font-size:14px">${nl2br(c.legal_text || 'لا يوجد إشعار قانوني منشور حالياً.')}</p>
    </div>

    <div class="summary" style="margin-top:20px">
      <h3>🎯 من نحن</h3>
      <p style="color:#475569;line-height:2;font-size:14px">${nl2br(c.about_text || '')}</p>
    </div>
  `;
}

// ==================== صفحة إثباتات التسليم ====================
async function renderTestimonials() {
  const list = state.settings.testimonials || [];
  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>⭐ إثباتات التسليم وتقييمات العملاء</h2></div>
    <p style="color:#64748B;margin-bottom:20px">شهادات حقيقية من عملاء استلموا شحناتهم عبر ${esc(state.settings.content?.site_name || 'وصلني')}.</p>
    ${list.length === 0
      ? '<div class="empty"><div class="ic">📸</div><h3>لا توجد إثباتات منشورة بعد</h3></div>'
      : `<div class="testi-grid">
          ${list.map(t => `
            <div class="testi-card">
              ${t.video_url
                ? `<video src="${esc(t.video_url)}" controls style="width:100%;height:200px;object-fit:cover;background:#000"></video>`
                : `<img src="${esc(t.image_url || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400')}" onerror="this.src='https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400'" alt="">`}
              <div class="testi-body">
                <h4>${esc(t.title)}</h4>
                <div class="who">👤 ${esc(t.customer_name)}</div>
                <div class="stars-gold" style="margin-bottom:8px">★★★★★</div>
                <p>${esc(t.description)}</p>
              </div>
            </div>`).join('')}
        </div>`}`;
}

// ==================== مركز المساعدة ====================
async function renderHelp() {
  const c = state.settings.content || {};
  const contacts = state.settings.contact_methods || [];
  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>💬 مركز المساعدة</h2></div>
    <div class="policy-grid">
      ${contacts.map(cm => {
        let href = '#', desc = '';
        if (cm.type === 'whatsapp') { href = 'https://wa.me/' + cm.value.replace(/[^0-9]/g, ''); desc = 'تواصل مباشر عبر واتساب'; }
        else if (cm.type === 'telegram') { href = 'https://t.me/' + cm.value.replace(/^@/, ''); desc = 'قناتنا على تلغرام'; }
        else if (cm.type === 'email') { href = 'mailto:' + cm.value; desc = 'أرسل لنا إيميل'; }
        else if (cm.type === 'link') { href = cm.value; desc = 'افتح الرابط'; }
        else if (cm.type === 'phone') { href = 'tel:' + cm.value; desc = 'اتصل بنا'; }
        else { href = cm.value; desc = ''; }
        return `<a href="${esc(href)}" target="_blank" style="text-decoration:none">
          <div class="policy-card green">
            <h4>${cm.icon} ${esc(cm.label)}</h4>
            <p>${esc(desc)}</p>
            <p style="margin-top:12px;color:#10B981;font-weight:700">${esc(cm.value)} ←</p>
          </div>
        </a>`;
      }).join('')}
      <div class="policy-card" onclick="state.user ? navigate('/support') : navigate('/login')" style="cursor:pointer">
        <h4>💬 محادثة داخلية</h4>
        <p>راسل فريق الدعم مباشرة من داخل المنصة.</p>
        <p style="margin-top:12px;color:#F59E0B;font-weight:700">ابدأ محادثة ←</p>
      </div>
    </div>

    <div class="sec-title"><h2>❓ أسئلة شائعة</h2></div>
    <div class="policy-grid">
      <div class="policy-card">
        <h4>🎯 كيف أطلب منتج؟</h4>
        <p>اذهب إلى "اطلب الآن"، الصق رابط المنتج، اكتب تفاصيل ما تريده، وأدخل بيانات المستلم. سنراسلك بعرض السعر.</p>
      </div>
      <div class="policy-card">
        <h4>⏱️ كم يستغرق السعر؟</h4>
        <p>عادةً خلال ساعات من إرسال طلبك، وأقصى حد 24 ساعة.</p>
      </div>
      <div class="policy-card">
        <h4>💳 ما هي طرق الدفع؟</h4>
        <p>الدفع بالكريبتو USDT فقط عبر شبكتي TRC20 و BEP20.</p>
      </div>
      <div class="policy-card">
        <h4>🛡️ هل هناك ضمان؟</h4>
        <p>${esc(c.warranty_note || 'نضمن استرجاع كامل المبلغ بالـ USDT عند عدم وصول الشحنة.')}</p>
      </div>
      <div class="policy-card">
        <h4>📦 كيف أتابع طلبي؟</h4>
        <p>من صفحة "طلباتي" حيث يظهر رقم طلبك وحالة الشحنة بمراحل مفصلة.</p>
      </div>
    </div>`;
}

// ==================== صفحة الطلب ====================
async function renderNewOrder() {
  if (!state.user) { toast('سجّل الدخول أولاً', 'error'); navigate('/login'); return; }

  const stores = state.settings.stores || [];
  const regions = state.settings.regions || [];

  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>📦 طلب عرض سعر</h2></div>
    <p style="color:#64748B;margin-bottom:20px">
      الصق رابط المنتج من أمازون أو أي متجر عالمي، اكتب لنا ما تريده بالتفصيل،
      وسنرسل لك السعر النهائي (سعر المنتج + الشحن + الجمارك) خلال ساعات.
    </p>

    <div class="calc-card">
      <div class="calc-section">
        <h3><span class="num">1</span> المنتج المطلوب</h3>
        <div class="fg">
          <label>المتجر</label>
          <select id="o_store">
            <option value="">-- اختر المتجر --</option>
            ${stores.map(s => `<option value="${esc(s.name_ar)}">${s.icon} ${esc(s.name_ar)}</option>`).join('')}
          </select>
        </div>
        <div class="fg">
          <label>رابط المنتج *</label>
          <input id="o_url" placeholder="https://www.amazon.com/dp/..." style="direction:ltr;text-align:left" oninput="tryExtractTitle()">
          <div class="helper">انسخ الرابط من صفحة المنتج في المتجر</div>
        </div>
        <div class="fg">
          <label>اسم المنتج *</label>
          <input id="o_title" placeholder="مثال: Apple iPhone 15 Pro Max 256GB">
          <div class="helper">يُملأ تلقائياً من الرابط إن أمكن — يمكنك تعديله</div>
        </div>
        <div class="fg">
          <label>📝 ما تريده بالتفصيل *</label>
          <textarea id="o_desc" placeholder="مثال: أريد اللون الأزرق تيتانيوم، سعة 256GB، إصدار أمريكي أصلي مغلق، مع ضمان سنة. يرجى التأكد من أنه يدعم شريحة اتصال سورية."></textarea>
          <div class="helper">اكتب اللون، الحجم، السعة، أي مواصفات، بلد الإصدار، ضمان — كل ما هو مهم.</div>
        </div>
        <div class="fg">
          <label>الكمية</label>
          <input type="number" id="o_qty" value="1" min="1" max="20">
        </div>
      </div>

      <div class="calc-section">
        <h3><span class="num">2</span> بيانات المستلم</h3>
        <div class="calc-grid">
          <div>
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">الاسم الثلاثي *</label>
            <input id="o_name" placeholder="أحمد محمد علي">
          </div>
          <div>
            <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">رقم الهاتف *</label>
            <input id="o_phone" placeholder="09xxxxxxxx" maxlength="10">
          </div>
        </div>
        <div class="fg" style="margin-top:14px">
          <label>المحافظة *</label>
          <select id="o_region">
            <option value="">-- اختر --</option>
            ${regions.map(r => `<option value="${r.id}">${esc(r.name_ar)}</option>`).join('')}
          </select>
        </div>
        <div class="fg">
          <label>العنوان الكامل *</label>
          <textarea id="o_address" placeholder="دمشق - المزة - شارع الجلاء - بناء 5 - ط2"></textarea>
        </div>
      </div>

      <div class="warn" style="background:#FEF3C7;border-color:#FCD34D;border-right-color:#F59E0B;color:#78350F">
        <strong>📌 كيف يعمل النظام؟</strong><br>
        1. ترسل طلبك الآن (بدون دفع)<br>
        2. نراجع الطلب ونرسل لك السعر النهائي (سعر المنتج + الشحن + الجمارك)<br>
        3. توافق على السعر وتدفع بالـ USDT<br>
        4. نشتري ونشحن ونتابع معك حتى الاستلام
      </div>

      <button class="btn-primary" style="width:100%;padding:16px;font-size:16px;background:#F59E0B;border-color:#F59E0B;color:#0F172A;font-weight:800;border-radius:14px" onclick="submitOrder()">
        📩 إرسال طلب عرض السعر
      </button>
    </div>
  `;
}

function tryExtractTitle() {
  const url = document.getElementById('o_url')?.value;
  if (!url) return;
  try {
    let m = url.match(/\/([^\/]+)\/dp\/[A-Z0-9]{10}/i);
    if (!m) m = url.match(/amazon\.[a-z.]+\/([^\/]+?)\/dp\//i);
    if (!m) m = url.match(/\/([^\/]+)\/product\//i);
    if (!m) m = url.match(/\/item\/([^\/?]+)/i);
    if (m && m[1]) {
      const title = decodeURIComponent(m[1])
        .replace(/-/g, ' ')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const el = document.getElementById('o_title');
      if (el && !el.value && title.length > 5 && title.length < 200) el.value = title;
    }
    const sel = document.getElementById('o_store');
    if (sel && !sel.value) {
      const l = url.toLowerCase();
      if (l.includes('amazon.')) sel.value = 'أمازون';
      else if (l.includes('aliexpress.')) sel.value = 'علي إكسبريس';
      else if (l.includes('ebay.')) sel.value = 'إي باي';
      else if (l.includes('walmart.')) sel.value = 'وول مارت';
    }
  } catch (e) {}
}
window.tryExtractTitle = tryExtractTitle;

async function submitOrder() {
  const body = {
    region_id: parseInt(document.getElementById('o_region').value),
    receiver_name: document.getElementById('o_name').value.trim(),
    receiver_phone: document.getElementById('o_phone').value.trim(),
    full_address: document.getElementById('o_address').value.trim(),
    store_name: document.getElementById('o_store').value.trim(),
    product_title: document.getElementById('o_title').value.trim(),
    product_url: document.getElementById('o_url').value.trim(),
    customer_description: document.getElementById('o_desc').value.trim(),
    quantity: parseInt(document.getElementById('o_qty').value) || 1
  };
  if (!body.product_title || !body.product_url) { toast('اسم المنتج ورابطه مطلوبان', 'error'); return; }
  if (!body.customer_description || body.customer_description.length < 5) { toast('اكتب وصف ما تريده بالتفصيل', 'error'); return; }
  if (!body.receiver_name || body.receiver_name.split(/\s+/).length < 3) { toast('الاسم الثلاثي مطلوب', 'error'); return; }
  if (!/^09\d{8}$/.test(body.receiver_phone)) { toast('الهاتف 10 أرقام يبدأ بـ 09', 'error'); return; }
  if (!body.region_id) { toast('اختر المحافظة', 'error'); return; }
  if (!body.full_address) { toast('العنوان مطلوب', 'error'); return; }

  try {
    const r = await api('/api/orders', 'POST', body);
    toast('✅ تم إرسال طلبك — سنراسلك بالسعر قريباً');
    setTimeout(() => navigate('/order/' + r.order_id), 700);
  } catch (e) { toast(e.message, 'error'); }
}
window.submitOrder = submitOrder;

// ==================== صفحة طلباتي ====================
async function renderOrders() {
  if (!state.user) { navigate('/login'); return; }
  const orders = await api('/api/orders/mine');
  const labels = state.settings.status_labels || {};

  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>📦 طلباتي (${orders.length})</h2></div>
    ${orders.length === 0
      ? `<div class="empty">
          <div class="ic">📦</div>
          <h3>لا توجد طلبات بعد</h3>
          <button class="btn-primary" style="margin-top:14px" onclick="navigate('/new-order')">ابدأ طلبك الأول</button>
        </div>`
      : orders.map(o => `
        <div class="ocard">
          <h3>
            <span>طلب <span class="order-num">${esc(o.order_number)}</span></span>
            <span class="status-chip st-${o.status}">${labels[o.status] || o.status}</span>
          </h3>
          <div class="info-grid">
            <p><strong>المنتج</strong>${esc(o.product_title)}</p>
            <p><strong>المتجر</strong>${esc(o.store_name || '-')}</p>
            <p><strong>المحافظة</strong>${esc(o.region_name || '-')}</p>
            <p><strong>المستلم</strong>${esc(o.receiver_name)}</p>
            <p><strong>الهاتف</strong>${esc(o.receiver_phone)}</p>
            ${o.total_usd > 0 ? `<p><strong>الإجمالي</strong>$${fmt(o.total_usd)}</p>` : '<p><strong>الحالة</strong>بانتظار عرض السعر</p>'}
          </div>
          <p class="mini" style="margin-top:10px">📅 ${new Date(o.created_at).toLocaleString('ar-EG')}</p>
          <button class="btn-primary btn-sm" style="margin-top:10px" onclick="navigate('/order/${o.id}')">عرض التفاصيل والتتبع ←</button>
        </div>`).join('')}`;
}

// ==================== صفحة تفاصيل الطلب ====================
async function renderOrderDetail(id) {
  if (!state.user) { navigate('/login'); return; }
  const o = await api('/api/orders/' + id);
  const labels = state.settings.status_labels || {};
  const flow = ['pending_quote','quote_sent','awaiting_payment','payment_received','purchased','warehouse_foreign','international_shipping','arrived_syria','out_for_delivery','delivered'];
  const wallets = state.settings.wallets || [];

  document.getElementById('app').innerHTML = `
    <div class="sec-title">
      <h2>📦 طلب <span class="order-num" style="font-size:20px">${esc(o.order_number)}</span></h2>
      <span class="status-chip st-${o.status}">${labels[o.status] || o.status}</span>
    </div>

    ${o.status === 'quote_sent' ? `
      <div class="summary" style="margin-top:0;background:#DBEAFE;border:2px solid #3B82F6">
        <h3 style="color:#1E40AF">💰 عرض السعر جاهز — بانتظار موافقتك</h3>
        <div class="total-line"><span>سعر المنتج من المتجر</span><span>$${fmt(o.admin_quote_price)}</span></div>
        <div class="total-line"><span>الشحن الدولي</span><span>$${fmt(o.admin_quote_shipping)}</span></div>
        <div class="total-line"><span>الجمارك والخدمة</span><span>$${fmt(o.admin_quote_customs)}</span></div>
        <div class="total-line big"><span>الإجمالي</span><span>$${fmt(o.total_usd)} USDT</span></div>
        ${o.admin_quote_notes ? `<p style="background:#fff;padding:12px;border-radius:8px;margin-top:12px;color:#1E40AF"><strong>ملاحظة الإدارة:</strong> ${esc(o.admin_quote_notes)}</p>` : ''}
        <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap">
          <button class="btn-green" style="flex:1;min-width:200px;padding:14px;font-weight:800" onclick="approveQuote(${o.id})">✅ أوافق — أريد إتمام الشراء</button>
          <button class="btn-red" style="flex:1;min-width:200px;padding:14px;font-weight:800" onclick="rejectQuote(${o.id})">❌ لا أوافق</button>
        </div>
      </div>
    ` : ''}

    ${o.status === 'awaiting_payment' ? `
      <div class="summary" style="margin-top:0;background:#FEF3C7;border:2px solid #F59E0B">
        <h3 style="color:#78350F">💳 الدفع مطلوب الآن</h3>
        <p style="margin-bottom:14px">حوّل المبلغ التالي بالـ USDT إلى إحدى المحافظ أدناه، ثم الصق رقم العملية (TxID).</p>
        <p style="font-size:22px;font-weight:800;color:#B12704;margin-bottom:14px">$${fmt(o.total_usd)} USDT</p>
        <div class="net-tabs" id="netTabs">
          ${wallets.map((w, i) => `<div class="net-tab ${i === 0 ? 'active' : ''}" data-net="${esc(w.network)}" data-addr="${esc(w.address)}" onclick="selectNet(this)">${esc(w.network)}</div>`).join('')}
        </div>
        <div class="wallet">
          <code id="walletAddr">${esc(wallets[0]?.address || '')}</code>
          <button onclick="copyWallet()">📋 نسخ</button>
        </div>
        <div class="fg" style="margin-top:14px">
          <label>رقم عملية التحويل (TxID)</label>
          <input id="payTx" placeholder="0x..." style="direction:ltr;text-align:left;font-family:monospace">
        </div>
        <div class="fg">
          <label>رابط إثبات الدفع (اختياري)</label>
          <input id="payProof" placeholder="https://..." style="direction:ltr;text-align:left">
        </div>
        <button class="btn-green" style="width:100%;padding:14px;font-weight:800" onclick="submitPayment(${o.id})">💸 تأكيد الدفع</button>
      </div>
    ` : ''}

    ${o.status === 'quote_rejected' ? `
      <div class="summary" style="margin-top:0;background:#FEE2E2;border:2px solid #DC2626">
        <h3 style="color:#991B1B">❌ لقد رفضت عرض السعر</h3>
        <p>إذا كان لديك استفسار، يمكنك التواصل مع الدعم أو إنشاء طلب جديد.</p>
        <button class="btn-primary" style="margin-top:12px" onclick="navigate('/new-order')">طلب جديد</button>
      </div>
    ` : ''}

    <div class="summary" style="margin-top:16px">
      <h3>📋 تفاصيل المنتج</h3>
      <div class="info-grid">
        <p><strong>المتجر</strong>${esc(o.store_name || '-')}</p>
        <p><strong>اسم المنتج</strong>${esc(o.product_title)}</p>
        <p><strong>الرابط</strong><a href="${esc(o.product_url)}" target="_blank" style="direction:ltr;display:inline-block;font-size:11px">فتح</a></p>
        <p><strong>الكمية</strong>${o.quantity}</p>
      </div>
      <div style="margin-top:12px;padding:14px;background:#F8FAFC;border-radius:10px">
        <strong style="font-size:13px">📝 طلبك:</strong>
        <p style="margin-top:6px;color:#475569;line-height:1.8">${esc(o.customer_description || '-')}</p>
      </div>
    </div>

    ${o.admin_quote_price ? `
      <div class="summary" style="margin-top:16px">
        <h3>💰 تفاصيل التسعير</h3>
        <div class="total-line"><span>سعر المنتج</span><span>$${fmt(o.admin_quote_price)}</span></div>
        <div class="total-line"><span>الشحن الدولي</span><span>$${fmt(o.admin_quote_shipping)}</span></div>
        <div class="total-line"><span>الجمارك والخدمة</span><span>$${fmt(o.admin_quote_customs)}</span></div>
        <div class="total-line big"><span>الإجمالي</span><span>$${fmt(o.total_usd)} USDT</span></div>
      </div>
    ` : ''}

    <div class="summary" style="margin-top:16px">
      <h3>🚚 بيانات المستلم</h3>
      <div class="info-grid">
        <p><strong>الاسم</strong>${esc(o.receiver_name)}</p>
        <p><strong>الهاتف</strong>${esc(o.receiver_phone)}</p>
        <p><strong>المحافظة</strong>${esc(o.region_name || '-')}</p>
        <p><strong>العنوان</strong>${esc(o.full_address)}</p>
      </div>
    </div>

    ${o.tx_ref ? `
      <div class="summary" style="margin-top:16px">
        <h3>💳 بيانات الدفع</h3>
        <div class="info-grid">
          <p><strong>الشبكة</strong>${esc(o.wallet_network)}</p>
          <p><strong>TxID</strong><span style="direction:ltr;display:inline-block;font-size:11px;word-break:break-all">${esc(o.tx_ref)}</span></p>
        </div>
      </div>` : ''}

    <div class="sec-title"><h2>📍 تتبع الطلب</h2></div>
    <div class="summary" style="margin-top:0">
      <div class="tracking-timeline">
        ${flow.map((s, i) => {
          const step = (o.tracking || []).find(t => t.status === s);
          const done = !!step;
          const current = o.status === s;
          return `
            <div class="track-step ${done ? 'done' : ''} ${current ? 'current' : ''}">
              <div class="track-icon">${done ? '✓' : i + 1}</div>
              <div class="track-info">
                <h4>${labels[s] || s}</h4>
                ${step ? `<p>${esc(step.note)}</p><div class="dt">${new Date(step.created_at).toLocaleString('ar-EG')}</div>` : '<p class="mini">بانتظار التحديث</p>'}
              </div>
            </div>`;
        }).join('')}
      </div>
    </div>

    ${o.notes ? `
      <div class="summary" style="margin-top:16px">
        <h3>📝 ملاحظات الإدارة</h3>
        <p style="color:#475569;line-height:1.7">${esc(o.notes)}</p>
      </div>` : ''}
  `;

  window._selectedNet = wallets[0]?.network || '';
}

async function approveQuote(id) {
  if (!confirm('هل أنت متأكد من الموافقة على السعر؟ سيُطلب منك الدفع بعدها.')) return;
  try { await api(`/api/orders/${id}/approve-quote`, 'POST'); toast('✅ تمت الموافقة'); renderOrderDetail(id); }
  catch (e) { toast(e.message, 'error'); }
}
window.approveQuote = approveQuote;

async function rejectQuote(id) {
  if (!confirm('هل أنت متأكد من رفض عرض السعر؟')) return;
  try { await api(`/api/orders/${id}/reject-quote`, 'POST'); toast('تم الرفض', 'info'); renderOrderDetail(id); }
  catch (e) { toast(e.message, 'error'); }
}
window.rejectQuote = rejectQuote;

async function submitPayment(id) {
  const tx = document.getElementById('payTx').value.trim();
  const proof = document.getElementById('payProof').value.trim();
  if (!tx || tx.length < 6) { toast('رقم التحويل (TxID) مطلوب', 'error'); return; }
  try {
    await api(`/api/orders/${id}/submit-payment`, 'POST', {
      wallet_network: window._selectedNet || '',
      tx_ref: tx,
      tx_proof_url: proof
    });
    toast('✅ تم إرسال إثبات الدفع');
    renderOrderDetail(id);
  } catch (e) { toast(e.message, 'error'); }
}
window.submitPayment = submitPayment;

function selectNet(el) {
  document.querySelectorAll('.net-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const a = document.getElementById('walletAddr');
  if (a) a.textContent = el.dataset.addr;
  window._selectedNet = el.dataset.net;
}
window.selectNet = selectNet;

function copyWallet() {
  const a = document.getElementById('walletAddr')?.textContent || '';
  navigator.clipboard.writeText(a).then(() => toast('✓ تم نسخ العنوان'));
}
window.copyWallet = copyWallet;

// ==================== صفحة الإشعارات ====================
async function renderNotifications() {
  if (!state.user) { navigate('/login'); return; }
  await loadNotifications();
  document.getElementById('app').innerHTML = `
    <div class="sec-title">
      <h2>🔔 الإشعارات (${state.notifications.length})</h2>
      ${state.notifications.length ? '<button class="btn-gray btn-sm" onclick="markAllRead()">تحديد الكل كمقروء</button>' : ''}
    </div>
    ${state.notifications.length === 0
      ? '<div class="empty"><div class="ic">🔔</div><h3>لا توجد إشعارات</h3></div>'
      : state.notifications.map(n => `
        <div class="ocard" style="${!n.read ? 'border-right-color:#DC2626;background:#FFF7ED' : ''}">
          <h3 style="font-size:15px">${esc(n.title)} ${!n.read ? '<span style="background:#DC2626;color:#fff;font-size:10px;padding:2px 8px;border-radius:10px">جديد</span>' : ''}</h3>
          ${n.body ? `<p style="color:#475569;font-size:14px;line-height:1.6">${esc(n.body)}</p>` : ''}
          <p class="mini" style="margin-top:8px">${new Date(n.created_at).toLocaleString('ar-EG')}</p>
          ${n.order_id ? `<button class="btn-primary btn-sm" style="margin-top:8px" onclick="navigate('/order/${n.order_id}')">عرض الطلب ←</button>` : ''}
        </div>`).join('')}`;
}
async function markAllRead() {
  try { await api('/api/notifications/read-all', 'POST'); await loadNotifications(); renderNotifications(); renderHeader(); toast('تم'); }
  catch (e) { toast(e.message, 'error'); }
}
window.markAllRead = markAllRead;

// ==================== صفحة الدعم ====================
async function renderSupport() {
  if (!state.user) { navigate('/login'); return; }
  const msgs = await api('/api/support/mine');
  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>💬 الدعم الفني</h2></div>
    <div class="chat">
      <div class="chat-hdr">💬 فريق دعم ${esc(state.settings.content?.site_name || 'وصلني')}</div>
      <div class="chat-body" id="chatBody">
        ${msgs.length === 0 ? '<p style="text-align:center;padding:30px;color:#64748B">👋 مرحباً! كيف يمكننا مساعدتك؟</p>' : ''}
        ${msgs.map(m => `
          <div class="bub me">${esc(m.message)}<span class="tm">${new Date(m.created_at).toLocaleString('ar-EG')}</span></div>
          ${m.reply ? `<div class="bub adm">${esc(m.reply)}<span class="tm">${new Date(m.replied_at).toLocaleString('ar-EG')}</span></div>` : ''}
        `).join('')}
      </div>
      <div class="chat-input">
        <input id="supportMsg" placeholder="اكتب رسالتك..." onkeyup="if(event.key==='Enter') sendSupport()">
        <button onclick="sendSupport()">➤ إرسال</button>
      </div>
    </div>`;
  const cb = document.getElementById('chatBody');
  if (cb) cb.scrollTop = cb.scrollHeight;
}
async function sendSupport() {
  const m = document.getElementById('supportMsg').value.trim();
  if (!m) return;
  try { await api('/api/support', 'POST', { message: m }); toast('✅ تم الإرسال'); renderSupport(); }
  catch (e) { toast(e.message, 'error'); }
}
window.sendSupport = sendSupport;

// ==================== تسجيل الدخول ====================
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="form-card">
      <div class="logo-top">${flagSVG()}<div class="brand-logo"><div class="brand-name" style="color:#0F172A">${esc(state.settings.content?.site_name || 'وصلني')}</div><div class="brand-sub" style="color:#64748B">SHOPPING & LOGISTICS</div></div></div>
      <h2>تسجيل الدخول</h2>
      <div class="fg"><label>البريد الإلكتروني أو رقم الهاتف:</label>
        <input id="logId" autocomplete="username" placeholder="example@gmail.com">
      </div>
      <div class="fg"><label>كلمة المرور:</label>
        <input type="password" id="logPw" onkeyup="if(event.key==='Enter') doLogin()" placeholder="••••••••">
      </div>
      <button class="main-btn" onclick="doLogin()">دخول</button>
      <div class="form-foot">ليس لديك حساب؟ <a onclick="navigate('/register')">إنشاء حساب جديد</a></div>
    </div>`;
}
async function doLogin() {
  const identifier = document.getElementById('logId').value.trim();
  const password = document.getElementById('logPw').value;
  if (!identifier || !password) { toast('املأ الحقول', 'error'); return; }
  try {
    const d = await api('/api/auth/login', 'POST', { identifier, password });
    state.token = d.token; state.user = d.user;
    localStorage.setItem('ws_token', d.token);
    // أعد تحميل بيانات المستخدم للحصول على admin_path
    await loadMe();
    renderHeader();
    toast('✅ مرحباً ' + (d.user.name || d.user.email));
    navigate('/');
  } catch (e) { toast(e.message, 'error'); }
}
window.doLogin = doLogin;

// ==================== التسجيل ====================
function renderRegister() {
  document.getElementById('app').innerHTML = `
    <div class="form-card">
      <div class="logo-top">${flagSVG()}<div class="brand-logo"><div class="brand-name" style="color:#0F172A">${esc(state.settings.content?.site_name || 'وصلني')}</div><div class="brand-sub" style="color:#64748B">SHOPPING & LOGISTICS</div></div></div>
      <h2>إنشاء حساب جديد</h2>
      <div class="fg">
        <label>الاسم الثلاثي:</label>
        <input id="regName" placeholder="أحمد محمد علي">
      </div>
      <div class="fg">
        <label>البريد الإلكتروني (Gmail فقط):</label>
        <input type="email" id="regEmail" placeholder="example@gmail.com" oninput="validateLive()">
        <div class="helper">يجب أن ينتهي بـ @gmail.com</div>
        <div class="err-msg" id="errEmail"></div>
      </div>
      <div class="fg">
        <label>رقم الهاتف:</label>
        <input id="regPhone" placeholder="09xxxxxxxx" maxlength="10" oninput="validateLive()">
        <div class="helper">10 أرقام تبدأ بـ 09</div>
        <div class="err-msg" id="errPhone"></div>
      </div>
      <div class="fg">
        <label>كلمة المرور:</label>
        <input type="password" id="regPw" placeholder="8+ أحرف وأرقام ورموز" oninput="validateLive()">
        <div class="helper">مثال: MyPass@123</div>
        <div class="err-msg" id="errPw"></div>
      </div>
      <button class="main-btn" onclick="doRegister()">إنشاء الحساب</button>
      <div class="form-foot">لديك حساب؟ <a onclick="navigate('/login')">تسجيل الدخول</a></div>
    </div>`;
}
function validateLive() {
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const pw = document.getElementById('regPw').value;
  const eE = document.getElementById('errEmail');
  const eP = document.getElementById('errPhone');
  const eW = document.getElementById('errPw');
  if (email) eE.textContent = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email) ? '' : 'البريد يجب أن ينتهي بـ @gmail.com'; else eE.textContent = '';
  if (phone) eP.textContent = /^09\d{8}$/.test(phone) ? '' : 'الهاتف 10 أرقام يبدأ بـ 09'; else eP.textContent = '';
  if (pw) {
    if (pw.length < 8) eW.textContent = 'كلمة المرور 8 أحرف على الأقل';
    else if (!/[A-Za-z]/.test(pw)) eW.textContent = 'يجب أن تحتوي على أحرف';
    else if (!/\d/.test(pw)) eW.textContent = 'يجب أن تحتوي على أرقام';
    else if (!/[!@#$%^&*()_\-+=\[\]{};:'",.<>\/?\\|`~]/.test(pw)) eW.textContent = 'يجب أن تحتوي على رموز';
    else eW.textContent = '';
  } else eW.textContent = '';
}
window.validateLive = validateLive;

async function doRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPw').value;
  if (!name || name.split(/\s+/).length < 2) { toast('الاسم الثلاثي مطلوب', 'error'); return; }
  if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email)) { toast('البريد يجب أن ينتهي بـ @gmail.com', 'error'); return; }
  if (!/^09\d{8}$/.test(phone)) { toast('رقم الهاتف 10 أرقام يبدأ بـ 09', 'error'); return; }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[!@#$%^&*()_\-+=\[\]{};:'",.<>\/?\\|`~]/.test(password)) {
    toast('كلمة المرور: 8+ أحرف وأرقام ورموز', 'error'); return;
  }
  try {
    const d = await api('/api/auth/register', 'POST', { name, email, phone, password });
    state.token = d.token; state.user = d.user;
    localStorage.setItem('ws_token', d.token);
    await loadNotifications();
    renderHeader();
    toast('✅ تم إنشاء حسابك');
    navigate('/');
  } catch (e) { toast(e.message, 'error'); }
}
window.doRegister = doRegister;

// ==================== لوحة الأدمن ====================
async function renderAdmin() {
  if (!state.user || !state.user.is_admin) { toast('صلاحيات غير كافية', 'error'); navigate('/'); return; }
  document.getElementById('app').innerHTML = `
    <div class="admin">
      <h2 style="margin-bottom:18px;color:#0F172A">⚙️ لوحة الإدارة</h2>
      <div class="atabs">
        <button data-t="ov" onclick="adminTab('ov')">📊 نظرة عامة</button>
        <button data-t="or" onclick="adminTab('or')">🛒 الطلبات</button>
        <button data-t="wa" onclick="adminTab('wa')">💳 المحافظ</button>
        <button data-t="cm" onclick="adminTab('cm')">📞 طرق التواصل</button>
        <button data-t="st" onclick="adminTab('st')">🏪 المتاجر</button>
        <button data-t="te" onclick="adminTab('te')">⭐ الإثباتات</button>
        <button data-t="co" onclick="adminTab('co')">📝 المحتوى والشروط</button>
        <button data-t="ge" onclick="adminTab('ge')">🌍 الدول والمحافظ</button>
        <button data-t="ac" onclick="adminTab('ac')">👥 الحسابات</button>
        <button data-t="su" onclick="adminTab('su')">💬 الدعم</button>
        <button data-t="bc" onclick="adminTab('bc')">📢 البث</button>
      </div>
      <div id="adminBody"></div>
    </div>`;
  adminTab('ov');
}
window.renderAdmin = renderAdmin;

async function adminTab(t) {
  document.querySelectorAll('.atabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  const c = document.getElementById('adminBody');
  c.innerHTML = '<div class="loader">⏳ جاري التحميل…</div>';
  try {
    if (t === 'ov') return adminOverview(c);
    if (t === 'or') return adminOrders(c);
    if (t === 'wa') return adminWallets(c);
    if (t === 'cm') return adminContactMethods(c);
    if (t === 'st') return adminStores(c);
    if (t === 'te') return adminTestimonials(c);
    if (t === 'co') return adminContent(c);
    if (t === 'ge') return adminGeo(c);
    if (t === 'ac') return adminAccounts(c);
    if (t === 'su') return adminSupport(c);
    if (t === 'bc') return adminBroadcast(c);
  } catch (e) { c.innerHTML = `<div class="empty"><h3>${esc(e.message)}</h3></div>`; }
}
window.adminTab = adminTab;

async function adminOverview(c) {
  const s = await api('/api/admin/stats');
  const orders = await api('/api/admin/orders');
  const labels = state.settings.status_labels || {};
  c.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><div class="n">${s.total_orders}</div><div class="l">إجمالي الطلبات</div></div>
      <div class="stat"><div class="n">${s.pending_quote}</div><div class="l">طلبات جديدة</div></div>
      <div class="stat"><div class="n">${s.awaiting_payment}</div><div class="l">بانتظار الدفع</div></div>
      <div class="stat"><div class="n">${s.in_progress}</div><div class="l">قيد التنفيذ</div></div>
      <div class="stat"><div class="n">${s.delivered}</div><div class="l">تم التسليم</div></div>
      <div class="stat"><div class="n">${s.open_support}</div><div class="l">رسائل مفتوحة</div></div>
      <div class="stat"><div class="n">$${fmt(s.total_revenue)}</div><div class="l">الإيرادات</div></div>
    </div>
    <h4 style="margin-bottom:12px;color:#0F172A">📋 آخر 5 طلبات</h4>
    <div class="tbl-wrap"><table>
      <tr><th>#</th><th>المستلم</th><th>المحافظة</th><th>المنتج</th><th>المبلغ</th><th>الحالة</th></tr>
      ${orders.slice(0, 5).map(o => `<tr>
        <td>${esc(o.order_number)}</td><td>${esc(o.receiver_name)}</td><td>${esc(o.region_name || '-')}</td>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.product_title)}</td>
        <td>${o.total_usd > 0 ? '$' + fmt(o.total_usd) : '—'}</td>
        <td><span class="status-chip st-${o.status}">${labels[o.status] || o.status}</span></td>
      </tr>`).join('')}
    </table></div>`;
}

async function adminOrders(c) {
  const orders = await api('/api/admin/orders');
  const labels = state.settings.status_labels || {};
  c.innerHTML = `
    <div class="toolbar"><h4>🛒 الطلبات (${orders.length})</h4></div>
    <div class="tbl-wrap"><table>
      <tr><th>#</th><th>المنتج</th><th>المستلم</th><th>الهاتف</th><th>المحافظة</th><th>الإجمالي</th><th>الحالة</th><th>إجراءات</th></tr>
      ${orders.map(o => `
        <tr>
          <td style="font-family:monospace;font-size:11px">${esc(o.order_number)}</td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(o.product_title)}</td>
          <td>${esc(o.receiver_name)}</td>
          <td>${esc(o.receiver_phone)}</td>
          <td>${esc(o.region_name || '-')}</td>
          <td>${o.total_usd > 0 ? '$' + fmt(o.total_usd) : '—'}</td>
          <td><span class="status-chip st-${o.status}">${labels[o.status] || o.status}</span></td>
          <td>
            <button class="btn-primary btn-sm" onclick='editOrder(${JSON.stringify(o).replace(/'/g, "&#39;")})'>✏️ فتح</button>
            <button class="btn-red btn-sm" onclick="delOrder(${o.id})">🗑️</button>
          </td>
        </tr>`).join('')}
    </table></div>`;
}

function editOrder(o) {
  const labels = state.settings.status_labels || {};
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.onclick = e => { if (e.target === bg) bg.remove(); };
  bg.innerHTML = `
    <div class="modal">
      <button class="modal-close" onclick="this.closest('.modal-bg').remove()">✕</button>
      <h3>إدارة الطلب ${esc(o.order_number)}</h3>

      <div style="padding:14px;background:#F8FAFC;border-radius:10px;margin-bottom:14px">
        <p><strong>👤 العميل:</strong> ${esc(o.user_name || '-')} ${o.user_email ? `(${esc(o.user_email)})` : ''} ${o.user_phone ? ` - ${esc(o.user_phone)}` : ''}</p>
        <p style="margin-top:8px"><strong>📦 المنتج:</strong> ${esc(o.product_title)}</p>
        <p style="margin-top:8px"><strong>🏪 المتجر:</strong> ${esc(o.store_name || '-')} | <strong>الكمية:</strong> ${o.quantity}</p>
        <p style="margin-top:8px"><a href="${esc(o.product_url)}" target="_blank" style="font-size:12px">🔗 فتح رابط المنتج</a></p>
        <p style="margin-top:10px"><strong>📝 طلب الزبون:</strong></p>
        <p style="color:#475569;font-size:13px;line-height:1.7;margin-top:4px;background:#fff;padding:10px;border-radius:6px">${esc(o.customer_description || '-')}</p>
      </div>

      <div style="padding:14px;background:#F8FAFC;border-radius:10px;margin-bottom:14px">
        <p><strong>🚚 بيانات المستلم:</strong></p>
        <p style="font-size:13px;margin-top:4px">${esc(o.receiver_name)} — ${esc(o.receiver_phone)}</p>
        <p style="font-size:13px">${esc(o.region_name || '-')} — ${esc(o.full_address)}</p>
      </div>

      ${o.status === 'pending_quote' ? `
        <div style="background:#FEF3C7;padding:16px;border-radius:10px;border-right:3px solid #F59E0B;margin-bottom:14px">
          <p style="font-weight:700;color:#78350F;margin-bottom:12px;font-size:15px">💰 أدخل عرض السعر للزبون</p>
          <div class="fg"><label>سعر المنتج من المتجر ($):</label>
            <input type="number" step="0.01" id="q_amazon" placeholder="0.00">
          </div>
          <div class="fg"><label>الشحن الدولي ($):</label>
            <input type="number" step="0.01" id="q_ship" placeholder="0.00" value="0">
          </div>
          <div class="fg"><label>الجمارك والخدمة ($):</label>
            <input type="number" step="0.01" id="q_cust" placeholder="0.00" value="0">
          </div>
          <div class="fg"><label>ملاحظة للزبون (اختياري):</label>
            <textarea id="q_notes" placeholder="مثال: السعر يشمل ضمان سنة، الشحن جوي خلال 3 أسابيع"></textarea>
          </div>
          <button class="btn-green" style="width:100%;padding:12px;font-weight:800" onclick="sendQuote(${o.id})">📤 إرسال عرض السعر للزبون</button>
        </div>
      ` : ''}

      ${o.admin_quote_price ? `
        <div style="padding:14px;background:#DBEAFE;border-radius:10px;margin-bottom:14px">
          <p style="font-weight:700;color:#1E40AF">✅ عرض السعر المُرسل:</p>
          <p style="font-size:13px;margin-top:6px">المنتج: $${fmt(o.admin_quote_price)} | الشحن: $${fmt(o.admin_quote_shipping)} | الجمارك: $${fmt(o.admin_quote_customs)}</p>
          <p style="font-size:15px;font-weight:800;color:#1E40AF;margin-top:6px">الإجمالي: $${fmt(o.total_usd)}</p>
        </div>
      ` : ''}

      <div class="fg"><label>تغيير الحالة:</label>
        <select id="mo_status">
          ${Object.keys(labels).map(k => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${labels[k]}</option>`).join('')}
        </select>
      </div>

      <div class="fg"><label>ملاحظة التتبع (ستظهر للزبون):</label>
        <input id="mo_note" placeholder="مثال: تم استلام الشحنة في المستودع الخارجي">
      </div>

      <div class="fg"><label>ملاحظات إدارية:</label>
        <textarea id="mo_notes">${esc(o.notes || '')}</textarea>
      </div>

      <button class="btn-primary" style="width:100%;padding:12px" onclick="saveOrderEdit(${o.id})">💾 حفظ التغييرات</button>
    </div>`;
  document.body.appendChild(bg);
}
window.editOrder = editOrder;

async function sendQuote(id) {
  const body = {
    amazon_price: parseFloat(document.getElementById('q_amazon').value) || 0,
    shipping_cost: parseFloat(document.getElementById('q_ship').value) || 0,
    customs: parseFloat(document.getElementById('q_cust').value) || 0,
    notes: document.getElementById('q_notes').value.trim()
  };
  if (!body.amazon_price || body.amazon_price <= 0) { toast('سعر المنتج مطلوب', 'error'); return; }
  try {
    await api(`/api/admin/orders/${id}/send-quote`, 'POST', body);
    toast('✅ تم إرسال العرض للزبون');
    document.querySelector('.modal-bg')?.remove();
    adminTab('or');
  } catch (e) { toast(e.message, 'error'); }
}
window.sendQuote = sendQuote;

async function saveOrderEdit(id) {
  const body = {
    status: document.getElementById('mo_status').value,
    tracking_note: document.getElementById('mo_note').value.trim(),
    notes: document.getElementById('mo_notes').value.trim()
  };
  try {
    await api('/api/admin/orders/' + id, 'PUT', body);
    toast('✅ تم التحديث');
    document.querySelector('.modal-bg')?.remove();
    adminTab('or');
  } catch (e) { toast(e.message, 'error'); }
}
window.saveOrderEdit = saveOrderEdit;

async function delOrder(id) {
  if (!confirm('حذف الطلب نهائياً؟')) return;
  try { await api('/api/admin/orders/' + id, 'DELETE'); toast('تم الحذف', 'info'); adminTab('or'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delOrder = delOrder;

// ==================== إدارة المحافظ ====================
async function adminWallets(c) {
  const list = await api('/api/admin/wallets');
  c.innerHTML = `
    <div class="toolbar"><h4>💳 المحافظ (${list.length})</h4></div>
    <div class="afm">
      <h4>➕ إضافة محفظة</h4>
      <div class="frow">
        <div class="fg"><label>الشبكة:</label>
          <select id="nw_net">
            <option>TRC20</option><option>BEP20</option><option>ERC20</option>
          </select>
        </div>
        <div class="fg"><label>ترتيب العرض:</label><input type="number" id="nw_order" value="0"></div>
      </div>
      <div class="fg"><label>عنوان المحفظة:</label>
        <input id="nw_addr" style="direction:ltr;text-align:left;font-family:monospace">
      </div>
      <button class="btn-primary" onclick="addWallet()">إضافة</button>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>الشبكة</th><th>العنوان</th><th>نشط</th><th>إجراءات</th></tr>
      ${list.map(w => `
        <tr>
          <td>${w.id}</td><td><strong>${esc(w.network)}</strong></td>
          <td style="direction:ltr;font-family:monospace;font-size:11px;word-break:break-all">${esc(w.address)}</td>
          <td>${w.active ? '✅' : '❌'}</td>
          <td>
            <button class="btn-gray btn-sm" onclick="toggleWallet(${w.id}, ${w.active ? 0 : 1})">${w.active ? 'تعطيل' : 'تفعيل'}</button>
            <button class="btn-red btn-sm" onclick="delWallet(${w.id})">🗑️</button>
          </td>
        </tr>`).join('')}
    </table></div>
    <p class="mini" style="margin-top:12px">💡 يمكنك أيضاً تعديل العناوين مباشرة من متغيرات البيئة على Render: WALLET_TRC20 و WALLET_BEP20</p>`;
}
async function addWallet() {
  const body = {
    network: document.getElementById('nw_net').value,
    address: document.getElementById('nw_addr').value.trim(),
    sort_order: parseInt(document.getElementById('nw_order').value) || 0
  };
  if (!body.address) { toast('العنوان مطلوب', 'error'); return; }
  try {
    await api('/api/admin/wallets', 'POST', body);
    state.settings = await api('/api/public/data');
    toast('✅ تمت الإضافة'); adminTab('wa');
  } catch (e) { toast(e.message, 'error'); }
}
window.addWallet = addWallet;
async function toggleWallet(id, active) {
  try {
    const list = await api('/api/admin/wallets');
    const w = list.find(x => x.id === id);
    await api('/api/admin/wallets/' + id, 'PUT', { ...w, active: active === 1 });
    state.settings = await api('/api/public/data');
    adminTab('wa');
  } catch (e) { toast(e.message, 'error'); }
}
window.toggleWallet = toggleWallet;
async function delWallet(id) {
  if (!confirm('حذف المحفظة؟')) return;
  try {
    await api('/api/admin/wallets/' + id, 'DELETE');
    state.settings = await api('/api/public/data');
    toast('تم الحذف', 'info'); adminTab('wa');
  } catch (e) { toast(e.message, 'error'); }
}
window.delWallet = delWallet;

// ==================== إدارة طرق التواصل ====================
async function adminContactMethods(c) {
  const list = await api('/api/admin/contact-methods');
  const types = [
    { v: 'whatsapp', l: '📱 واتساب' },
    { v: 'telegram', l: '✈️ تلغرام' },
    { v: 'email', l: '📧 إيميل' },
    { v: 'phone', l: '📞 هاتف' },
    { v: 'link', l: '🔗 رابط' }
  ];
  c.innerHTML = `
    <div class="toolbar"><h4>📞 طرق التواصل (${list.length})</h4></div>
    <div class="afm">
      <h4>➕ إضافة طريقة تواصل</h4>
      <div class="frow">
        <div class="fg"><label>النوع:</label>
          <select id="cm_type">
            ${types.map(t => `<option value="${t.v}">${t.l}</option>`).join('')}
          </select>
        </div>
        <div class="fg"><label>الأيقونة (emoji):</label>
          <input id="cm_icon" placeholder="📱" maxlength="4">
        </div>
      </div>
      <div class="frow">
        <div class="fg"><label>الاسم المعروض:</label>
          <input id="cm_label" placeholder="واتساب الأعمال">
        </div>
        <div class="fg"><label>القيمة (رقم/يوزر/رابط):</label>
          <input id="cm_value" placeholder="+9639xxxxxxxx" style="direction:ltr;text-align:left">
        </div>
      </div>
      <div class="fg"><label>ترتيب:</label><input type="number" id="cm_order" value="0"></div>
      <button class="btn-primary" onclick="addContactMethod()">إضافة</button>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>النوع</th><th>الاسم</th><th>القيمة</th><th>نشط</th><th>إجراءات</th></tr>
      ${list.map(cm => `
        <tr>
          <td>${cm.id}</td>
          <td>${cm.icon} ${esc(cm.type)}</td>
          <td>${esc(cm.label)}</td>
          <td style="direction:ltr;font-size:12px">${esc(cm.value)}</td>
          <td>${cm.active ? '✅' : '❌'}</td>
          <td>
            <button class="btn-gray btn-sm" onclick="toggleContactMethod(${cm.id}, ${cm.active ? 0 : 1})">${cm.active ? 'إخفاء' : 'إظهار'}</button>
            <button class="btn-red btn-sm" onclick="delContactMethod(${cm.id})">🗑️</button>
          </td>
        </tr>`).join('')}
    </table></div>
    <p class="mini" style="margin-top:12px">💡 هذه الطرق تظهر في الفوتر، صفحة "مركز المساعدة"، وفي الصفحة الرئيسية.</p>`;
}
async function addContactMethod() {
  const body = {
    type: document.getElementById('cm_type').value,
    icon: document.getElementById('cm_icon').value.trim() || '💬',
    label: document.getElementById('cm_label').value.trim(),
    value: document.getElementById('cm_value').value.trim(),
    sort_order: parseInt(document.getElementById('cm_order').value) || 0
  };
  if (!body.label || !body.value) { toast('الاسم والقيمة مطلوبان', 'error'); return; }
  try {
    await api('/api/admin/contact-methods', 'POST', body);
    state.settings = await api('/api/public/data');
    renderFooter();
    toast('✅'); adminTab('cm');
  } catch (e) { toast(e.message, 'error'); }
}
window.addContactMethod = addContactMethod;
async function toggleContactMethod(id, active) {
  try {
    const list = await api('/api/admin/contact-methods');
    const cm = list.find(x => x.id === id);
    await api('/api/admin/contact-methods/' + id, 'PUT', { ...cm, active: active === 1 });
    state.settings = await api('/api/public/data');
    renderFooter();
    adminTab('cm');
  } catch (e) { toast(e.message, 'error'); }
}
window.toggleContactMethod = toggleContactMethod;
async function delContactMethod(id) {
  if (!confirm('حذف طريقة التواصل؟')) return;
  try {
    await api('/api/admin/contact-methods/' + id, 'DELETE');
    state.settings = await api('/api/public/data');
    renderFooter();
    toast('تم الحذف', 'info'); adminTab('cm');
  } catch (e) { toast(e.message, 'error'); }
}
window.delContactMethod = delContactMethod;

// ==================== إدارة المتاجر ====================
async function adminStores(c) {
  const list = await api('/api/admin/stores');
  c.innerHTML = `
    <div class="toolbar"><h4>🏪 المتاجر المدعومة (${list.length})</h4></div>
    <div class="afm">
      <h4>➕ إضافة متجر</h4>
      <div class="frow">
        <div class="fg"><label>الاسم العربي:</label><input id="ns_ar" placeholder="أمازون"></div>
        <div class="fg"><label>الاسم الإنجليزي:</label><input id="ns_en" placeholder="Amazon"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>الأيقونة:</label><input id="ns_icon" placeholder="🅰️" maxlength="4"></div>
        <div class="fg"><label>الرابط (للعرض):</label><input id="ns_hint" placeholder="amazon.com" style="direction:ltr;text-align:left"></div>
      </div>
      <button class="btn-primary" onclick="addStore()">إضافة</button>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>الأيقونة</th><th>الاسم</th><th>الرابط</th><th>نشط</th><th>إجراءات</th></tr>
      ${list.map(s => `
        <tr>
          <td>${s.id}</td><td style="font-size:22px">${s.icon}</td>
          <td>${esc(s.name_ar)} / ${esc(s.name_en)}</td>
          <td style="direction:ltr;font-size:11px">${esc(s.url_hint)}</td>
          <td>${s.active ? '✅' : '❌'}</td>
          <td>
            <button class="btn-gray btn-sm" onclick="toggleStore(${s.id}, ${s.active ? 0 : 1})">${s.active ? 'تعطيل' : 'تفعيل'}</button>
            <button class="btn-red btn-sm" onclick="delStore(${s.id})">🗑️</button>
          </td>
        </tr>`).join('')}
    </table></div>`;
}
async function addStore() {
  const body = {
    name_ar: document.getElementById('ns_ar').value.trim(),
    name_en: document.getElementById('ns_en').value.trim(),
    icon: document.getElementById('ns_icon').value.trim() || '🛒',
    url_hint: document.getElementById('ns_hint').value.trim()
  };
  if (!body.name_ar || !body.name_en) { toast('الاسم مطلوب', 'error'); return; }
  try {
    await api('/api/admin/stores', 'POST', body);
    state.settings = await api('/api/public/data');
    toast('✅'); adminTab('st');
  } catch (e) { toast(e.message, 'error'); }
}
window.addStore = addStore;
async function toggleStore(id, active) {
  try {
    const list = await api('/api/admin/stores');
    const s = list.find(x => x.id === id);
    await api('/api/admin/stores/' + id, 'PUT', { ...s, active: active === 1 });
    state.settings = await api('/api/public/data');
    adminTab('st');
  } catch (e) { toast(e.message, 'error'); }
}
window.toggleStore = toggleStore;
async function delStore(id) {
  if (!confirm('حذف المتجر؟')) return;
  try {
    await api('/api/admin/stores/' + id, 'DELETE');
    state.settings = await api('/api/public/data');
    toast('تم الحذف', 'info'); adminTab('st');
  } catch (e) { toast(e.message, 'error'); }
}
window.delStore = delStore;

// ==================== إدارة الإثباتات ====================
async function adminTestimonials(c) {
  const list = await api('/api/admin/testimonials');
  c.innerHTML = `
    <div class="toolbar"><h4>⭐ إثباتات التسليم (${list.length})</h4></div>
    <div class="afm">
      <h4>➕ إضافة إثبات جديد</h4>
      <div class="frow">
        <div class="fg"><label>اسم العميل:</label><input id="nt_name" placeholder="أحمد من دمشق"></div>
        <div class="fg"><label>عنوان (اسم المنتج):</label><input id="nt_title" placeholder="آيفون 15 برو"></div>
      </div>
      <div class="fg"><label>الوصف:</label><textarea id="nt_desc" placeholder="وصلني الجهاز بأسبوعين..."></textarea></div>
      <div class="frow">
        <div class="fg"><label>رابط الصورة:</label><input id="nt_img" style="direction:ltr;text-align:left" placeholder="https://..."></div>
        <div class="fg"><label>رابط الفيديو (اختياري):</label><input id="nt_vid" style="direction:ltr;text-align:left" placeholder="https://..."></div>
      </div>
      <button class="btn-primary" onclick="addTestimonial()">إضافة</button>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>العميل</th><th>العنوان</th><th>الوسائط</th><th>نشط</th><th>إجراءات</th></tr>
      ${list.map(t => `
        <tr>
          <td>${t.id}</td><td>${esc(t.customer_name)}</td><td>${esc(t.title)}</td>
          <td>${t.video_url ? '🎥 فيديو' : (t.image_url ? '🖼️ صورة' : '—')}</td>
          <td>${t.active ? '✅' : '❌'}</td>
          <td>
            <button class="btn-gray btn-sm" onclick="toggleTesti(${t.id}, ${t.active ? 0 : 1})">${t.active ? 'إخفاء' : 'نشر'}</button>
            <button class="btn-red btn-sm" onclick="delTesti(${t.id})">🗑️</button>
          </td>
        </tr>`).join('')}
    </table></div>`;
}
async function addTestimonial() {
  const body = {
    customer_name: document.getElementById('nt_name').value.trim(),
    title: document.getElementById('nt_title').value.trim(),
    description: document.getElementById('nt_desc').value.trim(),
    image_url: document.getElementById('nt_img').value.trim(),
    video_url: document.getElementById('nt_vid').value.trim()
  };
  if (!body.customer_name || !body.title) { toast('الاسم والعنوان مطلوبان', 'error'); return; }
  try {
    await api('/api/admin/testimonials', 'POST', body);
    state.settings = await api('/api/public/data');
    toast('✅'); adminTab('te');
  } catch (e) { toast(e.message, 'error'); }
}
window.addTestimonial = addTestimonial;
async function toggleTesti(id, active) {
  try {
    const list = await api('/api/admin/testimonials');
    const t = list.find(x => x.id === id);
    await api('/api/admin/testimonials/' + id, 'PUT', { ...t, active: active === 1 });
    state.settings = await api('/api/public/data');
    adminTab('te');
  } catch (e) { toast(e.message, 'error'); }
}
window.toggleTesti = toggleTesti;
async function delTesti(id) {
  if (!confirm('حذف الإثبات؟')) return;
  try {
    await api('/api/admin/testimonials/' + id, 'DELETE');
    state.settings = await api('/api/public/data');
    toast('تم الحذف', 'info'); adminTab('te');
  } catch (e) { toast(e.message, 'error'); }
}
window.delTesti = delTesti;

// ==================== إدارة المحتوى والشروط ====================
async function adminContent(c) {
  const k = await api('/api/admin/content');
  c.innerHTML = `
    <h4 style="margin-bottom:16px;color:#0F172A">📝 إدارة المحتوى والشروط والسياسات</h4>

    <div class="afm">
      <h5 style="margin-bottom:12px;color:#0F172A">🏠 نصوص الصفحة الرئيسية</h5>
      <div class="fg"><label>اسم المنصة:</label><input id="cn_site_name" value="${esc(k.site_name || '')}"></div>
      <div class="fg"><label>الوصف المختصر:</label><input id="cn_site_tagline" value="${esc(k.site_tagline || '')}"></div>
      <div class="fg"><label>عنوان البانر الرئيسي:</label><input id="cn_hero_title" value="${esc(k.hero_title || '')}"></div>
      <div class="fg"><label>الوصف تحت البانر:</label><textarea id="cn_hero_subtitle">${esc(k.hero_subtitle || '')}</textarea></div>
      <div class="fg"><label>نص "من نحن":</label><textarea id="cn_about_text">${esc(k.about_text || '')}</textarea></div>
      <div class="fg"><label>ملاحظة الضمان:</label><input id="cn_warranty_note" value="${esc(k.warranty_note || '')}"></div>
    </div>

    <div class="afm">
      <h5 style="margin-bottom:12px;color:#0F172A">📜 الشروط والأحكام</h5>
      <div class="fg">
        <textarea id="cn_terms_text" style="min-height:200px;line-height:1.8">${esc(k.terms_text || '')}</textarea>
        <div class="helper">اكتب كل بند في سطر منفصل. تُعرض في صفحة "الشروط والسياسات".</div>
      </div>
    </div>

    <div class="afm">
      <h5 style="margin-bottom:12px;color:#0F172A">💸 سياسة الاسترجاع والضمان</h5>
      <div class="fg">
        <textarea id="cn_refund_text" style="min-height:200px;line-height:1.8">${esc(k.refund_text || '')}</textarea>
      </div>
    </div>

    <div class="afm">
      <h5 style="margin-bottom:12px;color:#0F172A">⚖️ الإشعار القانوني وسياسة الخصوصية</h5>
      <div class="fg">
        <textarea id="cn_legal_text" style="min-height:200px;line-height:1.8">${esc(k.legal_text || '')}</textarea>
      </div>
    </div>

    <button class="btn-primary" style="width:100%;padding:14px;font-size:15px;font-weight:800" onclick="saveContent()">💾 حفظ الكل</button>`;
}
async function saveContent() {
  const keys = ['site_name','site_tagline','hero_title','hero_subtitle','about_text','warranty_note','terms_text','refund_text','legal_text'];
  const body = {};
  keys.forEach(k => {
    const el = document.getElementById('cn_' + k);
    if (el) body[k] = el.value;
  });
  try {
    await api('/api/admin/content', 'PUT', body);
    state.settings = await api('/api/public/data');
    renderHeader(); renderFooter();
    toast('✅ تم الحفظ');
  } catch (e) { toast(e.message, 'error'); }
}
window.saveContent = saveContent;

// ==================== إدارة الدول والمحافظ ====================
async function adminGeo(c) {
  const list = await api('/api/admin/countries');
  c.innerHTML = `
    <div class="toolbar"><h4>🌍 الدول والمحافظ</h4></div>
    <div class="afm">
      <h4>➕ إضافة دولة</h4>
      <div class="frow">
        <div class="fg"><label>الاسم العربي:</label><input id="ng_ar"></div>
        <div class="fg"><label>الاسم الإنجليزي:</label><input id="ng_en"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>العلم:</label><input id="ng_flag" placeholder="🇸🇾" maxlength="4"></div>
        <div class="fg"><label>ترتيب:</label><input type="number" id="ng_order" value="0"></div>
      </div>
      <button class="btn-primary" onclick="addGeoCountry()">إضافة دولة</button>
    </div>
    ${list.map(cnt => `
      <div class="afm">
        <h4>${cnt.flag} ${esc(cnt.name_ar)} — ${esc(cnt.name_en)} ${cnt.active ? '✅' : '❌'}</h4>
        <div class="frow" style="margin-bottom:10px">
          <button class="btn-gray btn-sm" onclick="toggleCountry(${cnt.id}, ${cnt.active ? 0 : 1})">${cnt.active ? 'تعطيل' : 'تفعيل'}</button>
          <button class="btn-red btn-sm" onclick="delCountry(${cnt.id})">حذف الدولة</button>
        </div>
        <p class="mini" style="margin-bottom:10px">المحافظ (${cnt.regions.length}):</p>
        <div class="tbl-wrap" style="margin-bottom:10px"><table>
          <tr><th>ID</th><th>المحافظة</th><th>نشط</th><th>إجراءات</th></tr>
          ${cnt.regions.map(r => `
            <tr>
              <td>${r.id}</td><td>${esc(r.name_ar)}</td>
              <td>${r.active ? '✅' : '❌'}</td>
              <td>
                <button class="btn-gray btn-sm" onclick="toggleRegion(${r.id}, ${r.active ? 0 : 1})">${r.active ? 'تعطيل' : 'تفعيل'}</button>
                <button class="btn-red btn-sm" onclick="delRegion(${r.id})">🗑️</button>
              </td>
            </tr>`).join('')}
        </table></div>
        <div class="frow">
          <div class="fg"><label>اسم محافظة جديدة:</label><input id="nr_name_${cnt.id}"></div>
          <div class="fg"><label>&nbsp;</label><button class="btn-green btn-sm" onclick="addRegion(${cnt.id})">➕ إضافة محافظة</button></div>
        </div>
      </div>`).join('')}`;
}
async function addGeoCountry() {
  const body = {
    name_ar: document.getElementById('ng_ar').value.trim(),
    name_en: document.getElementById('ng_en').value.trim(),
    flag: document.getElementById('ng_flag').value.trim() || '🌐',
    sort_order: parseInt(document.getElementById('ng_order').value) || 0
  };
  if (!body.name_ar || !body.name_en) { toast('الاسم مطلوب', 'error'); return; }
  try { await api('/api/admin/countries', 'POST', body); state.settings = await api('/api/public/data'); toast('✅'); adminTab('ge'); }
  catch (e) { toast(e.message, 'error'); }
}
window.addGeoCountry = addGeoCountry;
async function toggleCountry(id, active) {
  try {
    const list = await api('/api/admin/countries');
    const c = list.find(x => x.id === id);
    await api('/api/admin/countries/' + id, 'PUT', { ...c, active: active === 1 });
    state.settings = await api('/api/public/data');
    adminTab('ge');
  } catch (e) { toast(e.message, 'error'); }
}
window.toggleCountry = toggleCountry;
async function delCountry(id) {
  if (!confirm('حذف الدولة وكل محافظها؟')) return;
  try { await api('/api/admin/countries/' + id, 'DELETE'); state.settings = await api('/api/public/data'); toast('تم الحذف', 'info'); adminTab('ge'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delCountry = delCountry;
async function addRegion(cid) {
  const body = {
    country_id: cid,
    name_ar: document.getElementById('nr_name_' + cid).value.trim()
  };
  if (!body.name_ar) { toast('الاسم مطلوب', 'error'); return; }
  try { await api('/api/admin/regions', 'POST', body); state.settings = await api('/api/public/data'); toast('✅'); adminTab('ge'); }
  catch (e) { toast(e.message, 'error'); }
}
window.addRegion = addRegion;
async function toggleRegion(id, active) {
  try {
    const list = await api('/api/admin/countries');
    let rgn;
    list.forEach(c => c.regions.forEach(r => { if (r.id === id) rgn = r; }));
    await api('/api/admin/regions/' + id, 'PUT', { ...rgn, active: active === 1 });
    state.settings = await api('/api/public/data');
    adminTab('ge');
  } catch (e) { toast(e.message, 'error'); }
}
window.toggleRegion = toggleRegion;
async function delRegion(id) {
  if (!confirm('حذف المحافظة؟')) return;
  try { await api('/api/admin/regions/' + id, 'DELETE'); state.settings = await api('/api/public/data'); toast('تم الحذف', 'info'); adminTab('ge'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delRegion = delRegion;

// ==================== إدارة الحسابات ====================
async function adminAccounts(c) {
  const list = await api('/api/admin/accounts');
  c.innerHTML = `
    <div class="toolbar"><h4>👥 الحسابات (${list.length})</h4></div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>مدير</th><th>محظور</th><th>إجراءات</th></tr>
      ${list.map(a => `
        <tr>
          <td>${a.id}</td><td>${esc(a.name)}</td><td>${esc(a.email || '-')}</td><td>${esc(a.phone || '-')}</td>
          <td>${a.is_admin ? '✅' : '—'}</td>
          <td>${a.banned ? '<span style="color:#DC2626">🚫</span>' : '—'}</td>
          <td>
            ${a.id != state.user.id ? `
              <button class="btn-${a.banned ? 'green' : 'red'} btn-sm" onclick="toggleBan(${a.id}, ${a.banned ? 0 : 1})">${a.banned ? 'رفع الحظر' : 'حظر'}</button>
              <button class="btn-gray btn-sm" onclick="delAccount(${a.id})">🗑️</button>` : '<span class="mini">أنت</span>'}
          </td>
        </tr>`).join('')}
    </table></div>`;
}
async function toggleBan(id, banned) {
  try { await api('/api/admin/accounts/' + id, 'PUT', { banned: banned === 1 }); toast('✅'); adminTab('ac'); }
  catch (e) { toast(e.message, 'error'); }
}
window.toggleBan = toggleBan;
async function delAccount(id) {
  if (!confirm('حذف الحساب نهائياً؟')) return;
  try { await api('/api/admin/accounts/' + id, 'DELETE'); toast('تم الحذف', 'info'); adminTab('ac'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delAccount = delAccount;

// ==================== إدارة الدعم ====================
async function adminSupport(c) {
  const list = await api('/api/admin/support');
  c.innerHTML = `
    <div class="toolbar"><h4>💬 رسائل الدعم (${list.length})</h4></div>
    ${list.length === 0 ? '<p class="mini">لا توجد رسائل.</p>' : list.map(m => `
      <div class="afm" style="${m.status === 'open' ? 'background:#FEF3C7;border-color:#FCD34D' : ''}">
        <p><strong>👤 ${esc(m.user_name)}</strong> <span class="mini">(${esc(m.user_email || m.user_phone)})</span></p>
        <p class="mini">${new Date(m.created_at).toLocaleString('ar-EG')}</p>
        <p style="margin:10px 0;padding:12px;background:#fff;border-radius:8px;line-height:1.7">${esc(m.message)}</p>
        ${m.reply
          ? `<div style="background:#D1FAE5;padding:12px;border-radius:8px;border-right:3px solid #10B981"><strong>✅ ردك:</strong> ${esc(m.reply)}</div>`
          : `<div class="fg"><textarea id="rp_${m.id}" placeholder="اكتب الرد..."></textarea></div>
             <button class="btn-green btn-sm" onclick="sendReply(${m.id})">📤 إرسال الرد</button>`}
      </div>`).join('')}`;
}
async function sendReply(id) {
  const r = document.getElementById('rp_' + id).value.trim();
  if (!r) { toast('اكتب الرد', 'error'); return; }
  try { await api('/api/admin/support/' + id + '/reply', 'POST', { reply: r }); toast('✅'); adminTab('su'); }
  catch (e) { toast(e.message, 'error'); }
}
window.sendReply = sendReply;

// ==================== البث الجماعي ====================
async function adminBroadcast(c) {
  c.innerHTML = `
    <h4 style="margin-bottom:16px;color:#0F172A">📢 إرسال إشعار جماعي</h4>
    <div class="afm">
      <div class="fg"><label>عنوان الإشعار:</label><input id="bc_title" placeholder="عرض خاص!"></div>
      <div class="fg"><label>نص الإشعار:</label><textarea id="bc_body" placeholder="خصم 15% على الشحن الجوي هذا الأسبوع..."></textarea></div>
      <button class="btn-primary" onclick="sendBroadcast()">📢 إرسال للجميع</button>
    </div>`;
}
async function sendBroadcast() {
  const title = document.getElementById('bc_title').value.trim();
  const body = document.getElementById('bc_body').value.trim();
  if (!title) { toast('العنوان مطلوب', 'error'); return; }
  if (!confirm('إرسال الإشعار لجميع المستخدمين؟')) return;
  try {
    const r = await api('/api/admin/broadcast', 'POST', { title, body });
    toast(`✅ تم الإرسال لـ ${r.count} مستخدم`);
  } catch (e) { toast(e.message, 'error'); }
}
window.sendBroadcast = sendBroadcast;

// ==================== الراوتر ====================
async function renderPage() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loader">⏳ جاري التحميل…</div>';
  const hash = location.hash.slice(1) || '/';
  const path = hash.split('?')[0];
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    // فحص مسار الأدمن السري
    const adminPath = state.user?.admin_path;
    const isAdminPath = adminPath && path === '/' + adminPath;

    if (isAdminPath) {
      await renderAdmin();
    }
    else if (path === '/') await renderHome();
    else if (path === '/testimonials') await renderTestimonials();
    else if (path === '/legal') await renderLegal();
    else if (path === '/help') await renderHelp();
    else if (path === '/new-order') await renderNewOrder();
    else if (path === '/orders') await renderOrders();
    else if (path.startsWith('/order/')) await renderOrderDetail(path.split('/')[2]);
    else if (path === '/support') await renderSupport();
    else if (path === '/notifications') await renderNotifications();
    else if (path === '/login') renderLogin();
    else if (path === '/register') renderRegister();
    else app.innerHTML = `<div class="empty"><div class="ic">🤷</div><h3>الصفحة غير موجودة</h3><button class="btn-primary" onclick="navigate('/')">العودة للرئيسية</button></div>`;
  } catch (e) {
    app.innerHTML = `<div class="empty"><div class="ic">⚠️</div><h3>${esc(e.message)}</h3></div>`;
  }
  renderHeader();
  renderFooter();
}

window.addEventListener('hashchange', renderPage);
window.addEventListener('DOMContentLoaded', async () => {
  try { state.settings = await api('/api/public/data'); }
  catch (e) { state.settings = { content: {}, pricing: {}, countries: [], regions: [], stores: [], wallets: [], testimonials: [], contact_methods: [] }; }
  await loadMe();
  renderPage();
});
