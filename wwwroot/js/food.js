import {
  api, initSite, state, esc, qs, qsa, foodCard, bindFoodCards, initRevealWithin,
  renderPageHead, content, flag
} from "./app.js";

await initSite({ page: "food" });

const head = content("food", "header");
renderPageHead({
  title: head?.title || "Restaurant & Menu",
  subtitle: head?.subtitle || "",
  image: "/assets/page-header.svg",
  crumbs: [{ label: "Home", href: "/index.html" }, { label: "Dining" }]
});

if (!flag("booking.enableFoodOrdering", true)) {
  qs("#foodGrid").innerHTML = `<div class="alert alert-warn" style="grid-column:1/-1">
    Online food ordering is currently switched off. Please call ${""} the resort to order.</div>`;
}

const params = new URLSearchParams(location.search);
const catSelect = qs("#ffCategory");
const foodCats = state.categories.filter((c) => c.type === "Food");

foodCats.forEach((c) => catSelect.insertAdjacentHTML("beforeend", `<option value="${c.id}">${esc(c.name)}</option>`));
if (params.get("category")) {
  const match = foodCats.find((c) => c.slug === params.get("category"));
  if (match) catSelect.value = match.id;
}

const tabs = qs("#foodCatTabs");
tabs.innerHTML = `<button class="tab-btn active" data-cat="">Everything</button>` +
  foodCats.map((c) => `<button class="tab-btn" data-cat="${c.id}">${esc(c.name)}</button>`).join("");
qsa(".tab-btn", tabs).forEach((b) => {
  if (catSelect.value && b.dataset.cat === catSelect.value) {
    qsa(".tab-btn", tabs).forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
  }
});

const grid = qs("#foodGrid");
const countLabel = qs("#foodCount");

async function load() {
  grid.innerHTML = `<div class="skeleton" style="height:300px"></div>`.repeat(6);
  const query = new URLSearchParams();
  if (catSelect.value) query.set("categoryId", catSelect.value);
  const search = qs("#ffSearch").value.trim();
  if (search) query.set("search", search);
  if (qs("#ffVeg").value) query.set("veg", qs("#ffVeg").value);
  if (qs("#ffSort").value && qs("#ffSort").value !== "default") query.set("sort", qs("#ffSort").value);

  try {
    const items = await api("/api/public/food?" + query.toString());
    if (!items.length) {
      countLabel.textContent = "No dishes found";
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
        <p><strong>Nothing matches those filters.</strong></p>
        <p class="small">Try a different category or clear the search.</p></div>`;
      return;
    }
    countLabel.innerHTML = `<strong>${items.length}</strong> dishes`;
    grid.innerHTML = items.map(foodCard).join("");
    bindFoodCards(grid);
    initRevealWithin(grid);
  } catch (err) {
    grid.innerHTML = `<div class="alert alert-error" style="grid-column:1/-1">${esc(err.message)}</div>`;
  }
}

qs("#foodFilters").onsubmit = (e) => { e.preventDefault(); load(); };

tabs.onclick = (e) => {
  const btn = e.target.closest("[data-cat]");
  if (!btn) return;
  qsa(".tab-btn", tabs).forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  catSelect.value = btn.dataset.cat;
  load();
};

qs("#clearFoodFilters").onclick = () => {
  qs("#ffSearch").value = "";
  catSelect.value = "";
  qs("#ffVeg").value = "";
  qs("#ffSort").value = "default";
  qsa(".tab-btn", tabs).forEach((b, i) => b.classList.toggle("active", i === 0));
  load();
};

qs("#ffSearch").addEventListener("input", (() => {
  let t;
  return () => { clearTimeout(t); t = setTimeout(load, 420); };
})());

initRevealWithin(document);
await load();
