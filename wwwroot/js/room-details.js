import {
  api, initSite, esc, qs, money, num, icon, settingValue, flag, stars, lightbox,
  initRevealWithin, todayISO, nights, toast, roomCard, auth
} from "./app.js";

await initSite({ page: "rooms" });

const slug = new URLSearchParams(location.search).get("room");
const host = qs("#roomDetail");

if (!slug) {
  host.innerHTML = `<div class="empty"><p><strong>No room selected.</strong></p>
    <a class="btn mt-2" href="/rooms.html">Browse all rooms</a></div>`;
} else {
  try {
    const data = await api("/api/public/rooms/" + encodeURIComponent(slug));
    render(data);
  } catch (err) {
    host.innerHTML = `<div class="empty"><p><strong>${esc(err.message)}</strong></p>
      <a class="btn mt-2" href="/rooms.html">Browse all rooms</a></div>`;
  }
}

function render(data) {
  const room = data.room;
  const images = (data.images?.length ? data.images : [{ imageUrl: room.coverImage }]).filter((i) => i.imageUrl);
  const amenities = room.amenities || [];
  const taxPercent = num(settingValue("booking.taxPercent", "12"), 12);
  const minNights = num(settingValue("booking.minNights", "1"), 1);
  const maxNights = num(settingValue("booking.maxNights", "30"), 30);

  qs("#crumbs").innerHTML = `
    <a href="/index.html">Home</a><span>/</span>
    <a href="/rooms.html">Rooms</a><span>/</span>
    <span>${esc(room.category || "Room")}</span><span>/</span>
    <span>${esc(room.name)}</span>`;

  host.innerHTML = `
    <div class="grid" style="grid-template-columns:1.6fr 1fr;gap:40px;align-items:start" id="roomLayout">
      <div>
        <!-- gallery -->
        <div class="card" style="overflow:hidden" data-anim="zoom">
          <div style="position:relative;aspect-ratio:16/10;background:var(--section-bg)">
            <img id="mainImage" src="${esc(images[0].imageUrl)}" alt="${esc(room.name)}"
                 style="width:100%;height:100%;object-fit:cover;cursor:zoom-in">
            ${images.length > 1 ? `
              <button class="hero-arrow prev" id="galPrev" aria-label="Previous photo" style="width:44px;height:44px">&#8249;</button>
              <button class="hero-arrow next" id="galNext" aria-label="Next photo" style="width:44px;height:44px">&#8250;</button>
              <span class="ribbon right dark" id="galCount">1 / ${images.length}</span>` : ""}
          </div>
          ${images.length > 1 ? `<div class="flex" id="galThumbs" style="padding:12px;gap:10px;overflow-x:auto">
            ${images.map((img, i) => `<img src="${esc(img.imageUrl)}" alt="" data-thumb="${i}"
              style="width:92px;height:68px;object-fit:cover;border-radius:9px;cursor:pointer;flex:0 0 auto;border:2px solid ${i === 0 ? "var(--primary)" : "transparent"}">`).join("")}
          </div>` : ""}
        </div>

        <!-- headline -->
        <div class="mt-4" data-anim="up">
          <div class="flex items-center justify-between flex-wrap">
            <div>
              <span class="eyebrow" style="margin-bottom:8px">${esc(room.category || "Room")}</span>
              <h1 style="font-size:clamp(1.8rem,3.4vw,2.6rem);margin:0 0 6px">${esc(room.name)}</h1>
              <div class="flex items-center flex-wrap" style="gap:14px">
                <span class="rating">${stars(5)}</span>
                <span class="small muted">Guest favourite &middot; ${num(room.availableUnits)} of ${num(room.totalUnits)} available</span>
              </div>
            </div>
            <div class="text-right">
              ${room.discountPercent > 0 ? `<span class="badge badge-green mb-1">${num(room.discountPercent)}% off</span>` : ""}
              <div class="price" style="font-size:2rem">${money(room.finalPrice)}<small> / night</small></div>
              ${room.discountPercent > 0 ? `<del class="muted small">${money(room.pricePerNight)}</del>` : ""}
            </div>
          </div>
        </div>

        <!-- quick facts -->
        <div class="grid grid-4 mt-3" style="gap:16px" data-anim="up">
          ${fact(icon("home"), "Room size", room.roomSize || "—")}
          ${fact(icon("bed"), "Bed", room.bedType || "—")}
          ${fact(icon("users"), "Sleeps", `${num(room.maxAdults)} adults, ${num(room.maxChildren)} children`)}
          ${fact(icon("sparkle"), "Units", `${num(room.totalUnits)} rooms`)}
        </div>

        <!-- description -->
        <div class="mt-4" data-anim="up">
          <h3>About this room</h3>
          <p>${esc(room.description || room.shortDescription || "")}</p>
        </div>

        <!-- amenities -->
        <div class="mt-4" data-anim="up">
          <h3>Amenities</h3>
          <div class="grid grid-2" style="gap:12px 30px">
            ${amenities.map((a) => `<div class="flex items-center" style="gap:10px">
              <span style="color:var(--primary);width:18px">${icon("check")}</span><span>${esc(a)}</span></div>`).join("") ||
              `<p class="muted">Amenities will be listed soon.</p>`}
          </div>
        </div>

        <!-- policies -->
        <div class="mt-4" data-anim="up">
          <h3>Good to know</h3>
          <ul class="info-list">
            <li>${icon("clock")}<div><strong>Check-in / Check-out</strong><span>${esc(settingValue("site.checkInTime", "2:00 PM"))} &middot; ${esc(settingValue("site.checkOutTime", "11:00 AM"))}</span></div></li>
            <li>${icon("cal")}<div><strong>Stay length</strong><span>Minimum ${minNights} night, maximum ${maxNights} nights online.</span></div></li>
            <li>${icon("shield")}<div><strong>Payment</strong><span>${esc(settingValue("booking.paymentInstructions", "Pay at the resort or via UPI after confirmation."))}</span></div></li>
            <li>${icon("phone")}<div><strong>Questions?</strong><span>Call <a href="tel:${esc(settingValue("site.phone"))}">${esc(settingValue("site.phone"))}</a></span></div></li>
          </ul>
        </div>

        <!-- reviews -->
        ${data.reviews?.length ? `<div class="mt-4" data-anim="up">
          <h3>What guests said</h3>
          <div class="grid grid-2">
            ${data.reviews.map((r) => `<div class="testimonial">
              <div class="rating">${stars(r.rating)}</div>
              <p>${esc(r.message)}</p>
              <div class="testimonial-who">
                <img src="${esc(r.imageUrl || "/assets/person-1.svg")}" alt="">
                <div><strong>${esc(r.name)}</strong><span>${esc(r.location || "")}</span></div>
              </div></div>`).join("")}
          </div>
        </div>` : ""}
      </div>

      <!-- booking sidebar -->
      <aside style="position:sticky;top:calc(var(--nav-h) + 18px)">
        <div class="card" style="padding:0" data-anim="right">
          <div class="card-body">
            <h3 class="mb-1">Reserve this room</h3>
            <p class="small muted">Free cancellation up to 48 hours before check-in.</p>
            <form class="form" id="detailBookingForm" novalidate>
              <div class="form-row" style="grid-template-columns:1fr 1fr">
                <div class="field"><label for="dbIn">Check in</label><input type="date" id="dbIn" required></div>
                <div class="field"><label for="dbOut">Check out</label><input type="date" id="dbOut" required></div>
              </div>
              <div class="form-row" style="grid-template-columns:1fr 1fr">
                <div class="field"><label for="dbAdults">Adults</label>
                  <select id="dbAdults">${Array.from({ length: num(room.maxAdults) }, (_, i) => `<option value="${i + 1}" ${i === 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select>
                </div>
                <div class="field"><label for="dbChildren">Children</label>
                  <select id="dbChildren">${Array.from({ length: num(room.maxChildren) + 1 }, (_, i) => `<option value="${i}">${i}</option>`).join("")}</select>
                </div>
              </div>
              <div class="field"><label for="dbRooms">Rooms</label>
                <select id="dbRooms">${Array.from({ length: Math.max(1, num(room.totalUnits)) }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join("")}</select>
              </div>

              <div class="summary mt-1">
                <div class="summary-row"><span>${money(room.finalPrice)} x <span id="dbNights">1</span> night(s)</span><span id="dbSub">—</span></div>
                <div class="summary-row"><span>Rooms</span><span id="dbRoomsLabel">x1</span></div>
                <div class="summary-row"><span>Taxes (${taxPercent}%)</span><span id="dbTax">—</span></div>
                <div class="summary-row total"><span>Total</span><span id="dbTotal">—</span></div>
              </div>

              <div id="dbAlert"></div>
              <button class="btn btn-block btn-lg" type="submit" id="dbSubmit">Book this room</button>
              <a class="btn btn-block btn-outline" href="/booking.html?room=${encodeURIComponent(room.slug)}">Full booking page</a>
              <p class="small muted text-center mb-0">No prepayment needed - pay after confirmation.</p>
            </form>
          </div>
        </div>

        <div class="summary mt-3">
          <strong>Need help choosing?</strong>
          <p class="small mb-2">Our reservations desk replies within 2 hours.</p>
          <a class="btn btn-sm btn-block btn-outline" href="/contact.html">Send an enquiry</a>
        </div>
      </aside>
    </div>`;

  // responsive layout for the two column grid
  const layout = qs("#roomLayout");
  const mq = window.matchMedia("(max-width: 980px)");
  const applyLayout = () => {
    layout.style.gridTemplateColumns = mq.matches ? "1fr" : "1.6fr 1fr";
    const aside = layout.querySelector("aside");
    if (aside) aside.style.position = mq.matches ? "static" : "sticky";
  };
  applyLayout();
  mq.addEventListener("change", applyLayout);

  /* ------------------------------------------------------------ gallery */
  let index = 0;
  const mainImg = qs("#mainImage");
  const setIndex = (i) => {
    index = (i + images.length) % images.length;
    mainImg.src = images[index].imageUrl;
    const counter = qs("#galCount");
    if (counter) counter.textContent = `${index + 1} / ${images.length}`;
    qs("#galThumbs")?.querySelectorAll("[data-thumb]").forEach((t, k) => {
      t.style.borderColor = k === index ? "var(--primary)" : "transparent";
    });
  };
  qs("#galPrev")?.addEventListener("click", () => setIndex(index - 1));
  qs("#galNext")?.addEventListener("click", () => setIndex(index + 1));
  qs("#galThumbs")?.addEventListener("click", (e) => {
    const t = e.target.closest("[data-thumb]");
    if (t) setIndex(num(t.dataset.thumb));
  });
  mainImg.onclick = () => lightbox.open(images.map((i, k) => ({ url: i.imageUrl, mediaType: "Image", title: i.caption || `${room.name} ${k + 1}` })), index);

  /* -------------------------------------------------------- live pricing */
  const inInput = qs("#dbIn");
  const outInput = qs("#dbOut");
  inInput.min = todayISO(0);
  inInput.value = todayISO(1);
  outInput.min = todayISO(1 + minNights);
  outInput.value = todayISO(1 + Math.max(1, minNights));

  const recalc = () => {
    let n = nights(inInput.value, outInput.value);
    if (n < minNights) n = minNights;
    const rooms = num(qs("#dbRooms").value, 1);
    const sub = room.finalPrice * n * rooms;
    const tax = Math.round(sub * taxPercent) / 100;
    qs("#dbNights").textContent = n;
    qs("#dbRoomsLabel").textContent = "x" + rooms;
    qs("#dbSub").textContent = money(sub);
    qs("#dbTax").textContent = money(tax);
    qs("#dbTotal").textContent = money(sub + tax);
  };

  inInput.onchange = () => {
    const min = new Date(inInput.value || todayISO(1));
    min.setDate(min.getDate() + minNights);
    const minISO = min.toISOString().slice(0, 10);
    outInput.min = minISO;
    if (!outInput.value || outInput.value < minISO) outInput.value = minISO;
    recalc();
  };
  qs("#dbOut").onchange = recalc;
  qs("#dbRooms").onchange = recalc;
  recalc();

  /* ------------------------------------------------------------- submit */
  qs("#detailBookingForm").onsubmit = async (e) => {
    e.preventDefault();
    const alertBox = qs("#dbAlert");
    alertBox.innerHTML = "";

    const user = auth.user;
    const guestAllowed = flag("booking.enableGuestBooking", true);

    if (!user) {
      if (!guestAllowed) {
        alertBox.innerHTML = `<div class="alert alert-info">Please sign in to book, or
          <a href="/register.html">create an account</a> — it takes 30 seconds.
          <br><a href="/login.html?next=${encodeURIComponent(location.pathname + location.search)}">Sign in</a></div>`;
        return;
      }
      // Guests are welcome: hand them to the full booking wizard, which collects their details.
      const q = new URLSearchParams({
        room: room.slug,
        checkIn: inInput.value,
        checkOut: outInput.value,
        adults: qs("#dbAdults").value,
        children: qs("#dbChildren").value
      });
      location.href = "/booking.html?" + q.toString();
      return;
    }

    const payload = {
      roomId: room.id,
      checkIn: inInput.value,
      checkOut: outInput.value,
      adults: num(qs("#dbAdults").value, 2),
      children: num(qs("#dbChildren").value, 0),
      roomCount: num(qs("#dbRooms").value, 1),
      guestName: user.fullName,
      guestEmail: user.email,
      guestPhone: user.phone || "",
      specialRequest: "",
      paymentMethod: "Pay after confirmation"
    };

    if (!payload.guestPhone) {
      alertBox.innerHTML = `<div class="alert alert-warn">Please add a phone number to your profile first.
        <a href="/my-account.html?tab=profile">Open my account</a></div>`;
      return;
    }

    const btn = qs("#dbSubmit");
    btn.classList.add("is-loading");
    try {
      const res = await api("/api/public/bookings", { method: "POST", body: payload });
      const b = res.booking;
      host.querySelector("#detailBookingForm").outerHTML = `
        <div class="alert alert-success">
          <div>
            <strong>Booking confirmed request received</strong>
            <p class="mb-1">${esc(res.message)}</p>
            <p class="small mb-0">Reference <strong>${esc(b.bookingCode)}</strong> &middot; ${esc(b.roomName)} &middot; ${esc(b.nights)} night(s)</p>
            <p class="small">Total ${money(b.totalAmount)} &middot; status ${esc(b.status)}</p>
            <div class="flex mt-2 flex-wrap">
              <a class="btn btn-sm" href="/my-account.html?tab=bookings">My bookings</a>
              <a class="btn btn-sm btn-outline" href="/food.html">Pre-order food</a>
            </div>
          </div>
        </div>`;
      toast("Booking request sent to the reservations desk", "success");
    } catch (err) {
      alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    } finally {
      btn.classList.remove("is-loading");
    }
  };

  /* ------------------------------------------------------------- related */
  if (data.related?.length) {
    qs("#relatedSection").hidden = false;
    qs("#relatedGrid").innerHTML = data.related.map((r) => roomCard({
      ...r, amenities: [], images: [], availableUnits: null, maxAdults: 2, maxChildren: 1
    })).join("");
  }

  initRevealWithin(host);
  document.title = `${room.name} | Rooms`;
}

function fact(iconHtml, label, value) {
  return `<div class="card" style="padding:16px">
    <div class="flex items-center" style="gap:12px">
      <span style="color:var(--primary);width:24px">${iconHtml}</span>
      <div><span class="small muted" style="display:block">${esc(label)}</span><strong>${esc(value)}</strong></div>
    </div></div>`;
}
