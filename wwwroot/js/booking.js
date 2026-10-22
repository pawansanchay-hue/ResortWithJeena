import {
  api, initSite, state, auth, esc, qs, qsa, money, num, icon, flag, settingValue,
  toast, initRevealWithin, todayISO, nights, renderPageHead, content
} from "./app.js";

await initSite({ page: "booking" });

const head = content("booking", "header");
renderPageHead({
  title: head?.title || "Book Your Stay",
  subtitle: head?.subtitle || "",
  image: "/assets/page-header.svg",
  crumbs: [{ label: "Home", href: "/index.html" }, { label: "Booking" }]
});

/* ------------------------------------------------------------- constants */

const minNights = num(settingValue("booking.minNights", "1"), 1);
const maxNights = num(settingValue("booking.maxNights", "30"), 30);
const taxPercent = num(settingValue("booking.taxPercent", "12"), 12);
const currency = settingValue("booking.currencySymbol", "₹");

qs("#minNightsLabel").textContent = minNights;
qs("#callBtn").href = "tel:" + String(settingValue("site.phone")).replace(/\s/g, "");
qs("#callBtn").innerHTML = `${icon("phone")} Call ${esc(settingValue("site.phone"))}`;

const params = new URLSearchParams(location.search);
const preset = { room: params.get("room") || "" };

/* -------------------------------------------------- step 1: dates & guests */

const catSelect = qs("#bkCategory");
state.categories
  .filter((c) => c.type === "Room")
  .forEach((c) => catSelect.insertAdjacentHTML("beforeend", `<option value="${c.id}">${esc(c.name)}</option>`));

const inInput = qs("#bkIn");
const outInput = qs("#bkOut");
inInput.min = todayISO(0);
outInput.min = todayISO(minNights);
inInput.value = params.get("checkIn") || todayISO(1);
outInput.value = params.get("checkOut") || todayISO(1 + minNights);
if (params.get("adults")) qs("#bkAdults").value = params.get("adults");
if (params.get("children")) qs("#bkChildren").value = params.get("children");
if (params.get("categoryId")) catSelect.value = params.get("categoryId");

inInput.onchange = () => {
  const d = new Date(inInput.value || todayISO(1));
  d.setDate(d.getDate() + minNights);
  const min = d.toISOString().slice(0, 10);
  outInput.min = min;
  if (!outInput.value || outInput.value < min) outInput.value = min;
};

/* --------------------------------------------------------------- the state */

const view = {
  step: 1,
  nights: minNights,
  rooms: [],
  selectedId: null,
  food: new Map(), // id -> { item, qty }
  booking: null
};

function goStep(n) {
  view.step = n;
  [1, 2, 3, 4].forEach((k) => {
    const panel = qs(`[data-panel="${k}"]`);
    if (panel) panel.hidden = k !== n;
  });
  qsa("#stepper .step").forEach((li) => {
    const s = num(li.dataset.step);
    li.classList.toggle("active", s === n);
    li.classList.toggle("done", s < n);
  });
  qs("#stepper").hidden = n === 4;
  const aside = qs("#bookingAside");
  if (aside) aside.hidden = n === 4;
  if (n === 4) {
    window.scrollTo({ top: 200, behavior: "smooth" });
  } else {
    qs("#bookingLayout").scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ------------------------------------------------------- step 1 → step 2 */

qs("#step1Form").onsubmit = async (e) => {
  e.preventDefault();
  const alertBox = qs("#step1Alert");
  alertBox.innerHTML = "";
  const btn = qs("#step1Btn");

  const n = nights(inInput.value, outInput.value);
  if (n < minNights) {
    alertBox.innerHTML = `<div class="alert alert-error">Minimum stay is ${minNights} night(s).</div>`;
    return;
  }
  if (n > maxNights) {
    alertBox.innerHTML = `<div class="alert alert-error">Maximum online stay is ${maxNights} nights. Please contact us for longer bookings.</div>`;
    return;
  }

  btn.classList.add("is-loading");
  const query = new URLSearchParams({
    checkIn: inInput.value,
    checkOut: outInput.value,
    adults: qs("#bkAdults").value,
    children: qs("#bkChildren").value
  });

  try {
    const data = await api("/api/public/availability?" + query.toString());
    view.nights = data.nights;
    let rooms = data.rooms;

    const cat = catSelect.value;
    if (cat) {
      rooms = rooms.filter((r) => {
        const full = state.categories.find((c) => String(c.id) === String(cat));
        return !full || r.category === full.name;
      });
    }
    view.rooms = rooms;

    renderAvailRooms();
    goStep(2);
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  } finally {
    btn.classList.remove("is-loading");
  }
};

/* ------------------------------------------------------------ room picker */

function renderAvailRooms() {
  const host = qs("#availRooms");
  const adults = num(qs("#bkAdults").value, 2);
  const children = num(qs("#bkChildren").value, 0);
  const roomCount = num(qs("#bkRooms").value, 1);

  qs("#availSummary").textContent =
    `${view.nights} night(s) - ${adults} adult(s)${children ? `, ${children} child(ren)` : ""} - ` +
    `${inInput.value} to ${outInput.value}`;

  if (!view.rooms.length) {
    host.innerHTML = `<div class="empty"><p><strong>No rooms match those dates and filters.</strong></p>
      <p class="small">Try different dates, fewer guests or another room type.</p>
      <button class="btn btn-outline btn-sm mt-2" type="button" id="emptyBack">Change search</button></div>`;
    qs("#emptyBack").onclick = () => goStep(1);
    qs("#toStep3").disabled = true;
    return;
  }

  host.innerHTML = view.rooms.map((r) => {
    const enough = r.availableUnits >= roomCount;
    const total = r.subtotal * roomCount;
    const tax = Math.round(total * r.taxPercent) / 100;
    return `<label class="room-pick ${enough ? "" : "disabled"}" data-room="${r.roomId}">
      <input type="radio" name="pickRoom" value="${r.roomId}" ${enough ? "" : "disabled"}>
      <img src="${esc(r.coverImage || "/assets/placeholder.svg")}" alt="${esc(r.name)}">
      <div class="room-pick-body">
        <div class="flex items-center justify-between flex-wrap" style="gap:8px">
          <div>
            <strong>${esc(r.name)}</strong>
            <span class="small muted" style="display:block">${esc(r.category || "Room")} &middot; up to ${num(r.maxAdults)} adults, ${num(r.maxChildren)} children</span>
          </div>
          <div class="text-right">
            <span class="price">${money(r.nightlyRate)}<small> / night</small></span>
            ${enough
              ? `<span class="badge badge-green" style="display:block">${num(r.availableUnits)} available</span>`
              : `<span class="badge badge-red" style="display:block">Sold out for these dates</span>`}
          </div>
        </div>
        <div class="summary mt-2" style="margin-bottom:0">
          <div class="summary-row"><span>${money(r.nightlyRate)} x ${view.nights} night(s) x ${roomCount} room(s)</span><span>${money(total)}</span></div>
          <div class="summary-row"><span>Taxes (${num(r.taxPercent)}%)</span><span>${money(tax)}</span></div>
          <div class="summary-row total"><span>Room total</span><span>${money(total + tax)}</span></div>
        </div>
      </div>
    </label>`;
  }).join("");

  const continueBtn = qs("#toStep3");

  if (preset.room) {
    const match = view.rooms.find((r) => r.slug === preset.room);
    if (match && match.availableUnits >= roomCount) {
      const radio = host.querySelector(`input[value="${match.roomId}"]`);
      if (radio) { radio.checked = true; view.selectedId = match.roomId; }
    }
  }
  if (!view.selectedId) {
    const first = host.querySelector("input:not(:disabled)");
    if (first) { first.checked = true; view.selectedId = num(first.value); }
  }

  host.onchange = (e) => {
    const radio = e.target.closest("input[name='pickRoom']");
    if (!radio) return;
    view.selectedId = num(radio.value);
    syncRoomSelection();
  };

  continueBtn.disabled = !view.selectedId;
  syncRoomSelection();
}

function syncRoomSelection() {
  qsa(".room-pick").forEach((n) => n.classList.toggle("selected", num(n.dataset.room) === view.selectedId));
  renderSummary();
  qs("#toStep3").disabled = !view.selectedId;
}

qs("#back1").onclick = () => goStep(1);
qs("#back1b").onclick = () => goStep(1);
qs("#back2").onclick = () => goStep(2);

qs("#toStep3").onclick = () => {
  if (!view.selectedId) return;
  prefillGuest();
  loadAddons();
  goStep(3);
};

/* ------------------------------------------------------ guest prefill + hint */

function prefillGuest() {
  const user = auth.user;
  if (user) {
    qs("#gName").value = user.fullName || "";
    qs("#gEmail").value = user.email || "";
    qs("#gPhone").value = user.phone || "";
    qs("#signInHint").innerHTML = `<div class="alert alert-info">Booking as
      <strong>${esc(user.fullName)}</strong> (${esc(user.email)}).
      This stay will appear in <a href="/my-account.html?tab=bookings">your account</a>.</div>`;
  } else {
    qs("#signInHint").innerHTML = `<div class="alert alert-info">
      <div><strong>Booking as a guest.</strong> Already have an account?
      <a href="/login.html?next=${encodeURIComponent(location.pathname + location.search)}">Sign in</a> to track this stay,
      or <a href="/register.html">create one</a> - it takes 30 seconds.</div></div>`;
  }
}

/* --------------------------------------------------------- food add-ons */

let addonLoaded = false;

async function loadAddons() {
  const grid = qs("#addonGrid");
  const tabs = qs("#addonTabs");

  if (!flag("booking.enableFoodOrdering", true)) {
    grid.innerHTML = `<div class="alert alert-info" style="grid-column:1/-1">Adding food to a booking is switched off. Order from the dining page after check-in.</div>`;
    return;
  }

  const foodCats = state.categories.filter((c) => c.type === "Food");
  if (!addonLoaded) {
    tabs.innerHTML = `<button class="tab-btn active" data-cat="" type="button">Chef's picks</button>` +
      foodCats.map((c) => `<button class="tab-btn" data-cat="${c.id}" type="button">${esc(c.name)}</button>`).join("");
    tabs.onclick = (e) => {
      const btn = e.target.closest("[data-cat]");
      if (!btn) return;
      qsa(".tab-btn", tabs).forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      paintAddons(btn.dataset.cat);
    };
    addonLoaded = true;
  }
  paintAddons("");
}

async function paintAddons(categoryId = "") {
  const grid = qs("#addonGrid");
  grid.innerHTML = `<div class="skeleton" style="height:150px"></div>`.repeat(3);
  try {
    const q = categoryId ? `&categoryId=${categoryId}` : "";
    let items = await api(`/api/public/food?featured=true${q}`);
    if (items.length < 3) items = await api(`/api/public/food?${q.slice(1)}`);
    items = items.slice(0, 6);

    grid.innerHTML = items.map((f) => {
      const price = f.discountPrice ?? f.price;
      const picked = view.food.get(f.id)?.qty || 0;
      return `<div class="addon ${picked ? "on" : ""}" data-food="${f.id}">
        <div class="addon-head">
          <span class="veg-dot ${f.isVeg ? "" : "nonveg"}"></span>
          <strong>${esc(f.name)}</strong>
        </div>
        <span class="small muted">${esc(f.category || "")}</span>
        <div class="flex items-center justify-between mt-1">
          <span class="price">${money(price)}</span>
          <span class="qty" data-id="${f.id}">
            <button type="button" data-act="dec" aria-label="Remove one">&minus;</button>
            <span>${picked}</span>
            <button type="button" data-act="inc" aria-label="Add one">+</button>
          </span>
        </div>
      </div>`;
    }).join("");

    grid.onclick = (e) => {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const wrap = btn.closest(".addon");
      const id = num(wrap.dataset.food);
      const item = items.find((f) => f.id === id);
      if (!item) return;
      const line = view.food.get(id) || { item, qty: 0 };
      line.qty += btn.dataset.act === "inc" ? 1 : -1;
      if (line.qty <= 0) view.food.delete(id);
      else view.food.set(id, line);

      const qtyNode = wrap.querySelector(".qty span");
      qtyNode.textContent = Math.max(0, line.qty);
      wrap.classList.toggle("on", line.qty > 0);
      renderSummary();
    };
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-error" style="grid-column:1/-1">${esc(err.message)}</div>`;
  }
}

/* -------------------------------------------------------------- summary */

function renderSummary() {
  const room = view.rooms.find((r) => r.roomId === view.selectedId);
  const roomCount = num(qs("#bkRooms")?.value, 1);
  const box = qs("#summaryBox");
  const roomHost = qs("#summaryRoom");

  if (!room) {
    roomHost.textContent = "No room selected yet.";
    box.innerHTML = "";
    qs("#foodPickTotal") && (qs("#foodPickTotal").textContent = "Nothing selected");
    return;
  }

  const roomTotal = room.subtotal * roomCount;
  const roomTax = Math.round(roomTotal * room.taxPercent) / 100;
  const foodTotal = [...view.food.values()].reduce(
    (sum, l) => sum + (l.item.discountPrice ?? l.item.price) * l.qty, 0);
  const foodTax = Math.round(foodTotal * room.taxPercent) / 100;
  const total = roomTotal + roomTax + foodTotal + foodTax;

  roomHost.innerHTML = `
    <div class="flex" style="gap:12px;align-items:center">
      <img src="${esc(room.coverImage || "/assets/placeholder.svg")}" alt=""
           style="width:74px;height:58px;object-fit:cover;border-radius:10px">
      <div>
        <strong style="color:var(--heading)">${esc(room.name)}</strong>
        <span class="small muted" style="display:block">${esc(room.category || "Room")} &middot; ${roomCount} room(s)</span>
        <span class="small muted">${inInput.value} &rarr; ${outInput.value}</span>
      </div>
    </div>`;

  box.innerHTML = `
    <div class="summary-row"><span>${money(room.nightlyRate)} x ${view.nights} night(s) x ${roomCount}</span><span>${money(roomTotal)}</span></div>
    <div class="summary-row"><span>Taxes on room (${num(room.taxPercent)}%)</span><span>${money(roomTax)}</span></div>
    ${foodTotal ? `
      <div class="summary-row"><span>Food pre-order</span><span>${money(foodTotal)}</span></div>
      <div class="summary-row"><span>Taxes on food (${num(room.taxPercent)}%)</span><span>${money(foodTax)}</span></div>` : ""}
    <div class="summary-row total"><span>Total payable</span><span>${money(total)}</span></div>
    <p class="small muted mb-0">Advance of ${num(settingValue("booking.advancePercent", "30"), 30)}% may be requested after confirmation.</p>`;

  qs("#summaryPolicy").innerHTML = `
    <li>${icon("clock")}<div><strong>Check-in ${esc(settingValue("site.checkInTime", "2:00 PM"))}</strong><span>Check-out ${esc(settingValue("site.checkOutTime", "11:00 AM"))}</span></div></li>
    <li>${icon("shield")}<div><strong>Free cancellation</strong><span>Up to 48 hours before check-in</span></div></li>`;

  const count = [...view.food.values()].reduce((n, l) => n + l.qty, 0);
  const label = qs("#foodPickTotal");
  if (label) label.textContent = count
    ? `${count} item(s) - ${money(foodTotal)}`
    : "Nothing selected";
}

qs("#bkRooms").onchange = () => {
  if (view.step === 2) renderAvailRooms();
  renderSummary();
};
qs("#bkAdults").onchange = renderSummary;
qs("#bkChildren").onchange = renderSummary;

/* ---------------------------------------------------------------- confirm */

qs("#step3Form").onsubmit = async (e) => {
  e.preventDefault();
  const alertBox = qs("#step3Alert");
  alertBox.innerHTML = "";
  const btn = qs("#bookBtn");

  const name = qs("#gName").value.trim();
  const email = qs("#gEmail").value.trim();
  const phone = qs("#gPhone").value.trim();

  if (!name || !email || !phone) {
    alertBox.innerHTML = `<div class="alert alert-error">Please fill in your name, email and mobile number.</div>`;
    return;
  }
  if (!qs("#agreeTerms").checked) {
    alertBox.innerHTML = `<div class="alert alert-error">Please accept the booking terms to continue.</div>`;
    return;
  }
  if (!view.selectedId) {
    alertBox.innerHTML = `<div class="alert alert-error">Please choose a room first.</div>`;
    return;
  }

  const notes = [qs("#gNotes").value.trim(), `Arrival: ${qs("#gArrival").value}`]
    .filter(Boolean).join(" | ");

  const payload = {
    roomId: view.selectedId,
    checkIn: inInput.value,
    checkOut: outInput.value,
    adults: num(qs("#bkAdults").value, 2),
    children: num(qs("#bkChildren").value, 0),
    roomCount: num(qs("#bkRooms").value, 1),
    guestName: name,
    guestEmail: email,
    guestPhone: phone,
    specialRequest: notes,
    paymentMethod: qs("#gPayment").value,
    foodItems: [...view.food.values()].map((l) => ({ foodItemId: l.item.id, quantity: l.qty }))
  };

  btn.classList.add("is-loading");
  try {
    const res = await api("/api/public/bookings", { method: "POST", body: payload });
    view.booking = res.booking;
    cartItemsClear();
    renderSuccess(res);
    toast("Reservation request sent. Check your email for confirmation.", "success");
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  } finally {
    btn.classList.remove("is-loading");
  }
};

function cartItemsClear() {
  view.food.clear();
}

function renderSuccess(res) {
  const b = res.booking;
  qs("#successTitle").textContent = settingValue("booking.successTitle", "Reservation request received");
  qs("#successMessage").textContent = res.message || "Thank you! Our reservations desk will confirm shortly.";
  qs("#successSummary").innerHTML = `
    <div class="summary-row total"><span>Booking reference</span><span>${esc(b.bookingCode)}</span></div>
    <div class="summary-row"><span>Room</span><span>${esc(b.roomName)}</span></div>
    <div class="summary-row"><span>Dates</span><span>${esc(b.checkIn)} &rarr; ${esc(b.checkOut)} (${num(b.nights)} night(s))</span></div>
    <div class="summary-row"><span>Guests</span><span>${num(b.adults)} adult(s), ${num(b.children)} child(ren)</span></div>
    ${b.foodAmount ? `<div class="summary-row"><span>Food pre-order</span><span>${money(b.foodAmount)}</span></div>` : ""}
    <div class="summary-row"><span>Taxes</span><span>${money(b.taxAmount)}</span></div>
    <div class="summary-row total"><span>Total payable</span><span>${money(b.totalAmount)}</span></div>
    ${res.paymentInstructions ? `<p class="small muted mb-0">${esc(res.paymentInstructions)}</p>` : ""}`;
  goStep(4);
}

qs("#bookAnother").onclick = () => {
  view.selectedId = null;
  view.food.clear();
  qs("#step3Form").reset();
  goStep(1);
};

/* ------------------------------------------------------------ responsive */

const layout = qs("#bookingLayout");
const mq = window.matchMedia("(max-width: 980px)");
const applyLayout = () => {
  layout.style.gridTemplateColumns = mq.matches ? "1fr" : "1.6fr 1fr";
  const aside = qs("#bookingAside");
  if (aside) aside.style.position = mq.matches ? "static" : "sticky";
};
applyLayout();
mq.addEventListener("change", applyLayout);

renderSummary();
initRevealWithin(document);

// if a room slug was supplied, jump straight to availability
if (preset.room) {
  qs("#step1Form").requestSubmit();
}
