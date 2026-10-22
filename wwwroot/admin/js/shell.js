/* ==========================================================================
   Jeena Resort & Spa - admin shell
   Login gate, sidebar navigation, hash router and boot sequence.
   ========================================================================== */

import {
  $, $$, S, ROUTES, api, auth, toast, esc, initials, svg, go, loadCategories, num
} from "./core.js";

/* ============================================================ nav model */

export const NAV = [
  {
    group: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard" },
      { key: "reports", label: "Reports" }
    ]
  },
  {
    group: "Front desk",
    items: [
      { key: "bookings", label: "Bookings", badge: () => num(S.dash?.cards?.pendingBookings) },
      { key: "food-orders", label: "Food orders", badge: () => num(S.dash?.cards?.pendingFoodOrders) },
      { key: "messages", label: "Enquiries", badge: () => num(S.dash?.cards?.unreadMessages) },
      { key: "newsletter", label: "Newsletter" }
    ]
  },
  {
    group: "Rooms & dining",
    items: [
      { key: "rooms", label: "Rooms & suites" },
      { key: "room-categories", label: "Room types" },
      { key: "food", label: "Menu items" },
      { key: "food-categories", label: "Menu categories" }
    ]
  },
  {
    group: "Website content",
    items: [
      { key: "pages", label: "Page text" },
      { key: "carousel", label: "Hero carousel" },
      { key: "gallery", label: "Gallery" },
      { key: "facilities", label: "Facilities" },
      { key: "testimonials", label: "Testimonials" },
      { key: "media", label: "Media library" }
    ]
  },
  {
    group: "System",
    items: [
      { key: "users", label: "Users" },
      { key: "audit", label: "Audit log" },
      { key: "settings", label: "Settings" }
    ]
  }
];

export const TITLES = {
  dashboard: ["Dashboard", "Everything happening at the resort right now"],
  reports: ["Reports", "Revenue, occupancy, orders and member analytics"],
  bookings: ["Bookings", "Review, edit and action every reservation"],
  "food-orders": ["Food orders", "Kitchen queue, dining and room-service orders"],
  messages: ["Enquiries", "Website contact form submissions and replies"],
  newsletter: ["Newsletter", "Everyone who subscribed from the website"],
  rooms: ["Rooms & suites", "Inventory, pricing, amenities and photo galleries"],
  "room-images": ["Room gallery", "Photos shown on the room details page"],
  "room-categories": ["Room types", "Group rooms into categories guests can filter by"],
  food: ["Menu items", "Dishes, pricing, availability and food photos"],
  "food-categories": ["Menu categories", "How the menu is grouped for guests"],
  pages: ["Page text", "Every heading, paragraph and label on the website"],
  carousel: ["Hero carousel", "Full-width slides, images, videos and buttons"],
  gallery: ["Gallery", "Photos and videos shown in the media gallery"],
  facilities: ["Facilities", "Resort facilities and the icons they use"],
  testimonials: ["Testimonials", "Guest reviews shown on the website"],
  media: ["Media library", "Upload and manage images, video and documents"],
  users: ["Users", "Customer, staff and administrator accounts"],
  audit: ["Audit log", "Who changed what, and when"],
  settings: ["Settings", "Branding, colours, backgrounds, SEO, email and more"]
};

/* ============================================================== gate */

export function isAdmin() {
  const u = auth.user;
  return !!auth.token && !!u && u.role === "Admin";
}

function showGate(message = "") {
  $("#gate").hidden = false;
  $("#shell").hidden = true;
  const help = $("#gateHelp");
  help.innerHTML = message || "Default demo administrator: <strong>admin@resortwithjeena.com</strong> / <strong>Admin@123</strong>";
}

function showShell() {
  $("#gate").hidden = true;
  $("#shell").hidden = false;
}

function wireGate() {
  const form = $("#gateForm");
  const btn = $("#gateBtn");
  const alertBox = $("#gateAlert");

  $("#gateEye").onclick = () => {
    const input = $("#gatePassword");
    const isPw = input.type === "password";
    input.type = isPw ? "text" : "password";
    $("#gateEye").innerHTML = isPw ? "&#128584;" : "&#128065;";
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    alertBox.innerHTML = "";
    btn.classList.add("is-loading");
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: { email: $("#gateEmail").value.trim(), password: $("#gatePassword").value, rememberMe: true }
      });
      if (res.user?.role !== "Admin") {
        alertBox.innerHTML = `<div class="alert alert-error">That account is a ${esc(res.user?.role || "customer")} account. Only administrators can open this panel.</div>`;
        return;
      }
      auth.save(res.token, res.user);
      S.me = res.user;
      toast(`Welcome back, ${res.user.fullName}`, "success");
      await start();
    } catch (err) {
      const data = err.data;
      if (data?.requiresOtp) {
        alertBox.innerHTML = `<div class="alert alert-warn">${esc(data.message)}</div>`;
      } else {
        alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
      }
    } finally {
      btn.classList.remove("is-loading");
    }
  };
}

/* ============================================================== sidebar */

function renderNav() {
  const host = $("#sideNav");
  const route = currentRoute().key;
  host.innerHTML = NAV.map((g) => `<div class="side-group">
      <span>${esc(g.group)}</span>
      ${g.items.map((it) => {
        const count = it.badge?.() || 0;
        return `<button type="button" class="side-link ${it.key === route ? "active" : ""}" data-nav="${it.key}">
          ${svg(iconFor(it.key))}<span>${esc(it.label)}</span>
          ${count > 0 ? `<span class="badge-dot">${count}</span>` : ""}
        </button>`;
      }).join("")}
    </div>`).join("");

  $$("[data-nav]", host).forEach((b) => (b.onclick = () => {
    go(b.dataset.nav);
    closeSidebar();
  }));
}

function iconFor(key) {
  return {
    dashboard: "grid", reports: "chart", bookings: "cal", "food-orders": "bowl",
    messages: "mail", newsletter: "send", rooms: "bed", "room-categories": "layers",
    food: "bowl", "food-categories": "layers", pages: "text", carousel: "image",
    gallery: "camera", facilities: "sparkle", testimonials: "quote",
    media: "folder", users: "users", audit: "shield", settings: "cog"
  }[key] || "grid";
}

function paintUser() {
  const me = auth.user || {};
  $("#sideName").textContent = me.fullName || "Administrator";
  $("#sideRole").textContent = me.role || "Admin";
  $("#sideAvatar").innerHTML = me.avatarUrl
    ? `<img src="${esc(me.avatarUrl)}" alt="">`
    : esc(initials(me.fullName || "Admin"));
}

function closeSidebar() {
  $("#side").classList.remove("open");
}

/* =============================================================== router */

export function currentRoute() {
  const raw = (location.hash || "#/dashboard").replace(/^#\/?/, "");
  const [key = "dashboard", param = ""] = raw.split("/");
  return { key: key || "dashboard", param: decodeURIComponent(param || "") };
}

export function setTitle(title, sub = "") {
  $("#viewTitle").textContent = title;
  $("#viewSub").textContent = sub;
}

export function refreshNavSoon() {
  renderNav();
}

let routing = false;
let reroutePending = false;

async function renderCurrent() {
  const { key, param } = currentRoute();
  S.route = key;
  const handler = ROUTES[key] || ROUTES.dashboard;
  if (!ROUTES[key]) location.replace("#/dashboard");

  renderNav();
  const [title, sub] = TITLES[key] || [key, ""];
  setTitle(title, sub);

  const host = $("#view");
  host.innerHTML = `<div class="admin-spinner"></div>`;
  try {
    await handler(param, host);
  } catch (err) {
    if (err.status === 401 || err.status === 403) {
      auth.clear?.();
      location.reload();
      return;
    }
    host.innerHTML = `<div class="panel"><div class="panel-body">
      <div class="alert alert-error">${esc(err.message || "Something went wrong.")}</div>
      <button class="btn btn-outline" type="button" id="routeRetry">Try again</button></div></div>`;
    $("#routeRetry").onclick = () => route();
  }
}

/**
 * Route changes that arrive while a screen is still loading are queued rather
 * than dropped, so quickly clicking two menu items always lands on the last one.
 */
async function route() {
  if (routing) { reroutePending = true; return; }
  routing = true;
  try {
    do {
      reroutePending = false;
      await renderCurrent();
    } while (reroutePending);
  } finally {
    routing = false;
    closeSidebar();
  }
}

export const reroute = route;

/* ============================================================== helpers */

/** Small sticky action header used at the top of list screens. */
export function screenHead({ label = "", actions = "" } = {}) {
  return `<div class="panel"><div class="panel-head">
    <div><h2>${esc(label)}</h2></div>
    <div class="toolbar" style="margin:0">${actions}</div>
  </div></div>`;
}

/** Render a searchable / filterable list shell and return the nodes. */
export function listShell({ filters = "", actions = "", body = "" }) {
  return `${actions}
  <div class="panel"><div class="panel-body flush" id="listBody">${body}</div></div>`;
}

/* ============================================================== boot */

export async function start() {
  if (!isAdmin()) {
    showGate();
    return;
  }
  showShell();
  S.me = auth.user;
  paintUser();

  $("#sideLogout").onclick = async () => {
    auth.clear();
    location.reload();
  };

  $("#mainBurger").onclick = () => $("#side").classList.toggle("open");

  $("#quickAdd").onclick = () => openQuickAdd();

  // warm the shared caches
  await Promise.allSettled([loadCategories(), loadDashboardCounts()]);

  if (!location.hash) location.hash = "#/dashboard";
  window.addEventListener("hashchange", route);

  // settings status pill (SMTP configured?)
  paintSmtpPill();

  await route();
}

export async function loadDashboardCounts() {
  try {
    S.dash = await api("/api/admin/dashboard");
    refreshNavSoon();
  } catch {
    /* dashboard cards are optional for navigation */
  }
}

async function paintSmtpPill() {
  const pill = $("#pillSmtp");
  try {
    const status = await api("/api/admin/settings/status");
    const configured = status.emailConfigured ?? status.smtpConfigured;
    pill.textContent = configured ? "SMTP ready" : "SMTP in dev mode";
    pill.className = "pill " + (configured ? "on" : "off");
    pill.title = configured ? "Email is sent through your SMTP server." : "Verification codes are shown in the panel and written to App_Data/outbox.";
  } catch {
    pill.textContent = "";
    pill.className = "pill";
  }
}

function openQuickAdd() {
  const links = [
    ["rooms", "Add a room"], ["food", "Add a menu item"], ["gallery", "Add gallery media"],
    ["carousel", "Add a hero slide"], ["facilities", "Add a facility"], ["testimonials", "Add a testimonial"],
    ["pages", "Edit page text"], ["settings", "Open settings"]
  ];
  import("./core.js").then(({ openPanel }) => {
    openPanel(`<div class="modal sm">
      <div class="modal-head"><h3>Quick add</h3><button class="modal-close" data-close-modal>&times;</button></div>
      <div class="modal-body"><div class="grid-2" style="gap:10px">
        ${links.map(([k, l]) => `<button type="button" class="icon-btn" data-quick="${k}" style="padding:14px;text-align:left">${esc(l)}</button>`).join("")}
      </div></div>
      <div class="modal-foot"><button class="btn btn-outline" data-close-modal>Close</button></div>
    </div>`, {
      onReady: (root) => $$("[data-quick]", root).forEach((b) => (b.onclick = () => {
        const key = b.dataset.quick;
        import("./core.js").then(({ closePanel }) => closePanel());
        go(key, key === "settings" || key === "pages" ? "" : "new");
      }))
    });
  });
}

export function boot() {
  wireGate();
  start();
  if (!isAdmin()) showGate();
}
