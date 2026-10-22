/* ==========================================================================
   Jeena Resort & Spa - shared front end runtime
   - talks to the C# API
   - applies admin controlled theme + texts
   - renders the shared header / footer
   - handles auth, cart, modals, lightbox and scroll animations
   ========================================================================== */

export const API = "";

export const state = {
  settings: {},
  pages: [],
  carousel: [],
  categories: [],
  facilities: [],
  testimonials: [],
  mapEmbedUrl: "",
  user: null,
  loaded: false
};

/* ------------------------------------------------------------------ storage */

const LS_TOKEN = "jr_token";
const LS_USER = "jr_user";
const LS_CART = "jr_cart";

export const auth = {
  get token() { return localStorage.getItem(LS_TOKEN) || ""; },
  get user() {
    try { return JSON.parse(localStorage.getItem(LS_USER) || "null"); } catch { return null; }
  },
  get isLoggedIn() { return !!localStorage.getItem(LS_TOKEN); },
  get isAdmin() { return this.user?.role === "Admin"; },
  save(token, user) {
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(user));
    state.user = user;
  },
  updateUser(user) { localStorage.setItem(LS_USER, JSON.stringify(user)); state.user = user; },
  clear() {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    state.user = null;
  }
};

/* ------------------------------------------------------------------- http */

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = "GET", body, form, headers = {} } = {}) {
  const opts = { method, headers: { ...headers } };
  if (auth.token) opts.headers.Authorization = "Bearer " + auth.token;

  if (form) {
    opts.body = form;
  } else if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(API + path, opts);
  } catch {
    throw new ApiError("Cannot reach the server. Is the API running?", 0, null);
  }

  if (res.status === 401 && auth.isLoggedIn && !path.includes("/auth/login")) {
    auth.clear();
  }

  const text = await res.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = { message: text }; } }

  if (!res.ok) {
    const msg = data?.message || data?.title || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status, data);
  }
  return data;
}

/* ---------------------------------------------------------------- helpers */

export const qs = (sel, scope = document) => scope.querySelector(sel);
export const qsa = (sel, scope = document) => [...scope.querySelectorAll(sel)];

export function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function money(amount, opts = {}) {
  const symbol = state.settings["booking.currencySymbol"] || "₹";
  const value = Number(amount || 0);
  const formatted = value.toLocaleString("en-IN", {
    minimumFractionDigits: opts.decimals ?? 0,
    maximumFractionDigits: opts.decimals ?? 0
  });
  return opts.bare ? formatted : symbol + " " + formatted;
}

export function num(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function flag(key, fallback = false) {
  const v = state.settings[key];
  if (v === undefined || v === null || v === "") return fallback;
  return ["true", "1", "yes", "on"].includes(String(v).toLowerCase());
}

export function settingValue(key, fallback = "") {
  const v = state.settings[key];
  return v === undefined || v === null || v === "" ? fallback : v;
}

export function fmtDate(value, style = "medium") {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const opts = style === "long"
    ? { weekday: "short", day: "numeric", month: "long", year: "numeric" }
    : style === "short" ? { day: "2-digit", month: "short", year: "numeric" }
    : { day: "2-digit", month: "short", year: "numeric" };
  return d.toLocaleDateString("en-IN", opts);
}

export function fmtDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function nights(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn + "T00:00:00");
  const b = new Date(checkOut + "T00:00:00");
  return Math.max(0, Math.round((b - a) / 86400000));
}

export function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "G";
}

export function debounce(fn, wait = 320) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

export function stars(rating = 5) {
  const full = Math.round(num(rating, 5));
  let out = "";
  for (let i = 1; i <= 5; i++) out += `<svg viewBox="0 0 24 24" class="${i <= full ? "" : "off"}"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"/></svg>`;
  return out;
}

export function skeleton(count = 3, height = 260) {
  return Array.from({ length: count }, () => `<div class="skeleton" style="height:${height}px"></div>`).join("");
}

export function emptyState(message, hint = "") {
  return `<div class="empty">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7h18M3 12h18M3 17h10"/></svg>
    <p><strong>${esc(message)}</strong></p>${hint ? `<p class="small">${esc(hint)}</p>` : ""}</div>`;
}

export function statusBadge(status) {
  const map = {
    Pending: "badge-amber", Confirmed: "badge-blue", CheckedIn: "badge-green", CheckedOut: "badge-gray",
    Cancelled: "badge-red", Unpaid: "badge-red", Partial: "badge-amber", Paid: "badge-green", Refunded: "badge-gray",
    New: "badge-amber", Preparing: "badge-blue", Served: "badge-green", Billed: "badge-gray",
    Admin: "badge-purple", Staff: "badge-blue", Customer: "badge-gray"
  };
  const label = String(status || "").replace(/([a-z])([A-Z])/g, "$1 $2");
  return `<span class="badge ${map[status] || "badge-gray"}">${esc(label)}</span>`;
}

/* ---------------------------------------------------------------- overlays */

let toastHost;

export function toast(message, type = "info", ms = 4600) {
  if (!toastHost) {
    toastHost = document.createElement("div");
    toastHost.style.cssText = "position:fixed;top:22px;right:22px;z-index:900;display:grid;gap:10px;max-width:min(400px,92vw)";
    document.body.appendChild(toastHost);
  }
  const el = document.createElement("div");
  const colors = {
    success: "#12603f", error: "#9a2d26", info: "#17547d", warn: "#8a6415"
  };
  const bgs = { success: "#e9f7f0", error: "#fdecea", info: "#eaf4fb", warn: "#fdf5e3" };
  el.style.cssText = `background:${bgs[type] || "#fff"};color:${colors[type] || "#333"};border-radius:12px;padding:14px 18px;box-shadow:0 18px 40px rgba(10,30,24,.18);font-size:.92rem;opacity:0;transform:translateY(-10px);transition:.3s`;
  el.innerHTML = `<div style="display:flex;gap:10px;align-items:flex-start"><span style="flex:1">${esc(message)}</span>
    <button aria-label="Dismiss" style="background:none;border:0;cursor:pointer;font-size:1.1rem;line-height:1;color:inherit;opacity:.6">&times;</button></div>`;
  el.querySelector("button").onclick = () => el.remove();
  toastHost.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = "1"; el.style.transform = "none"; });
  if (ms) setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateY(-10px)"; setTimeout(() => el.remove(), 320); }, ms);
}

export function openModal(node) {
  if (typeof node === "string") node = qs(node);
  if (!node) return;
  node.classList.add("show");
  document.body.classList.add("modal-open");
}
export function closeModal(node) {
  if (typeof node === "string") node = qs(node);
  if (!node) return;
  node.classList.remove("show");
  if (!qs(".modal-back.show")) document.body.classList.remove("modal-open");
}

export function confirmDialog(message, { title = "Please confirm", ok = "Yes, continue", cancel = "Cancel" } = {}) {
  return new Promise((resolve) => {
    const back = document.createElement("div");
    back.className = "modal-back";
    back.innerHTML = `<div class="modal sm"><div class="modal-head"><h3>${esc(title)}</h3></div>
      <div class="modal-body"><p class="mb-0">${esc(message)}</p></div>
      <div class="modal-foot"><button class="btn btn-outline" data-no>${esc(cancel)}</button><button class="btn" data-yes>${esc(ok)}</button></div></div>`;
    document.body.appendChild(back);
    requestAnimationFrame(() => back.classList.add("show"));
    const done = (v) => { back.classList.remove("show"); setTimeout(() => back.remove(), 300); resolve(v); };
    back.querySelector("[data-yes]").onclick = () => done(true);
    back.querySelector("[data-no]").onclick = () => done(false);
    back.onclick = (e) => { if (e.target === back) done(false); };
  });
}

/* ---------------------------------------------------------------- lightbox */

const lightbox = {
  items: [],
  index: 0,
  node: null,
  ensure() {
    if (this.node) return this.node;
    const el = document.createElement("div");
    el.className = "lightbox";
    el.innerHTML = `<button class="lightbox-close" aria-label="Close">&times;</button>
      <button class="lightbox-prev" aria-label="Previous">&#8249;</button>
      <button class="lightbox-next" aria-label="Next">&#8250;</button>
      <div class="lightbox-stage"></div><div class="lightbox-cap"></div>`;
    document.body.appendChild(el);
    el.querySelector(".lightbox-close").onclick = () => this.close();
    el.querySelector(".lightbox-prev").onclick = (e) => { e.stopPropagation(); this.step(-1); };
    el.querySelector(".lightbox-next").onclick = (e) => { e.stopPropagation(); this.step(1); };
    el.onclick = (e) => { if (e.target === el || e.target.classList.contains("lightbox-stage")) this.close(); };
    document.addEventListener("keydown", (e) => {
      if (!el.classList.contains("show")) return;
      if (e.key === "Escape") this.close();
      if (e.key === "ArrowLeft") this.step(-1);
      if (e.key === "ArrowRight") this.step(1);
    });
    this.node = el;
    return el;
  },
  /** items: [{ url, mediaType, title, thumbnailUrl }] */
  open(items, index = 0) {
    this.items = items.filter((i) => i && i.url);
    if (!this.items.length) return;
    this.index = index;
    const el = this.ensure();
    el.classList.add("show");
    document.body.classList.add("modal-open");
    this.render();
  },
  step(delta) {
    if (!this.items.length) return;
    this.index = (this.index + delta + this.items.length) % this.items.length;
    this.render();
  },
  render() {
    const item = this.items[this.index];
    const stage = this.node.querySelector(".lightbox-stage");
    const isVideo = item.mediaType === "Video" || /\.(mp4|webm|mov)$/i.test(item.url);
    const isYt = item.mediaType === "YouTube" || /youtube|youtu\.be|vimeo/i.test(item.url);
    if (isYt) stage.innerHTML = `<iframe src="${esc(item.url)}" allow="autoplay; encrypted-media; fullscreen" allowfullscreen></iframe>`;
    else if (isVideo) stage.innerHTML = `<video src="${esc(item.url)}" controls autoplay playsinline></video>`;
    else stage.innerHTML = `<img src="${esc(item.url)}" alt="${esc(item.title || "")}">`;
    this.node.querySelector(".lightbox-cap").textContent = item.title || "";
    const multi = this.items.length > 1;
    this.node.querySelector(".lightbox-prev").style.display = multi ? "grid" : "none";
    this.node.querySelector(".lightbox-next").style.display = multi ? "grid" : "none";
  },
  close() {
    if (!this.node) return;
    this.node.classList.remove("show");
    this.node.querySelector(".lightbox-stage").innerHTML = "";
    document.body.classList.remove("modal-open");
  }
};

export { lightbox };

/* -------------------------------------------------------------------- cart */
/* Cart lines: { id, name, price, image, qty } */

export const cart = {
  get items() {
    try { return JSON.parse(localStorage.getItem(LS_CART) || "[]"); } catch { return []; }
  },
  persist(items) {
    localStorage.setItem(LS_CART, JSON.stringify(items));
    document.dispatchEvent(new CustomEvent("cart:change", { detail: items }));
    this.renderFab();
  },
  add(item, qty = 1) {
    const items = this.items;
    const found = items.find((i) => i.id === item.id);
    if (found) found.qty += qty;
    else items.push({ id: item.id, name: item.name, price: num(item.price), image: item.image, qty });
    this.persist(items);
    toast(`${item.name} added to your order`, "success", 2600);
  },
  setQty(id, qty) {
    let items = this.items;
    const line = items.find((i) => i.id === id);
    if (!line) return;
    line.qty = qty;
    if (line.qty <= 0) items = items.filter((i) => i.id !== id);
    this.persist(items);
    this.renderPanel();
  },
  remove(id) {
    this.persist(this.items.filter((i) => i.id !== id));
    this.renderPanel();
  },
  clear() {
    this.persist([]);
    this.renderPanel();
  },
  get count() { return this.items.reduce((n, i) => n + i.qty, 0); },
  get total() { return this.items.reduce((n, i) => n + i.qty * num(i.price), 0); },

  renderFab() {
    if (!flag("booking.enableFoodOrdering", true)) return;
    let fab = qs("#cartFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.id = "cartFab";
      fab.className = "cart-fab";
      fab.onclick = () => this.openPanel();
      document.body.appendChild(fab);
    }
    const count = this.count;
    fab.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7 4h-2l-1 2v1h2l3.6 7.6-1.35 2.45A2 2 0 0 0 10 20h9v-2h-8.4l1.1-2h6.3a2 2 0 0 0 1.8-1.1L23 7H6.2L5 4z"/><circle cx="10" cy="21" r="1.6"/><circle cx="18" cy="21" r="1.6"/></svg>
      <span>My order</span>${count ? `<span class="count">${count}</span>` : ""}`;
    fab.style.display = count || qs("#cartPanel.open") ? "inline-flex" : "none";
    if (count) fab.style.display = "inline-flex";
  },

  openPanel() {
    const panel = this.ensurePanel();
    panel.classList.add("open");
    document.body.classList.add("modal-open");
    this.renderPanel();
  },
  closePanel() {
    qs("#cartPanel")?.classList.remove("open");
    document.body.classList.remove("modal-open");
  },
  ensurePanel() {
    let panel = qs("#cartPanel");
    if (panel) return panel;
    panel = document.createElement("aside");
    panel.id = "cartPanel";
    panel.className = "cart-panel";
    panel.innerHTML = `<div class="drawer-head"><h3 class="mb-0">Your food order</h3><button class="drawer-close" aria-label="Close">&times;</button></div>
      <div class="cart-items" id="cartItems"></div>
      <div class="cart-total" id="cartFooter"></div>`;
    document.body.appendChild(panel);
    panel.querySelector(".drawer-close").onclick = () => this.closePanel();
    return panel;
  },
  renderPanel() {
    const panel = qs("#cartPanel");
    if (!panel) return;
    const items = this.items;
    const host = qs("#cartItems", panel);
    const foot = qs("#cartFooter", panel);

    if (!items.length) {
      host.innerHTML = emptyState("Your order is empty", "Add a few dishes from the menu page");
      foot.innerHTML = `<button class="btn btn-block btn-outline" id="cartClose">Continue browsing</button>`;
      qs("#cartClose", foot).onclick = () => this.closePanel();
      return;
    }

    host.innerHTML = items.map((i) => `<div class="cart-line">
        ${i.image ? `<img src="${esc(i.image)}" alt="">` : `<div class="skeleton" style="height:64px"></div>`}
        <div>
          <strong>${esc(i.name)}</strong>
          <span class="small muted">${money(i.price)} each</span>
          <div class="qty" data-id="${i.id}">
            <button data-act="dec" aria-label="Decrease">&minus;</button><span>${i.qty}</span><button data-act="inc" aria-label="Increase">+</button>
          </div>
        </div>
        <div class="text-right">
          <div class="price">${money(i.price * i.qty)}</div>
          <button class="btn-link small" data-act="remove">Remove</button>
        </div>
      </div>`).join("");

    host.onclick = (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const id = num(btn.closest(".cart-line").querySelector(".qty").dataset.id);
      const line = this.items.find((x) => x.id === id);
      const act = btn.dataset.act;
      if (act === "inc") this.setQty(id, line.qty + 1);
      if (act === "dec") this.setQty(id, line.qty - 1);
      if (act === "remove") this.remove(id);
    };

    foot.innerHTML = `<div class="summary-row total"><span>Total</span><span>${money(this.total)}</span></div>
      <p class="small muted">Dine-in, room service or takeaway - choose at checkout.</p>
      <div class="flex" style="flex-direction:column">
        <button class="btn btn-block" id="cartCheckout">Place order</button>
        <button class="btn btn-block btn-outline" id="cartClear">Clear order</button>
      </div>`;
    qs("#cartCheckout", foot).onclick = () => { this.closePanel(); openFoodCheckout(); };
    qs("#cartClear", foot).onclick = () => this.clear();
  }
};

/* Food order checkout modal, opened from the cart. */
function openFoodCheckout() {
  const items = cart.items;
  if (!items.length) { toast("Your order is empty", "warn"); return; }

  let back = qs("#foodCheckout");
  if (!back) {
    back = document.createElement("div");
    back.className = "modal-back";
    back.id = "foodCheckout";
    document.body.appendChild(back);
  }

  const user = auth.user;
  const types = ["DineIn", "RoomService", "Takeaway"];
  const typeLabels = { DineIn: "Dine in at the restaurant", RoomService: "Room service", Takeaway: "Takeaway / parcel" };

  back.innerHTML = `<div class="modal">
    <div class="modal-head"><h3>Confirm your food order</h3><button class="modal-close" data-close>&times;</button></div>
    <div class="modal-body">
      <form class="form" id="foodOrderForm" novalidate>
        <div class="form-row">
          <div class="field"><label>Your name <span class="req">*</span></label><input name="customerName" value="${esc(user?.fullName || "")}" required></div>
          <div class="field"><label>Phone <span class="req">*</span></label><input name="phone" value="${esc(user?.phone || "")}" required></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Email</label><input type="email" name="email" value="${esc(user?.email || "")}"></div>
          <div class="field"><label>Booking reference (optional)</label><input name="bookingCode" placeholder="JR-2610-1001"></div>
        </div>
        <div class="field"><label>How should we serve it?</label>
          <select name="orderType">${types.map((t) => `<option value="${t}">${typeLabels[t]}</option>`).join("")}</select>
        </div>
        <div class="field"><label>Notes for the kitchen</label><textarea name="notes" placeholder="Allergies, spice level, delivery time..."></textarea></div>
        <div class="summary">
          ${items.map((i) => `<div class="summary-row"><span>${esc(i.name)} x ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join("")}
          <div class="summary-row total"><span>Total</span><span>${money(cart.total)}</span></div>
        </div>
        <div id="foodOrderAlert"></div>
      </form>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-close>Cancel</button>
      <button class="btn" form="foodOrderForm" type="submit" id="foodOrderSubmit">Place order</button>
    </div>
  </div>`;

  back.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => closeModal(back)));
  back.onclick = (e) => { if (e.target === back) closeModal(back); };

  qs("#foodOrderForm", back).onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = qs("#foodOrderSubmit", back);
    const alertBox = qs("#foodOrderAlert", back);
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.items = items.map((i) => ({ foodItemId: i.id, quantity: i.qty }));

    btn.classList.add("is-loading");
    alertBox.innerHTML = "";
    try {
      const res = await api("/api/public/food-orders", { method: "POST", body: payload });
      cart.clear();

      // Replace the whole dialog, otherwise the footer's "Place order" button
      // stays on screen after the order has already been sent.
      back.innerHTML = `<div class="modal">
        <div class="modal-body text-center">
          <div style="font-size:3rem">🍽️</div>
          <h3>Order placed</h3>
          <p class="lead">${esc(res.message)}</p>
          <p class="muted small">Order reference <strong>${esc(res.order.orderCode)}</strong></p>
        </div>
        <div class="modal-foot"><button class="btn" data-close>Done</button></div>
      </div>`;
      back.querySelectorAll("[data-close]").forEach((b) => (b.onclick = () => closeModal(back)));
    } catch (err) {
      alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    } finally {
      btn.classList.remove("is-loading");
    }
  };

  openModal(back);
}

/* --------------------------------------------------------------- site boot */

export async function initSite({ page = "index", overHero = false } = {}) {
  injectLoader();
  try {
    const data = await api("/api/public/bootstrap");
    Object.assign(state, data);
    state.loaded = true;
  } catch (err) {
    console.error(err);
    document.body.innerHTML = `<div class="container section"><div class="alert alert-error">
      <div><strong>Cannot reach the resort API.</strong><br>Start the backend with <code>dotnet run</code> in the ResortWithJeena folder, then reload this page.
      <br><span class="small">${esc(err.message)}</span></div></div></div>`;
    return;
  }

  state.user = auth.user;
  applyTheme();
  renderTopbar();
  renderHeader(page, overHero);
  renderFooter();
  applySettingsToDom();
  applyPageContent();
  initReveal();
  initBackToTop();
  initWhatsapp();
  cart.renderFab();
  document.dispatchEvent(new CustomEvent("site:ready"));
  hideLoader();
}

export async function reloadSite() {
  const data = await api("/api/public/bootstrap");
  Object.assign(state, data);
  applyTheme();
  applySettingsToDom();
  applyPageContent();
}

/* ------------------------------------------------------------------ theme */

export function applyTheme() {
  const s = state.settings;
  const root = document.documentElement.style;
  const set = (varName, key, fallback) => {
    const v = s[key];
    if (v !== undefined && v !== null && String(v).trim() !== "") root.setProperty(varName, String(v).trim());
    else if (fallback) root.setProperty(varName, fallback);
  };

  set("--primary", "theme.primaryColor", "#c8a24a");
  set("--secondary", "theme.secondaryColor", "#0f5132");
  set("--accent", "theme.accentColor", "#e2703a");
  set("--body-bg", "theme.bodyBackground", "#ffffff");
  set("--section-bg", "theme.sectionBackground", "#f7f4ee");
  set("--card-bg", "theme.cardBackground", "#ffffff");
  set("--text", "theme.textColor", "#4a4a4a");
  set("--heading", "theme.headingColor", "#12261f");
  set("--nav-bg", "theme.navBackground", "#ffffff");
  set("--nav-text", "theme.navTextColor", "#12261f");
  set("--footer-bg", "theme.footerBackground", "#0b1f18");
  set("--footer-text", "theme.footerTextColor", "#cfe0d9");
  set("--btn-text", "theme.buttonTextColor", "#ffffff");
  set("--font", "theme.fontFamily", "'Segoe UI', system-ui, sans-serif");

  const radius = s["theme.borderRadius"];
  if (radius) root.setProperty("--radius", `${num(radius, 14)}px`);

  const animations = flag("theme.animationsEnabled", true);
  document.body.classList.toggle("animations-off", !animations);

  const overlayColor = s["hero.overlayColor"] || "#04140f";
  const opacity = Math.min(1, Math.max(0, num(s["hero.overlayOpacity"], 0.45)));
  const rgb = hexToRgb(overlayColor);
  document.documentElement.style.setProperty("--hero-overlay", `rgba(${rgb}, ${opacity})`);

  if (flag("hero.enabled", true) && s["hero.videoAutoplay"] === "false") { /* no-op, handled by hero */ }

  // Optional full page background image behind everything.
  const bgImage = s["theme.backgroundImage"];
  document.body.style.backgroundImage = bgImage ? `url("${bgImage}")` : "";
  document.body.style.backgroundSize = bgImage ? "cover" : "";
  document.body.style.backgroundAttachment = bgImage ? "fixed" : "";
  document.body.style.backgroundColor = s["theme.bodyBackground"] || "#fff";

  // SEO
  if (s["seo.title"]) document.title = document.title.includes("|") ? document.title : `${document.title} | ${s["site.name"] || ""}`.trim();
  const desc = qs('meta[name="description"]');
  if (desc && s["seo.description"]) desc.setAttribute("content", s["seo.description"]);
}

function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(String(hex).trim());
  if (!m) return "4, 20, 15";
  return `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}`;
}

/* ------------------------------------------------------- settings bindings */

export function applySettingsToDom() {
  qsa("[data-setting]").forEach((n) => {
    const v = state.settings[n.dataset.setting];
    if (v !== undefined && v !== null && v !== "") n.textContent = v;
  });
  qsa("[data-setting-src]").forEach((n) => {
    const v = state.settings[n.dataset.settingSrc];
    if (v) n.setAttribute("src", v);
  });
  qsa("[data-setting-href]").forEach((n) => {
    const v = state.settings[n.dataset.settingHref];
    if (v && v !== "#") n.setAttribute("href", v);
    if (!v || v === "#") n.style.display = "none";
  });
  qsa("[data-setting-placeholder]").forEach((n) => {
    const v = state.settings[n.dataset.settingPlaceholder];
    if (v) n.setAttribute("placeholder", v);
  });
  qsa("[data-setting-show]").forEach((n) => {
    n.toggleAttribute("hidden", !flag(n.dataset.settingShow, true));
  });
  qsa("[data-setting-hide]").forEach((n) => {
    n.toggleAttribute("hidden", flag(n.dataset.settingHide, false));
  });
  qsa("[data-setting-title]").forEach((n) => {
    const v = state.settings[n.dataset.settingTitle];
    if (v) n.setAttribute("title", v);
  });
  const year = qs("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
}

/* --------------------------------------------------------- page content */

export function applyPageContent() {
  qsa("[data-section]").forEach((section) => {
    const [pageKey, sectionKey] = String(section.dataset.section).split("/");
    const block = state.pages.find((p) => p.pageKey === pageKey && p.sectionKey === sectionKey);
    if (!block) return;

    if (block.isVisible === false) { section.setAttribute("hidden", ""); return; }

    section.querySelectorAll("[data-cms]").forEach((node) => {
      const field = node.dataset.cms;

      if (field === "items") {
        if (!block.items) return;
        node.innerHTML = renderContentItems(block.items);
        return;
      }

      let value = block[field];
      if (field === "image") value = block.imageUrl;
      if (field === "button") value = block.buttonText;

      if (value === undefined || value === null || value === "") return;

      const tag = node.tagName;
      if (tag === "IMG") node.setAttribute("src", value);
      else if (tag === "A") {
        node.textContent = value;
        if (block.buttonLink) node.setAttribute("href", block.buttonLink);
      } else if (node.hasAttribute("data-html")) node.innerHTML = value;
      else node.textContent = value;
    });
  });
}

export function renderContentItems(raw) {
  let items;
  try { items = JSON.parse(raw); } catch { return ""; }
  if (!Array.isArray(items)) return "";

  return items.map((item, i) => {
    if (item.name && item.role) {
      return `<div class="text-center" data-anim="up" data-delay="${(i % 4) + 1}">
        <img src="${esc(item.image || "/assets/placeholder.svg")}" alt="${esc(item.name)}"
             style="width:130px;height:130px;border-radius:50%;object-fit:cover;margin:0 auto 14px;box-shadow:var(--shadow)">
        <h4 class="mb-0">${esc(item.name)}</h4><span class="small muted">${esc(item.role)}</span></div>`;
    }
    return `<div class="feature" data-anim="up" data-delay="${(i % 4) + 1}">
      <div class="feature-icon">${icon("leaf")}</div>
      <div><h4>${esc(item.title || "")}</h4><p>${esc(item.text || "")}</p></div></div>`;
  }).join("");
}

export function content(pageKey, sectionKey) {
  return state.pages.find((p) => p.pageKey === pageKey && p.sectionKey === sectionKey) || null;
}

export function cmsText(pageKey, sectionKey, field, fallback = "") {
  const block = content(pageKey, sectionKey);
  return block && block[field] ? block[field] : fallback;
}

/* -------------------------------------------------------------------- icons */

const ICONS = {
  bed: '<path d="M2 8v11h20V8a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3zm2 0a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3H4zm0 5h16v4H4z"/>',
  leaf: '<path d="M5 21c8 0 14-6 14-14V3h-4C7 3 3 8 3 14c0 2 .5 4 2 5zm2-3c1-5 4-8 9-9-3 3-5 6-6 10z"/>',
  sparkle: '<path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 15l.9 2.6L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.4z"/>',
  crown: '<path d="M3 18h18l-1.5-9-4.5 4L12 6l-3 7-4.5-4z"/>',
  users: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-8 2-8 5v1h16v-1c0-3-4-5-8-5z"/>',
  home: '<path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/>',
  spa: '<path d="M12 2c2 3 3 6 3 9s-1 7-3 11c-2-4-3-8-3-11s1-6 3-9zm-7 9c2 1 3 3 4 5s1 4 1 6c-2-1-4-3-5-5s-1-4 0-6zm14 0c1 2 1 4 0 6s-3 4-5 5c0-2 0-4 1-6s2-4 4-5z"/>',
  pool: '<path d="M3 15c2 0 3 1.5 5 1.5S11 15 13 15s3 1.5 5 1.5S21 15 21 15v2c-2 0-3 1.5-5 1.5S13 17 11 17s-3 1.5-5 1.5S3 17 3 17zm9-11a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm-6 7h12v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0zm4 8h10v2H7z"/>',
  flame: '<path d="M12 2c3 4 5 6 5 9a5 5 0 0 1-10 0c0-1 .3-2 1-3 .5 2 2 2 2 0 0-2-1-3 2-6z"/>',
  star: '<path d="M12 2l3.1 6.3L22 9.3l-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  car: '<path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a2 2 0 0 1 2 2v5h-3a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H2v-5a2 2 0 0 1 2-2z"/>',
  sun: '<path d="M12 6a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm0-5 1.5 3h-3zM2 12l3-1.5v3zm20 0-3 1.5v-3zM12 23l-1.5-3h3z"/>',
  cake: '<path d="M12 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm-8 6h16v3c-2 0-3-1-5-1s-3 1-5 1-3-1-5-1zm0 5c2 0 3 1 5 1s3-1 5-1 3 1 5 1v3H4z"/>',
  cup: '<path d="M4 3h13v3h2a3 3 0 0 1 0 6h-2v1a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zm13 5h2a1 1 0 0 0 0-2h-2z"/>',
  camera: '<path d="M9 3h6l1.5 2H21v14H3V5h4.5zM12 8a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/>',
  wifi: '<path d="M12 20a2 2 0 1 1 0-4 2 2 0 0 1 0 4zM5 13a10 10 0 0 1 14 0l-2 2a7 7 0 0 0-10 0zm-4-4a15 15 0 0 1 22 0l-2 2a12 12 0 0 0-18 0z"/>',
  shield: '<path d="M12 2l8 3v6c0 6-4 10-8 11-4-1-8-5-8-11V5z"/>',
  clock: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5v5.5l4 2-1 1.7-5-2.6V7z"/>',
  phone: '<path d="M6 2h4l2 5-2.5 1.5a12 12 0 0 0 6 6L17 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 4a2 2 0 0 1 2-2z"/>',
  mail: '<path d="M2 5h20v14H2zm2 2v.5l8 5 8-5V7z"/>',
  pin: '<path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/>',
  cal: '<path d="M7 2v2H5a2 2 0 0 0-2 2v14h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 10h14v8H5z"/>',
  check: '<path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"/>',
  arrow: '<path d="M5 12h12l-5-5 1.4-1.4L21 12l-7.6 6.4L12 17l5-5H5z"/>',
  google: '<path d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.6h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.2z"/><path d="M12 22c2.7 0 4.9-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1a6 6 0 0 1-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9z"/><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6A6 6 0 0 1 12 6z"/>'
};

export function icon(name) {
  const path = ICONS[name] || ICONS.sparkle;
  return `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${path}</svg>`;
}

/* ------------------------------------------------------------------ chrome */

const NAV_LINKS = [
  { href: "/index.html", label: "Home", key: "index" },
  { href: "/rooms.html", label: "Rooms", key: "rooms" },
  { href: "/food.html", label: "Dining", key: "food" },
  { href: "/gallery.html", label: "Gallery", key: "gallery" },
  { href: "/about.html", label: "About", key: "about" },
  { href: "/contact.html", label: "Contact", key: "contact" }
];

function socialLinks() {
  const socials = [
    ["facebook", "social.facebook", "M13 22v-9h3l.5-3.5H13V7.4c0-1 .3-1.7 1.8-1.7H17V2.6A24 24 0 0 0 14.2 2.4c-2.8 0-4.7 1.7-4.7 4.8v2.3H6.5V13H9.5v9z"],
    ["instagram", "social.instagram", "M12 2.2c-2.7 0-3 0-4.1.1-1 0-1.8.2-2.4.5a4.8 4.8 0 0 0-1.8 1.1A4.8 4.8 0 0 0 2.6 5.7c-.3.6-.5 1.3-.5 2.4C2 9.2 2 9.5 2 12s0 2.8.1 3.9c0 1 .2 1.8.5 2.4a5 5 0 0 0 1.2 1.8 4.8 4.8 0 0 0 1.8 1.1c.6.3 1.3.5 2.4.5 1.1.1 1.4.1 4.1.1s3 0 4.1-.1c1 0 1.8-.2 2.4-.5a5 5 0 0 0 1.8-1.1 4.8 4.8 0 0 0 1.1-1.8c.3-.6.5-1.3.5-2.4.1-1.1.1-1.4.1-3.9s0-2.8-.1-3.9c0-1-.2-1.8-.5-2.4a4.8 4.8 0 0 0-1.1-1.8 4.8 4.8 0 0 0-1.8-1.1c-.6-.3-1.3-.5-2.4-.5C15 2.2 14.7 2.2 12 2.2zm0 1.8c2.7 0 3 0 4 .1.9 0 1.4.2 1.7.3.5.2.8.4 1.1.7.3.3.5.6.7 1.1.1.3.3.8.3 1.7.1 1 .1 1.3.1 4s0 3-.1 4c0 .9-.2 1.4-.3 1.7-.2.5-.4.8-.7 1.1-.3.3-.6.5-1.1.7-.3.1-.8.3-1.7.3-1 .1-1.3.1-4 .1s-3 0-4-.1c-.9 0-1.4-.2-1.7-.3-.5-.2-.8-.4-1.1-.7a2.9 2.9 0 0 1-.7-1.1c-.1-.3-.3-.8-.3-1.7-.1-1-.1-1.3-.1-4s0-3 .1-4c0-.9.2-1.4.3-1.7.2-.5.4-.8.7-1.1.3-.3.6-.5 1.1-.7.3-.1.8-.3 1.7-.3 1-.1 1.3-.1 4-.1zm0 3.1a4.9 4.9 0 1 0 0 9.8 4.9 4.9 0 0 0 0-9.8zm0 8a3.1 3.1 0 1 1 0-6.2 3.1 3.1 0 0 1 0 6.2zm6.3-8.2a1.15 1.15 0 1 1-2.3 0 1.15 1.15 0 0 1 2.3 0z"],
    ["twitter", "social.twitter", "M18.9 2H22l-6.9 7.9L22.6 22h-6.3l-4.4-6-5 6H2l7.3-8.4L1.9 2h6.5l4 5.5zM17 20h1.8L7 4H5.1z"],
    ["youtube", "social.youtube", "M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.8 12 4.8 12 4.8s-6.8 0-8.5.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1.1 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.7.4 8.5.4 8.5.4s6.8 0 8.5-.4a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .4-4.8 29 29 0 0 0-.4-4.8zM9.8 15.3V8.7l5.7 3.3z"]
  ];
  return socials
    .filter(([, key]) => settingValue(key, "") !== "")
    .map(([, key, path]) => `<a href="${esc(settingValue(key))}" target="_blank" rel="noopener" aria-label="${key.split(".")[1]}"><svg viewBox="0 0 24 24">${path}</svg></a>`)
    .join("");
}

function renderTopbar() {
  const host = qs("#topbar");
  if (!host) return;
  const whatsapp = settingValue("social.whatsapp");
  host.className = "topbar";
  host.innerHTML = `<div class="container">
    <div class="topbar-left">
      <span class="topbar-item">${icon("phone")}<a href="tel:${esc(settingValue("site.phone"))}">${esc(settingValue("site.phone"))}</a></span>
      <span class="topbar-item">${icon("mail")}<a href="mailto:${esc(settingValue("site.email"))}">${esc(settingValue("site.email"))}</a></span>
      <span class="topbar-item">${icon("clock")}${esc(settingValue("site.workingHours", "Reception open 24 x 7"))}</span>
    </div>
    <div class="topbar-right">
      ${whatsapp ? `<span class="topbar-item">${icon("pin")}<a href="https://wa.me/${esc(whatsapp.replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a></span>` : ""}
      <div class="topbar-social">${socialLinks()}</div>
    </div>
  </div>`;
  qsa(".topbar-item svg", host).forEach((s) => { s.style.width = "13px"; s.style.height = "13px"; s.style.fill = "var(--primary)"; });
}

function renderHeader(page, overHero) {
  const host = qs("#siteHeader");
  if (!host) return;
  const logo = settingValue("site.logo", "/assets/logo.svg");
  const logoLight = settingValue("site.logoLight", "/assets/logo-light.svg");
  const user = auth.user;

  const roomCats = state.categories.filter((c) => c.type === "Room");
  const foodCats = state.categories.filter((c) => c.type === "Food");

  // Only float the header over the hero when there is actually a hero to sit on.
  const heroMode = overHero && flag("hero.enabled", true);
  host.className = "header" + (heroMode ? " over-hero" : "");
  document.body.classList.toggle("hero-header", heroMode);
  host.innerHTML = `
    <div class="container-fluid header-inner"style="padding-inline:15px">
      <a href="/index.html" class="brand" aria-label="${esc(settingValue("site.name"))} home">
        <img class="brand-logo-dark" src="${esc(logo)}" alt="${esc(settingValue("site.name"))}">
        <img class="brand-logo-light" src="${esc(logoLight)}" alt="${esc(settingValue("site.name"))}">
      </a>

      <nav class="nav" aria-label="Main">
        ${NAV_LINKS.map((l) => {
          const drop = l.key === "rooms" ? roomCats : l.key === "food" ? foodCats : null;
          if (!drop?.length) {
            return `<a class="nav-link ${page === l.key ? "active" : ""}" href="${l.href}">${l.label}</a>`;
          }
          const target = l.key === "rooms" ? "/rooms.html" : "/food.html";
          const param = l.key === "rooms" ? "category" : "category";
          return `<div class="nav-drop">
            <a class="nav-link ${page === l.key ? "active" : ""}" href="${target}">${l.label}</a>
            <div class="nav-drop-menu">
              <a href="${target}">All ${l.label.toLowerCase()}</a>
              ${drop.map((c) => `<a href="${target}?${param}=${encodeURIComponent(c.slug)}">${esc(c.name)}</a>`).join("")}
            </div>
          </div>`;
        }).join("")}
        ${auth.isLoggedIn ? `<a class="nav-link" href="/my-account.html">My Account</a>` : ""}
        ${auth.isAdmin ? `<a class="nav-link" href="/admin/">Admin Panel</a>` : ""}
      </nav>

      <div class="header-actions">
        <a class="header-phone" href="tel:${esc(settingValue("site.phone"))}">${icon("phone")}<span>${esc(settingValue("site.phone"))}</span></a>
        ${user ? `<button class="user-chip" id="userChip" aria-haspopup="true">
            ${user.avatarUrl ? `<img src="${esc(user.avatarUrl)}" alt="">` : `<span class="ini">${esc(initials(user.fullName))}</span>`}
            <span>${esc(user.fullName.split(" ")[0])}</span>
          </button>` : `<a class="btn btn-sm btn-outline" href="/login.html">Sign in</a>`}
        <a class="btn btn-sm" href="/booking.html">Book now</a>
        <button class="burger" id="burger" aria-label="Open menu" aria-expanded="false"><span></span><span></span><span></span></button>
      </div>
    </div>

    <div class="drawer" id="drawer" role="dialog" aria-label="Menu">
      <div class="drawer-head">
        <img src="${esc(logo)}" alt="" style="height:40px">
        <button class="drawer-close" id="drawerClose" aria-label="Close menu">&times;</button>
      </div>
      <div class="drawer-body">
        ${NAV_LINKS.map((l) => `<a class="nav-link" href="${l.href}">${l.label}</a>`).join("")}
        <a class="nav-link" href="/booking.html">Book your stay</a>
        ${auth.isLoggedIn ? `<a class="nav-link" href="/my-account.html">My Account</a>` : `<a class="nav-link" href="/login.html">Sign in</a><a class="nav-link" href="/register.html">Create account</a>`}
        ${auth.isAdmin ? `<a class="nav-link" href="/admin/">Admin Panel</a>` : ""}
        <div class="mt-3 flex" style="flex-direction:column">
          <a class="btn btn-block" href="/booking.html">Check availability</a>
          <a class="btn btn-block btn-outline" href="tel:${esc(settingValue("site.phone"))}">Call ${esc(settingValue("site.phone"))}</a>
        </div>
        <div class="footer-social mt-3">${socialLinks()}</div>
      </div>
    </div>

    <div class="overlay" id="drawerOverlay"></div>`;

  // mobile drawer
  const drawer = qs("#drawer", host);
  const overlay = qs("#drawerOverlay", host);
  const burger = qs("#burger", host);
  const toggle = (open) => {
    drawer.classList.toggle("open", open);
    burger.classList.toggle("active", open);
    burger.setAttribute("aria-expanded", String(open));
    overlay.classList.toggle("show", open);
    document.body.classList.toggle("nav-open", open);
  };
  burger.onclick = () => toggle(!drawer.classList.contains("open"));
  qs("#drawerClose", host).onclick = () => toggle(false);
  overlay.onclick = () => toggle(false);
  qsa(".drawer .nav-link", host).forEach((a) => (a.onclick = () => toggle(false)));

  // user menu
  const chip = qs("#userChip", host);
  if (chip) {
    chip.onclick = (e) => {
      e.stopPropagation();
      const existing = qs("#userMenu");
      if (existing) { existing.remove(); return; }
      const menu = document.createElement("div");
      menu.id = "userMenu";
      menu.style.cssText = "position:absolute;right:20px;top:calc(100% - 4px);min-width:230px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;box-shadow:var(--shadow-lg);padding:10px;z-index:130";
      menu.innerHTML = `
        <div style="padding:10px 12px;border-bottom:1px solid var(--border);margin-bottom:8px">
          <strong style="display:block;color:var(--heading)">${esc(user.fullName)}</strong>
          <span class="small muted">${esc(user.email)}</span>
        </div>
        <a class="nav-drop-menu" href="/my-account.html" style="display:block;padding:9px 12px;border-radius:8px;color:var(--text)">My account</a>
        <a href="/my-account.html?tab=bookings" style="display:block;padding:9px 12px;border-radius:8px;color:var(--text)">My bookings</a>
        <a href="/food.html" style="display:block;padding:9px 12px;border-radius:8px;color:var(--text)">Order food</a>
        ${auth.isAdmin ? `<a href="/admin/" style="display:block;padding:9px 12px;border-radius:8px;color:var(--text)">Admin panel</a>` : ""}
        <button id="signOutBtn" style="width:100%;text-align:left;padding:9px 12px;border-radius:8px;border:0;background:none;cursor:pointer;font-family:var(--font);font-size:.93rem;color:#a53129">Sign out</button>`;
      host.style.position = host.style.position || "sticky";
      host.appendChild(menu);
      qs("#signOutBtn", menu).onclick = () => {
        auth.clear();
        toast("Signed out. See you soon!", "info");
        setTimeout(() => location.href = "/index.html", 700);
      };
      document.addEventListener("click", () => menu.remove(), { once: true });
    };
  }

  // sticky behaviours
  const onScroll = () => {
    const y = window.scrollY;
    host.classList.toggle("is-scrolled", y > 40);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // mobile nav dropdowns
  qsa(".nav-drop", host).forEach((drop) => {
    const link = drop.querySelector(".nav-link");
    link.addEventListener("click", (e) => {
      if (window.innerWidth > 1100) return;
      e.preventDefault();
      drop.classList.toggle("open");
    });
  });
}

function renderFooter() {
  const host = qs("#siteFooter");
  if (!host) return;

  const about = content("footer", "about");
  const news = content("footer", "newsletterTitle");
  const address = settingValue("site.address");
  const mapUrl = state.mapEmbedUrl;

  host.className = "footer";
  host.innerHTML = `<div class="container">
    <div class="footer-grid">
      <div class="footer-about">
        <img src="${esc(settingValue("site.logoLight", "/assets/logo-light.svg"))}" alt="${esc(settingValue("site.name"))}">
        <p>${esc(about?.body || settingValue("site.shortAbout"))}</p>
        <div class="footer-social">${socialLinks()}</div>
      </div>

      <div>
        <h4>Explore</h4>
        <ul class="footer-links">
          <li><a href="/rooms.html">Rooms &amp; Suites</a></li>
          <li><a href="/food.html">Restaurant</a></li>
          <li><a href="/gallery.html">Gallery</a></li>
          <li><a href="/about.html">About us</a></li>
          <li><a href="/booking.html">Book a stay</a></li>
          <li><a href="/my-account.html">My bookings</a></li>
        </ul>
      </div>

      <div>
        <h4>Guest Services</h4>
        <ul class="footer-links">
          <li><a href="/contact.html">Contact us</a></li>
          <li><a href="/food.html">Order food</a></li>
          <li><a href="/about.html">Spa &amp; facilities</a></li>
          <li><a href="/contact.html">Weddings &amp; events</a></li>
          <li><a href="/login.html">Guest sign in</a></li>
          <li><a href="/register.html">Create account</a></li>
        </ul>
      </div>

      <div>
        <h4>Reach Us</h4>
        <ul class="info-list" style="gap:12px">
          <li>${icon("pin")}<div><span>${esc(address)}</span></div></li>
          <li>${icon("phone")}<div><span><a href="tel:${esc(settingValue("site.phone"))}">${esc(settingValue("site.phone"))}</a>${settingValue("site.phone2") ? ` &middot; <a href="tel:${esc(settingValue("site.phone2"))}">${esc(settingValue("site.phone2"))}</a>` : ""}</span></div></li>
          <li>${icon("mail")}<div><span><a href="mailto:${esc(settingValue("site.email"))}">${esc(settingValue("site.email"))}</a></span></div></li>
          <li>${icon("clock")}<div><span>Check-in ${esc(settingValue("site.checkInTime", "2:00 PM"))} &middot; Check-out ${esc(settingValue("site.checkOutTime", "11:00 AM"))}</span></div></li>
        </ul>
        ${mapUrl && flag("site.mapEnabled", true) ? `<a class="btn btn-sm btn-outline-light mt-2" href="${esc(mapUrl)}" target="_blank" rel="noopener">Open in Google Maps</a>` : ""}
      </div>
    </div>

    <div class="footer-grid" style="grid-template-columns:1fr;margin-top:44px">
      <div>
        <h4>${esc(news?.title || "Join our list")}</h4>
        <p class="small">${esc(news?.subtitle || "")}</p>
        <form class="newsletter-form" id="footerNewsletter">
          <input type="email" name="email" placeholder="Your email address" required aria-label="Email address">
          <button class="btn" type="submit">Subscribe</button>
        </form>
        <div id="newsletterMsg" class="mt-1 small"></div>
      </div>
    </div>

    <div class="footer-bottom">
      <span>${esc(settingValue("site.copyright", ""))}</span>
      <span class="flex" style="gap:18px">
        <a href="/about.html">Privacy</a><a href="/about.html">Terms</a><a href="/contact.html">Support</a>
      </span>
    </div>
  </div>`;

  qsa(".info-list svg", host).forEach((s) => { s.style.color = "var(--primary)"; });

  qs("#footerNewsletter", host).onsubmit = async (e) => {
    e.preventDefault();
    const input = e.target.querySelector("input");
    const msg = qs("#newsletterMsg", host);
    try {
      const res = await api("/api/public/newsletter", { method: "POST", body: { email: input.value } });
      msg.innerHTML = `<span style="color:#8fe0b6">${esc(res.message)}</span>`;
      input.value = "";
    } catch (err) {
      msg.innerHTML = `<span style="color:#ffb4ac">${esc(err.message)}</span>`;
    }
  };
}

/* -------------------------------------------------------------- behaviours */

/* Headlines are split into masked words so each one can rise on its own.
   Only text-only nodes are touched, and only once. */
const SPLIT_SELECTOR = ".section-head h1, .section-head h2, .section-title, .page-head h1";
const FINE_POINTER = typeof matchMedia === "function" ? matchMedia("(hover: hover) and (pointer: fine)") : null;

function prepareSplits(scope = document) {
  qsa(SPLIT_SELECTOR, scope).forEach((el) => {
    if (el.dataset.split === "done" || el.children.length) return;
    const text = (el.textContent || "").trim();
    if (!text || text.length > 200) return;
    el.dataset.split = "done";
    // A headline that already animates as a block hands the motion to the words.
    if (el.hasAttribute("data-anim")) el.classList.add("is-split");
    else el.setAttribute("data-anim", "mask");
    el.innerHTML = text.split(/\s+/)
      .map((word, i) => `<span class="w" style="--i:${i}"><span class="wi">${esc(word)}</span></span>`)
      .join(" ");
  });
}

/* Cards lean towards the cursor and carry a gold spotlight. Fine pointers only. */
function initTilt(scope = document) {
  if (!FINE_POINTER || !FINE_POINTER.matches || !flag("theme.animationsEnabled", true)) return;
  qsa(".card, .testimonial, .gallery-item", scope).forEach((el) => {
    if (el.dataset.tilt === "on") return;
    el.dataset.tilt = "on";
    let frame = 0;
    let px = 0.5;
    let py = 0.5;
    const apply = () => {
      frame = 0;
      el.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      el.style.setProperty("--my", (py * 100).toFixed(1) + "%");
      el.style.setProperty("--ry", ((px - 0.5) * 7).toFixed(2) + "deg");
      el.style.setProperty("--rx", ((0.5 - py) * 7).toFixed(2) + "deg");
    };
    el.addEventListener("pointermove", (event) => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      px = (event.clientX - box.left) / box.width;
      py = (event.clientY - box.top) / box.height;
      el.classList.add("is-tilting");
      if (!frame) frame = requestAnimationFrame(apply);
    }, { passive: true });
    el.addEventListener("pointerleave", () => {
      el.classList.remove("is-tilting");
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    });
  });
}

export function initReveal() {
  prepareSplits(document);
  const nodes = qsa("[data-anim]");
  if (!flag("theme.animationsEnabled", true) || !("IntersectionObserver" in window)) {
    nodes.forEach((n) => n.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -60px 0px" });
    nodes.forEach((n) => io.observe(n));
  }
  initTilt(document);
}

export function initRevealWithin(scope) {
  prepareSplits(scope);
  if (!flag("theme.animationsEnabled", true)) {
    qsa("[data-anim]", scope).forEach((n) => n.classList.add("in"));
    initTilt(scope);
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } });
  }, { threshold: 0.1 });
  qsa("[data-anim]", scope).forEach((n) => io.observe(n));
  initTilt(scope);
}

function initBackToTop() {
  const btn = document.createElement("button");
  btn.className = "to-top";
  btn.setAttribute("aria-label", "Back to top");
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 5l7 7-1.4 1.4L13 8.8V20h-2V8.8l-4.6 4.6L5 12z"/></svg>`;
  btn.onclick = () => window.scrollTo({ top: 0, behavior: "smooth" });
  document.body.appendChild(btn);
  window.addEventListener("scroll", () => btn.classList.toggle("show", window.scrollY > 500), { passive: true });
}

function initWhatsapp() {
  const number = settingValue("social.whatsapp", "").replace(/\D/g, "");
  if (!number) return;
  const a = document.createElement("a");
  a.className = "whatsapp-fab";
  a.href = `https://wa.me/${number}`;
  a.target = "_blank";
  a.rel = "noopener";
  a.setAttribute("aria-label", "Chat on WhatsApp");
  a.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1a12 12 0 0 1-5.9-5.2c-.4-.7-.7-1.5-.7-2.3 0-.8.4-1.5.8-1.8.2-.2.4-.3.6-.3h.5c.2 0 .4 0 .6.4l.7 1.7c.1.2 0 .4-.1.6l-.3.4c-.1.2-.3.3-.1.6.5.9 1.6 1.9 2.6 2.4.3.1.5.1.6-.1l.5-.6c.2-.2.3-.2.6-.1l1.6.8c.3.1.4.2.4.4s0 .7-.1 1z"/></svg>`;
  document.body.appendChild(a);
}

function injectLoader() {
  const loader = document.createElement("div");
  loader.className = "page-loader";
  loader.id = "pageLoader";
  loader.innerHTML = `<img class="mark" src="${settingValue("site.favicon", "/assets/favicon.svg")}" alt="">`;
  document.body.appendChild(loader);
}
function hideLoader() {
  const loader = qs("#pageLoader");
  if (!loader) return;
  setTimeout(() => {
    loader.classList.add("done");
    setTimeout(() => loader.remove(), 600);
  }, 240);
}

/* --------------------------------------------------------------- page head */

export function renderPageHead({ title, subtitle, image, crumbs = [] }) {
  const host = qs("#pageHead");
  if (!host) return;
  host.className = "page-head";
  host.innerHTML = `${image ? `<img src="${esc(image)}" alt="">` : ""}
    <div class="container">
      <h1 data-anim="up">${esc(title)}</h1>
      ${subtitle ? `<p data-anim="up" data-delay="1">${esc(subtitle)}</p>` : ""}
      ${crumbs.length ? `<div class="breadcrumb">${crumbs.map((c, i) => i === crumbs.length - 1 ? `<span>${esc(c.label)}</span>` : `<a href="${esc(c.href)}">${esc(c.label)}</a><span>/</span>`).join("")}</div>` : ""}
    </div>`;
}

/* ------------------------------------------------------------ section heads */

export function sectionHeading(pageKey, sectionKey, { eyebrow = "", align = "center" } = {}) {
  const block = content(pageKey, sectionKey);
  if (!block) return "";
  return `<div class="section-head ${align === "left" ? "left" : ""}" data-anim="up">
    ${eyebrow ? `<span class="eyebrow sym">${esc(eyebrow)}</span>` : ""}
    <h2 class="section-title">${esc(block.title || "")}</h2>
    ${block.subtitle ? `<p class="section-sub">${esc(block.subtitle)}</p>` : ""}
  </div>`;
}

/* ----------------------------------------------------------------- counters */

export function initCounters(scope = document) {
  const nodes = qsa("[data-count]", scope);
  if (!nodes.length) return;
  const still = !flag("theme.animationsEnabled", true)
    || (typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  const render = (node, value) => {
    node.textContent = Math.round(value).toLocaleString("en-IN") + (node.dataset.suffix || "");
  };
  const run = (node) => {
    const target = num(node.dataset.count);
    if (still) { render(node, target); return; }
    const duration = 1800;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      render(node, target * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
  }, { threshold: 0.4 });
  nodes.forEach((n) => io.observe(n));
}

/* --------------------------------------------------------------- hero build */

export function buildHero(host) {
  if (!host || !flag("hero.enabled", true)) { if (host) host.remove(); return null; }

  const bgType = settingValue("hero.backgroundType", "Carousel");
  const slides = state.carousel;
  const interval = num(settingValue("hero.slideInterval", "6000"), 6000);
  const scrollText = settingValue("hero.scrollDownText", "Explore");

  let mediaHtml = "";
  let slideCount = 0;

  if (bgType === "Video" && settingValue("hero.videoUrl")) {
    const url = settingValue("hero.videoUrl");
    const isYt = /youtube|youtu\.be|vimeo/i.test(url);
    mediaHtml = isYt
      ? `<div class="hero-slide active"><iframe src="${esc(url)}${url.includes("?") ? "&" : "?"}autoplay=1&mute=1&loop=1&controls=0&playsinline=1" allow="autoplay; encrypted-media" title="Resort film"></iframe></div>`
      : `<div class="hero-slide active"><video src="${esc(url)}" autoplay muted loop playsinline poster="${esc(settingValue("hero.backgroundImage"))}"></video></div>`;
    slideCount = 1;
  } else if (bgType === "Image") {
    mediaHtml = `<div class="hero-slide active kenburns"><img src="${esc(settingValue("hero.backgroundImage", "/assets/hero.svg"))}" alt=""></div>`;
    slideCount = 1;
  } else if (slides.length) {
    mediaHtml = slides.map((s, i) => {
      const active = i === 0 ? " active kenburns" : "";
      if (s.mediaType === "YouTube" || s.mediaType === "Video") {
        const isYt = /youtube|youtu\.be|vimeo/i.test(s.mediaUrl || "");
        const inner = isYt
          ? `<iframe src="${esc(s.mediaUrl)}${(s.mediaUrl || "").includes("?") ? "&" : "?"}autoplay=1&mute=1&loop=1&controls=0&playsinline=1" allow="autoplay; encrypted-media" title="${esc(s.title || "")}"></iframe>`
          : `<video src="${esc(s.mediaUrl)}" autoplay muted loop playsinline poster="${esc(s.posterUrl || "")}"></video>`;
        return `<div class="hero-slide${active}" data-media="video">${inner}</div>`;
      }
      return `<div class="hero-slide${active}"><img src="${esc(s.mediaUrl || settingValue("hero.backgroundImage", "/assets/hero.svg"))}" alt="${esc(s.title || "")}"></div>`;
    }).join("");
    slideCount = slides.length;
  } else {
    mediaHtml = `<div class="hero-slide active kenburns"><img src="${esc(settingValue("hero.backgroundImage", "/assets/hero.svg"))}" alt=""></div>`;
    slideCount = 1;
  }

  const first = slides[0] || {};
  const title = first.title || settingValue("site.tagline");
  const subtitle = first.subtitle || settingValue("site.shortAbout");
  const btnText = first.buttonText || "Book your stay";
  const btnLink = first.buttonLink || "/booking.html";
  const btn2Text = first.button2Text || "Explore rooms";
  const btn2Link = first.button2Link || "/rooms.html";

  host.className = "hero";
  host.innerHTML = `
    <div class="hero-slides">${mediaHtml}</div>
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <div class="container">
        <div class="hero-anim">
          <span class="hero-badge">${icon("sparkle")} ${esc(settingValue("site.tagline", "Welcome"))}</span>
          <h1 class="hero-title">${esc(title)}</h1>
          <p class="hero-sub">${esc(subtitle)}</p>
          <div class="hero-actions">
            <a class="btn btn-lg" href="${esc(btnLink)}">${esc(btnText)}</a>
            <a class="btn btn-lg btn-outline-light" href="${esc(btn2Link)}">${esc(btn2Text)}</a>
          </div>
        </div>
      </div>
    </div>
    ${slideCount > 1 ? `
      <button class="hero-arrow prev" aria-label="Previous slide"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M15 5l-7 7 7 7 1.4-1.4L10.8 12l5.6-5.6z"/></svg></button>
      <button class="hero-arrow next" aria-label="Next slide"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M9 5l7 7-7 7-1.4-1.4L13.2 12 7.6 6.4z"/></svg></button>
      <div class="hero-dots">${slides.map((_, i) => `<button class="hero-dot ${i === 0 ? "active" : ""}" data-slide="${i}" aria-label="Slide ${i + 1}"></button>`).join("")}</div>` : ""}
    <div class="hero-scroll"><span>${esc(scrollText)}</span><i></i></div>`;

  qs(".hero-badge svg", host)?.setAttribute("width", "14");

  const slideNodes = qsa(".hero-slide", host);
  const dots = qsa(".hero-dot", host);
  const dotsHost = qs(".hero-dots", host);
  if (dotsHost) dotsHost.style.setProperty("--hero-interval", Math.max(2500, interval) + "ms");
  let index = 0;
  let timer;

  const show = (i) => {
    if (!slideNodes.length) return;
    index = (i + slideNodes.length) % slideNodes.length;
    slideNodes.forEach((n, k) => {
      n.classList.toggle("active", k === index);
      if (k === index && n.dataset.media !== "video") {
        n.classList.remove("kenburns");
        void n.offsetWidth;
        n.classList.add("kenburns");
      }
    });
    dots.forEach((d, k) => d.classList.toggle("active", k === index));
  };

  if (slideCount > 1) {
    const next = () => show(index + 1);
    const prev = () => show(index - 1);
    qs(".hero-arrow.next", host).onclick = () => { next(); restart(); };
    qs(".hero-arrow.prev", host).onclick = () => { prev(); restart(); };
    dots.forEach((d) => (d.onclick = () => { show(num(d.dataset.slide)); restart(); }));
    const start = () => { timer = setInterval(next, Math.max(2500, interval)); };
    const restart = () => { clearInterval(timer); start(); };
    start();
    document.addEventListener("visibilitychange", () => document.hidden ? clearInterval(timer) : restart());

    // touch swipe
    let x0 = null;
    host.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    host.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) { dx < 0 ? next() : prev(); restart(); }
      x0 = null;
    }, { passive: true });
  }

  return { show, next: () => show(index + 1), prev: () => show(index - 1), count: slideCount };
}

/* ------------------------------------------------------------- video embed */

export function videoBlock(url, poster) {
  if (!url) return "";
  const isYt = /youtube|youtu\.be|vimeo/i.test(url);
  if (!isYt) {
    return `<div class="video-embed" data-video-src="${esc(url)}">
      <img src="${esc(poster || settingValue("hero.backgroundImage", "/assets/hero.svg"))}" alt="Play the resort film">
      <span class="video-play"><svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5l12 7-12 7z"/></svg></span>
    </div>`;
  }
  return `<div class="video-embed" data-video-src="${esc(url)}" data-yt="1">
    <img src="${esc(poster || settingValue("hero.backgroundImage", "/assets/hero.svg"))}" alt="Play the resort film">
    <span class="video-play"><svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5l12 7-12 7z"/></svg></span>
  </div>`;
}

export function initVideoEmbeds() {
  qsa(".video-embed").forEach((node) => {
    node.onclick = () => {
      const src = node.dataset.videoSrc;
      if (!src) return;
      const isYt = node.dataset.yt === "1" || /youtube|youtu\.be|vimeo/i.test(src);
      node.innerHTML = isYt
        ? `<iframe src="${esc(src)}${src.includes("?") ? "&" : "?"}autoplay=1" allow="autoplay; encrypted-media; fullscreen" allowfullscreen title="Resort film"></iframe>`
        : `<video src="${esc(src)}" controls autoplay playsinline></video>`;
    };
  });
}

/* ----------------------------------------------------------------- helpers */

export function amenitiesChips(amenities, limit = 4) {
  const list = Array.isArray(amenities) ? amenities : [];
  const shown = list.slice(0, limit);
  const extra = list.length - shown.length;
  return `<div class="chips">${shown.map((a) => `<span class="chip">${icon("check")}${esc(a)}</span>`).join("")}
    ${extra > 0 ? `<span class="chip">+${extra} more</span>` : ""}</div>`;
}

export function roomCard(room) {
  const image = room.coverImage || (room.images && room.images[0]) || "/assets/placeholder.svg";
  const discount = room.discountPercent > 0;
  return `<article class="card" data-anim="up">
    <div class="card-media">
      <img src="${esc(image)}" alt="${esc(room.name)}" loading="lazy">
      ${discount ? `<span class="ribbon">${num(room.discountPercent)}% off</span>` : (room.isFeatured ? `<span class="ribbon gold">Popular</span>` : "")}
      ${room.availableUnits === 0 ? `<span class="ribbon right dark">Sold out</span>` : (room.availableUnits > 0 && room.availableUnits <= 2 ? `<span class="ribbon right dark">${room.availableUnits} left</span>` : "")}
    </div>
    <div class="card-body">
      <span class="small muted">${esc(room.category || "Room")}</span>
      <h3 class="card-title"><a href="/room-details.html?room=${encodeURIComponent(room.slug)}">${esc(room.name)}</a></h3>
      <p class="card-text">${esc(room.shortDescription || "")}</p>
      ${amenitiesChips(room.amenities, 3)}
      <div class="card-foot">
        <span class="price">${money(room.finalPrice)} <small>/ night</small>${discount ? `<del>${money(room.pricePerNight, { bare: true })}</del>` : ""}</span>
        <a class="btn btn-sm" href="/booking.html?room=${encodeURIComponent(room.slug)}">Book</a>
      </div>
    </div>
  </article>`;
}

export function foodCard(item) {
  const price = item.discountPrice ?? item.price;
  return `<article class="card" data-anim="up">
    <div class="card-media" style="aspect-ratio:3/2">
      <img src="${esc(item.imageUrl || "/assets/placeholder.svg")}" alt="${esc(item.name)}" loading="lazy">
      ${item.discountPrice ? `<span class="ribbon">Offer</span>` : item.isFeatured ? `<span class="ribbon gold">Chef's pick</span>` : ""}
    </div>
    <div class="card-body">
      <div class="flex items-center justify-between" style="gap:8px">
        <span class="flex items-center" style="gap:8px">
          <span class="veg-dot ${item.isVeg ? "" : "nonveg"}" title="${item.isVeg ? "Vegetarian" : "Non-vegetarian"}"></span>
          <span class="small muted">${esc(item.category || "")}</span>
        </span>
        ${item.spiceLevel ? `<span class="chip">${esc(item.spiceLevel)}</span>` : ""}
      </div>
      <h3 class="card-title mt-1">${esc(item.name)}</h3>
      <p class="card-text">${esc(item.description || "")}</p>
      <div class="card-foot">
        <span class="price">${money(price)} ${item.discountPrice ? `<del>${money(item.price, { bare: true })}</del>` : ""}</span>
        <button class="btn btn-sm" data-add-food="${item.id}"
          data-food-name="${esc(item.name)}" data-food-price="${price}" data-food-image="${esc(item.imageUrl || "")}">
          ${icon("plus-free")}Add to order</button>
      </div>
    </div>
  </article>`;
}

export function bindFoodCards(scope = document) {
  qsa("[data-add-food]", scope).forEach((btn) => {
    btn.onclick = () => {
      cart.add({
        id: num(btn.dataset.addFood),
        name: btn.dataset.foodName,
        price: num(btn.dataset.foodPrice),
        image: btn.dataset.foodImage
      });
    };
  });
}

export function pagination(current, pages, onGo) {
  if (pages <= 1) return "";
  const host = document.createElement("div");
  host.className = "pagination";
  const btn = (label, page, opts = {}) => {
    const b = document.createElement("button");
    b.innerHTML = label;
    if (opts.active) b.classList.add("active");
    if (opts.disabled) b.disabled = true;
    b.onclick = () => onGo(page);
    return b;
  };
  host.appendChild(btn("&#8249;", current - 1, { disabled: current === 1 }));
  const windowSize = 2;
  const from = Math.max(1, current - windowSize);
  const to = Math.min(pages, current + windowSize);
  if (from > 1) host.appendChild(btn("1", 1));
  if (from > 2) host.appendChild(Object.assign(document.createElement("span"), { textContent: "…", style: "align-self:center;color:var(--muted)" }));
  for (let i = from; i <= to; i++) host.appendChild(btn(String(i), i, { active: i === current }));
  if (to < pages - 1) host.appendChild(Object.assign(document.createElement("span"), { textContent: "…", style: "align-self:center;color:var(--muted)" }));
  if (to < pages) host.appendChild(btn(String(pages), pages));
  host.appendChild(btn("&#8250;", current + 1, { disabled: current === pages }));
  return host;
}

export function setActiveNav(page) {
  qsa(".nav-link").forEach((a) => a.classList.remove("active"));
  qsa(".nav-link").forEach((a) => {
    const href = a.getAttribute("href") || "";
    if (href.includes(`${page}.html`)) a.classList.add("active");
  });
}

export function mapIframe(height = 430) {
  if (!flag("site.mapEnabled", true)) return "";
  return `<div class="map-frame"><iframe src="${esc(state.mapEmbedUrl)}" loading="lazy" allowfullscreen
    referrerpolicy="no-referrer-when-downgrade" title="Map showing ${esc(settingValue("site.name"))}" style="height:${height}px"></iframe></div>`;
}

export function requireAuth(redirect = true) {
  if (auth.isLoggedIn) return true;
  if (redirect) location.href = "/login.html?next=" + encodeURIComponent(location.pathname + location.search);
  return false;
}
