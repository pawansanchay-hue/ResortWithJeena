import {
  api, initSite, state, esc, qs, roomCard, pagination, initRevealWithin,
  renderPageHead, content, icon
} from "./app.js";

await initSite({ page: "rooms" });

const head = content("rooms", "header");
renderPageHead({
  title: head?.title || "Rooms & Suites",
  subtitle: head?.subtitle || "",
  image: "/assets/page-header.svg",
  crumbs: [{ label: "Home", href: "/index.html" }, { label: "Rooms" }]
});

const params = new URLSearchParams(location.search);
const catSelect = qs("#rfCategory");
const state_ = { page: 1, categoryId: params.get("categoryId") || "", category: params.get("category") || "" };

state.categories.filter((c) => c.type === "Room").forEach((c) => {
  catSelect.insertAdjacentHTML("beforeend", `<option value="${c.id}">${esc(c.name)} (${c.roomCount})</option>`);
});
if (state_.categoryId) catSelect.value = state_.categoryId;
if (params.get("search")) qs("#rfSearch").value = params.get("search");

const grid = qs("#roomGrid");
const countLabel = qs("#roomCount");
const pager = qs("#roomPager");

async function load(page = 1) {
  state_.page = page;
  grid.innerHTML = `<div class="skeleton" style="height:320px"></div>`.repeat(6);
  pager.innerHTML = "";

  const query = new URLSearchParams({ page, pageSize: 9 });
  if (catSelect.value) query.set("categoryId", catSelect.value);
  else if (state_.category) query.set("category", state_.category);
  const search = qs("#rfSearch").value.trim();
  if (search) query.set("search", search);
  if (qs("#rfPrice").value) query.set("maxPrice", qs("#rfPrice").value);
  if (qs("#rfSort").value) query.set("sort", qs("#rfSort").value);

  try {
    const data = await api("/api/public/rooms?" + query.toString());
    if (!data.items.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
        <p><strong>No rooms match those filters.</strong></p>
        <p class="small">Try widening the price range or clearing the search.</p>
        <button class="btn btn-outline btn-sm mt-2" onclick="document.getElementById('clearFilters').click()">Clear filters</button></div>`;
      countLabel.textContent = "0 rooms found";
      return;
    }

    countLabel.innerHTML = `Showing <strong>${data.items.length}</strong> of <strong>${data.total}</strong> rooms`;
    grid.innerHTML = data.items.map(roomCard).join("");
    initRevealWithin(grid);

    pager.innerHTML = "";
    const nav = pagination(data.page, data.pages, (p) => { load(p); window.scrollTo({ top: 320, behavior: "smooth" }); });
    if (nav) pager.appendChild(nav);
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-error" style="grid-column:1/-1">${esc(err.message)}</div>`;
    countLabel.textContent = "Could not load rooms";
  }
}

qs("#roomFilters").onsubmit = (e) => { e.preventDefault(); state_.category = ""; load(1); };
qs("#clearFilters").onclick = () => {
  qs("#rfSearch").value = "";
  catSelect.value = "";
  qs("#rfPrice").value = "";
  qs("#rfSort").value = "default";
  state_.category = "";
  load(1);
};

/* what is included with every stay */
const included = [
  { icon: "wifi", title: "High speed Wi-Fi", text: "Complimentary fibre internet in every room." },
  { icon: "bowl", title: "Breakfast for two", text: "Farmhouse breakfast served 7:00 - 10:30 am." },
  { icon: "spa", title: "Spa & pool access", text: "Steam, sauna and the infinity pool." },
  { icon: "car", title: "Secure parking", text: "Free on-site parking with valet on request." }
];
qs("#includedGrid").innerHTML = included.map((f, i) => `
  <div class="feature" data-anim="up" data-delay="${i + 1}">
    <div class="feature-icon">${icon(f.icon)}</div>
    <div><h4>${esc(f.title)}</h4><p>${esc(f.text)}</p></div>
  </div>`).join("");

initRevealWithin(document);
await load(1);
