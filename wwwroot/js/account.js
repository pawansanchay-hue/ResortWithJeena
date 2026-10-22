import {
  api, initSite, auth, esc, qs, qsa, money, num, icon, fmtDate, fmtDateTime,
  initials, statusBadge, toast, requireAuth, confirmDialog, openModal, closeModal,
  initRevealWithin
} from "./app.js";

await initSite({ page: "account" });

if (!requireAuth(false)) {
  location.href = "/login.html?next=" + encodeURIComponent("/my-account.html");
}

const me = auth.user || {};
const cache = { bookings: [], orders: [], summary: null };

/* ------------------------------------------------------------------ chrome */

qs("#acAvatar").innerHTML = me.avatarUrl
  ? `<img src="${esc(me.avatarUrl)}" alt="">`
  : esc(initials(me.fullName || "Guest"));
qs("#acName").textContent = me.fullName || "My Account";
qs("#acEmail").textContent = me.email || "";
qs("#ovName").textContent = (me.fullName || "guest").split(" ")[0];

/* -------------------------------------------------------------------- tabs */

const params = new URLSearchParams(location.search);
function showTab(name) {
  qsa("[data-tab-panel]").forEach((p) => (p.hidden = p.dataset.tabPanel !== name));
  qsa(".account-tab[data-tab]").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  const url = new URL(location.href);
  url.searchParams.set("tab", name);
  history.replaceState({}, "", url);
}
qsa(".account-tab[data-tab]").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
qsa("[data-goto-tab]").forEach((b) => (b.onclick = (e) => { e.preventDefault(); showTab(b.dataset.gotoTab); }));

/* ---------------------------------------------------------------- sign out */

const signOut = () => {
  auth.clear();
  toast("Signed out. See you soon!", "info");
  setTimeout(() => (location.href = "/index.html"), 700);
};
qs("#acSignOut").onclick = signOut;
qs("#acSignOut2").onclick = signOut;

/* ------------------------------------------------------------------ loader */

async function loadAll() {
  const [summary, bookings, orders] = await Promise.all([
    api("/api/account/summary"),
    api("/api/account/bookings"),
    api("/api/account/orders")
  ]);
  cache.summary = summary;
  cache.bookings = bookings;
  cache.orders = orders;

  auth.updateUser({ ...me, ...summary.user });

  renderStats(summary);
  renderNextStay(bookings);
  renderQuickLinks();
  renderBookings("All");
  renderOrders();
  fillProfile(summary.user);
}

/* ------------------------------------------------------------------- stats */

function renderStats(summary) {
  const s = summary.stats;
  qs("#ovStats").innerHTML = [
    { label: "Total bookings", value: num(s.totalBookings), icon: "cal" },
    { label: "Upcoming stays", value: num(s.upcoming), icon: "clock" },
    { label: "Nights stayed", value: num(s.nightsStayed), icon: "bed" },
    { label: "Total spent", value: money(s.totalSpent), icon: "star", raw: true }
  ].map((c, i) => `<div class="card" style="padding:20px" data-anim="up" data-delay="${i + 1}">
      <div class="feature-icon" style="margin-bottom:10px">${icon(c.icon)}</div>
      <div style="font-size:1.6rem;font-weight:700;color:var(--heading)">${c.raw ? esc(c.value) : c.value}</div>
      <span class="small muted">${esc(c.label)}</span>
    </div>`).join("");
}

function renderNextStay(bookings) {
  const today = new Date().toISOString().slice(0, 10);
  const next = bookings
    .filter((b) => b.checkIn >= today && b.status !== "Cancelled" && b.status !== "CheckedOut")
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];

  if (!next) {
    qs("#ovNext").innerHTML = `<div class="empty"><p><strong>No upcoming stays.</strong></p>
      <p class="small">Ready for a break? Check live availability and book in a couple of minutes.</p>
      <a class="btn mt-2" href="/booking.html">Check availability</a></div>`;
    return;
  }

  qs("#ovNext").innerHTML = `
    <div class="flex flex-wrap" style="gap:18px;align-items:center">
      <img src="${esc(next.roomImage || "/assets/placeholder.svg")}" alt=""
           style="width:150px;height:110px;object-fit:cover;border-radius:12px">
      <div style="flex:1;min-width:220px">
        <div class="flex items-center flex-wrap" style="gap:10px">
          <strong style="font-size:1.15rem">${esc(next.roomName)}</strong>
          ${statusBadge(next.status)}
        </div>
        <p class="mb-1 small muted">${esc(next.bookingCode)} &middot; ${num(next.nights)} night(s) &middot; ${num(next.adults)} adult(s)</p>
        <p class="mb-1">${icon("cal")} ${esc(fmtDate(next.checkIn))} &rarr; ${esc(fmtDate(next.checkOut))}</p>
        <p class="mb-0"><strong>${money(next.totalAmount)}</strong> <span class="small muted">total &middot; ${esc(next.paymentStatus || "")}</span></p>
      </div>
      <div class="flex" style="flex-direction:column;gap:8px">
        <button class="btn btn-sm" type="button" data-detail="${next.id}">View details</button>
        ${next.canCancel ? `<button class="btn btn-sm btn-outline" type="button" data-cancel="${next.id}">Cancel</button>` : ""}
      </div>
    </div>`;
}

function renderQuickLinks() {
  const user = cache.summary?.user || {};
  qs("#ovQuick").innerHTML = `
    <div class="card card-pad">
      <h4>Stay details</h4>
      <ul class="info-list">
        <li>${icon("phone")}<div><strong>Mobile</strong><span>${esc(user.phone || "Not added yet")}</span></div></li>
        <li>${icon("mail")}<div><strong>Email</strong><span>${esc(user.email)} ${user.isEmailVerified ? '<span class="badge badge-green">verified</span>' : '<span class="badge badge-amber">unverified</span>'}</span></div></li>
        <li>${icon("clock")}<div><strong>Member since</strong><span>${esc(fmtDate(user.createdAt))}</span></div></li>
      </ul>
      <button class="btn btn-sm btn-outline" type="button" data-goto-tab="profile">Edit profile</button>
    </div>
    <div class="card card-pad">
      <h4>Popular with members</h4>
      <p class="small muted">Longer stays unlock complimentary upgrades and a spa credit.</p>
      <div class="flex flex-wrap">
        <a class="btn btn-sm" href="/rooms.html">Browse rooms</a>
        <a class="btn btn-sm btn-outline" href="/food.html">See the menu</a>
      </div>
    </div>`;
  qsa("[data-goto-tab]", qs("#ovQuick")).forEach((b) => (b.onclick = () => showTab(b.dataset.gotoTab)));
}

/* ---------------------------------------------------------------- bookings */

qs("#bookingStatusTabs").onclick = (e) => {
  const btn = e.target.closest("[data-status]");
  if (!btn) return;
  qsa(".tab-btn", qs("#bookingStatusTabs")).forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderBookings(btn.dataset.status);
};

function renderBookings(status) {
  const host = qs("#bookingList");
  const items = status === "All" ? cache.bookings : cache.bookings.filter((b) => b.status === status);

  if (!items.length) {
    host.innerHTML = `<div class="empty"><p><strong>No ${status === "All" ? "" : esc(status.toLowerCase())} bookings yet.</strong></p>
      <a class="btn mt-2" href="/booking.html">Book your first stay</a></div>`;
    return;
  }

  host.innerHTML = items.map((b) => `
    <article class="booking-row" data-anim="up">
      <img src="${esc(b.roomImage || "/assets/placeholder.svg")}" alt="">
      <div class="booking-row-body">
        <div class="flex items-center justify-between flex-wrap" style="gap:8px">
          <div>
            <strong style="font-size:1.08rem">${esc(b.roomName)}</strong>
            <span class="small muted" style="display:block">${esc(b.bookingCode)} &middot; booked ${esc(fmtDate(b.createdAt))}</span>
          </div>
          ${statusBadge(b.status)}
        </div>
        <div class="booking-meta">
          <span>${icon("cal")} ${esc(fmtDate(b.checkIn))} &rarr; ${esc(fmtDate(b.checkOut))}</span>
          <span>${icon("bed")} ${num(b.nights)} night(s), ${num(b.roomCount)} room(s)</span>
          <span>${icon("users")} ${num(b.adults)} adult(s), ${num(b.children)} child(ren)</span>
        </div>
        <div class="summary" style="margin:12px 0 0">
          <div class="summary-row"><span>Room</span><span>${money(b.roomAmount)}</span></div>
          ${b.foodAmount ? `<div class="summary-row"><span>Food pre-order</span><span>${money(b.foodAmount)}</span></div>` : ""}
          <div class="summary-row"><span>Taxes</span><span>${money(b.taxAmount)}</span></div>
          <div class="summary-row total"><span>Total (${esc(b.paymentStatus || "")})</span><span>${money(b.totalAmount)}</span></div>
        </div>
      </div>
      <div class="booking-row-actions">
        <button class="btn btn-sm" type="button" data-detail="${b.id}">Details</button>
        ${b.canCancel ? `<button class="btn btn-sm btn-outline" type="button" data-cancel="${b.id}">Cancel booking</button>` : ""}
        <a class="btn btn-sm btn-outline" href="/food.html">Add food</a>
      </div>
    </article>`).join("");

  initRevealWithin(host);
}

/* booking actions (event delegation) */
document.addEventListener("click", async (e) => {
  const detailBtn = e.target.closest("[data-detail]");
  if (detailBtn) { openBooking(Number(detailBtn.dataset.detail)); return; }

  const cancelBtn = e.target.closest("[data-cancel]");
  if (cancelBtn) {
    const id = Number(cancelBtn.dataset.cancel);
    const ok = await confirmDialog(
      "Cancelling is free up to 48 hours before check-in. Do you want to continue?",
      { title: "Cancel this booking?", ok: "Yes, cancel it" });
    if (!ok) return;
    try {
      const res = await api(`/api/account/bookings/${id}/cancel`, { method: "POST" });
      toast(res.message, "success");
      await loadAll();
      showTab("bookings");
    } catch (err) {
      toast(err.message, "error");
    }
  }
});

async function openBooking(id) {
  let back = qs("#bookingModal");
  if (!back) {
    back = document.createElement("div");
    back.className = "modal-back";
    back.id = "bookingModal";
    document.body.appendChild(back);
  }
  back.innerHTML = `<div class="modal"><div class="modal-body"><div class="spinner"></div></div></div>`;
  openModal(back);

  try {
    const b = await api("/api/account/bookings/" + id);
    back.innerHTML = `<div class="modal">
      <div class="modal-head">
        <div><h3 class="mb-0">${esc(b.roomName)}</h3><span class="small muted">${esc(b.bookingCode)}</span></div>
        <button class="modal-close" data-close>&times;</button>
      </div>
      <div class="modal-body">
        <div class="flex items-center flex-wrap" style="gap:10px">${statusBadge(b.status)} ${statusBadge(b.paymentStatus)}</div>
        <img src="${esc(b.roomImage || "/assets/placeholder.svg")}" alt=""
             style="width:100%;height:180px;object-fit:cover;border-radius:14px;margin:14px 0">
        <ul class="info-list">
          <li>${icon("cal")}<div><strong>Dates</strong><span>${esc(fmtDate(b.checkIn))} &rarr; ${esc(fmtDate(b.checkOut))} (${num(b.nights)} nights)</span></div></li>
          <li>${icon("users")}<div><strong>Guests</strong><span>${num(b.adults)} adult(s), ${num(b.children)} child(ren), ${num(b.roomCount)} room(s)</span></div></li>
          <li>${icon("phone")}<div><strong>Contact</strong><span>${esc(b.guestPhone)} &middot; ${esc(b.guestEmail)}</span></div></li>
          ${b.specialRequest ? `<li>${icon("sparkle")}<div><strong>Requests</strong><span>${esc(b.specialRequest)}</span></div></li>` : ""}
        </ul>
        <div class="summary">
          <div class="summary-row"><span>Room charges</span><span>${money(b.roomAmount)}</span></div>
          ${b.foodAmount ? `<div class="summary-row"><span>Food</span><span>${money(b.foodAmount)}</span></div>` : ""}
          <div class="summary-row"><span>Taxes</span><span>${money(b.taxAmount)}</span></div>
          <div class="summary-row total"><span>Total</span><span>${money(b.totalAmount)}</span></div>
        </div>
        ${b.foodOrders?.length ? `<h4 class="mt-3">Food ordered with this stay</h4>
          ${b.foodOrders.map((o) => `<div class="summary">
            <div class="summary-row"><span><strong>${esc(o.orderCode)}</strong> &middot; ${esc(o.orderType)} &middot; ${esc(o.status)}</span><span>${money(o.totalAmount)}</span></div>
            ${o.items.map((it) => `<div class="summary-row"><span>${esc(it.name)} x ${num(it.quantity)}</span><span>${money(it.unitPrice * it.quantity)}</span></div>`).join("")}
          </div>`).join("")}` : ""}
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" data-close>Close</button>
        ${b.status !== "Cancelled" && b.status !== "CheckedOut" ? `<button class="btn" id="modalCancel" data-id="${b.id}">Cancel booking</button>` : ""}
      </div>
    </div>`;

    qsa("[data-close]", back).forEach((btn) => (btn.onclick = () => closeModal(back)));
    qs("#modalCancel", back)?.addEventListener("click", async (ev) => {
      const id2 = Number(ev.target.dataset.id);
      closeModal(back);
      const ok = await confirmDialog("Cancel this reservation?", { title: "Confirm cancellation", ok: "Yes, cancel it" });
      if (!ok) return;
      try {
        const res = await api(`/api/account/bookings/${id2}/cancel`, { method: "POST" });
        toast(res.message, "success");
        await loadAll();
        showTab("bookings");
      } catch (err) { toast(err.message, "error"); }
    });
  } catch (err) {
    back.innerHTML = `<div class="modal"><div class="modal-body"><div class="alert alert-error">${esc(err.message)}</div>
      <button class="btn" data-close>Close</button></div></div>`;
    qsa("[data-close]", back).forEach((btn) => (btn.onclick = () => closeModal(back)));
  }
}

/* --------------------------------------------------------------- orders */

function renderOrders() {
  const host = qs("#orderList");
  if (!cache.orders.length) {
    host.innerHTML = `<div class="empty"><p><strong>No food orders yet.</strong></p>
      <a class="btn mt-2" href="/food.html">Explore the menu</a></div>`;
    return;
  }

  host.innerHTML = cache.orders.map((o) => `
    <article class="card" style="padding:20px" data-anim="up">
      <div class="flex items-center justify-between flex-wrap" style="gap:10px">
        <div>
          <strong>${esc(o.orderCode)}</strong>
          <span class="small muted" style="display:block">${esc(fmtDateTime(o.createdAt))}</span>
        </div>
        <div class="flex items-center flex-wrap" style="gap:8px">
          <span class="chip">${esc(o.orderType)}</span>
          ${statusBadge(o.status)}
        </div>
      </div>
      <div class="summary mt-2">
        ${o.items.map((it) => `<div class="summary-row"><span>${esc(it.name)} x ${num(it.quantity)}</span><span>${money(it.lineTotal)}</span></div>`).join("")}
        <div class="summary-row total"><span>Total</span><span>${money(o.totalAmount)}</span></div>
      </div>
      ${o.notes ? `<p class="small muted mb-0 mt-1">${esc(o.notes)}</p>` : ""}
    </article>`).join("");

  initRevealWithin(host);
}

/* --------------------------------------------------------------- profile */

function fillProfile(user) {
  qs("#pfName").value = user.fullName || "";
  qs("#pfPhone").value = user.phone || "";
  qs("#pfEmail").value = user.email || "";
  qs("#pfAvatar").value = user.avatarUrl || "";
}

qs("#profileForm").onsubmit = async (e) => {
  e.preventDefault();
  const btn = qs("#profileBtn");
  const alertBox = qs("#profileAlert");
  alertBox.innerHTML = "";

  const payload = {
    fullName: qs("#pfName").value.trim(),
    phone: qs("#pfPhone").value.trim(),
    avatarUrl: qs("#pfAvatar").value.trim()
  };
  if (!payload.fullName) {
    alertBox.innerHTML = `<div class="alert alert-error">Your name cannot be empty.</div>`;
    return;
  }

  btn.classList.add("is-loading");
  try {
    const res = await api("/api/auth/profile", { method: "PUT", body: payload });
    auth.updateUser(res.user);
    alertBox.innerHTML = `<div class="alert alert-success">${esc(res.message)}</div>`;
    toast("Profile updated", "success");
    qs("#acAvatar").innerHTML = res.user.avatarUrl ? `<img src="${esc(res.user.avatarUrl)}" alt="">` : esc(initials(res.user.fullName));
    qs("#acName").textContent = res.user.fullName;
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  } finally {
    btn.classList.remove("is-loading");
  }
};

/* -------------------------------------------------------------- security */

qs("#passwordForm").onsubmit = async (e) => {
  e.preventDefault();
  const btn = qs("#passwordBtn");
  const alertBox = qs("#passwordAlert");
  alertBox.innerHTML = "";

  const currentPassword = qs("#cpCurrent").value;
  const newPassword = qs("#cpNew").value;
  const confirm = qs("#cpConfirm").value;

  if (newPassword.length < 6) {
    alertBox.innerHTML = `<div class="alert alert-error">Your new password must be at least 6 characters long.</div>`;
    return;
  }
  if (newPassword !== confirm) {
    alertBox.innerHTML = `<div class="alert alert-error">The two new passwords do not match.</div>`;
    return;
  }

  btn.classList.add("is-loading");
  try {
    const res = await api("/api/auth/change-password", { method: "POST", body: { currentPassword, newPassword } });
    alertBox.innerHTML = `<div class="alert alert-success">${esc(res.message)}</div>`;
    qs("#passwordForm").reset();
    toast("Password changed", "success");
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  } finally {
    btn.classList.remove("is-loading");
  }
};

/* ------------------------------------------------------------------- boot */

const layout = qs("#acLayout");
const mq = window.matchMedia("(max-width: 900px)");
const apply = () => { layout.style.gridTemplateColumns = mq.matches ? "1fr" : "250px 1fr"; };
apply();
mq.addEventListener("change", apply);

try {
  await loadAll();
  showTab(params.get("tab") || "overview");
  initRevealWithin(document);
} catch (err) {
  toast(err.message, "error");
  if (err.status === 401) location.href = "/login.html?next=" + encodeURIComponent("/my-account.html");
}
