import {
  api, initSite, state, esc, qs, qsa, lightbox, initRevealWithin, renderPageHead,
  content, videoBlock, initVideoEmbeds, settingValue, num
} from "./app.js";

await initSite({ page: "gallery" });

const head = content("gallery", "header");
renderPageHead({
  title: head?.title || "Gallery",
  subtitle: head?.subtitle || "",
  image: "/assets/page-header.svg",
  crumbs: [{ label: "Home", href: "/index.html" }, { label: "Gallery" }]
});

const galleryCats = state.categories.filter((c) => c.type === "Gallery");
const tabs = qs("#galleryTabs");
let allItems = [];
let activeCat = "";

try {
  allItems = await api("/api/public/gallery");
} catch { allItems = []; }

const catIds = [...new Set(allItems.map((i) => i.categoryId).filter(Boolean))];
const availableCats = galleryCats.filter((c) => catIds.includes(c.id));

tabs.innerHTML = `<button class="tab-btn active" data-cat="">All photos</button>` +
  availableCats.map((c) => `<button class="tab-btn" data-cat="${c.id}">${esc(c.name)}</button>`).join("");

const grid = qs("#galleryGrid");
const countLabel = qs("#galleryCount");
let visible = [];

function paint() {
  visible = activeCat ? allItems.filter((i) => String(i.categoryId) === String(activeCat)) : allItems;

  if (!visible.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><p><strong>No media in this album yet.</strong></p></div>`;
    countLabel.textContent = "";
    return;
  }

  grid.innerHTML = visible.map((g, i) => {
    const thumb = g.thumbnailUrl || g.url;
    const isMedia = g.mediaType === "YouTube" || g.mediaType === "Video";
    return `<figure class="gallery-item ${i % 7 === 0 ? "tall" : ""}" data-anim="zoom" data-delay="${(i % 4) + 1}" data-index="${i}">
      <img src="${esc(thumb)}" alt="${esc(g.title || "Gallery")}" loading="lazy">
      ${isMedia ? `<span class="play"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5l12 7-12 7z"/></svg></span>` : ""}
      <figcaption class="gallery-item-cap">${esc(g.title || "")}${g.category ? ` &middot; ${esc(g.category)}` : ""}</figcaption>
    </figure>`;
  }).join("");

  countLabel.innerHTML = `${visible.length} item(s)`;
  initRevealWithin(grid);
}

grid.onclick = (e) => {
  const item = e.target.closest(".gallery-item");
  if (!item) return;
  lightbox.open(visible.map((g) => ({ url: g.url, mediaType: g.mediaType, title: g.title, thumbnailUrl: g.thumbnailUrl })), num(item.dataset.index));
};

tabs.onclick = (e) => {
  const btn = e.target.closest("[data-cat]");
  if (!btn) return;
  qsa(".tab-btn", tabs).forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  activeCat = btn.dataset.cat;
  paint();
};

const videoHost = qs("#galleryVideo");
const videoUrl = settingValue("home.videoUrl");
if (videoHost) {
  videoHost.innerHTML = videoUrl ? videoBlock(videoUrl, settingValue("hero.backgroundImage")) : "";
  initVideoEmbeds();
}

paint();
initRevealWithin(document);
