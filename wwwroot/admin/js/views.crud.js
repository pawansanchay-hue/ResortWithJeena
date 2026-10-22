/* ==========================================================================
   Jeena Resort & Spa - admin CRUD screens
   One small engine drives every catalogue screen (rooms, food, gallery,
   carousel, facilities, testimonials and the category tables).
   ========================================================================== */

import {
  $, $$, api, esc, money, num, toast, confirmDialog, renderForm,
  readForm, wireForm, primeFields, openPanel, closePanel, tableWrap, pager,
  catsOf, catName, toOptions, svg, go, page
} from "./core.js";
import { setTitle, refreshNavSoon } from "./shell.js";

const PAGE_SIZE = 12;

/* --------------------------------------------------------------- helpers */

export function badge(text, kind = "gray") {
  return `<span class="badge badge-${kind}">${esc(text)}</span>`;
}

const activeBadge = (on) => (on ? badge("Live", "green") : badge("Hidden", "gray"));

function thumb(url, alt = "") {
  return url
    ? `<img class="thumb" src="${esc(url)}" alt="${esc(alt)}">`
    : `<span class="badge badge-gray">none</span>`;
}

/* ============================================================= the engine */

function crud(cfg) {
  const state = { rows: [], search: "", filters: {}, page: 1, loading: false };

  /* ---------------------------------------------------------------- data */

  async function load() {
    const data = await api(cfg.endpoint);
    state.rows = cfg.itemsKey ? (data[cfg.itemsKey] || []) : (Array.isArray(data) ? data : []);
    state.rows.sort(cfg.sort || ((a, b) => num(a.sortOrder) - num(b.sortOrder)));
    return state.rows;
  }

  function filtered() {
    let rows = state.rows;
    const q = state.search.trim().toLowerCase();
    if (q) rows = rows.filter((r) => cfg.searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
    Object.entries(state.filters).forEach(([k, v]) => {
      if (v === "" || v === undefined) return;
      rows = rows.filter((r) => String(r[k] ?? "") === String(v));
    });
    return rows;
  }

  /* ------------------------------------------------------------- toolbar */

  function toolbar() {
    const filters = (cfg.filters || []).map((f) => `<div class="field">
      <label>${esc(f.label)}</label>
      <select data-filter="${esc(f.key)}">
        ${f.options().map((o) => `<option value="${esc(o.value)}" ${String(state.filters[f.key] ?? "") === String(o.value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
      </select></div>`).join("");

    return `<div class="toolbar">
      <div class="field grow"><label>Search</label>
        <input type="text" id="crudSearch" value="${esc(state.search)}" placeholder="Search ${esc(cfg.plural.toLowerCase())}…"></div>
      ${filters}
      <div class="field"><label>&nbsp;</label>
        <button class="btn" type="button" id="crudAdd">+ Add ${esc(cfg.singular)}</button></div>
      <div class="field"><label>&nbsp;</label>
        <button class="btn btn-outline" type="button" id="crudRefresh">Refresh</button></div>
    </div>`;
  }

  /* ---------------------------------------------------------------- paint */

  function paint(host) {
    const rows = filtered();
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    if (state.page > pages) state.page = pages;
    const slice = rows.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

    const body = $("#crudBody", host);
    body.innerHTML = slice.length
      ? tableWrap(
          [...cfg.columns.map((c) => ({ label: c.label, num: c.num })), { label: "Actions" }],
          slice.map((row) => `<tr>${cfg.columns.map((c) => `<td ${c.num ? 'class="num"' : ""}>${c.cell(row)}</td>`).join("")}
            <td><div class="actions">
              ${(cfg.extraActions || []).map((a) => `<button type="button" class="icon-btn" data-extra="${esc(a.key)}" data-id="${num(row[cfg.idField])}">${esc(a.label)}</button>`).join("")}
              <button type="button" class="icon-btn" data-edit="${num(row[cfg.idField])}">Edit</button>
              <button type="button" class="icon-btn danger" data-del="${num(row[cfg.idField])}">Delete</button>
            </div></td></tr>`).join(""),
          { empty: `No ${cfg.plural.toLowerCase()} yet` })
      : `<div class="empty-admin">${svg(cfg.icon || "grid", 46)}<p><strong>No ${esc(cfg.plural.toLowerCase())} yet</strong></p>
         <p class="small muted">${esc(cfg.emptyHint || "Use the add button above to create the first one.")}</p></div>`;

    body.insertAdjacentHTML("afterbegin", `<div class="panel-head" style="border-bottom:1px solid var(--border)">
      <div><h2>${esc(cfg.plural)}</h2><p>${rows.length} record(s)${state.search ? ` matching “${esc(state.search)}”` : ""}</p></div>
    </div>`);

    if (pages > 1) body.insertAdjacentHTML("beforeend", pager(state.page, pages, (p) => { state.page = p; paint(host); }));

    // events
    $("#crudAdd", host).onclick = () => openEditor(null, host);
    $("#crudRefresh", host).onclick = () => reload(host);
    const search = $("#crudSearch", host);
    search.oninput = () => { state.search = search.value; state.page = 1; paint(host); setTimeout(() => { const n = $("#crudSearch", host); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 0); };
    $$("[data-filter]", host).forEach((sel) => (sel.onchange = () => { state.filters[sel.dataset.filter] = sel.value; state.page = 1; paint(host); }));
    $$("[data-edit]", body).forEach((b) => (b.onclick = () => openEditor(Number(b.dataset.edit), host)));
    $$("[data-del]", body).forEach((b) => (b.onclick = () => remove(Number(b.dataset.del), host)));
    (cfg.extraActions || []).forEach((a) => $$(`[data-extra="${a.key}"]`, body).forEach((b) => (b.onclick = () => a.run(state.rows.find((r) => String(r[cfg.idField]) === String(b.dataset.id)), host))));
  }

  async function reload(host) {
    host.innerHTML = `<div class="admin-spinner"></div>`;
    await load();
    render(host);
  }

  function render(host) {
    const rows = filtered();
    host.innerHTML = `${toolbar()}
      <div class="panel"><div class="panel-body flush" id="crudBody"></div></div>
      <p class="small muted" style="text-align:right">Showing ${Math.min(PAGE_SIZE, rows.length)} of ${rows.length}</p>`;
    paint(host);
  }

  /* --------------------------------------------------------------- editor */

  async function openEditor(id, host) {
    let row = { ...(cfg.defaults || {}) };
    if (id) {
      row = state.rows.find((r) => String(r[cfg.idField]) === String(id)) || await api(`${cfg.endpoint}/${id}`);
    }
    primeFields(cfg.fields);

    const title = id ? `Edit ${cfg.singular}` : `New ${cfg.singular}`;
    openPanel(`<div class="modal lg">
      <div class="modal-head">
        <div><h3 class="mb-0">${esc(title)}</h3><span class="small muted">${esc(cfg.hint || "")}</span></div>
        <button class="modal-close" data-close-modal>&times;</button>
      </div>
      <div class="modal-body" id="crudFormScope">${renderForm(cfg.fields, row)}</div>
      <div class="modal-foot">
        <button class="btn btn-outline" data-close-modal>Cancel</button>
        <button class="btn" id="crudSave">${id ? "Save changes" : `Create ${esc(cfg.singular)}`}</button>
      </div>
    </div>`, {
      wide: true,
      onReady: (root) => {
        wireForm(root);
        const scope = $("#crudFormScope", root);
        const btn = $("#crudSave", root);
        btn.onclick = async () => {
          const body = readForm(scope, cfg.fields);
          const missing = cfg.fields.filter((f) => f.required && !String(body[f.k] ?? "").trim());
          if (missing.length) { toast(`Please fill in: ${missing.map((f) => f.l).join(", ")}`, "warn"); return; }
          if (cfg.beforeSave) { const stop = cfg.beforeSave(body, id); if (stop) { toast(stop, "warn"); return; } }

          btn.classList.add("is-loading");
          try {
            const res = id
              ? await api(cfg.updatePath(id), { method: "PUT", body })
              : await api(cfg.createPath, { method: "POST", body });
            toast(res.message || `${cfg.singular} saved`, "success");
            closePanel();
            await load();
            render(host);
            await loadCategories();
            refreshNavSoon();
          } catch (err) {
            toast(err.message, "error");
          } finally {
            btn.classList.remove("is-loading");
          }
        };
      }
    });
  }

  /* --------------------------------------------------------------- delete */

  async function remove(id, host) {
    const row = state.rows.find((r) => String(r[cfg.idField]) === String(id));
    const label = cfg.labelOf ? cfg.labelOf(row) : `this ${cfg.singular.toLowerCase()}`;
    const ok = await confirmDialog(`Delete “${label}”? This cannot be undone.`, { title: `Delete ${cfg.singular}`, ok: "Yes, delete it" });
    if (!ok) return;
    try {
      const res = await api(cfg.removePath(id), { method: "DELETE" });
      toast(res.message || "Deleted", "success");
      await load();
      render(host);
      refreshNavSoon();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  return async function (param, host) {
    await load();
    render(host);
    if (param) {
      if (param === "new") await openEditor(null, host);
      else await openEditor(Number(param), host);
      history.replaceState({}, "", `#/${cfg.key}`);
    }
  };
}

/* ==========================================================================
   Resource definitions
   ========================================================================== */

const roomFields = () => [
  { k: "name", l: "Room name", t: "text", required: true, placeholder: "Deluxe Valley View" },
  { k: "categoryId", l: "Room type", t: "select", numeric: true, options: () => toOptions(catsOf("Room"), { blank: "— pick a room type —" }) },
  { k: "shortDescription", l: "Card description", t: "textarea", rows: 2, span: 2, hint: "One or two lines shown on room cards." },
  { k: "description", l: "Full description", t: "textarea", rows: 6, span: 2, hint: "Shown on the room details page. Plain text, blank lines become paragraphs." },
  { k: "pricePerNight", l: "Price per night", t: "decimal", min: 0, required: true, def: 5000 },
  { k: "discountPercent", l: "Discount %", t: "number", min: 0, max: 90, def: 0 },
  { k: "roomSize", l: "Room size", t: "text", placeholder: "420 sq ft" },
  { k: "bedType", l: "Bed type", t: "text", placeholder: "King bed + sofa" },
  { k: "maxAdults", l: "Max adults", t: "number", min: 1, max: 20, def: 2 },
  { k: "maxChildren", l: "Max children", t: "number", min: 0, max: 20, def: 1 },
  { k: "totalUnits", l: "Total units", t: "number", min: 1, max: 999, def: 1, hint: "How many identical rooms of this type you have." },
  { k: "amenities", l: "Amenities", t: "text", span: 2, hint: "Comma separated, e.g. Wi-Fi, Air conditioning, Private balcony, Mini bar" },
  { k: "coverImage", l: "Cover image", t: "image", folder: "rooms", span: 2 },
  { k: "isFeatured", l: "Feature on the home page", t: "checkbox" },
  { k: "isActive", l: "Published on the website", t: "checkbox", def: true },
  { k: "sortOrder", l: "Sort order", t: "number", def: 0, hint: "Lower numbers appear first." }
];

page("rooms", crud({
  key: "rooms", singular: "Room", plural: "Rooms & suites", icon: "bed",
  endpoint: "/api/admin/rooms", createPath: "/api/admin/rooms",
  updatePath: (id) => `/api/admin/rooms/${id}`, removePath: (id) => `/api/admin/rooms/${id}`,
  idField: "id", searchKeys: ["name", "slug", "shortDescription"],
  labelOf: (r) => r?.name || "this room",
  hint: "Guests see the cover image, price and amenities on the rooms page.",
  emptyHint: "Add your first room type to start taking bookings.",
  defaults: { maxAdults: 2, maxChildren: 1, totalUnits: 1, isActive: true, sortOrder: 0, discountPercent: 0 },
  fields: roomFields(),
  filters: [
    { key: "categoryId", label: "Room type", options: () => toOptions(catsOf("Room"), { blank: "All room types" }) },
    { key: "isActive", label: "Status", options: () => [{ value: "", label: "All" }, { value: "true", label: "Published" }, { value: "false", label: "Hidden" }] }
  ],
  columns: [
    { label: "Photo", cell: (r) => thumb(r.coverImage, r.name) },
    { label: "Room", cell: (r) => `<span class="strong">${esc(r.name)}</span><br><span class="muted-sm">${esc(r.slug || "")}</span>` },
    { label: "Type", cell: (r) => esc(catName(r.categoryId)) },
    { label: "Price", num: true, cell: (r) => esc(money(r.pricePerNight)) },
    { label: "Units", num: true, cell: (r) => num(r.totalUnits) },
    { label: "Guests", cell: (r) => `${num(r.maxAdults)} adults, ${num(r.maxChildren)} children` },
    { label: "Bookings", num: true, cell: (r) => num(r.bookings) },
    { label: "Status", cell: (r) => `${activeBadge(r.isActive)}${r.isFeatured ? " " + badge("Featured", "amber") : ""}` }
  ],
  extraActions: [
    { key: "images", label: "Photos", run: (row) => go("room-images", row.id) }
  ]
}));

page("room-categories", crud({
  key: "room-categories", singular: "Room type", plural: "Room types", icon: "layers",
  endpoint: "/api/admin/categories?type=Room", createPath: "/api/admin/categories",
  updatePath: (id) => `/api/admin/categories/${id}`, removePath: (id) => `/api/admin/categories/${id}`,
  idField: "id", searchKeys: ["name", "description"],
  labelOf: (r) => r?.name,
  hint: "Room types are used for the filters and menus on the rooms page.",
  defaults: { type: "Room", isActive: true, sortOrder: 0 },
  fields: [
    { k: "name", l: "Type name", t: "text", required: true, placeholder: "Suites" },
    { k: "type", l: "Applies to", t: "select", options: () => ["Room", "Food", "Gallery", "Blog"] },
    { k: "description", l: "Description", t: "textarea", rows: 3, span: 2 },
    { k: "imageUrl", l: "Image", t: "image", folder: "rooms", span: 2 },
    { k: "icon", l: "Icon name", t: "text", placeholder: "crown", hint: "bed, crown, spa, pool, leaf, sun, star, home" },
    { k: "sortOrder", l: "Sort order", t: "number", def: 0 },
    { k: "isActive", l: "Show on the website", t: "checkbox", def: true }
  ],
  columns: [
    { label: "Image", cell: (r) => thumb(r.imageUrl, r.name) },
    { label: "Name", cell: (r) => `<span class="strong">${esc(r.name)}</span><br><span class="muted-sm">${esc(r.slug || "")}</span>` },
    { label: "Applies to", cell: (r) => badge(r.type, "blue") },
    { label: "Rooms", num: true, cell: (r) => num(r.rooms) },
    { label: "Dishes", num: true, cell: (r) => num(r.food) },
    { label: "Order", num: true, cell: (r) => num(r.sortOrder) },
    { label: "Status", cell: (r) => activeBadge(r.isActive) }
  ]
}));

page("food", crud({
  key: "food", singular: "Dish", plural: "Menu items", icon: "bowl",
  endpoint: "/api/admin/food", createPath: "/api/admin/food",
  updatePath: (id) => `/api/admin/food/${id}`, removePath: (id) => `/api/admin/food/${id}`,
  idField: "id", searchKeys: ["name", "description"],
  labelOf: (r) => r?.name,
  hint: "Dishes appear on the dining page and can be pre-ordered with a booking.",
  defaults: { isVeg: true, isAvailable: true, sortOrder: 0 },
  fields: [
    { k: "name", l: "Dish name", t: "text", required: true, placeholder: "Himachali Trout" },
    { k: "categoryId", l: "Menu category", t: "select", numeric: true, options: () => toOptions(catsOf("Food"), { blank: "— pick a category —" }) },
    { k: "description", l: "Description", t: "textarea", rows: 3, span: 2 },
    { k: "price", l: "Price", t: "decimal", min: 0, required: true, def: 350 },
    { k: "discountPrice", l: "Offer price", t: "decimal", min: 0, nullable: true, hint: "Leave blank for no offer." },
    { k: "spiceLevel", l: "Spice level", t: "select", options: () => ["", "Mild", "Medium", "Hot", "Extra hot"] },
    { k: "imageUrl", l: "Photo", t: "image", folder: "food", span: 2 },
    { k: "isVeg", l: "Vegetarian", t: "checkbox", def: true },
    { k: "isFeatured", l: "Chef's pick", t: "checkbox" },
    { k: "isAvailable", l: "Available today", t: "checkbox", def: true },
    { k: "sortOrder", l: "Sort order", t: "number", def: 0 }
  ],
  filters: [
    { key: "categoryId", label: "Category", options: () => toOptions(catsOf("Food"), { blank: "All categories" }) },
    { key: "isAvailable", label: "Availability", options: () => [{ value: "", label: "All" }, { value: "true", label: "Available" }, { value: "false", label: "Sold out" }] }
  ],
  columns: [
    { label: "Photo", cell: (r) => thumb(r.imageUrl, r.name) },
    { label: "Dish", cell: (r) => `<span class="strong">${esc(r.name)}</span><br><span class="muted-sm">${esc(r.category || "")}</span>` },
    { label: "Price", num: true, cell: (r) => `${esc(money(r.discountPrice ?? r.price))}${r.discountPrice ? `<br><span class="muted-sm" style="text-decoration:line-through">${esc(money(r.price))}</span>` : ""}` },
    { label: "Diet", cell: (r) => badge(r.isVeg ? "Veg" : "Non-veg", r.isVeg ? "green" : "red") },
    { label: "Orders", num: true, cell: (r) => num(r.orders) },
    { label: "Revenue", num: true, cell: (r) => esc(money(r.revenue)) },
    { label: "Status", cell: (r) => `${r.isAvailable ? badge("Available", "green") : badge("Sold out", "red")}${r.isFeatured ? " " + badge("Chef's pick", "amber") : ""}` }
  ]
}));

page("food-categories", crud({
  key: "food-categories", singular: "Menu category", plural: "Menu categories", icon: "layers",
  endpoint: "/api/admin/categories?type=Food", createPath: "/api/admin/categories",
  updatePath: (id) => `/api/admin/categories/${id}`, removePath: (id) => `/api/admin/categories/${id}`,
  idField: "id", searchKeys: ["name", "description"],
  labelOf: (r) => r?.name,
  hint: "Menu categories become the tabs on the dining page.",
  defaults: { type: "Food", isActive: true, sortOrder: 0 },
  fields: [
    { k: "name", l: "Category name", t: "text", required: true, placeholder: "Starters" },
    { k: "type", l: "Applies to", t: "select", options: () => ["Room", "Food", "Gallery", "Blog"] },
    { k: "description", l: "Description", t: "textarea", rows: 3, span: 2 },
    { k: "imageUrl", l: "Image", t: "image", folder: "food", span: 2 },
    { k: "icon", l: "Icon name", t: "text", placeholder: "flame", hint: "bowl, flame, cup, cake, leaf, star" },
    { k: "sortOrder", l: "Sort order", t: "number", def: 0 },
    { k: "isActive", l: "Show on the website", t: "checkbox", def: true }
  ],
  columns: [
    { label: "Image", cell: (r) => thumb(r.imageUrl, r.name) },
    { label: "Name", cell: (r) => `<span class="strong">${esc(r.name)}</span><br><span class="muted-sm">${esc(r.slug || "")}</span>` },
    { label: "Type", cell: (r) => badge(r.type, "blue") },
    { label: "Dishes", num: true, cell: (r) => num(r.food) },
    { label: "Order", num: true, cell: (r) => num(r.sortOrder) },
    { label: "Status", cell: (r) => activeBadge(r.isActive) }
  ]
}));

page("carousel", crud({
  key: "carousel", singular: "Slide", plural: "Hero slides", icon: "image",
  endpoint: "/api/admin/carousel", createPath: "/api/admin/carousel",
  updatePath: (id) => `/api/admin/carousel/${id}`, removePath: (id) => `/api/admin/carousel/${id}`,
  idField: "id", searchKeys: ["title", "subtitle"],
  labelOf: (r) => r?.title || "this slide",
  hint: "Slides rotate automatically at the top of the home page. Images, hosted video or a YouTube link all work.",
  defaults: { mediaType: "Image", isActive: true, sortOrder: 0 },
  fields: [
    { k: "title", l: "Headline", t: "text", span: 2, placeholder: "Where Elegance Meets Nature" },
    { k: "subtitle", l: "Sub headline", t: "textarea", rows: 2, span: 2 },
    { k: "mediaType", l: "Media type", t: "select", options: () => ["Image", "Video", "YouTube"] },
    { k: "sortOrder", l: "Sort order", t: "number", def: 0 },
    { k: "mediaUrl", l: "Media", t: "image", folder: "carousel", span: 2, hint: "Image or .mp4 file. For YouTube use the watch or share link." },
    { k: "posterUrl", l: "Video poster image", t: "image", folder: "carousel", span: 2, hint: "Optional still frame shown while a video loads." },
    { k: "buttonText", l: "Primary button text", t: "text", placeholder: "Book your stay" },
    { k: "buttonLink", l: "Primary button link", t: "text", placeholder: "/booking.html" },
    { k: "button2Text", l: "Secondary button text", t: "text", placeholder: "Explore the resort" },
    { k: "button2Link", l: "Secondary button link", t: "text", placeholder: "/rooms.html" },
    { k: "isActive", l: "Include this slide", t: "checkbox", def: true }
  ],
  columns: [
    { label: "Media", cell: (r) => thumb(r.mediaUrl, r.title) },
    { label: "Headline", cell: (r) => `<span class="strong">${esc(r.title || "(untitled)")}</span><br><span class="muted-sm">${esc((r.subtitle || "").slice(0, 70))}</span>` },
    { label: "Type", cell: (r) => badge(r.mediaType, "blue") },
    { label: "Buttons", cell: (r) => `${r.buttonText ? esc(r.buttonText) : "—"}${r.button2Text ? " / " + esc(r.button2Text) : ""}` },
    { label: "Order", num: true, cell: (r) => num(r.sortOrder) },
    { label: "Status", cell: (r) => activeBadge(r.isActive) }
  ]
}));

page("gallery", crud({
  key: "gallery", singular: "Gallery item", plural: "Gallery media", icon: "camera",
  endpoint: "/api/admin/gallery", createPath: "/api/admin/gallery",
  updatePath: (id) => `/api/admin/gallery/${id}`, removePath: (id) => `/api/admin/gallery/${id}`,
  idField: "id", searchKeys: ["title"],
  labelOf: (r) => r?.title || "this item",
  defaults: { mediaType: "Image", isActive: true, sortOrder: 0 },
  fields: [
    { k: "title", l: "Title", t: "text", required: true, placeholder: "Infinity pool at sunset" },
    { k: "categoryId", l: "Album", t: "select", numeric: true, options: () => toOptions(catsOf("Gallery"), { blank: "— no album —" }) },
    { k: "mediaType", l: "Media type", t: "select", options: () => ["Image", "Video", "YouTube"] },
    { k: "url", l: "Media", t: "image", folder: "gallery", span: 2, hint: "Image, .mp4 file or a YouTube link." },
    { k: "thumbnailUrl", l: "Thumbnail", t: "image", folder: "gallery", span: 2, hint: "Optional. Used on the gallery grid for videos." },
    { k: "sortOrder", l: "Sort order", t: "number", def: 0 },
    { k: "isActive", l: "Show in the gallery", t: "checkbox", def: true }
  ],
  filters: [
    { key: "categoryId", label: "Album", options: () => toOptions(catsOf("Gallery"), { blank: "All albums" }) },
    { key: "mediaType", label: "Media", options: () => [{ value: "", label: "All media" }, { value: "Image", label: "Images" }, { value: "Video", label: "Videos" }, { value: "YouTube", label: "YouTube" }] }
  ],
  columns: [
    { label: "Preview", cell: (r) => thumb(r.thumbnailUrl || r.url, r.title) },
    { label: "Title", cell: (r) => `<span class="strong">${esc(r.title)}</span><br><span class="muted-sm">${esc(catName(r.categoryId))}</span>` },
    { label: "Type", cell: (r) => badge(r.mediaType, "blue") },
    { label: "Order", num: true, cell: (r) => num(r.sortOrder) },
    { label: "Status", cell: (r) => activeBadge(r.isActive) }
  ]
}));

page("facilities", crud({
  key: "facilities", singular: "Facility", plural: "Facilities", icon: "sparkle",
  endpoint: "/api/admin/facilities", createPath: "/api/admin/facilities",
  updatePath: (id) => `/api/admin/facilities/${id}`, removePath: (id) => `/api/admin/facilities/${id}`,
  idField: "id", searchKeys: ["title", "description"],
  labelOf: (r) => r?.title,
  defaults: { isActive: true, sortOrder: 0, icon: "sparkle" },
  fields: [
    { k: "title", l: "Facility", t: "text", required: true, placeholder: "Infinity pool" },
    { k: "icon", l: "Icon", t: "select", options: () => ["sparkle", "pool", "spa", "bed", "leaf", "crown", "users", "home", "bowl", "flame", "star", "car", "sun", "cake", "cup", "camera", "wifi", "shield", "clock", "phone", "pin"] },
    { k: "description", l: "Description", t: "textarea", rows: 3, span: 2 },
    { k: "imageUrl", l: "Image", t: "image", folder: "facilities", span: 2 },
    { k: "sortOrder", l: "Sort order", t: "number", def: 0 },
    { k: "isActive", l: "Show on the website", t: "checkbox", def: true }
  ],
  columns: [
    { label: "Icon", cell: (r) => `<span class="badge badge-amber">${esc(r.icon || "sparkle")}</span>` },
    { label: "Image", cell: (r) => thumb(r.imageUrl, r.title) },
    { label: "Facility", cell: (r) => `<span class="strong">${esc(r.title)}</span><br><span class="muted-sm">${esc((r.description || "").slice(0, 80))}</span>` },
    { label: "Order", num: true, cell: (r) => num(r.sortOrder) },
    { label: "Status", cell: (r) => activeBadge(r.isActive) }
  ]
}));

page("testimonials", crud({
  key: "testimonials", singular: "Testimonial", plural: "Testimonials", icon: "quote",
  endpoint: "/api/admin/testimonials", createPath: "/api/admin/testimonials",
  updatePath: (id) => `/api/admin/testimonials/${id}`, removePath: (id) => `/api/admin/testimonials/${id}`,
  idField: "id", searchKeys: ["name", "message", "location"],
  labelOf: (r) => r?.name,
  defaults: { isActive: true, sortOrder: 0, rating: 5 },
  fields: [
    { k: "name", l: "Guest name", t: "text", required: true },
    { k: "designation", l: "Designation", t: "text", placeholder: "Honeymoon stay" },
    { k: "location", l: "City", t: "text", placeholder: "Mumbai" },
    { k: "rating", l: "Rating", t: "number", min: 1, max: 5, def: 5 },
    { k: "message", l: "Review", t: "textarea", rows: 4, required: true, span: 2 },
    { k: "imageUrl", l: "Guest photo", t: "image", folder: "testimonials", span: 2 },
    { k: "sortOrder", l: "Sort order", t: "number", def: 0 },
    { k: "isActive", l: "Show on the website", t: "checkbox", def: true }
  ],
  columns: [
    { label: "Photo", cell: (r) => thumb(r.imageUrl, r.name) },
    { label: "Guest", cell: (r) => `<span class="strong">${esc(r.name)}</span><br><span class="muted-sm">${esc(r.location || "")}</span>` },
    { label: "Rating", cell: (r) => "★".repeat(Math.max(1, Math.min(5, num(r.rating, 5)))) },
    { label: "Review", cell: (r) => `<span class="muted-sm">${esc((r.message || "").slice(0, 110))}…</span>` },
    { label: "Order", num: true, cell: (r) => num(r.sortOrder) },
    { label: "Status", cell: (r) => activeBadge(r.isActive) }
  ]
}));

/* ====================================================== room photo gallery */

page("room-images", async (param, host) => {
  const rooms = await api("/api/admin/rooms");
  const room = rooms.find((r) => String(r.id) === String(param));
  if (!room) {
    host.innerHTML = `<div class="panel"><div class="panel-body">
      <div class="alert alert-error">That room no longer exists.</div>
      <button class="btn" type="button" id="backRooms">Back to rooms</button></div></div>`;
    $("#backRooms").onclick = () => go("rooms");
    return;
  }

  setTitle(`${room.name} — photo gallery`, `${(room.images || []).length} image(s). The first image is used as the room cover when none is set.`);

  const fields = [
    { k: "imageUrl", l: "Image", t: "image", folder: "rooms", required: true },
    { k: "caption", l: "Caption", t: "text", placeholder: "Balcony view" }
  ];
  primeFields(fields);

  host.innerHTML = `
    <div class="toolbar">
      <button class="btn btn-outline" type="button" id="backRooms">← All rooms</button>
      <a class="btn btn-outline" href="/room-details.html?slug=${encodeURIComponent(room.slug)}" target="_blank" rel="noopener">Preview on the website</a>
    </div>
    <div class="panel">
      <div class="panel-head"><div><h2>Add a photo</h2><p>Upload a file or pick one from the media library, then add a caption.</p></div></div>
      <div class="panel-body">
        <div id="imgForm">${renderForm(fields, {})}</div>
        <button class="btn" type="button" id="addImg" style="margin-top:16px">Add to gallery</button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><h2>Gallery</h2><p>Drag-free ordering: delete and re-add, or set the cover from the room editor.</p></div></div>
      <div class="panel-body"><div class="media-grid" id="imgGrid"></div></div>
    </div>`;

  const addForm = $("#imgForm");
  wireForm(addForm);
  $("#backRooms").onclick = () => go("rooms");

  function paintGrid() {
    const images = room.images || [];
    $("#imgGrid").innerHTML = images.length
      ? images.map((img) => `<div class="media-cell">
          <div class="thumb"><img src="${esc(img.imageUrl)}" alt=""></div>
          <div class="meta">
            <strong>${esc(img.caption || `Image ${img.id}`)}</strong>
            <span>${esc(img.imageUrl)}</span>
            <div class="row">
              <button class="icon-btn" type="button" data-cover="${img.id}">Set cover</button>
              <button class="icon-btn danger" type="button" data-delimg="${img.id}">Delete</button>
            </div>
          </div></div>`).join("")
      : `<div class="empty-admin">${svg("camera", 44)}<p><strong>No gallery images yet</strong></p><p class="small">Add the first one above.</p></div>`;

    $$("[data-delimg]").forEach((b) => (b.onclick = async () => {
      const ok = await confirmDialog("Remove this image from the room gallery?", { title: "Delete image", ok: "Remove it" });
      if (!ok) return;
      try {
        await api(`/api/admin/rooms/${room.id}/images/${b.dataset.delimg}`, { method: "DELETE" });
        room.images = room.images.filter((i) => String(i.id) !== String(b.dataset.delimg));
        paintGrid();
        toast("Image removed", "success");
      } catch (err) { toast(err.message, "error"); }
    }));

    $$("[data-cover]").forEach((b) => (b.onclick = async () => {
      const img = room.images.find((i) => String(i.id) === String(b.dataset.cover));
      try {
        await api(`/api/admin/rooms/${room.id}`, { method: "PUT", body: { ...room, coverImage: img.imageUrl } });
        toast("Room cover updated", "success");
      } catch (err) { toast(err.message, "error"); }
    }));
  }
  paintGrid();

  $("#addImg").onclick = async () => {
    const body = readForm(addForm, fields);
    if (!body.imageUrl) { toast("Pick or upload an image first", "warn"); return; }
    const btn = $("#addImg");
    btn.classList.add("is-loading");
    try {
      await api(`/api/admin/rooms/${room.id}/images`, { method: "POST", body });
      const fresh = await api(`/api/admin/rooms/${room.id}`);
      room.images = fresh.images || [];
      addForm.innerHTML = renderForm(fields, {});
      wireForm(addForm);
      paintGrid();
      toast("Image added to the gallery", "success");
    } catch (err) {
      toast(err.message, "error");
    } finally {
      btn.classList.remove("is-loading");
    }
  };
});
