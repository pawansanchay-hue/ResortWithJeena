import {
  api, initSite, state, settingValue, num, esc, icon, qs, qsa,
  buildHero, initCounters, initVideoEmbeds, videoBlock, roomCard, foodCard,
  bindFoodCards, initRevealWithin, lightbox, stars, mapIframe, todayISO, toast
} from "./app.js";

await initSite({ page: "index", overHero: true });

buildHero(qs("#hero"));

/* ------------------------------------------------------------- search bar */

const catSelect = qs("#qsCat");
state.categories
  .filter((c) => c.type === "Room")
  .forEach((c) => catSelect.insertAdjacentHTML("beforeend", `<option value="${c.id}">${esc(c.name)} (${c.roomCount})</option>`));

const inInput = qs("#qsIn");
const outInput = qs("#qsOut");
const minNights = num(settingValue("booking.minNights", "1"), 1);
inInput.min = todayISO(0);
outInput.min = todayISO(minNights);
inInput.value = todayISO(1);
outInput.value = todayISO(1 + minNights);

inInput.onchange = () => {
  const d = new Date(inInput.value || todayISO(1));
  d.setDate(d.getDate() + minNights);
  const min = d.toISOString().slice(0, 10);
  outInput.min = min;
  if (!outInput.value || outInput.value < min) outInput.value = min;
};

qs("#quickSearch").onsubmit = (e) => {
  e.preventDefault();
  const params = new URLSearchParams({
    checkIn: inInput.value,
    checkOut: outInput.value,
    adults: qs("#qsAdults").value,
    children: qs("#qsChildren").value
  });
  if (catSelect.value) params.set("categoryId", catSelect.value);
  location.href = "/booking.html?" + params.toString();
};

/* ------------------------------------------------------------- facilities */

const facilitiesGrid = qs("#facilitiesGrid");
if (facilitiesGrid) {
  facilitiesGrid.innerHTML = state.facilities.map((f, i) => `
    <article class="card" data-anim="up" data-delay="${(i % 3) + 1}">
      <div class="card-media" style="aspect-ratio:16/10">
        <img src="${esc(f.imageUrl || "/assets/placeholder.svg")}" alt="${esc(f.title)}" loading="lazy">
      </div>
      <div class="card-body">
        <div class="feature-icon" style="margin-bottom:14px">${icon(f.icon || "sparkle")}</div>
        <h3 class="card-title">${esc(f.title)}</h3>
        <p class="card-text">${esc(f.description || "")}</p>
      </div>
    </article>`).join("");
}

/* ------------------------------------------------------------------ stats */

const statsSection = qs("#statsSection");
const stats = [
  { value: settingValue("home.statsYears", "18"), label: "Years of hospitality", suffix: "+" },
  { value: settingValue("home.statsRooms", "42"), label: "Rooms & suites", suffix: "" },
  { value: settingValue("home.statsGuests", "25000"), label: "Happy guests", suffix: "+" },
  { value: settingValue("home.statsAwards", "12"), label: "Awards won", suffix: "" }
];

if (statsSection) {
  qs("#statsGrid", statsSection).innerHTML = stats.map((s, i) => `
    <div class="stat" data-anim="up" data-delay="${i + 1}">
      <div class="stat-value" data-count="${esc(s.value)}" data-suffix="${esc(s.suffix)}">0</div>
      <div class="stat-label">${esc(s.label)}</div>
    </div>`).join("");
  initCounters(statsSection);
}

/* ------------------------------------------------------------------ rooms */

const roomsGrid = qs("#roomsGrid");
if (roomsGrid) {
  roomsGrid.innerHTML = `<div class="skeleton" style="height:300px"></div>`.repeat(3);
  try {
    const data = await api(`/api/public/rooms?pageSize=${num(settingValue("home.roomsToShow", "6"), 6)}&sort=default`);
    const items = data.items.slice(0, num(settingValue("home.roomsToShow", "6"), 6));
    roomsGrid.innerHTML = items.map(roomCard).join("");
    initRevealWithin(roomsGrid);
  } catch (err) {
    roomsGrid.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
}

/* ------------------------------------------------------------------- food */

const foodGrid = qs("#foodGrid");
const foodTabs = qs("#foodTabs");
let foodLoaded = [];

async function loadFood(categoryId = "") {
  foodGrid.innerHTML = `<div class="skeleton" style="height:280px"></div>`.repeat(3);
  const limit = num(settingValue("home.foodToShow", "6"), 6);
  const q = categoryId ? `&categoryId=${categoryId}` : "";
  const data = await api(`/api/public/food?${q.slice(1)}&featured=true`);
  let items = data;
  if (items.length < 3) {
    items = await api(`/api/public/food?${q.slice(1)}`);
  }
  foodLoaded = items.slice(0, limit);
  foodGrid.innerHTML = foodLoaded.length
    ? foodLoaded.map(foodCard).join("")
    : `<div class="empty"><p>No dishes in this category yet.</p></div>`;
  bindFoodCards(foodGrid);
  initRevealWithin(foodGrid);
}

if (foodGrid) {
  const foodCats = state.categories.filter((c) => c.type === "Food");
  foodTabs.innerHTML = `<button class="tab-btn active" data-cat="">Chef's picks</button>` +
    foodCats.map((c) => `<button class="tab-btn" data-cat="${c.id}">${esc(c.name)}</button>`).join("");

  foodTabs.onclick = (e) => {
    const btn = e.target.closest("[data-cat]");
    if (!btn) return;
    qsa(".tab-btn", foodTabs).forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    loadFood(btn.dataset.cat).catch((err) => toast(err.message, "error"));
  };

  await loadFood("").catch(() => {});
}

/* ------------------------------------------------------------------ video */

const videoHost = qs("#homeVideo");
if (videoHost) {
  const url = settingValue("home.videoUrl");
  videoHost.innerHTML = url
    ? videoBlock(url, settingValue("hero.backgroundImage"))
    : `<div class="alert alert-info">Add a video URL under Admin &gt; Settings &gt; Home Sections to show the resort film here.</div>`;
  initVideoEmbeds();
}

/* ----------------------------------------------------------- testimonials */

const track = qs("#testimonialTrack");
if (track) {
  track.innerHTML = state.testimonials.map((t) => `
    <article class="testimonial" data-anim="up">
      <span class="quote">&ldquo;</span>
      <div class="rating">${stars(t.rating)}</div>
      <p>${esc(t.message)}</p>
      <div class="testimonial-who">
        <img src="${esc(t.imageUrl || "/assets/person-1.svg")}" alt="${esc(t.name)}">
        <div><strong>${esc(t.name)}</strong><span>${esc([t.designation, t.location].filter(Boolean).join(", "))}</span></div>
      </div>
    </article>`).join("");

  qsa("[data-scroll]", document).forEach((btn) => {
    btn.onclick = () => track.scrollBy({ left: btn.dataset.scroll === "next" ? 440 : -440, behavior: "smooth" });
  });
}

/* ---------------------------------------------------------------- gallery */

const galleryGrid = qs("#galleryGrid");
let galleryItems = [];
if (galleryGrid) {
  try {
    galleryItems = (await api("/api/public/gallery")).slice(0, 8);
    galleryGrid.innerHTML = galleryItems.map((g, i) => {
      const thumb = g.thumbnailUrl || g.url;
      const isMedia = g.mediaType === "YouTube" || g.mediaType === "Video";
      return `<figure class="gallery-item ${i % 5 === 0 ? "tall" : ""}" data-anim="zoom" data-delay="${(i % 4) + 1}" data-index="${i}">
        <img src="${esc(thumb)}" alt="${esc(g.title || "Gallery image")}" loading="lazy">
        ${isMedia ? `<span class="play"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5l12 7-12 7z"/></svg></span>` : ""}
        <figcaption class="gallery-item-cap">${esc(g.title || "")}${g.category ? ` <span class="small">&middot; ${esc(g.category)}</span>` : ""}</figcaption>
      </figure>`;
    }).join("");

    galleryGrid.onclick = (e) => {
      const item = e.target.closest(".gallery-item");
      if (!item) return;
      lightbox.open(galleryItems.map((g) => ({
        url: g.mediaType === "YouTube" ? g.url : g.url,
        mediaType: g.mediaType,
        title: g.title,
        thumbnailUrl: g.thumbnailUrl
      })), num(item.dataset.index));
    };
  } catch { /* ignore */ }
}

/* ---------------------------------------------------------------- contact */

const contactInfo = qs("#contactInfo");
if (contactInfo) {
  contactInfo.innerHTML = `
    <li>${icon("pin")}<div><strong>Address</strong><span>${esc(settingValue("site.address"))}</span></div></li>
    <li>${icon("phone")}<div><strong>Reservations</strong><span><a href="tel:${esc(settingValue("site.phone"))}">${esc(settingValue("site.phone"))}</a></span></div></li>
    <li>${icon("mail")}<div><strong>Email</strong><span><a href="mailto:${esc(settingValue("site.email"))}">${esc(settingValue("site.email"))}</a></span></div></li>
    <li>${icon("clock")}<div><strong>Reception</strong><span>${esc(settingValue("site.workingHours", "Open 24 x 7"))}</span></div></li>`;
}

const homeMap = qs("#homeMap");
if (homeMap) homeMap.innerHTML = mapIframe(430);

/* --------------------------------------------------------------- reveal */

initRevealWithin(document);
