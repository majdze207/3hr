const state = { token: localStorage.getItem('sy_token') || null, user: null, cart: JSON.parse(localStorage.getItem('sy_cart') || '[]'), countries: [], settings: {} };

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

function saveCart() { localStorage.setItem('sy_cart', JSON.stringify(state.cart)); updateCartBadge(); }
function cartTotal() { return state.cart.reduce((s, i) => s + (i.price_usd + (i.shipping_fee_usd || 0)) * i.quantity, 0); }
function cartCount() { return state.cart.reduce((s, i) => s + i.quantity, 0); }

function updateCartBadge() {
  const b = document.getElementById('cartBadge');
  if (b) b.textContent = cartCount();
}

function navigate(path) { location.hash = '#' + path; }
window.navigate = navigate;

function flagSVG(size = '') {
  return `<div class="flag ${size}">
    <div class="g"></div>
    <div class="w"><span class="s">★</span><span class="s">★</span><span class="s">★</span></div>
    <div class="b"></div>
  </div>`;
}

function renderHeader() {
  const user = state.user;
  const right = user
    ? `<div class="pill" onclick="navigate('/orders')">📦 طلباتي</div>
       <div class="pill" onclick="navigate('/support')">💬 الدعم</div>
       ${user.is_admin ? `<div class="pill" onclick="navigate('/admin')">⚙️ الإدارة</div>` : ''}
       <div class="pill" onclick="logout()">👤 ${user.name || user.email || user.phone} — خروج</div>`
    : `<div class="pill" onclick="navigate('/login')">👤 دخول</div>
       <div class="pill" onclick="navigate('/register')">إنشاء حساب</div>`;
  document.getElementById('header').innerHTML = `
    <div class="hdr">
      <div class="brand" onclick="navigate('/')">
        ${flagSVG()}
        <h1>سوريا<span>ستور</span></h1>
      </div>
      <div class="search">
        <input id="searchInput" placeholder="ابحث عن منتج..." onkeyup="if(event.key==='Enter') doSearch()">
        <button onclick="doSearch()">🔍</button>
      </div>
      <div class="hdr-right">
        ${right}
        <button class="cart-btn" onclick="navigate('/cart')">🛒 السلة <span class="badge" id="cartBadge">0</span></button>
      </div>
    </div>
    <div class="subnav">
      <a href="#/countries">🌍 تسوق حسب الدولة</a>
      <a href="#/support">💬 تواصل مع الدعم</a>
      <a href="#/register">✨ إنشاء حساب</a>
    </div>`;
  updateCartBadge();
}

function renderFooter() {
  document.getElementById('footer').innerHTML = `
    ${flagSVG('xs')}
    <p><strong>سورياستور</strong> — تجربة تسوق عالمية بنكهة سورية 🇸🇾</p>
    <p class="muted">💳 الدفع بالكريبتو USDT فقط • 🚚 التوصيل من 3 إلى 6 أسابيع</p>
    <p class="muted">© 2024 سورياستور — جميع الحقوق محفوظة</p>`;
}

function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  navigate('/?search=' + encodeURIComponent(q));
}
window.doSearch = doSearch;

async function loadMe() {
  if (!state.token) { state.user = null; return; }
  try { const d = await api('/api/store-auth/me'); state.user = d.user; }
  catch (e) { state.token = null; state.user = null; localStorage.removeItem('sy_token'); }
}

function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem('sy_token');
  renderHeader();
  toast('تم تسجيل الخروج', 'info');
  navigate('/');
}
window.logout = logout;

function addToCart(p) {
  const ex = state.cart.find(i => i.id === p.id);
  if (ex) ex.quantity++;
  else state.cart.push({ id: p.id, title: p.title, price_usd: p.price_usd, shipping_fee_usd: p.shipping_fee_usd, image_url: p.image_url, country_name: p.country_name, quantity: 1 });
  saveCart();
  toast('✅ تمت الإضافة إلى السلة');
}
window.addToCart = addToCart;

function updateQty(id, q) {
  const it = state.cart.find(i => i.id === id);
  if (it) { it.quantity = parseInt(q); if (it.quantity < 1) it.quantity = 1; saveCart(); renderPage(); }
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

// ==================== الصفحات ====================
async function renderHome() {
  const hash = location.hash.slice(1);
  const search = new URLSearchParams(hash.split('?')[1] || '').get('search') || '';
  let countries = [], products = [];
  try {
    countries = await api('/api/countries');
    state.countries = countries;
    const url = '/api/products' + (search ? '?search=' + encodeURIComponent(search) : '');
    products = await api(url);
  } catch (e) { document.getElementById('app').innerHTML = `<div class="empty"><div class="ic">⚠️</div><h3>${e.message}</h3></div>`; return; }

  document.getElementById('app').innerHTML = `
    <div class="hero">
      <h2>🛍️ كل ما تحتاجه... يوصلك إلى سوريا</h2>
      <p>تسوق من أمازون السعودية والإمارات وألمانيا وأمريكا — توصيل خلال 3-6 أسابيع</p>
      <button onclick="document.getElementById('cc').scrollIntoView({behavior:'smooth'})">تصفح الدول</button>
    </div>
    <div class="features">
      <div class="feat"><div class="ic">💳</div><h4>دفع USDT آمن</h4><p>شبكة BEP20</p></div>
      <div class="feat"><div class="ic">🚚</div><h4>توصيل 3-6 أسابيع</h4><p>حسب الدولة</p></div>
      <div class="feat"><div class="ic">💬</div><h4>دعم عربي</h4><p>على مدار الساعة</p></div>
    </div>
    <div class="sec-title" id="cc"><h2>🌍 اختر الدولة</h2></div>
    <div class="cgrid">
      ${countries.map(c => `
        <div class="ccard" onclick="navigate('/country/${c.id}')">
          <div class="em">${c.flag_emoji}</div>
          <h3>${c.name_ar}</h3>
          <p>التوصيل خلال ${c.delivery_weeks_min}-${c.delivery_weeks_max} أسابيع</p>
          <button class="btn-yellow">عرض المنتجات</button>
        </div>`).join('')}
    </div>
    <div class="sec-title">
      <h2>${search ? `🔍 نتائج البحث عن "${search}" (${products.length})` : '🔥 أحدث المنتجات'}</h2>
      ${search ? '<button class="btn-gray" onclick="navigate(\'/\')">إلغاء البحث</button>' : ''}
    </div>
    ${products.length === 0
      ? '<div class="empty"><div class="ic">📦</div><h3>لا توجد منتجات</h3></div>'
      : `<div class="pgrid">${products.map(p => `
          <div class="pcard">
            <img src="${p.image_url || 'https://via.placeholder.com/300'}" onerror="this.src='https://via.placeholder.com/300'">
            <h3>${p.title}</h3>
            <div class="stars">${stars(p.rating_avg)} <span class="muted">(${p.rating_count})</span></div>
            <div class="price">${p.price_usd} USDT</div>
            <div class="sub">+ شحن ${p.shipping_fee_usd} USDT</div>
            <div class="sub">${p.country_name}</div>
            <div class="stock ${p.stock <= 0 ? 'out' : ''}">${p.stock <= 0 ? '❌ نفذت' : '✅ متوفر: ' + p.stock}</div>
            <div class="acts">
              <button class="btn-gray" onclick="navigate('/product/${p.id}')">التفاصيل</button>
              <button class="btn-yellow" ${p.stock <= 0 ? 'disabled' : ''} onclick='addToCartById(${p.id})'>🛒 أضف</button>
            </div>
          </div>`).join('')}</div>`}
  `;
}

async function addToCartById(id) {
  try {
    const p = await api('/api/products/' + id);
    addToCart(p);
  } catch (e) { toast(e.message, 'error'); }
}
window.addToCartById = addToCartById;

async function renderCountries() {
  const countries = await api('/api/countries');
  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>🌍 تسوق حسب الدولة</h2></div>
    <div class="cgrid">
      ${countries.map(c => `
        <div class="ccard" onclick="navigate('/country/${c.id}')">
          <div class="em">${c.flag_emoji}</div>
          <h3>${c.name_ar}</h3>
          <p>${c.name_en}</p>
          <p>التوصيل خلال ${c.delivery_weeks_min}-${c.delivery_weeks_max} أسابيع</p>
          <button class="btn-yellow">تصفح المنتجات</button>
        </div>`).join('')}
    </div>`;
}

async function renderCountry(id) {
  const countries = await api('/api/countries');
  const c = countries.find(x => x.id == id);
  if (!c) { navigate('/'); return; }
  const products = await api('/api/products?country_id=' + id);
  document.getElementById('app').innerHTML = `
    <div class="crumb"><a href="#/">الرئيسية</a> › ${c.name_ar}</div>
    <div class="sec-title">
      <h2>${c.flag_emoji} منتجات ${c.name_ar}</h2>
      <button class="btn-gray" onclick="navigate('/')">← العودة</button>
    </div>
    ${products.length === 0 ? '<div class="empty"><div class="ic">📦</div><h3>لا توجد منتجات</h3></div>' :
    `<div class="pgrid">${products.map(p => `
      <div class="pcard">
        <img src="${p.image_url || 'https://via.placeholder.com/300'}" onerror="this.src='https://via.placeholder.com/300'">
        <h3>${p.title}</h3>
        <div class="stars">${stars(p.rating_avg)} <span class="muted">(${p.rating_count})</span></div>
        <div class="price">${p.price_usd} USDT</div>
        <div class="sub">+ شحن ${p.shipping_fee_usd} USDT</div>
        <div class="stock ${p.stock <= 0 ? 'out' : ''}">${p.stock <= 0 ? '❌ نفذت' : '✅ متوفر: ' + p.stock}</div>
        <div class="acts">
          <button class="btn-gray" onclick="navigate('/product/${p.id}')">التفاصيل</button>
          <button class="btn-yellow" ${p.stock <= 0 ? 'disabled' : ''} onclick='addToCartById(${p.id})'>🛒 أضف</button>
        </div>
      </div>`).join('')}</div>`}`;
}

async function renderProduct(id) {
  try {
    const p = await api('/api/products/' + id);
    document.getElementById('app').innerHTML = `
      <div class="crumb"><a href="#/">الرئيسية</a> › <a href="#/country/${p.country_id}">${p.country_name}</a> › ${p.title}</div>
      <div class="pdetail">
        <div><img src="${p.image_url || 'https://via.placeholder.com/400'}" onerror="this.src='https://via.placeholder.com/400'"></div>
        <div>
          <h2>${p.title}</h2>
          <div class="stars">${stars(p.rating_avg)} <span class="muted">${p.rating_avg} (${p.rating_count} تقييم)</span></div>
          <div class="bigprice">${p.price_usd} USDT</div>
          <div class="meta">
            <p><strong>+ أجرة الشحن:</strong> ${p.shipping_fee_usd} USDT</p>
            <p><strong>مدة التسليم:</strong> ${p.delivery_weeks_min}-${p.delivery_weeks_max} أسابيع</p>
            <p><strong>المخزون:</strong> ${p.stock > 0 ? '✅ ' + p.stock + ' قطعة' : '❌ نفذت الكمية'}</p>
            <p><strong>بلد الشحن:</strong> ${p.country_name}</p>
            <p><strong>الدفع:</strong> 💳 USDT (BEP20) فقط</p>
          </div>
          <button class="btn-yellow" style="padding:12px 30px;font-size:16px" ${p.stock <= 0 ? 'disabled' : ''} onclick='addToCart(${JSON.stringify(p).replace(/'/g, "&#39;")})'>🛒 إضافة إلى السلة</button>
        </div>
      </div>
      <div class="reviews-box">
        <h3>⭐ التقييمات (${p.reviews.length})</h3>
        ${p.reviews.length === 0 ? '<p class="muted">لا توجد تقييمات بعد.</p>' :
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
            <div class="fg"><label>تعليقك:</label><textarea id="revComment" placeholder="شاركنا تجربتك..."></textarea></div>
            <button class="btn-yellow" onclick="submitReview(${p.id})">إرسال</button>
            <p class="muted" style="margin-top:8px;font-size:12px">🔒 سيظهر اسمك مخفياً (مثال: م***د)</p>
          </div>` : '<p class="muted"><a href="#/login">سجّل الدخول</a> لإضافة تقييم.</p>'}
      </div>`;
  } catch (e) { document.getElementById('app').innerHTML = `<div class="empty"><div class="ic">⚠️</div><h3>${e.message}</h3></div>`; }
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

async function renderCart() {
  if (state.cart.length === 0) {
    document.getElementById('app').innerHTML = `<div class="empty"><div class="ic">🛒</div><h3>السلة فارغة</h3><button class="btn-yellow" onclick="navigate('/')">ابدأ التسوق</button></div>`;
    return;
  }
  const total = cartTotal();
  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>🛒 سلة التسوق (${cartCount()})</h2></div>
    ${state.cart.map(it => `
      <div class="citem">
        <img src="${it.image_url}" onerror="this.src='https://via.placeholder.com/90'">
        <div class="inf">
          <h4>${it.title}</h4>
          <p>من: ${it.country_name || ''}</p>
          <p class="pr">${it.price_usd} USDT + شحن ${it.shipping_fee_usd || 0}</p>
          <select onchange="updateQty(${it.id}, this.value)">
            ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option ${n === it.quantity ? 'selected' : ''} value="${n}">${n}</option>`).join('')}
          </select>
        </div>
        <button class="btn-red btn-sm" onclick="removeItem(${it.id})">🗑️</button>
      </div>`).join('')}
    <div class="summary">
      <h3>الإجمالي: ${total.toFixed(2)} USDT</h3>
      <button class="btn-yellow" style="width:100%;padding:14px;font-size:16px" onclick="navigate('/checkout')">💳 إتمام الشراء (USDT)</button>
    </div>`;
}

async function renderCheckout() {
  if (!state.user) { toast('سجّل الدخول أولاً', 'error'); navigate('/login'); return; }
  if (state.cart.length === 0) { navigate('/cart'); return; }
  if (!state.settings.usdt_wallet_address) { try { state.settings = await api('/api/settings'); } catch (e) {} }
  const total = cartTotal();
  const countries = state.countries.length ? state.countries : await api('/api/countries');
  const maxWeeks = Math.max(...state.cart.map(i => {
    const c = countries.find(x => x.name_ar === i.country_name);
    return c ? c.delivery_weeks_max : 6;
  }));

  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>💳 إتمام الشراء</h2></div>
    <div class="summary">
      <h3>📋 ملخص الطلب</h3>
      ${state.cart.map(it => `
        <div class="total-line"><span>${it.title} × ${it.quantity}</span><span>${((it.price_usd + (it.shipping_fee_usd || 0)) * it.quantity).toFixed(2)} USDT</span></div>
      `).join('')}
      <div class="total-line big"><span>الإجمالي</span><span>${total.toFixed(2)} USDT</span></div>
      <p class="muted" style="margin-top:10px">🚚 مدة التسليم المتوقعة: <strong>${maxWeeks} أسابيع</strong> كحد أقصى</p>
    </div>
    <div class="summary" style="margin-top:15px">
      <h3>💰 الدفع بالكريبتو</h3>
      <div class="warn">
        <strong>⚠️ الدفع مسبق إلزامي:</strong> حوّل المبلغ المطلوب بالضبط إلى عنوان المحفظة أدناه عبر شبكة <strong>${state.settings.network || 'BEP20'}</strong>، ثم الصق رقم عملية التحويل (TXID) في الحقل.
      </div>
      <p style="margin:10px 0"><strong>المبلغ:</strong> <span style="color:#B12704;font-size:20px;font-weight:bold">${total.toFixed(2)} USDT</span></p>
      <p><strong>العنوان (${state.settings.network || 'BEP20'}):</strong></p>
      <div class="wallet">
        <code id="walletAddr">${state.settings.usdt_wallet_address}</code>
        <button onclick="copyWallet()">📋 نسخ</button>
      </div>
      <div class="fg">
        <label>رقم عملية التحويل (TXID):</label>
        <input id="txRef" placeholder="0x..." style="font-family:monospace;direction:ltr;text-align:left">
      </div>
      <div class="fg">
        <label>اختر دولة التسليم:</label>
        <select id="orderCountry">${countries.map(c => `<option value="${c.id}">${c.flag_emoji} ${c.name_ar}</option>`).join('')}</select>
      </div>
      <button class="btn-green" style="width:100%;padding:14px;font-size:16px" onclick="placeOrder()">✅ تأكيد الطلب</button>
    </div>`;
}

function copyWallet() {
  navigator.clipboard.writeText(state.settings.usdt_wallet_address);
  toast('✓ تم نسخ العنوان');
}
window.copyWallet = copyWallet;

async function placeOrder() {
  const tx = document.getElementById('txRef').value.trim();
  const cid = document.getElementById('orderCountry').value;
  const c = state.countries.find(x => x.id == cid);
  if (!tx || tx.length < 6) { toast('رقم عملية التحويل مطلوب', 'error'); return; }
  try {
    await api('/api/orders', 'POST', {
      items: state.cart.map(i => ({ id: i.id, title: i.title, price_usd: i.price_usd, shipping_fee_usd: i.shipping_fee_usd || 0, quantity: i.quantity })),
      country_id: cid,
      country_name: c ? c.name_ar : '',
      tx_ref: tx,
      wallet_address: state.settings.usdt_wallet_address
    });
    state.cart = []; saveCart();
    toast('✅ تم إرسال الطلب — بانتظار تأكيد الدفع');
    setTimeout(() => navigate('/orders?placed=1'), 800);
  } catch (e) { toast(e.message, 'error'); }
}
window.placeOrder = placeOrder;

async function renderOrders() {
  if (!state.user) { navigate('/login'); return; }
  const orders = await api('/api/orders/mine');
  const placed = location.hash.includes('placed=1');
  const labels = { awaiting_confirmation: '⏳ بانتظار التأكيد', accepted: '✔ مقبول', rejected: '✖ مرفوض', shipped: '🚚 تم الشحن', delivered: '✔ تم التسليم' };
  document.getElementById('app').innerHTML = `
    ${placed ? '<div class="warn" style="background:#E8F5E9;border-color:#66BB6A;border-right-color:#2E7D32;color:#1B5E20"><strong>✅ تم إرسال طلبك بنجاح!</strong> سنراجعه قريباً بعد التحقق من التحويل.</div>' : ''}
    <div class="sec-title"><h2>📦 طلباتي (${orders.length})</h2></div>
    ${orders.length === 0 ? '<div class="empty"><div class="ic">📦</div><h3>لا توجد طلبات</h3></div>' :
    orders.map(o => `
      <div class="ocard">
        <h3>طلب #${o.id} — ${new Date(o.created_at).toLocaleString('ar-EG')}</h3>
        <p><strong>الدولة:</strong> ${o.country_name}</p>
        <p><strong>الإجمالي:</strong> ${o.total_usd.toFixed(2)} USDT</p>
        <p><strong>TXID:</strong> <code style="direction:ltr;display:inline-block;font-size:12px">${(o.tx_ref || '').slice(0, 20)}...</code></p>
        <p><strong>الحالة:</strong> <span class="st-${o.status}">${labels[o.status] || o.status}</span></p>
        <details><summary>المنتجات (${o.items.length})</summary>
          <ul style="padding-right:20px;margin-top:6px">
            ${o.items.map(i => `<li>${i.title} × ${i.quantity} — ${((i.price_usd + (i.shipping_fee_usd || 0)) * i.quantity).toFixed(2)} USDT</li>`).join('')}
          </ul>
        </details>
      </div>`).join('')}`;
}

async function renderSupport() {
  if (!state.user) { navigate('/login'); return; }
  const msgs = await api('/api/support/mine');
  const msgsAsc = [...msgs].reverse();
  document.getElementById('app').innerHTML = `
    <div class="sec-title"><h2>💬 الدعم الفني</h2></div>
    <div class="chat">
      <div class="chat-hdr">💬 تواصل مع فريق سورياستور</div>
      <div class="chat-body" id="chatBody">
        ${msgsAsc.length === 0 ? '<p class="muted" style="text-align:center;padding:20px">لا توجد رسائل بعد — ابدأ المحادثة 👋</p>' : ''}
        ${msgsAsc.map(m => `
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
  try {
    await api('/api/support', 'POST', { message: m });
    toast('✅ تم الإرسال');
    renderSupport();
  } catch (e) { toast(e.message, 'error'); }
}
window.sendSupport = sendSupport;

function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="form-card">
      <div class="logo-top">${flagSVG()}</div>
      <h2>تسجيل الدخول</h2>
      <div class="fg"><label>البريد الإلكتروني أو رقم الهاتف:</label><input id="logId" autocomplete="username"></div>
      <div class="fg"><label>كلمة المرور:</label><input type="password" id="logPw" onkeyup="if(event.key==='Enter') doLogin()"></div>
      <button class="main-btn" onclick="doLogin()">دخول</button>
      <div class="form-foot">ليس لديك حساب؟ <a href="#/register">إنشاء حساب جديد</a></div>
    </div>`;
}

async function doLogin() {
  const identifier = document.getElementById('logId').value.trim();
  const password = document.getElementById('logPw').value;
  if (!identifier || !password) { toast('املأ الحقول', 'error'); return; }
  try {
    const d = await api('/api/store-auth/login', 'POST', { identifier, password });
    state.token = d.token; state.user = d.user;
    localStorage.setItem('sy_token', d.token);
    renderHeader();
    toast('✅ مرحباً ' + (d.user.name || d.user.email));
    navigate('/');
  } catch (e) { toast(e.message, 'error'); }
}
window.doLogin = doLogin;

function renderRegister() {
  document.getElementById('app').innerHTML = `
    <div class="form-card">
      <div class="logo-top">${flagSVG()}</div>
      <h2>إنشاء حساب</h2>
      <div class="fg"><label>الاسم:</label><input id="regName"></div>
      <div class="fg"><label>البريد الإلكتروني:</label><input type="email" id="regEmail"></div>
      <div class="fg"><label>أو رقم الهاتف:</label><input id="regPhone" placeholder="09xxxxxxxx"></div>
      <div class="fg"><label>كلمة المرور (6 أحرف على الأقل):</label><input type="password" id="regPw"></div>
      <button class="main-btn" onclick="doRegister()">إنشاء الحساب</button>
      <div class="form-foot">لديك حساب؟ <a href="#/login">تسجيل الدخول</a></div>
    </div>`;
}

async function doRegister() {
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const phone = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPw').value;
  if (!email && !phone) { toast('البريد أو الهاتف مطلوب', 'error'); return; }
  if (password.length < 6) { toast('كلمة المرور 6 أحرف على الأقل', 'error'); return; }
  try {
    const d = await api('/api/store-auth/register', 'POST', { name, email, phone, password });
    state.token = d.token; state.user = d.user;
    localStorage.setItem('sy_token', d.token);
    renderHeader();
    toast('✅ تم إنشاء حسابك');
    navigate('/');
  } catch (e) { toast(e.message, 'error'); }
}
window.doRegister = doRegister;

// ==================== الأدمن ====================
async function renderAdmin() {
  if (!state.user || !state.user.is_admin) { toast('صلاحيات غير كافية', 'error'); navigate('/'); return; }
  document.getElementById('app').innerHTML = `
    <div class="admin">
      <h2 style="margin-bottom:15px">⚙️ لوحة الإدارة</h2>
      <div class="atabs">
        <button data-t="ov" onclick="adminTab('ov')">📊 نظرة عامة</button>
        <button data-t="or" onclick="adminTab('or')">🛒 الطلبات</button>
        <button data-t="pr" onclick="adminTab('pr')">📦 المنتجات</button>
        <button data-t="co" onclick="adminTab('co')">🌍 الدول</button>
        <button data-t="ac" onclick="adminTab('ac')">👥 الحسابات</button>
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
    if (t === 'co') return adminCountries(c);
    if (t === 'ac') return adminAccounts(c);
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
    </div>
    <h4 style="margin-bottom:10px">آخر 5 طلبات</h4>
    <div class="tbl-wrap"><table>
      <tr><th>#</th><th>العميل</th><th>الدولة</th><th>المبلغ</th><th>الحالة</th><th>التاريخ</th></tr>
      ${orders.slice(0, 5).map(o => `<tr><td>${o.id}</td><td>${o.user_name || '-'}</td><td>${o.country_name}</td><td>${o.total_usd.toFixed(2)}</td><td class="st-${o.status}">${o.status}</td><td>${new Date(o.created_at).toLocaleDateString('ar-EG')}</td></tr>`).join('')}
    </table></div>`;
}

async function adminOrders(c) {
  const orders = await api('/api/admin/orders');
  const labels = { awaiting_confirmation: 'بانتظار', accepted: 'مقبول', rejected: 'مرفوض', shipped: 'مشحون', delivered: 'مسلَّم' };
  c.innerHTML = `
    <div class="toolbar"><h4>الطلبات (${orders.length})</h4></div>
    <div class="tbl-wrap"><table>
      <tr><th>#</th><th>العميل</th><th>الدولة</th><th>المبلغ</th><th>TXID</th><th>الحالة</th><th>إجراء</th></tr>
      ${orders.map(o => `
        <tr>
          <td>${o.id}</td><td>${o.user_name || '-'}</td><td>${o.country_name}</td><td>${o.total_usd.toFixed(2)}</td>
          <td style="direction:ltr;font-size:11px">${(o.tx_ref || '').slice(0, 14)}…</td>
          <td><select onchange="updOrder(${o.id}, this.value)" style="padding:4px;width:auto">
            ${Object.keys(labels).map(k => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${labels[k]}</option>`).join('')}
          </select></td>
          <td><button class="btn-gray btn-sm" onclick='viewOrder(${JSON.stringify(o).replace(/'/g, "&#39;")})'>👁️</button></td>
        </tr>`).join('')}
    </table></div>`;
}

function viewOrder(o) {
  alert('طلب #' + o.id + '\n\n' + o.items.map(i => `${i.title} × ${i.quantity} = ${(i.price_usd * i.quantity).toFixed(2)}`).join('\n') + '\n\nTXID: ' + o.tx_ref);
}
window.viewOrder = viewOrder;

async function updOrder(id, status) {
  try { await api('/api/admin/orders/' + id, 'PUT', { status }); toast('✅ تم التحديث'); }
  catch (e) { toast(e.message, 'error'); }
}
window.updOrder = updOrder;

async function adminProducts(c) {
  const products = await api('/api/admin/products');
  const countries = await api('/api/admin/countries');
  c.innerHTML = `
    <div class="toolbar"><h4>المنتجات (${products.length})</h4><button class="btn-yellow" onclick="toggleForm('prodForm')">➕ إضافة منتج</button></div>
    <div class="afm" id="prodForm" style="display:none">
      <h4 id="prodFormTitle">منتج جديد</h4>
      <input type="hidden" id="pf_id">
      <div class="frow">
        <div class="fg"><label>العنوان:</label><input id="pf_title"></div>
        <div class="fg"><label>الدولة:</label><select id="pf_country">${countries.map(x => `<option value="${x.id}">${x.name_ar}</option>`).join('')}</select></div>
      </div>
      <div class="fg"><label>الوصف:</label><textarea id="pf_desc"></textarea></div>
      <div class="fg"><label>ملاحظات:</label><input id="pf_notes"></div>
      <div class="frow">
        <div class="fg"><label>السعر (USDT):</label><input type="number" step="0.01" id="pf_price"></div>
        <div class="fg"><label>أجرة الشحن (USDT):</label><input type="number" step="0.01" id="pf_ship" value="0"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>المخزون:</label><input type="number" id="pf_stock" value="0"></div>
        <div class="fg"><label>رابط الصورة:</label><input id="pf_img"></div>
      </div>
      <div class="fg"><label><input type="checkbox" id="pf_active" checked style="width:auto"> نشط</label></div>
      <button class="btn-green" onclick="saveProduct()">💾 حفظ</button>
      <button class="btn-gray" onclick="toggleForm('prodForm')">إلغاء</button>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>الصورة</th><th>العنوان</th><th>الدولة</th><th>السعر</th><th>المخزون</th><th>نشط</th><th>إجراءات</th></tr>
      ${products.map(p => `
        <tr>
          <td>${p.id}</td>
          <td><img src="${p.image_url}" style="width:40px;height:40px;object-fit:cover;border-radius:4px" onerror="this.style.display='none'"></td>
          <td>${p.title}</td><td>${p.country_name}</td><td>${p.price_usd}</td>
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
    ['pf_id', 'pf_title', 'pf_desc', 'pf_notes', 'pf_price', 'pf_ship', 'pf_stock', 'pf_img'].forEach(i => { const el = document.getElementById(i); if (el) el.value = i === 'pf_stock' || i === 'pf_ship' ? '0' : ''; });
    document.getElementById('pf_active').checked = true;
    document.getElementById('prodFormTitle').textContent = 'منتج جديد';
  }
}
window.toggleForm = toggleForm;

function editProduct(p) {
  document.getElementById('prodForm').style.display = 'block';
  document.getElementById('prodFormTitle').textContent = 'تعديل منتج #' + p.id;
  document.getElementById('pf_id').value = p.id;
  document.getElementById('pf_title').value = p.title;
  document.getElementById('pf_country').value = p.country_id;
  document.getElementById('pf_desc').value = p.description || '';
  document.getElementById('pf_notes').value = p.notes || '';
  document.getElementById('pf_price').value = p.price_usd;
  document.getElementById('pf_ship').value = p.shipping_fee_usd || 0;
  document.getElementById('pf_stock').value = p.stock;
  document.getElementById('pf_img').value = p.image_url || '';
  document.getElementById('pf_active').checked = p.active === 1;
  document.getElementById('prodForm').scrollIntoView({ behavior: 'smooth' });
}
window.editProduct = editProduct;

async function saveProduct() {
  const id = document.getElementById('pf_id').value;
  const body = {
    title: document.getElementById('pf_title').value.trim(),
    country_id: parseInt(document.getElementById('pf_country').value),
    description: document.getElementById('pf_desc').value.trim(),
    notes: document.getElementById('pf_notes').value.trim(),
    price_usd: parseFloat(document.getElementById('pf_price').value),
    shipping_fee_usd: parseFloat(document.getElementById('pf_ship').value) || 0,
    stock: parseInt(document.getElementById('pf_stock').value) || 0,
    image_url: document.getElementById('pf_img').value.trim(),
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

async function adminCountries(c) {
  const list = await api('/api/admin/countries');
  c.innerHTML = `
    <div class="toolbar"><h4>الدول (${list.length})</h4></div>
    <div class="afm">
      <h4>➕ إضافة دولة</h4>
      <div class="frow">
        <div class="fg"><label>الاسم العربي:</label><input id="nc_ar"></div>
        <div class="fg"><label>الاسم الإنجليزي:</label><input id="nc_en"></div>
      </div>
      <div class="frow">
        <div class="fg"><label>العلم (emoji):</label><input id="nc_flag" placeholder="🇶🇦"></div>
        <div class="fg"><label>مدة التسليم (أسابيع):</label>
          <div style="display:flex;gap:6px">
            <input type="number" id="nc_min" value="3" placeholder="من">
            <input type="number" id="nc_max" value="6" placeholder="إلى">
          </div>
        </div>
      </div>
      <button class="btn-green" onclick="addCountry()">إضافة</button>
    </div>
    <div class="tbl-wrap"><table>
      <tr><th>ID</th><th>العلم</th><th>الاسم</th><th>التسليم</th><th>نشط</th><th>إجراء</th></tr>
      ${list.map(x => `
        <tr>
          <td>${x.id}</td><td>${x.flag_emoji}</td><td>${x.name_ar} / ${x.name_en}</td>
          <td>${x.delivery_weeks_min}-${x.delivery_weeks_max} أسابيع</td>
          <td>${x.active ? '✅' : '❌'}</td>
          <td>
            <button class="btn-gray btn-sm" onclick="toggleCountry(${x.id}, ${x.active ? 0 : 1})">${x.active ? 'تعطيل' : 'تفعيل'}</button>
            <button class="btn-red btn-sm" onclick="delCountry(${x.id})">🗑️</button>
          </td>
        </tr>`).join('')}
    </table></div>`;
}

async function addCountry() {
  const body = {
    name_ar: document.getElementById('nc_ar').value.trim(),
    name_en: document.getElementById('nc_en').value.trim(),
    flag_emoji: document.getElementById('nc_flag').value.trim() || '🌐',
    delivery_weeks_min: parseInt(document.getElementById('nc_min').value) || 3,
    delivery_weeks_max: parseInt(document.getElementById('nc_max').value) || 6
  };
  if (!body.name_ar || !body.name_en) { toast('الأسماء مطلوبة', 'error'); return; }
  try { await api('/api/admin/countries', 'POST', body); toast('✅ تمت الإضافة'); adminTab('co'); }
  catch (e) { toast(e.message, 'error'); }
}
window.addCountry = addCountry;

async function toggleCountry(id, active) {
  try {
    const list = await api('/api/admin/countries');
    const c = list.find(x => x.id === id);
    await api('/api/admin/countries/' + id, 'PUT', { ...c, active: active === 1 });
    adminTab('co');
  } catch (e) { toast(e.message, 'error'); }
}
window.toggleCountry = toggleCountry;

async function delCountry(id) {
  if (!confirm('حذف الدولة وكل منتجاتها؟')) return;
  try { await api('/api/admin/countries/' + id, 'DELETE'); toast('تم الحذف', 'info'); adminTab('co'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delCountry = delCountry;

async function adminAccounts(c) {
  const list = await api('/api/admin/accounts');
  c.innerHTML = `
    <div class="toolbar"><h4>الحسابات (${list.length})</h4></div>
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
              <button class="btn-gray btn-sm" onclick="delAccount(${a.id})">🗑️</button>` : '—'}
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
  if (!confirm('حذف الحساب؟')) return;
  try { await api('/api/admin/accounts/' + id, 'DELETE'); toast('تم الحذف', 'info'); adminTab('ac'); }
  catch (e) { toast(e.message, 'error'); }
}
window.delAccount = delAccount;

async function adminSupport(c) {
  const list = await api('/api/admin/support');
  c.innerHTML = `
    <div class="toolbar"><h4>رسائل الدعم (${list.length})</h4></div>
    ${list.length === 0 ? '<p class="muted">لا توجد رسائل.</p>' : list.map(m => `
      <div class="afm" style="${m.status === 'open' ? 'background:#FFF8E1;border-color:#FFD54F' : ''}">
        <p><strong>👤 ${m.user_name}</strong> <span class="muted">(${m.user_email || m.user_phone})</span></p>
        <p class="muted" style="font-size:12px">${new Date(m.created_at).toLocaleString('ar-EG')}</p>
        <p style="margin:8px 0;padding:10px;background:#fff;border-radius:6px">${m.message}</p>
        ${m.reply
          ? `<div style="background:#E8F5E9;padding:10px;border-radius:6px;border-right:3px solid #27AE60"><strong>ردك:</strong> ${m.reply}</div>`
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
    <h4 style="margin-bottom:15px">⚙️ إعدادات المتجر</h4>
    <div class="afm">
      <div class="fg"><label>💳 عنوان محفظة USDT:</label>
        <input id="st_wallet" value="${s.usdt_wallet_address || ''}" style="font-family:monospace;direction:ltr;text-align:left">
      </div>
      <div class="fg"><label>🌐 الشبكة:</label>
        <select id="st_net">
          ${['BEP20', 'TRC20', 'ERC20'].map(n => `<option ${s.network === n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="fg"><label>📢 إعلان المتجر:</label>
        <input id="st_ann" value="${s.announcement || ''}">
      </div>
      <button class="btn-green" onclick="saveSettings()">💾 حفظ الإعدادات</button>
    </div>`;
}
async function saveSettings() {
  try {
    await api('/api/admin/settings', 'PUT', {
      usdt_wallet_address: document.getElementById('st_wallet').value.trim(),
      network: document.getElementById('st_net').value,
      announcement: document.getElementById('st_ann').value.trim()
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
    else if (path === '/countries') await renderCountries();
    else if (path.startsWith('/country/')) await renderCountry(path.split('/')[2]);
    else if (path.startsWith('/product/')) await renderProduct(path.split('/')[2]);
    else if (path === '/cart') await renderCart();
    else if (path === '/checkout') await renderCheckout();
    else if (path === '/orders') await renderOrders();
    else if (path === '/support') await renderSupport();
    else if (path === '/login') renderLogin();
    else if (path === '/register') renderRegister();
    else if (path === '/admin') await renderAdmin();
    else app.innerHTML = '<div class="empty"><div class="ic">🤷</div><h3>الصفحة غير موجودة</h3><button class="btn-yellow" onclick="navigate(\'/\')">العودة</button></div>';
  } catch (e) {
    app.innerHTML = `<div class="empty"><div class="ic">⚠️</div><h3>${e.message}</h3></div>`;
  }
}

window.addEventListener('hashchange', renderPage);
window.addEventListener('DOMContentLoaded', async () => {
  renderFooter();
  await loadMe();
  renderHeader();
  try { state.settings = await api('/api/settings'); } catch (e) {}
  renderPage();
});
