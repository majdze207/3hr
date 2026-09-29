// ==================== الحالة ====================
const state = {
  token: localStorage.getItem('az_token') || null,
  user: null,
  cart: JSON.parse(localStorage.getItem('az_cart') || '[]'),
  categories: [],
  settings: {}
};

// ==================== مساعد ====================
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

function toast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type === 'success' ? '' : type);
  setTimeout(() => t.className = 'toast', 3000);
}

function saveCart() { localStorage.setItem('az_cart', JSON.stringify(state.cart)); updateCartBadge(); }
function cartSubtotal() { return state.cart.reduce((s, i) => s + i.price_usd * i.quantity, 0); }
function cartShipping() { return state.cart.reduce((s, i) => s + (i.shipping_fee_usd || 0) * i.quantity, 0); }
function cartTotal() { return cartSubtotal() + cartShipping(); }
function cartCount() { return state.cart.reduce((s, i) => s + i.quantity, 0); }

function updateCartBadge() {
  const b = document.getElementById('cartBadge');
  if (b) b.textContent = cartCount();
}

function navigate(path) { location.hash = '#' + path; }
window.navigate = navigate;

// ==================== الشعارات ====================
function amazonLogoSVG() {
  return `<svg class="amazon-logo" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="38" font-family="'Segoe UI', Tahoma, sans-serif" font-size="34" font-weight="bold" fill="#FFFFFF">أمازون</text>
    <text x="115" y="38" font-family="'Segoe UI', Tahoma, sans-serif" font-size="34" font-weight="bold" fill="#FF9900">سوريا</text>
    <path d="M 5 48 Q 100 62 195 48" stroke="#FF9900" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M 187 43 L 197 48 L 187 53" stroke="#FF9900" stroke-width="3.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function amazonLogoDarkSVG() {
  return `<svg class="amazon-logo" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="38" font-family="'Segoe UI', Tahoma, sans-serif" font-size="34" font-weight="bold" fill="#131921">أمازون</text>
    <text x="115" y="38" font-family="'Segoe UI', Tahoma, sans-serif" font-size="34" font-weight="bold" fill="#FF9900">سوريا</text>
    <path d="M 5 48 Q 100 62 195 48" stroke="#FF9900" stroke-width="3.5" fill="none" stroke-linecap="round"/>
    <path d="M 187 43 L 197 48 L 187 53" stroke="#FF9900" stroke-width="3.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
  </svg>`;
}

function flagSVG(size = '') {
  return `<div class="flag ${size}">
    <div class="g"></div>
    <div class="w"><span class="s">★</span><span class="s">★</span><span class="s">★</span></div>
    <div class="b"></div>
  </div>`;
}

// ==================== الهيدر والفوتر ====================
function renderHeader() {
  const u = state.user;
  const right = u
    ? `<button class="hdr-btn" onclick="navigate('/orders')">📦 طلباتي<small>تابع الشحن</small></button>
       <button class="hdr-btn" onclick="navigate('/support')">💬 الدعم<small>تواصل معنا</small></button>
       ${u.is_admin ? `<button class="hdr-btn" onclick="navigate('/admin')">⚙️ الإدارة<small>لوحة التحكم</small></button>` : ''}
       <button class="hdr-btn" onclick="logout()">👤 ${(u.name || '').split(' ')[0] || 'حسابي'}<small>خروج</small></button>`
    : `<button class="hdr-btn" onclick="navigate('/login')">👤 مرحباً<small>تسجيل الدخول</small></button>
       <button class="hdr-btn" onclick="navigate('/register')">✨ جديد<small>إنشاء حساب</small></button>`;

  document.getElementById('header').innerHTML = `
    <div class="hdr">
      <div class="brand" onclick="navigate('/')" title="أمازون سوريا">
        ${flagSVG()}
        ${amazonLogoSVG()}
      </div>
      <div class="search">
        <select id="searchCat">
          <option value="">كل الأقسام</option>
          ${state.categories.map(c => `<option value="${c.id}">${c.name_ar}</option>`).join('')}
        </select>
        <input id="searchInput" placeholder="ابحث عن منتج..." onkeyup="if(event.key==='Enter') doSearch()">
        <button onclick="doSearch()">🔍</button>
      </div>
      <div class="hdr-right">
        ${right}
        <button class="cart-btn" onclick="navigate('/cart')">
          🛒 <span class="badge" id="cartBadge">0</span>
        </button>
      </div>
    </div>
    <div class="subnav">
      <span onclick="navigate('/categories')">☰ كل الأقسام</span>
      <span onclick="navigate('/?discount=1')">🔥 العروض والتخفيضات</span>
      <span onclick="navigate('/support')">💬 تواصل مع الدعم</span>
      <span onclick="navigate('/register')">✨ انضم إلينا</span>
    </div>`;
  updateCartBadge();
}

function renderFooter() {
  document.getElementById('footer').innerHTML = `
    ${flagSVG('xs')}
    <p><strong>أمازون سوريا</strong> — تسوّق عالمي، توصيل إلى سوريا</p>
    <div class="links">
      <a onclick="navigate('/categories')" style="cursor:pointer">الأقسام</a>
      <a onclick="navigate('/orders')" style="cursor:pointer">طلباتي</a>
      <a onclick="navigate('/support')" style="cursor:pointer">الدعم</a>
      <a onclick="navigate('/register')" style="cursor:pointer">إنشاء حساب</a>
    </div>
    <p class="muted">💳 الدفع بالكريبتو USDT فقط • 🚚 التوصيل من 3 إلى 6 أسابيع</p>
    <p class="muted">© 2025 أمازون سوريا — جميع الحقوق محفوظة</p>`;
}

function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  const cat = document.getElementById('searchCat').value;
  let url = '/?';
  if (q) url += 'search=' + encodeURIComponent(q) + '&';
  if (cat) url += 'category=' + cat;
  navigate(url.slice(0, -1));
}
window.doSearch = doSearch;

// ==================== تحميل المستخدم ====================
async function loadMe() {
  if (!state.token) { state.user = null; return; }
  try { const d = await api('/api/auth/me'); state.user = d.user; }
  catch (e) { state.token = null; state.user = null; localStorage.removeItem('az_token'); }
}

function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem('az_token');
  renderHeader();
  toast('تم تسجيل الخروج', 'info');
  navigate('/');
}
window.logout = logout;

// ==================== السلة ====================
function addToCart(p) {
  const ex = state.cart.find(i => i.id === p.id);
  const price = p.effective_price !== undefined ? p.effective_price : p.price_usd;
  if (ex) ex.quantity++;
  else state.cart.push({
    id: p.id, title: p.title, price_usd: price,
    original_price_usd: p.price_usd,
    shipping_fee_usd: p.shipping_fee_usd || 0,
    image_url: p.image_url, category_name: p.category_name || '',
    quantity: 1
  });
  saveCart();
  toast('✅ تمت الإضافة إلى السلة');
}
window.addToCart = addToCart;

async function addToCartById(id) {
  try { const p = await api('/api/products/' + id); addToCart(p); }
  catch (e) { toast(e.message, 'error'); }
}
window.addToCartById = addToCartById;

function updateQty(id, q) {
  const it = state.cart.find(i => i.id === id);
  if (it) { it.quantity = Math.max(1, parseInt(q)); saveCart(); renderPage(); }
}
window.updateQty = updateQty;

function removeItem(id) {
  state.cart = state.cart.filter(i => i.id !== id);
  saveCart(); renderPage();
  toast('تم الحذف', 'info');
}
window.removeItem = removeItem;

function stars(r) {
  const n = Math.round(r || 0);
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

// ==================== الصفحة الرئيسية ====================
async function renderHome() {
  const hash = location.hash.slice(1);
  const qs = hash.split('?')[1] || '';
  const search = new URLSearchParams(qs).get('search') || '';
  const category = new URLSearchParams(qs).get('category') || '';
  const discountOnly = new URLSearchParams(qs).get('discount') === '1';

  let cats = [], products = [];
  try {
    cats = await api('/api/categories');
    state.categories = cats;
    let url = '/api/products?';
    if (search) url += 'search=' + encodeURIComponent(search) + '&';
    if (category) url += 'category_id=' + category + '&';
    if (discountOnly) url += 'discount=1';
    products = await api(url);
  } catch (e) {
    document.getElementById('app').innerHTML = `<div class="empty"><div class="ic">⚠️</div><h3>${e.message}</h3></div>`;
    return;
  }

  const discounted = discountOnly ? products : products.filter(p => p.discount_active && p.discount_percent > 0);

  document.getElementById('app').innerHTML = `
    ${!search && !category && !discountOnly ? `
      <div class="hero">
        <h2>🛍️ كل ما تحتاجه... <span>يوصلك إلى سوريا</span></h2>
        <p>تسوّق من أمازون العالمية — توصيل خلال 3 إلى 6 أسابيع لجميع المحافظات</p>
        <button class="cta" onclick="document.getElementById('cats').scrollIntoView({behavior:'smooth'})">تصفح الأقسام</button>
      </div>
      <div class="features">
        <div class="feat"><div class="ic">💳</div><h4>دفع USDT آمن</h4><p>شبكة BEP20 السريعة</p></div>
        <div class="feat"><div class="ic">🚚</div><h4>توصيل 3-6 أسابيع</h4><p>لجميع المحافظات السورية</p></div>
        <div class="feat"><div class="ic">💬</div><h4>دعم عربي 24/7</h4><p>نحن دائماً معك</p></div>
        <div class="feat"><div class="ic">🔥</div><h4>عروض حصرية</h4><p>خصومات على منتجات مختارة</p></div>
      </div>
      <div class="sec-title" id="cats"><h2>تسوّق حسب القسم</h2></div>
      <div class="cgrid">
        ${cats.map(c => `
          <div class="ccard" onclick="navigate('/?category=${c.id}')">
            <div class="em">${c.icon}</div>
            <h3>${c.name_ar}</h3>
            <p>تصفح المنتجات</p>
          </div>`).join('')}
      </div>
    ` : ''}

    ${discounted.length > 0 && !search && !category ? `
      <div class="sec-title" id="deals">
        <h2>🔥 عروض وتخفيضات</h2>
        ${!discountOnly ? `<span class="link" onclick="navigate('/?discount=1')">عرض الكل ←</span>` : ''}
      </div>
      <div class="pgrid">${discounted.slice(0, 4).map(p => productCard(p)).join('')}</div>
    ` : ''}

    <div class="sec-title">
      <h2>${search ? `🔍 نتائج البحث عن "${search}"` : discountOnly ? '🔥 كل العروض' : category ? (cats.find(c => c.id == category)?.icon + ' ' + cats.find(c => c.id == category)?.name_ar) : '🔥 أحدث المنتجات'}</h2>
      ${search || category || discountOnly ? '<button class="btn-gray btn-sm" onclick="navigate(\'/\')">← العودة للرئيسية</button>' : ''}
    </div>
    ${products.length === 0
      ? '<div class="empty"><div class="ic">📦</div><h3>لا توجد منتجات</h3></div>'
      : `<div class="pgrid">${products.map(p => productCard(p)).join('')}</div>`}
  `;
}

function productCard(p) {
  const hasDisc = p.discount_active && p.discount_percent > 0;
  const price = p.effective_price !== undefined ? p.effective_price : p.price_usd;
  const out = p.stock <= 0;
  return `
    <div class="pcard">
      ${hasDisc ? `<div class="disc-badge">خصم ${Math.round(p.discount_percent)}%</div>` : ''}
      <img src="${p.image_url || 'https://via.placeholder.com/300'}" onerror="this.src='https://via.placeholder.com/300'" alt="${p.title}">
      <h3>${p.title}</h3>
      <div class="stars">${stars(p.rating_avg)} <span class="count">(${p.rating_count})</span></div>
      <div class="price-row">
        <div class="price">$${price.toFixed(2)}</div>
        ${hasDisc ? `<div class="old-price">$${p.price_usd.toFixed(2)}</div>` : ''}
      </div>
      <div class="sub">+ شحن $${(p.shipping_fee_usd || 0).toFixed(2)}</div>
      <div class="sub">📁 ${p.category_name}</div>
      <div class="stock ${out ? 'out' : ''}">${out ? '❌ نفذت الكمية' : '✅ متوفر'}</div>
      <div class="acts">
        <button class="btn-gray btn-sm" onclick="navigate('/product/${p.id}')">التفاصيل</button>
        <button class="btn-yellow btn-sm" ${out ? 'disabled' : ''} onclick="addToCartById(${p.id})">🛒 أضف</button>
      </div>
    </div>`;
}

// ==================== صفحة الأقسام ====================
async function renderCategoriesPage() {
  const cats = await api('/api/categories');
  state.categories = cats;
  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>☰ كل الأقسام</h2></div>
    <div class="cgrid">
      ${cats.map(c => `
        <div class="ccard" onclick="navigate('/?category=${c.id}')">
          <div class="em">${c.icon}</div>
          <h3>${c.name_ar}</h3>
          <p>تصفح المنتجات</p>
        </div>`).join('')}
    </div>`;
}

// ==================== تفاصيل المنتج ====================
async function renderProduct(id) {
  try {
    const p = await api('/api/products/' + id);
    const hasDisc = p.discount_active && p.discount_percent > 0;
    const out = p.stock <= 0;
    document.getElementById('app').innerHTML = `
      <div class="crumb">
        <a onclick="navigate('/')">الرئيسية</a> ›
        <a onclick="navigate('/?category=${p.category_id}')">${p.category_name}</a> ›
        ${p.title}
      </div>
      <div class="pdetail">
        <div class="img-wrap">
          ${hasDisc ? `<div class="disc-badge">خصم ${Math.round(p.discount_percent)}%</div>` : ''}
          <img src="${p.image_url || 'https://via.placeholder.com/400'}" onerror="this.src='https://via.placeholder.com/400'" alt="${p.title}">
        </div>
        <div>
          <h2>${p.title}</h2>
          <div class="rating-row">
            <div class="stars">${stars(p.rating_avg)}</div>
            <span>${p.rating_avg} • ${p.rating_count} تقييم</span>
          </div>
          <div class="price-block">
            <span class="bigprice">$${p.effective_price.toFixed(2)}</span>
            ${hasDisc ? `<span class="oldprice">$${p.price_usd.toFixed(2)}</span>` : ''}
            ${hasDisc ? `<div class="disc-note">💥 وفّر $${p.discount_amount.toFixed(2)} (${Math.round(p.discount_percent)}%)</div>` : ''}
          </div>
          <div class="meta">
            <p><strong>📦 أجرة الشحن:</strong> $${(p.shipping_fee_usd || 0).toFixed(2)}</p>
            <p><strong>🚚 مدة التسليم:</strong> 3 - 6 أسابيع حسب المنطقة</p>
            <p><strong>📊 المخزون:</strong> ${out ? '❌ نفذت الكمية' : '✅ ' + p.stock + ' قطعة متوفرة'}</p>
            <p><strong>📁 القسم:</strong> ${p.category_name}</p>
            <p><strong>💳 الدفع:</strong> USDT (BEP20) فقط</p>
          </div>
          <button class="add-cart" ${out ? 'disabled' : ''} onclick="addToCartById(${p.id})">
            🛒 إضافة إلى السلة
          </button>
          <div class="desc-box">
            <h4>📝 وصف المنتج</h4>
            <p>${p.description || 'لا يوجد وصف'}</p>
          </div>
          ${p.notes ? `<div class="notes-box"><strong>📌 ملاحظة:</strong> ${p.notes}</div>` : ''}
        </div>
      </div>

      <div class="reviews-box">
        <h3>⭐ التقييمات (${p.reviews.length})</h3>
        ${p.reviews.length === 0 ? '<p class="muted">لا توجد تقييمات بعد — كن أول من يقيّم!</p>' :
        p.reviews.map(r => `
          <div class="rev">
            <div class="who">👤 ${r.user_name}</div>
            <div class="st">${stars(r.rating)}</div>
            <div class="cmt">${r.comment}</div>
            <div class="dt">${new Date(r.created_at).toLocaleDateString('ar-EG')}</div>
          </div>`).join('')}
        ${state.user ? `
          <div class="rev-form">
            <h4>✍️ أضف تقييمك</h4>
            <div class="fg"><label>التقييم:</label>
              <select id="revRating">
                <option value="5">★★★★★ ممتاز</option>
                <option value="4">★★★★☆ جيد جداً</option>
                <option value="3">★★★☆☆ جيد</option>
                <option value="2">★★☆☆☆ مقبول</option>
                <option value="1">★☆☆☆☆ سيء</option>
              </select>
            </div>
            <div class="fg"><label>تعليقك:</label><textarea id="revComment" placeholder="شاركنا تجربتك مع المنتج..."></textarea></div>
            <button class="btn-yellow" onclick="submitReview(${p.id})">إرسال التقييم</button>
            <p class="muted" style="margin-top:8px;font-size:12px">🔒 سيظهر اسمك مخفياً مثل: أ***د</p>
          </div>` : '<p class="muted"><a onclick="navigate(\'/login\')" style="cursor:pointer">سجّل الدخول</a> لإضافة تقييم.</p>'}
      </div>`;
  } catch (e) {
    document.getElementById('app').innerHTML = `<div class="empty"><div class="ic">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

async function submitReview(pid) {
  const rating = document.getElementById('revRating').value;
  const comment = document.getElementById('revComment').value;
  try {
    await api('/api/reviews', 'POST', { product_id: pid, rating: parseInt(rating), comment });
    toast('✅ تم إرسال التقييم');
    renderProduct(pid);
  } catch (e) { toast(e.message, 'error'); }
}
window.submitReview = submitReview;

// ==================== السلة ====================
async function renderCart() {
  if (state.cart.length === 0) {
    document.getElementById('app').innerHTML = `
      <div class="empty">
        <div class="ic">🛒</div>
        <h3>سلة التسوق فارغة</h3>
        <p class="muted" style="margin:10px 0">ابدأ التسوق واختر منتجاتك المفضلة</p>
        <button class="btn-yellow" onclick="navigate('/')">تصفح المنتجات</button>
      </div>`;
    return;
  }
  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>🛒 سلة التسوق (${cartCount()})</h2></div>
    ${state.cart.map(it => {
      const hasDisc = it.original_price_usd && it.original_price_usd > it.price_usd;
      return `
        <div class="citem">
          <img src="${it.image_url}" onerror="this.src='https://via.placeholder.com/100'">
          <div class="inf">
            <h4>${it.title}</h4>
            <p>📁 ${it.category_name}</p>
            <p class="pr">
              $${it.price_usd.toFixed(2)}
              ${hasDisc ? `<span class="old">$${it.original_price_usd.toFixed(2)}</span>` : ''}
              <span style="color:#666;font-weight:normal;font-size:13px"> + شحن $${(it.shipping_fee_usd || 0).toFixed(2)}</span>
            </p>
            <select onchange="updateQty(${it.id}, this.value)">
              ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option ${n === it.quantity ? 'selected' : ''} value="${n}">${n}</option>`).join('')}
            </select>
          </div>
          <button class="btn-red btn-sm" onclick="removeItem(${it.id})">🗑️ حذف</button>
        </div>`;
    }).join('')}
    <div class="summary">
      <h3>ملخص الطلب</h3>
      <div class="total-line"><span>المنتجات</span><span>$${cartSubtotal().toFixed(2)}</span></div>
      <div class="total-line"><span>الشحن</span><span>$${cartShipping().toFixed(2)}</span></div>
      <div class="total-line big"><span>الإجمالي</span><span>$${cartTotal().toFixed(2)}</span></div>
      <button class="btn-yellow" style="width:100%;padding:14px;font-size:16px;margin-top:15px;font-weight:bold" onclick="navigate('/checkout')">
        💳 متابعة الشراء
      </button>
    </div>`;
}

// ==================== الشراء ====================
async function renderCheckout() {
  if (!state.user) { toast('سجّل الدخول أولاً', 'error'); navigate('/login'); return; }
  if (state.cart.length === 0) { navigate('/cart'); return; }
  if (!state.settings.usdt_wallet_address) { try { state.settings = await api('/api/settings'); } catch (e) {} }
  const companies = await api('/api/shipping-companies');

  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>💳 إتمام الشراء</h2></div>
    <div class="summary">
      <h3>📋 ملخص الطلب</h3>
      ${state.cart.map(it => `
        <div class="total-line">
          <span>${it.title} × ${it.quantity}</span>
          <span>$${((it.price_usd + (it.shipping_fee_usd || 0)) * it.quantity).toFixed(2)}</span>
        </div>
      `).join('')}
      <div class="total-line"><span>المنتجات</span><span>$${cartSubtotal().toFixed(2)}</span></div>
      <div class="total-line"><span>الشحن</span><span>$${cartShipping().toFixed(2)}</span></div>
      <div class="total-line big"><span>الإجمالي</span><span>$${cartTotal().toFixed(2)}</span></div>
    </div>

    <div class="summary" style="margin-top:15px">
      <h3>🚚 بيانات التوصيل</h3>
      <div class="fg">
        <label>الاسم الثلاثي للمستلم:</label>
        <input id="rcvName" placeholder="مثال: أحمد محمد علي">
        <div class="helper">يجب كتابة الاسم الثلاثي كاملاً (3 كلمات على الأقل)</div>
      </div>
      <div class="fg">
        <label>رقم هاتف المستلم:</label>
        <input id="rcvPhone" placeholder="09xxxxxxxx" maxlength="10">
        <div class="helper">يجب أن يبدأ بـ 09 ويتكون من 10 أرقام</div>
      </div>
      <div class="fg">
        <label>المنطقة / العنوان:</label>
        <input id="rcvRegion" placeholder="مثال: دمشق - المزة - شارع الجلاء">
      </div>
      <div class="fg">
        <label>شركة الشحن:</label>
        <select id="rcvCompany">
          <option value="">-- اختر شركة الشحن --</option>
          ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
    </div>

    <div class="summary" style="margin-top:15px">
      <h3>💰 الدفع بالكريبتو</h3>
      <div class="warn">
        <strong>⚠️ الدفع مسبق إلزامي:</strong> حوّل المبلغ المطلوب (<strong>$${cartTotal().toFixed(2)} USDT</strong>) بالضبط إلى عنوان المحفظة أدناه عبر شبكة <strong>${state.settings.network || 'BEP20'}</strong>، ثم الصق رقم عملية التحويل (TXID) في الحقل.
      </div>
      <p style="margin:10px 0"><strong>المبلغ المطلوب:</strong> <span style="color:#B12704;font-size:22px;font-weight:bold">$${cartTotal().toFixed(2)} USDT</span></p>
      <p><strong>عنوان المحفظة (${state.settings.network || 'BEP20'}):</strong></p>
      <div class="wallet">
        <code id="walletAddr">${state.settings.usdt_wallet_address || ''}</code>
        <button onclick="copyWallet()">📋 نسخ</button>
      </div>
      <div class="fg" style="margin-top:15px">
        <label>رقم عملية التحويل (TXID):</label>
        <input id="txRef" placeholder="0x..." style="font-family:monospace;direction:ltr;text-align:left">
        <div class="helper">الصق رقم المعاملة من محفظتك بعد التحويل</div>
      </div>
      <button class="btn-green" style="width:100%;padding:14px;font-size:16px;font-weight:bold;margin-top:10px" onclick="placeOrder()">
        ✅ تأكيد الطلب
      </button>
    </div>`;
}

function copyWallet() {
  const addr = state.settings.usdt_wallet_address || '';
  navigator.clipboard.writeText(addr).then(() => toast('✓ تم نسخ العنوان'));
}
window.copyWallet = copyWallet;

async function placeOrder() {
  const receiver_full_name = document.getElementById('rcvName').value.trim();
  const receiver_phone = document.getElementById('rcvPhone').value.trim();
  const region = document.getElementById('rcvRegion').value.trim();
  const shipping_company_id = document.getElementById('rcvCompany').value;
  const tx_ref = document.getElementById('txRef').value.trim();

  if (!receiver_full_name || receiver_full_name.split(/\s+/).length < 3) { toast('الاسم الثلاثي مطلوب', 'error'); return; }
  if (!/^09\d{8}$/.test(receiver_phone)) { toast('رقم الهاتف يجب أن يبدأ بـ 09 ويتكون من 10 أرقام', 'error'); return; }
  if (!region) { toast('المنطقة مطلوبة', 'error'); return; }
  if (!shipping_company_id) { toast('اختر شركة الشحن', 'error'); return; }
  if (!tx_ref || tx_ref.length < 6) { toast('رقم عملية التحويل مطلوب', 'error'); return; }

  try {
    await api('/api/orders', 'POST', {
      items: state.cart.map(i => ({ id: i.id, quantity: i.quantity })),
      receiver_full_name, receiver_phone, region,
      shipping_company_id: parseInt(shipping_company_id),
      tx_ref, wallet_address: state.settings.usdt_wallet_address
    });
    state.cart = []; saveCart();
    toast('✅ تم إرسال طلبك بنجاح');
    setTimeout(() => navigate('/orders?placed=1'), 800);
  } catch (e) { toast(e.message, 'error'); }
}
window.placeOrder = placeOrder;

// ==================== الطلبات ====================
async function renderOrders() {
  if (!state.user) { navigate('/login'); return; }
  const orders = await api('/api/orders/mine');
  const placed = location.hash.includes('placed=1');
  const labels = {
    awaiting_confirmation: '⏳ بانتظار تأكيد الدفع',
    accepted: '✔ تم قبول الطلب',
    rejected: '✖ تم رفض الطلب',
    shipped: '🚚 تم الشحن',
    delivered: '✔ تم التسليم'
  };
  document.getElementById('app').innerHTML = `
    ${placed ? '<div class="warn success-warn"><strong>✅ تم إرسال طلبك بنجاح!</strong> سنراجعه بعد التحقق من التحويل ثم نبدأ بالشحن.</div>' : ''}
    <div class="sec-title"><h2>📦 طلباتي (${orders.length})</h2></div>
    ${orders.length === 0 ? '<div class="empty"><div class="ic">📦</div><h3>لا توجد طلبات بعد</h3></div>' :
    orders.map(o => `
      <div class="ocard">
        <h3>طلب #${o.id} — ${new Date(o.created_at).toLocaleString('ar-EG')}</h3>
        <div class="info-grid">
          <p><strong>المستلم:</strong> ${o.receiver_full_name}</p>
          <p><strong>الهاتف:</strong> ${o.receiver_phone}</p>
          <p><strong>المنطقة:</strong> ${o.region}</p>
          <p><strong>شركة الشحن:</strong> ${o.shipping_company_name || '-'}</p>
          <p><strong>الإجمالي:</strong> $${o.total_usd.toFixed(2)}</p>
          <p><strong>TXID:</strong> <code style="direction:ltr;display:inline-block;font-size:11px">${(o.tx_ref || '').slice(0, 20)}...</code></p>
        </div>
        <p><strong>الحالة:</strong> <span class="st-${o.status}">${labels[o.status] || o.status}</span></p>
        <details><summary>المنتجات (${o.items.length})</summary>
          <ul>
            ${o.items.map(i => `<li>${i.title} × ${i.quantity} — $${i.line_total.toFixed(2)}</li>`).join('')}
          </ul>
        </details>
      </div>`).join('')}`;
}

// ==================== الدعم ====================
async function renderSupport() {
  if (!state.user) { navigate('/login'); return; }
  const msgs = await api('/api/support/mine');
  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>💬 الدعم الفني</h2></div>
    <div class="chat">
      <div class="chat-hdr">💬 فريق دعم أمازون سوريا — نرد خلال ساعات</div>
      <div class="chat-body" id="chatBody">
        ${msgs.length === 0 ? '<p class="muted" style="text-align:center;padding:30px">👋 مرحباً! كيف يمكننا مساعدتك؟</p>' : ''}
        ${msgs.map(m => `
          <div class="bub me">${m.message}<span class="tm">${new Date(m.created_at).toLocaleString('ar-EG')}</span></div>
          ${m.reply ? `<div class="bub adm">${m.reply}<span class="tm">${new Date(m.replied_at).toLocaleString('ar-EG')}</span></div>` : ''}
        `).join('')}
      </div>
      <div class="chat-input">
        <input id="supportMsg" placeholder="اكتب رسالتك..." onkeyup="if(event.key==='Enter') sendSupport()">
        <button onclick="sendSupport()">➤</button>
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
      <div class="logo-top">${amazonLogoDarkSVG()}</div>
      <h2>تسجيل الدخول</h2>
      <div class="fg"><label>البريد الإلكتروني أو رقم الهاتف:</label>
        <input id="logId" autocomplete="username" placeholder="example@gmail.com">
      </div>
      <div class="fg"><label>كلمة المرور:</label>
        <input type="password" id="logPw" onkeyup="if(event.key==='Enter') doLogin()" placeholder="••••••••">
      </div>
      <button class="main-btn" onclick="doLogin()">دخول</button>
      <div class="form-foot">ليس لديك حساب؟ <a onclick="navigate('/register')" style="cursor:pointer">إنشاء حساب جديد</a></div>
    </div>`;
}

async function doLogin() {
  const identifier = document.getElementById('logId').value.trim();
  const password = document.getElementById('logPw').value;
  if (!identifier || !password) { toast('املأ الحقول', 'error'); return; }
  try {
    const d = await api('/api/auth/login', 'POST', { identifier, password });
    state.token = d.token; state.user = d.user;
    localStorage.setItem('az_token', d.token);
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
      <div class="logo-top">${amazonLogoDarkSVG()}</div>
      <h2>إنشاء حساب جديد</h2>
      <div class="fg">
        <label>الاسم الثلاثي:</label>
        <input id="regName" placeholder="أحمد محمد علي">
      </div>
      <div class="fg">
        <label>البريد الإلكتروني (Gmail فقط):</label>
        <input type="email" id="regEmail" placeholder="example@gmail.com">
        <div class="helper">يجب أن ينتهي بـ @gmail.com</div>
        <div class="err-msg" id="errEmail"></div>
      </div>
      <div class="fg">
        <label>رقم الهاتف:</label>
        <input id="regPhone" placeholder="09xxxxxxxx" maxlength="10">
        <div class="helper">10 أرقام تبدأ بـ 09</div>
        <div class="err-msg" id="errPhone"></div>
      </div>
      <div class="fg">
        <label>كلمة المرور:</label>
        <input type="password" id="regPw" placeholder="8 أحرف على الأقل">
        <div class="helper">يجب أن تحتوي على أحرف وأرقام ورموز (مثال: MyPass@123)</div>
        <div class="err-msg" id="errPw"></div>
      </div>
      <button class="main-btn" onclick="doRegister()">إنشاء الحساب</button>
      <div class="form-foot">لديك حساب؟ <a onclick="navigate('/login')" style="cursor:pointer">تسجيل الدخول</a></div>
    </div>`;

  ['regEmail', 'regPhone', 'regPw'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', validateLive);
  });
}

function validateLive() {
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const pw = document.getElementById('regPw').value;

  const eE = document.getElementById('errEmail');
  const eP = document.getElementById('errPhone');
  const eW = document.getElementById('errPw');

  if (email) eE.textContent = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email) ? '' : 'البريد يجب أن ينتهي بـ @gmail.com';
  else eE.textContent = '';

  if (phone) eP.textContent = /^09\d{8}$/.test(phone) ? '' : 'الهاتف يجب أن يبدأ بـ 09 ويتكون من 10 أرقام';
  else eP.textContent = '';

  if (pw) {
    if (pw.length < 8) eW.textContent = 'كلمة المرور 8 أحرف على الأقل';
    else if (!/[A-Za-z]/.test(pw)) eW.textContent = 'يجب أن تحتوي على أحرف';
    else if (!/\d/.test(pw)) eW.textContent = 'يجب أن تحتوي على أرقام';
    else if (!/[!@#$%^&*()_\-+=\[\]{};:'",.<>\/?\\|`~]/.test(pw)) eW.textContent = 'يجب أن تحتوي على رموز (!@#$...)';
    else eW.textContent = '';
  } else eW.textContent = '';
}

async function doRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPw').value;

  if (!name || name.split(/\s+/).length < 2) { toast('الاسم الثلاثي مطلوب', 'error'); return; }
  if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email)) { toast('البريد يجب أن ينتهي بـ @gmail.com', 'error'); return; }
  if (!/^09\d{8}$/.test(phone)) { toast('رقم الهاتف يجب أن يبدأ بـ 09 ويتكون من 10 أرقام', 'error'); return; }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password) || !/[!@#$%^&*()_\-+=\[\]{};:'",.<>\/?\\|`~]/.test(password)) {
    toast('كلمة المرور يجب أن تحتوي أحرف وأرقام ورموز (8+)', 'error');
    return;
  }

  try {
    const d = await api('/api/auth/register', 'POST', { name, email, phone, password });
    state.token = d.token; state.user = d.user;
    localStorage.setItem('az_token', d.token);
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
      <h2 style="margin-bottom:15px;color:#131921">⚙️ لوحة الإدارة — أمازون سوريا</h2>
      <div class="atabs">
        <button data-t="ov" onclick="adminTab('ov')">📊 نظرة عامة</button>
        <button data-t="or" onclick="adminTab('or')">🛒 الطلبات</button>
        <button data-t="pr" onclick="adminTab('pr')">📦 المنتجات</button>
        <button data-t="ca" onclick="adminTab('ca')">📁 الأقسام</button>
        <button data-t="sh" onclick="adminTab('sh')">🚚 شركات الشحن</button>
        <button data-t="ac" onclick="adminTab('ac')">👥 الحسابات</button>
        <button data-t="rv" onclick="adminTab('rv')">⭐ التقييمات</button>
        <button data-t="su" onclick="adminTab('su')">💬 الدعم</button>
        <button data-t="se" onclick="adminTab('se')">⚙️ الإعدادات</button>
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
    if (t === 'pr') return adminProducts(c);
    if (t === 'ca') return adminCategories(c);
    if (t === 'sh') return adminShipping(c);
    if (t === 'ac') return adminAccounts(c);
    if (t === 'rv') return adminReviews(c);
    if (t === 'su') return adminSupport(c);
    if (t === 'se') return adminSettings(c);
  } catch (e) { c.innerHTML = `<div class="empty"><h3>${e.message}</h3></div>`; }
}
window.adminTab = adminTab;

async function adminOverview(c) {
  const s = await api('/api/admin/stats');
  const orders = await api('/api/admin/orders');
  c.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><div class="n">${s.total_orders}</div><div class="l">إجمالي الطلبات</div></div>
      <div class="stat"><div class="n">${s.pending_orders}</div><div class="l">بانتظار التأكيد</div></div>
      <div class="stat"><div class="n">${s.active_products}</div><div class="l">منتجات نشطة</div></div>
      <div class="stat"><div class="n">${s.open_support}</div><div class="l">رسائل مفتوحة</div></div>
      <div class="stat"><div class="n">${s.total_accounts}</div><div class="l">إجمالي الحسابات</div></div>
      <div class="stat"><div class="n">$${s.total_revenue.toFixed(2)}</div><div class="l">الإيرادات</div></div>
    </div>
    <h4 style="margin-bottom:10px;color:#131921">📋 آخر 5 طلبات</h4>
    <div class="tbl-wrap"><table>
      <tr><th>#</th><th>المستلم</th><th>الهاتف</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr>
      ${orders.slice(0, 5).map(o => `<tr>
        <td>${o.id}</td><td>${o.receiver_full_name}</td><td>${o.receiver_phone}</td>
        <td>$${o.total_usd.toFixed(2)}</td><td class="st-${o.status}">${o.status}</td>
        <td>${new Date(o.created_at).toLocaleDateString('ar-EG')}</td></tr>`).join('')}
    </table></div>`;
}

async function adminOrders(c) {
  const orders = await api('/api/admin/orders');
  const labels = { awaiting_confirmation: 'بانتظار', accepted: 'مقبول', rejected: 'مرفوض', shipped: 'مشحون', delivered: 'مسلَّم' };
  c.innerHTML = `
    <div class="toolbar"><h4>🛒 الطلبات (${orders.length})</h4></div>
    <div class="tbl-wrap"><table>
      <tr><th>#</th><th>المستلم</th><th>الهاتف</th><th>المنطقة</th><th>الشركة</th><th>المبلغ</th><th>TXID</th><th>الحالة</th><th>تفاصيل</th></tr>
      ${orders.map(o => `
        <tr>
          <td>${o.id}</td>
          <td>${o.receiver_full_name}</td>
          <td>${o.receiver_phone}</td>
          <td>${o.region}</td>
          <td>${o.shipping_company_name || '-'}</td>
          <td>$${o.total_usd.toFixed(2)}</td>
          <td style="direction:ltr;font-size:11px">${(o.tx_ref || '').slice(0, 12)}…</td>
          <td><select onchange="updOrder(${o.id}, this.value)" style="padding:4px;width:auto;font-size:12px">
            ${Object.keys(labels).map(k => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${labels[k]}</option>`).join('')}
          </select></td>
          <td><button class="btn-gray btn-sm" onclick='viewOrder(${JSON.stringify(o).replace(/'/g, "&#39;")})'>👁️</button></td>
        </tr>`).join('')}
    </table></div>`;
}

function viewOrder(o) {
  const items = o.items.map(i => `• ${i.title} × ${i.quantity} = $${i.line_total.toFixed(2)}`).join('\n');
  alert(`طلب #${o.id}\n\nالمستلم: ${o.receiver_full_name}\nالهاتف: ${o.receiver_phone}\nالمنطقة: ${o.region}\nشركة الشحن: ${o.shipping_company_name}\nTXID: ${o.tx_ref}\n\nالمنتجات:\n${items}\n\nالإجمالي: $${o.total_usd.toFixed(2)}`);
}
window.viewOrder = viewOrder;

async function updOrder(id, status) {
  try { await api('/api/admin/orders/' + id, 'PUT', { status }); toast('✅ تم التحديث'); }
  catch (e) { toast(e.message, 'error'); }
}
window.updOrder = updOrder;

async function adminProducts(c) {
  const products = await api('/api/admin/products');
  const cats = await api('/api/admin/categories');
  c.innerHTML = `
    <div class="toolbar"><h4>📦 المنتجات (${products.length})</h4><button class="btn-yellow" onclick="toggleForm('prodForm')">➕ إضافة منتج</button></div>
    <div class="afm" id="prodForm" style="display:none">
      <h4 id="prodFormTitle">منتج جديد</h4>
      <input type="hidden" id="pf_id">
      <div class="frow">
        <div class="fg"><label>العنوان:</label><input id="pf_title"></div>
        <div class="fg"><label>القسم:</label><select id="pf_cat">${cats.map(x => `<option value="${x.id}">${x.icon} ${x.name_ar}</option>`).join('')}</select></div>
      </div>
      <div class="fg"><label>الوصف:</label><textarea id="pf_desc"></textarea></div>
      <div class="fg"><label>ملاحظات (اختياري):</label><input id="pf_notes"></div>
      <div class="frow">
        <div class="fg"><label>السعر ($):</label><input type="number" step="0.01" id="pf_price"></div>
        <div class="fg"><label>أجرة الشحن ($):</label><input type="number" step="0.01" id="pf_ship" value="0"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>المخزون:</label><input type="number" id="pf_stock" value="0"></div>
        <div class="fg"><label>رابط الصورة:</label><input id="pf_img"></div>
      </div>
      <div class="frow" style="background:#FFF8E1;padding:12px;border-radius:6px;border-right:3px solid #FFA000">
        <div class="fg"><label>🔥 نسبة الخصم (%):</label><input type="number" min="0" max="90" id="pf_disc" value="0"></div>
        <div class="fg"><label><input type="checkbox" id="pf_disc_active" style="width:auto"> تفعيل الخصم</label></div>
      </div>
      <div class="fg"><label><input type="checkbox" id="pf_active" checked style="width:auto"> منتج نشط (يظهر للعملاء)</label></div>
      <button class="btn-green" onclick="saveProduct()">💾 حفظ</button>
      <button class="btn-gray" onclick="toggleForm('prodForm')">إلغاء</button>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>الصورة</th><th>العنوان</th><th>القسم</th><th>السعر</th><th>الخصم</th><th>المخزون</th><th>نشط</th><th>إجراءات</th></tr>
      ${products.map(p => `
        <tr>
          <td>${p.id}</td>
          <td><img src="${p.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px" onerror="this.style.display='none'"></td>
          <td>${p.title}</td>
          <td>${p.category_name}</td>
          <td>$${p.price_usd}</td>
          <td>${p.discount_active ? `<span style="color:#CC0C39;font-weight:bold">${p.discount_percent}%</span>` : '—'}</td>
          <td><input type="number" value="${p.stock}" style="width:70px;padding:4px" onchange="updStock(${p.id}, this.value)"></td>
          <td>${p.active ? '✅' : '❌'}</td>
          <td>
            <button class="btn-gray btn-sm" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'>✏️</button>
            <button class="btn-red btn-sm" onclick="delProduct(${p.id})">🗑️</button>
          </td>
        </tr>`).join('')}
    </table></div>`;
}

function toggleForm(id) {
  const f = document.getElementById(id);
  f.style.display = f.style.display === 'none' ? 'block' : 'none';
  if (id === 'prodForm' && f.style.display === 'block') {
    ['pf_id', 'pf_title', 'pf_desc', 'pf_notes', 'pf_price', 'pf_ship', 'pf_stock', 'pf_img', 'pf_disc'].forEach(i => {
      const el = document.getElementById(i); if (el) el.value = (i === 'pf_stock' || i === 'pf_ship' || i === 'pf_disc') ? '0' : '';
    });
    document.getElementById('pf_active').checked = true;
    document.getElementById('pf_disc_active').checked = false;
    document.getElementById('prodFormTitle').textContent = 'منتج جديد';
  }
}
window.toggleForm = toggleForm;

function editProduct(p) {
  document.getElementById('prodForm').style.display = 'block';
  document.getElementById('prodFormTitle').textContent = 'تعديل منتج #' + p.id;
  document.getElementById('pf_id').value = p.id;
  document.getElementById('pf_title').value = p.title;
  document.getElementById('pf_cat').value = p.category_id;
  document.getElementById('pf_desc').value = p.description || '';
  document.getElementById('pf_notes').value = p.notes || '';
  document.getElementById('pf_price').value = p.price_usd;
  document.getElementById('pf_ship').value = p.shipping_fee_usd || 0;
  document.getElementById('pf_stock').value = p.stock;
  document.getElementById('pf_img').value = p.image_url || '';
  document.getElementById('pf_disc').value = p.discount_percent || 0;
  document.getElementById('pf_disc_active').checked = p.discount_active === 1;
  document.getElementById('pf_active').checked = p.active === 1;
  document.getElementById('prodForm').scrollIntoView({ behavior: 'smooth' });
}
window.editProduct = editProduct;

async function saveProduct() {
  const id = document.getElementById('pf_id').value;
  const body = {
    category_id: parseInt(document.getElementById('pf_cat').value),
    title: document.getElementById('pf_title').value.trim(),
    description: document.getElementById('pf_desc').value.trim(),
    notes: document.getElementById('pf_notes').value.trim(),
    price_usd: parseFloat(document.getElementById('pf_price').value),
    shipping_fee_usd: parseFloat(document.getElementById('pf_ship').value) || 0,
    stock: parseInt(document.getElementById('pf_stock').value) || 0,
    image_url: document.getElementById('pf_img').value.trim(),
    discount_percent: parseFloat(document.getElementById('pf_disc').value) || 0,
    discount_active: document.getElementById('pf_disc_active').checked,
    active: document.getElementById('pf_active').checked
  };
  if (!body.title || isNaN(body.price_usd)) { toast('العنوان والسعر مطلوبان', 'error'); return; }
  try {
    if (id) await api('/api/admin/products/' + id, 'PUT', body);
    else await api('/api/admin/products', 'POST', body);
    toast('✅ تم الحفظ');
    adminTab('pr');
  } catch (e) { toast(e.message, 'error'); }
}
window.saveProduct = saveProduct;

async function updStock(id, v) {
  try {
    const p = (await api('/api/admin/products')).find(x => x.id === id);
    await api('/api/admin/products/' + id, 'PUT', { ...p, stock: parseInt(v) });
    toast('✅ تم تحديث المخزون');
  } catch (e) { toast(e.message, 'error'); }
}
window.updStock = updStock;

async function delProduct(id) {
  if (!confirm('حذف المنتج؟')) return;
  try { await api('/api/admin/products/' + id, 'DELETE'); toast('تم الحذف', 'info'); adminTab('pr'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delProduct = delProduct;

async function adminCategories(c) {
  const list = await api('/api/admin/categories');
  c.innerHTML = `
    <div class="toolbar"><h4>📁 الأقسام (${list.length})</h4></div>
    <div class="afm">
      <h4>➕ إضافة قسم جديد</h4>
      <div class="frow">
        <div class="fg"><label>اسم القسم:</label><input id="nc_name" placeholder="مثال: رياضة"></div>
        <div class="fg"><label>الأيقونة (emoji):</label><input id="nc_icon" placeholder="⚽" maxlength="4"></div>
      </div>
      <div class="fg"><label>الترتيب:</label><input type="number" id="nc_order" value="0"></div>
      <button class="btn-green" onclick="addCategory()">إضافة</button>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>الأيقونة</th><th>الاسم</th><th>الترتيب</th><th>نشط</th><th>إجراءات</th></tr>
      ${list.map(x => `
        <tr>
          <td>${x.id}</td><td style="font-size:22px">${x.icon}</td><td>${x.name_ar}</td><td>${x.sort_order}</td>
          <td>${x.active ? '✅' : '❌'}</td>
          <td>
            <button class="btn-gray btn-sm" onclick="toggleCat(${x.id}, ${x.active ? 0 : 1})">${x.active ? 'تعطيل' : 'تفعيل'}</button>
            <button class="btn-red btn-sm" onclick="delCat(${x.id})">🗑️</button>
          </td>
        </tr>`).join('')}
    </table></div>`;
}

async function addCategory() {
  const body = {
    name_ar: document.getElementById('nc_name').value.trim(),
    icon: document.getElementById('nc_icon').value.trim() || '📦',
    sort_order: parseInt(document.getElementById('nc_order').value) || 0
  };
  if (!body.name_ar) { toast('اسم القسم مطلوب', 'error'); return; }
  try { await api('/api/admin/categories', 'POST', body); toast('✅ تمت الإضافة'); adminTab('ca'); }
  catch (e) { toast(e.message, 'error'); }
}
window.addCategory = addCategory;

async function toggleCat(id, active) {
  try {
    const list = await api('/api/admin/categories');
    const cat = list.find(x => x.id === id);
    await api('/api/admin/categories/' + id, 'PUT', { ...cat, active: active === 1 });
    adminTab('ca');
  } catch (e) { toast(e.message, 'error'); }
}
window.toggleCat = toggleCat;

async function delCat(id) {
  if (!confirm('حذف القسم وكل منتجاته؟')) return;
  try { await api('/api/admin/categories/' + id, 'DELETE'); toast('تم الحذف', 'info'); adminTab('ca'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delCat = delCat;

async function adminShipping(c) {
  const list = await api('/api/admin/shipping-companies');
  c.innerHTML = `
    <div class="toolbar"><h4>🚚 شركات الشحن (${list.length})</h4></div>
    <div class="afm">
      <h4>➕ إضافة شركة شحن</h4>
      <div class="frow">
        <div class="fg"><label>اسم الشركة:</label><input id="ns_name" placeholder="مثال: أرامكس"></div>
        <div class="fg"><label>الترتيب:</label><input type="number" id="ns_order" value="0"></div>
      </div>
      <button class="btn-green" onclick="addShip()">إضافة</button>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>الاسم</th><th>الترتيب</th><th>نشط</th><th>إجراءات</th></tr>
      ${list.map(x => `
        <tr>
          <td>${x.id}</td><td>${x.name}</td><td>${x.sort_order}</td>
          <td>${x.active ? '✅' : '❌'}</td>
          <td>
            <button class="btn-gray btn-sm" onclick="toggleShip(${x.id}, ${x.active ? 0 : 1})">${x.active ? 'تعطيل' : 'تفعيل'}</button>
            <button class="btn-red btn-sm" onclick="delShip(${x.id})">🗑️</button>
          </td>
        </tr>`).join('')}
    </table></div>`;
}

async function addShip() {
  const body = {
    name: document.getElementById('ns_name').value.trim(),
    sort_order: parseInt(document.getElementById('ns_order').value) || 0
  };
  if (!body.name) { toast('اسم الشركة مطلوب', 'error'); return; }
  try { await api('/api/admin/shipping-companies', 'POST', body); toast('✅ تمت الإضافة'); adminTab('sh'); }
  catch (e) { toast(e.message, 'error'); }
}
window.addShip = addShip;

async function toggleShip(id, active) {
  try {
    const list = await api('/api/admin/shipping-companies');
    const s = list.find(x => x.id === id);
    await api('/api/admin/shipping-companies/' + id, 'PUT', { ...s, active: active === 1 });
    adminTab('sh');
  } catch (e) { toast(e.message, 'error'); }
}
window.toggleShip = toggleShip;

async function delShip(id) {
  if (!confirm('حذف الشركة؟')) return;
  try { await api('/api/admin/shipping-companies/' + id, 'DELETE'); toast('تم الحذف', 'info'); adminTab('sh'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delShip = delShip;

async function adminAccounts(c) {
  const list = await api('/api/admin/accounts');
  c.innerHTML = `
    <div class="toolbar"><h4>👥 الحسابات (${list.length})</h4></div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>مدير</th><th>محظور</th><th>إجراءات</th></tr>
      ${list.map(a => `
        <tr>
          <td>${a.id}</td><td>${a.name || '-'}</td><td>${a.email || '-'}</td><td>${a.phone || '-'}</td>
          <td>${a.is_admin ? '✅' : '—'}</td>
          <td>${a.banned ? '<span style="color:#c62828">🚫</span>' : '—'}</td>
          <td>
            ${a.id != state.user.id ? `
              <button class="btn-${a.banned ? 'green' : 'red'} btn-sm" onclick="toggleBan(${a.id}, ${a.banned ? 0 : 1})">${a.banned ? 'رفع الحظر' : 'حظر'}</button>
              <button class="btn-gray btn-sm" onclick="delAccount(${a.id})">🗑️</button>` : '<span class="mini">أنت</span>'}
          </td>
        </tr>`).join('')}
    </table></div>`;
}

async function toggleBan(id, banned) {
  try { await api('/api/admin/accounts/' + id, 'PUT', { banned: banned === 1 }); toast('✅ تم'); adminTab('ac'); }
  catch (e) { toast(e.message, 'error'); }
}
window.toggleBan = toggleBan;

async function delAccount(id) {
  if (!confirm('حذف الحساب نهائياً؟')) return;
  try { await api('/api/admin/accounts/' + id, 'DELETE'); toast('تم الحذف', 'info'); adminTab('ac'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delAccount = delAccount;

async function adminReviews(c) {
  const list = await api('/api/admin/reviews');
  c.innerHTML = `
    <div class="toolbar"><h4>⭐ التقييمات (${list.length})</h4></div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>المنتج</th><th>المستخدم</th><th>التقييم</th><th>التعليق</th><th>إجراء</th></tr>
      ${list.map(r => `
        <tr>
          <td>${r.id}</td><td>${r.product_title}</td><td>${r.user_name}</td>
          <td style="color:#FFA41C">${'★'.repeat(r.rating)}</td>
          <td>${r.comment || '-'}</td>
          <td><button class="btn-red btn-sm" onclick="delReview(${r.id})">🗑️</button></td>
        </tr>`).join('')}
    </table></div>`;
}

async function delReview(id) {
  if (!confirm('حذف التقييم؟')) return;
  try { await api('/api/admin/reviews/' + id, 'DELETE'); toast('تم الحذف', 'info'); adminTab('rv'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delReview = delReview;

async function adminSupport(c) {
  const list = await api('/api/admin/support');
  c.innerHTML = `
    <div class="toolbar"><h4>💬 رسائل الدعم (${list.length})</h4></div>
    ${list.length === 0 ? '<p class="muted">لا توجد رسائل.</p>' : list.map(m => `
      <div class="afm" style="${m.status === 'open' ? 'background:#FFF8E1;border-color:#FFD54F' : ''}">
        <p><strong>👤 ${m.user_name}</strong> <span class="muted">(${m.user_email || m.user_phone})</span></p>
        <p class="muted mini">${new Date(m.created_at).toLocaleString('ar-EG')}</p>
        <p style="margin:8px 0;padding:10px;background:#fff;border-radius:6px">${m.message}</p>
        ${m.reply
          ? `<div style="background:#E8F5E9;padding:10px;border-radius:6px;border-right:3px solid #27AE60"><strong>✅ ردك:</strong> ${m.reply}</div>`
          : `<div class="fg"><textarea id="rp_${m.id}" placeholder="اكتب الرد..."></textarea></div>
             <button class="btn-green btn-sm" onclick="sendReply(${m.id})">📤 إرسال الرد</button>`}
      </div>`).join('')}`;
}

async function sendReply(id) {
  const r = document.getElementById('rp_' + id).value.trim();
  if (!r) { toast('اكتب الرد', 'error'); return; }
  try { await api('/api/admin/support/' + id + '/reply', 'POST', { reply: r }); toast('✅ تم الإرسال'); adminTab('su'); }
  catch (e) { toast(e.message, 'error'); }
}
window.sendReply = sendReply;

async function adminSettings(c) {
  const s = await api('/api/admin/settings');
  c.innerHTML = `
    <h4 style="margin-bottom:15px;color:#131921">⚙️ إعدادات المتجر</h4>
    <div class="afm">
      <div class="fg">
        <label>💳 عنوان محفظة USDT:</label>
        <input id="st_wallet" value="${s.usdt_wallet_address || ''}" style="font-family:monospace;direction:ltr;text-align:left">
        <div class="helper">هذا العنوان سيظهر للعملاء عند الشراء</div>
      </div>
      <div class="fg">
        <label>🌐 الشبكة:</label>
        <select id="st_net">
          ${['BEP20', 'TRC20', 'ERC20'].map(n => `<option ${s.network === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="fg">
        <label>📢 إعلان المتجر:</label>
        <input id="st_ann" value="${s.announcement || ''}">
      </div>
      <div class="fg">
        <label>🏪 اسم المتجر:</label>
        <input id="st_name" value="${s.site_name || 'أمازون سوريا'}">
      </div>
      <button class="btn-green" onclick="saveSettings()">💾 حفظ الإعدادات</button>
    </div>`;
}

async function saveSettings() {
  try {
    await api('/api/admin/settings', 'PUT', {
      usdt_wallet_address: document.getElementById('st_wallet').value.trim(),
      network: document.getElementById('st_net').value,
      announcement: document.getElementById('st_ann').value.trim(),
      site_name: document.getElementById('st_name').value.trim()
    });
    state.settings = await api('/api/settings');
    toast('✅ تم الحفظ');
  } catch (e) { toast(e.message, 'error'); }
}
window.saveSettings = saveSettings;

// ==================== الراوتر ====================
async function renderPage() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loader">⏳ جاري التحميل…</div>';
  const hash = location.hash.slice(1) || '/';
  const path = hash.split('?')[0];
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    if (path === '/') await renderHome();
    else if (path === '/categories') await renderCategoriesPage();
    else if (path.startsWith('/product/')) await renderProduct(path.split('/')[2]);
    else if (path === '/cart') await renderCart();
    else if (path === '/checkout') await renderCheckout();
    else if (path === '/orders') await renderOrders();
    else if (path === '/support') await renderSupport();
    else if (path === '/login') renderLogin();
    else if (path === '/register') renderRegister();
    else if (path === '/admin') await renderAdmin();
    else app.innerHTML = '<div class="empty"><div class="ic">🤷</div><h3>الصفحة غير موجودة</h3><button class="btn-yellow" onclick="navigate(\'/\')">العودة للرئيسية</button></div>';
  } catch (e) {
    app.innerHTML = `<div class="empty"><div class="ic">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

window.addEventListener('hashchange', renderPage);
window.addEventListener('DOMContentLoaded', async () => {
  renderFooter();
  await loadMe();
  try { state.settings = await api('/api/settings'); } catch (e) {}
  try { state.categories = await api('/api/categories'); } catch (e) {}
  renderHeader();
  renderPage();
});
