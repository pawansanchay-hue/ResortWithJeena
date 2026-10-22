import {
  api, initSite, state, esc, qs, icon, initCounters, initRevealWithin,
  renderPageHead, content, settingValue, lightbox, num
} from "./app.js";

await initSite({ page: "about" });

const head = content("about", "header");
renderPageHead({
  title: head?.title || "About Us",
  subtitle: head?.subtitle || "",
  image: "/assets/page-header.svg",
  crumbs: [{ label: "Home", href: "/index.html" }, { label: "About" }]
});

/* ------------------------------------------------------------------ stats */

qs("#aboutStats").innerHTML = [
  { value: settingValue("home.statsYears", "18"), suffix: "+", label: "Years of hospitality" },
  { value: settingValue("home.statsRooms", "42"), suffix: "", label: "Rooms & suites" },
  { value: settingValue("home.statsGuests", "25000"), suffix: "+", label: "Happy guests" },
  { value: settingValue("home.statsAwards", "12"), suffix: "", label: "Awards won" }
].map((s, i) => `<div class="stat" data-anim="up" data-delay="${i + 1}">
    <div class="stat-value" data-count="${esc(s.value)}" data-suffix="${esc(s.suffix)}">0</div>
    <div class="stat-label">${esc(s.label)}</div></div>`).join("");
initCounters(qs("#aboutStats"));

/* ------------------------------------------------------------- facilities */

qs("#aboutFacilities").innerHTML = state.facilities.map((f, i) => `
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

/* ---------------------------------------------------------------- gallery */

try {
  const items = (await api("/api/public/gallery")).slice(0, 6);
  const grid = qs("#aboutGallery");
  grid.innerHTML = items.map((g, i) => `<figure class="gallery-item" data-anim="zoom" data-delay="${(i % 3) + 1}" data-index="${i}">
    <img src="${esc(g.thumbnailUrl || g.url)}" alt="${esc(g.title || "")}" loading="lazy">
    <figcaption class="gallery-item-cap">${esc(g.title || "")}</figcaption></figure>`).join("");
  grid.onclick = (e) => {
    const item = e.target.closest(".gallery-item");
    if (!item) return;
    lightbox.open(items.map((g) => ({ url: g.url, mediaType: g.mediaType, title: g.title, thumbnailUrl: g.thumbnailUrl })), num(item.dataset.index));
  };
} catch { /* ignore */ }

initRevealWithin(document);
