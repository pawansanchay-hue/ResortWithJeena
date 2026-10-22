/* ==========================================================================
   Jeena Resort & Spa - admin core
   Small helpers, icon set, SVG charts, form/field rendering, media picker,
   upload plumbing and the route registry. Every screen module imports this.
   ========================================================================== */

import {
  api, auth, esc, money, num, fmtDate, fmtDateTime, initials, statusBadge,
  toast, confirmDialog, openModal, closeModal, lightbox, icon, emptyState
} from "../../js/app.js";

export {
  api, auth, esc, money, num, fmtDate, fmtDateTime, initials, statusBadge,
  toast, confirmDialog, openModal, closeModal, lightbox, icon, emptyState
};

/* --------------------------------------------------------------- shortcuts */

export const $ = (sel, scope = document) => scope.querySelector(sel);
export const $$ = (sel, scope = document) => [...scope.querySelectorAll(sel)];
export const view = () => $("#view");

export const LS = { token: "jr_token", user: "jr_user" };

/* =========================================================== global state */

export const S = {
  settings: null,      // { groups, preview }
  categories: [],      // room + food + gallery categories
  dash: null,          // latest dashboard payload (used for nav badges)
  route: "",
  me: null
};

export async function loadCategories() {
  try {
    S.categories = await api("/api/admin/categories");
  } catch {
    S.categories = [];
  }
  return S.categories;
}

export const catsOf = (type) =>
  (S.categories || []).filter((c) => c.type === type)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

export const catName = (id) => (S.categories || []).find((c) => c.id === id)?.name || "—";

export const toOptions = (list, { value = "id", label = "name", blank = null } = {}) => {
  const opts = list.map((r) => ({ value: String(r[value]), label: r[label] }));
  if (blank) opts.unshift({ value: "", label: blank });
  return opts;
};

/* ================================================================= icons */

export const SVG = {
  grid: '<path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>',
  chart: '<path d="M4 20h16v2H4V3h2zm3-2V8h3v10zm5 0V4h3v14zm5 0v-6h3v6z"/>',
  cal: '<path d="M7 2v2H5a2 2 0 0 0-2 2v14h18V6a2 2 0 0 0-2-2h-2V2h-2v2H9V2zM5 10h14v8H5z"/>',
  bowl: '<path d="M3 11h18a9 9 0 0 1-18 0zm4 8h10v2H7z"/>',
  mail: '<path d="M2 5h20v14H2zm2 2v.4l8 5 8-5V7z"/>',
  send: '<path d="M2 21l20-9L2 3l4 9z"/>',
  bed: '<path d="M2 8v11h20V8a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3zm2 0a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v3H4zm0 5h16v4H4z"/>',
  layers: '<path d="M12 2l9 5-9 5-9-5zm0 7.8L21 15l-9 5-9-5z"/>',
  text: '<path d="M4 3h16v3H13v15h-3V6H4z"/>',
  image: '<path d="M3 4h18v16H3zm3 12l3.5-4.5 2.5 3 3-4L20 18z"/>',
  camera: '<path d="M9 3h6l1.5 2H21v14H3V5h4.5zM12 8a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z"/>',
  sparkle: '<path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8zM19 15l.9 2.6L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.4z"/>',
  quote: '<path d="M7 6c-2.8 0-5 2.2-5 5v7h7v-7H5.5C5.7 9.6 6.9 8.5 8.5 8V6zm11 0c-2.8 0-5 2.2-5 5v7h7v-7h-3.5c.2-1.4 1.4-2.5 3-3V6z"/>',
  folder: '<path d="M2 5h7l2 2h11v13H2z"/>',
  cog: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm9.4 4.9l1.3 2.3-2.3 2.3-2-1.2a7.7 7.7 0 0 1-1.8 1l-.3 2.3h-3.2l-.3-2.3a7.7 7.7 0 0 1-1.8-1l-2 1.2-2.3-2.3 1.3-2.3a7.6 7.6 0 0 1 0-2.1L5.1 8.7 7.4 6.4l2 1.2a7.7 7.7 0 0 1 1.8-1l.3-2.3h3.2l.3 2.3c.6.2 1.2.6 1.8 1l2-1.2 2.3 2.3-1.3 2.3c.1.7.1 1.4 0 2.1z"/>',
  users: '<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20a7 7 0 0 1 14 0zm15 0a5.6 5.6 0 0 0-2-4.3A5 5 0 0 1 22 20z"/>',
  shield: '<path d="M12 2l8 3v6c0 5-3.4 9.3-8 11-4.6-1.7-8-6-8-11V5z"/>',
  plus: '<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>',
  pencil: '<path d="M4 17l10-10 3 3-10 10H4zM16 4l2-2 3 3-2 2z"/>',
  trash: '<path d="M6 7h12l-1 14H7zM9 4h6l1 2H8z"/>',
  check: '<path d="M9 16.2l-3.5-3.5L4 14.2 9 19 20 8l-1.4-1.4z"/>',
  clock: '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 11h-4v-2h2V6h2z"/>',
  down: '<path d="M12 16l-6-6h12z"/>',
  eye: '<path d="M12 5c5 0 9 4.5 9 7s-4 7-9 7-9-4.5-9-7 4-7 9-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>',
  copy: '<path d="M8 2h10v14H8zM4 6h2v14h10v2H4z"/>',
  logout: '<path d="M10 3h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8v-2h8V5h-8zM3 11h9l-3-3 1.4-1.4L16.8 12l-6.4 5.4L9 16l3-3H3z"/>'
};

export function svg(name, size = 18) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor">${SVG[name] || SVG.grid}</svg>`;
}

/* ============================================================== utilities */

export const debounce = (fn, wait = 300) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
};

export function pct(part, whole) {
  const w = num(whole);
  return w <= 0 ? 0 : Math.round((num(part) / w) * 1000) / 10;
}

export function bytes(n) {
  const v = num(n);
  if (v < 1024) return v + " B";
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + " KB";
  if (v < 1024 * 1024 * 1024) return (v / 1024 / 1024).toFixed(1) + " MB";
  return (v / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

export function relTime(value) {
  if (!value) return "—";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return String(value);
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (Math.abs(mins) < 1) return "just now";
  if (Math.abs(mins) < 60) return mins > 0 ? `${mins} min ago` : `in ${-mins} min`;
  const hours = Math.round(mins / 60);
  if (Math.abs(hours) < 24) return hours > 0 ? `${hours} h ago` : `in ${-hours} h`;
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return days > 0 ? `${days} d ago` : `in ${-days} d`;
  return fmtDate(value);
}

export function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export function dateInputValue(v) {
  if (!v) return "";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
}

export function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function downloadCsv(filename, headers, rows) {
  const lines = [headers.map(csvCell).join(",")];
  rows.forEach((r) => lines.push(r.map(csvCell).join(",")));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied to the clipboard", "success", 2000);
  } catch {
    toast("Could not copy automatically", "warn");
  }
}

/* ================================================================ charts */

const CHART_COLORS = ["#c8a24a", "#0f5132", "#3f7fbf", "#b4553c", "#7d6bb0", "#4c9a8a", "#a8773c", "#5b7f4f"];

/**
 * Grouped bar chart.
 * data: [{ label, <key>: number }]
 */
export function barChart(data, { keys, height = 250, format = money, colors = CHART_COLORS } = {}) {
  if (!data?.length) return emptyChart("No data in this period");
  const w = 720;
  const pad = { t: 16, r: 12, b: 42, l: 62 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const max = Math.max(1, ...data.flatMap((d) => keys.map((k) => num(d[k]))));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;

  const slot = iw / data.length;
  const barW = Math.max(4, (slot * 0.62) / keys.length);

  const gridLines = [];
  for (let v = 0; v <= top + 0.001; v += step) {
    const y = pad.t + ih - (v / top) * ih;
    gridLines.push(`<line class="grid-line" x1="${pad.l}" y1="${y.toFixed(1)}" x2="${w - pad.r}" y2="${y.toFixed(1)}"/>`);
    gridLines.push(`<text class="axis-label" x="${pad.l - 8}" y="${(y + 3.5).toFixed(1)}" text-anchor="end">${esc(shortNum(v))}</text>`);
  }

  const bars = data.map((d, i) => {
    const x0 = pad.l + i * slot + (slot - barW * keys.length) / 2;
    return keys.map((k, ki) => {
      const v = num(d[k]);
      const h = (v / top) * ih;
      const x = x0 + ki * barW;
      const y = pad.t + ih - h;
      return `<rect class="bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(2, barW - 2).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="3" fill="${colors[ki % colors.length]}"><title>${esc(d.label)} — ${esc(format(v))}</title></rect>`;
    }).join("");
  }).join("");

  const labelEvery = Math.ceil(data.length / 10);
  const labels = data.map((d, i) => i % labelEvery === 0
    ? `<text class="axis-label" x="${(pad.l + i * slot + slot / 2).toFixed(1)}" y="${height - 14}" text-anchor="middle">${esc(String(d.label).slice(0, 12))}</text>`
    : "").join("");

  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${w} ${height}" preserveAspectRatio="xMidYMid meet">
    ${gridLines.join("")}${bars}${labels}</svg>${legend(keys, colors)}</div>`;
}

/** Multi-series line chart. */
export function lineChart(data, { keys, height = 250, format = money, colors = CHART_COLORS } = {}) {
  if (!data?.length) return emptyChart("No data in this period");
  const w = 720;
  const pad = { t: 16, r: 14, b: 42, l: 62 };
  const iw = w - pad.l - pad.r;
  const ih = height - pad.t - pad.b;

  const max = Math.max(1, ...data.flatMap((d) => keys.map((k) => num(d[k]))));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const x = (i) => pad.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v) => pad.t + ih - (num(v) / top) * ih;

  const gridLines = [];
  for (let v = 0; v <= top + 0.001; v += step) {
    gridLines.push(`<line class="grid-line" x1="${pad.l}" y1="${y(v).toFixed(1)}" x2="${w - pad.r}" y2="${y(v).toFixed(1)}"/>`);
    gridLines.push(`<text class="axis-label" x="${pad.l - 8}" y="${(y(v) + 3.5).toFixed(1)}" text-anchor="end">${esc(shortNum(v))}</text>`);
  }

  const series = keys.map((k, ki) => {
    const color = colors[ki % colors.length];
    const path = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(d[k]).toFixed(1)}`).join(" ");
    const dots = data.map((d, i) => `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(d[k]).toFixed(1)}" r="3.4" fill="${color}"><title>${esc(d.label)} — ${esc(format(num(d[k])))}</title></circle>`).join("");
    return `<path class="line" d="${path}" stroke="${color}"/>${dots}`;
  }).join("");

  const every = Math.ceil(data.length / 10);
  const labels = data.map((d, i) => i % every === 0
    ? `<text class="axis-label" x="${x(i).toFixed(1)}" y="${height - 14}" text-anchor="middle">${esc(String(d.label).slice(0, 12))}</text>`
    : "").join("");

  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${w} ${height}" preserveAspectRatio="xMidYMid meet">
    ${gridLines.join("")}${series}${labels}</svg>${legend(keys, colors)}</div>`;
}

/** Donut chart with a centre total. */
export function donutChart(items, { labelKey = "status", valueKey = "count", size = 176, format = (v) => num(v), colors = CHART_COLORS } = {}) {
  if (!items?.length) return emptyChart("Nothing to show yet");
  const total = items.reduce((s, i) => s + num(i[valueKey]), 0) || 1;
  const r = 56;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const arcs = items.map((it, i) => {
    const frac = num(it[valueKey]) / total;
    const dash = `${(frac * c).toFixed(2)} ${(c - frac * c).toFixed(2)}`;
    const seg = `<circle cx="88" cy="88" r="${r}" fill="none" stroke="${colors[i % colors.length]}"
      stroke-width="22" stroke-dasharray="${dash}" stroke-dashoffset="${(-offset).toFixed(2)}"
      transform="rotate(-90 88 88)"><title>${esc(it[labelKey])}: ${esc(format(num(it[valueKey])))}</title></circle>`;
    offset += frac * c;
    return seg;
  }).join("");

  const list = items.map((it, i) => `<div class="row" style="margin-bottom:8px">
      <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${colors[i % colors.length]};margin-right:8px"></i>${esc(it[labelKey])}</span>
      <span>${esc(format(num(it[valueKey])))}</span></div>`).join("");

  return `<div class="donut">
    <svg viewBox="0 0 176 176" width="${size}" height="${size}">
      <circle cx="88" cy="88" r="${r}" fill="none" stroke="var(--border,#e3e8e5)" stroke-width="22"/>
      ${arcs}
      <text x="88" y="84" text-anchor="middle" font-size="22" font-weight="700" fill="var(--heading,#14342a)">${esc(shortNum(total))}</text>
      <text x="88" y="104" text-anchor="middle" font-size="11" fill="var(--muted,#667)">TOTAL</text>
    </svg>
    <div style="flex:1;min-width:170px">${list}</div></div>`;
}

function legend(keys, colors) {
  if (keys.length < 2) return "";
  return `<div class="chart-legend">${keys.map((k, i) =>
    `<span><i style="background:${colors[i % colors.length]}"></i>${esc(prettifyKey(k))}</span>`).join("")}</div>`;
}

function prettifyKey(k) {
  return String(k).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());
}

function shortNum(v) {
  const n = num(v);
  const abs = Math.abs(n);
  if (abs >= 1e7) return (n / 1e7).toFixed(1) + "Cr";
  if (abs >= 1e5) return (n / 1e5).toFixed(1) + "L";
  if (abs >= 1e3) return (n / 1e3).toFixed(abs >= 1e4 ? 0 : 1) + "k";
  return String(Math.round(n));
}

function niceStep(max) {
  const raw = max / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const norm = raw / mag;
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return step * mag;
}

export function emptyChart(message) {
  return `<div class="empty-admin">${svg("chart", 44)}<p><strong>${esc(message)}</strong></p></div>`;
}

export function barList(items, { labelKey = "label", valueKey = "value", format = money, limit = 8 } = {}) {
  const rows = items.slice(0, limit);
  if (!rows.length) return emptyChart("No data yet");
  const max = Math.max(1, ...rows.map((r) => num(r[valueKey])));
  return `<div class="bar-list">${rows.map((r) => `<div class="row">
      <span>${esc(r[labelKey])}</span><span>${esc(format(num(r[valueKey])))}</span>
      <span class="track"><span class="fill" style="width:${((num(r[valueKey]) / max) * 100).toFixed(1)}%"></span></span>
    </div>`).join("")}</div>`;
}

/* ============================================================== fields */

/**
 * Field descriptor:
 * { k, l, t, hint, required, placeholder, rows, min, max, options, numeric, def, folder, accept }
 * t: text | textarea | number | decimal | checkbox | select | color | image | video | password | date | readonly | tags
 */
export function fieldHtml(f, value) {
  const id = "f_" + f.k;
  if (f.t === "checkbox") {
    return `<label class="check" ${f.span === 2 ? 'style="grid-column:1/-1"' : ""}>
      <input type="checkbox" data-k="${esc(f.k)}" ${value ? "checked" : ""}><span>${esc(f.l)}</span></label>`;
  }
  const hint = f.hint ? `<span class="hint">${esc(f.hint)}</span>` : "";
  const wrap = (html) => `<div class="field" ${f.span === 2 ? 'style="grid-column:1/-1"' : ""}>
    <label for="${id}">${esc(f.l)}${f.required ? ' <span class="req">*</span>' : ""}</label>${html}${hint}</div>`;

  switch (f.t) {
    case "textarea":
      return wrap(`<textarea id="${id}" data-k="${esc(f.k)}" rows="${f.rows || 4}" placeholder="${esc(f.placeholder || "")}">${esc(value ?? "")}</textarea>`);

    case "select": {
      const opts = typeof f.options === "function" ? f.options() : (f.options || []);
      const current = value ?? "";
      return wrap(`<select id="${id}" data-k="${esc(f.k)}">${opts.map((o) => {
        const v = o.value ?? o, l = o.label ?? o;
        return `<option value="${esc(v)}" ${String(v) === String(current) ? "selected" : ""}>${esc(l)}</option>`;
      }).join("")}</select>`);
    }

    case "color": {
      const v = value || "#c8a24a";
      return wrap(`<div class="color-input">
        <input type="color" data-color-for="${esc(f.k)}" value="${esc(v)}">
        <input type="text" id="${id}" data-k="${esc(f.k)}" value="${esc(v)}" placeholder="#c8a24a">
      </div>`);
    }

    case "number":
    case "decimal":
      return wrap(`<input type="number" id="${id}" data-k="${esc(f.k)}" step="${f.t === "decimal" ? (f.step || "0.01") : "1"}"
        ${f.min != null ? `min="${f.min}"` : ""} ${f.max != null ? `max="${f.max}"` : ""}
        value="${value === null || value === undefined ? "" : esc(value)}">`);

    case "image":
    case "video": {
      const v = value || "";
      const isImage = f.t === "image" && v && !/\.(mp4|webm|mov|m4v)$/i.test(v);
      const preview = isImage
        ? `<img src="${esc(v)}" alt="">`
        : (v ? `<span style="font-size:.66rem;word-break:break-all;padding:4px">${esc(String(v).split("/").pop())}</span>` : "none");
      return wrap(`<div class="media-input">
        <div class="preview">${preview}</div>
        <div class="stack">
          <input type="text" id="${id}" data-k="${esc(f.k)}" value="${esc(v)}" placeholder="${esc(f.placeholder || (f.t === "video" ? "/uploads/... .mp4 or a YouTube link" : "/assets/... or https://..."))}">
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="icon-btn" data-pick="${esc(f.k)}">Library</button>
            <label class="icon-btn" style="display:inline-block">Upload
              <input type="file" data-upload="${esc(f.k)}" data-folder="${esc(f.folder || "general")}" accept="${esc(f.accept || (f.t === "video" ? "video/*" : "image/*"))}" hidden>
            </label>
          </div>
        </div></div>`);
    }

    case "password":
      return wrap(`<input type="password" id="${id}" data-k="${esc(f.k)}" value="${esc(value ?? "")}" autocomplete="new-password" placeholder="${esc(f.placeholder || "")}">`);

    case "date":
      return wrap(`<input type="date" id="${id}" data-k="${esc(f.k)}" value="${esc(dateInputValue(value))}">`);

    case "readonly":
      return wrap(`<input type="text" id="${id}" value="${esc(value ?? "")}" disabled style="background:var(--section-bg,#f8faf9)">`);

    default:
      return wrap(`<input type="text" id="${id}" data-k="${esc(f.k)}" value="${esc(value ?? "")}" placeholder="${esc(f.placeholder || "")}">`);
  }
}

export function renderForm(fields, row = {}) {
  return `<div class="admin-form">${fields.map((f) => fieldHtml(f, row[f.k])).join("")}</div>`;
}

/** Read every [data-k] control inside scope into a plain object. */
export function readForm(scope, fields) {
  const out = {};
  fields.forEach((f) => {
    const el = scope.querySelector(`[data-k="${f.k}"]`);
    if (!el || f.t === "readonly") return;
    if (f.t === "checkbox") out[f.k] = el.checked;
    else if (f.t === "number") out[f.k] = el.value === "" ? (f.def ?? 0) : Math.trunc(Number(el.value));
    else if (f.t === "decimal") out[f.k] = el.value === "" ? null : Number(el.value);
    else if (f.numeric) out[f.k] = el.value === "" ? null : Number(el.value);
    else if (f.t === "tags") out[f.k] = el.value;
    else out[f.k] = el.value === "" && f.nullable ? null : el.value;
  });
  return out;
}

/** Wire colour pickers, library pickers and uploads inside a scope. */
export function wireForm(scope, { onUploaded } = {}) {
  $$("[data-color-for]", scope).forEach((picker) => {
    const key = picker.dataset.colorFor;
    const text = scope.querySelector(`[data-k="${key}"]`);
    if (!text) return;
    picker.oninput = () => { text.value = picker.value; };
    text.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(text.value.trim())) picker.value = text.value.trim(); };
  });

  $$("[data-pick]", scope).forEach((btn) => {
    btn.onclick = () => openMediaPicker((url) => {
      const input = scope.querySelector(`[data-k="${btn.dataset.pick}"]`);
      if (input) { input.value = url; input.dispatchEvent(new Event("change")); }
      syncPreview(scope, btn.dataset.pick, url);
    });
  });

  $$("[data-upload]", scope).forEach((input) => {
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const key = input.dataset.upload;
      const label = input.closest("label");
      const restore = label ? label.textContent : "Upload";
      if (label) label.textContent = "Uploading…";
      try {
        const res = await uploadFile(file, input.dataset.folder || "general");
        const url = res.url || res.path || res.fileUrl;
        const field = scope.querySelector(`[data-k="${key}"]`);
        if (field) field.value = url;
        syncPreview(scope, key, url);
        toast("File uploaded", "success");
        onUploaded?.(url, key);
      } catch (err) {
        toast(err.message, "error");
      } finally {
        if (label) label.textContent = restore;
        input.value = "";
      }
    };
  });

  $$("input[data-k], textarea[data-k]", scope).forEach((el) => {
    el.addEventListener("change", () => {
      const field = fields_cache.get(el.dataset.k);
      if (field && (field.t === "image" || field.t === "video")) syncPreview(scope, el.dataset.k, el.value);
    });
  });
}

const fields_cache = new Map();

export function primeFields(fields) {
  fields_cache.clear();
  fields.forEach((f) => fields_cache.set(f.k, f));
}

function syncPreview(scope, key, url) {
  const wrap = scope.querySelector(`[data-k="${key}"]`)?.closest(".media-input");
  if (!wrap) return;
  const box = wrap.querySelector(".preview");
  const isImage = url && !/\.(mp4|webm|mov|m4v)$/i.test(url);
  box.innerHTML = isImage
    ? `<img src="${esc(url)}" alt="">`
    : (url ? `<span style="font-size:.66rem;word-break:break-all;padding:4px">${esc(String(url).split("/").pop())}</span>` : "none");
}

/* ============================================================== modals */

export const modalRoot = () => $("#adminModal");
export const modalBox = () => $("#adminModalBox");

export function openPanel(html, { wide = false, onReady } = {}) {
  const root = modalRoot();
  root.innerHTML = html;
  root.querySelector(".modal")?.classList.toggle("lg", wide);
  openModal(root);
  root.onclick = (e) => { if (e.target === root) closePanel(); };
  $$("[data-close-modal]", root).forEach((b) => (b.onclick = closePanel));
  onReady?.(root);
  return root;
}

export function closePanel() {
  const root = modalRoot();
  closeModal(root);
  setTimeout(() => { if (!root.classList.contains("show")) root.innerHTML = ""; }, 260);
}

/* ============================================================ media bits */

export async function uploadFile(file, folder = "general", { onProgress } = {}) {
  const form = new FormData();
  form.append("file", file);
  const res = await api(`/api/admin/upload?folder=${encodeURIComponent(folder)}`, { method: "POST", form });
  return res;
}

export async function openMediaPicker(onPick) {
  let list = [];
  try {
    const res = await api("/api/admin/media");
    list = res.items || [];
  } catch (err) {
    toast(err.message, "error");
    return;
  }
  const images = list.filter((m) => /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(m.name || m.url || ""));

  openPanel(`<div class="modal">
    <div class="modal-head">
      <div><h3 class="mb-0">Media library</h3><span class="small muted">${images.length} image(s) available</span></div>
      <button class="modal-close" data-close-modal>&times;</button>
    </div>
    <div class="modal-body">
      <div class="toolbar"><div class="field grow"><input type="text" id="mediaSearch" placeholder="Search by file name…"></div></div>
      <div class="media-grid" id="mediaGrid"></div>
    </div>
    <div class="modal-foot"><button class="btn btn-outline" data-close-modal>Cancel</button></div>
  </div>`, {
    wide: true,
    onReady: (root) => {
      const grid = root.querySelector("#mediaGrid");
      const paint = (filter = "") => {
        const rows = images.filter((m) => (m.name || m.url || "").toLowerCase().includes(filter.toLowerCase()));
        grid.innerHTML = rows.length ? rows.map((m) => `<button type="button" class="media-cell" data-url="${esc(m.url)}" style="text-align:left;border:1px solid var(--border);background:var(--card-bg);cursor:pointer;padding:0">
            <span class="thumb"><img src="${esc(m.url)}" alt=""></span>
            <span class="meta"><strong>${esc(m.name)}</strong><span>${bytes(m.size)}</span></span>
          </button>`).join("") : `<div class="empty-admin">${svg("image", 40)}<p><strong>No images found</strong></p></div>`;
        $$("[data-url]", grid).forEach((btn) => (btn.onclick = () => {
          onPick(btn.dataset.url);
          closePanel();
        }));
      };
      paint();
      root.querySelector("#mediaSearch").oninput = debounce((e) => paint(e.target.value), 220);
    }
  });
}

/* ============================================================ route table */

export const ROUTES = {};

export function page(key, handler) {
  ROUTES[key] = handler;
  return handler;
}

export function go(key, param = "") {
  location.hash = `#/${key}${param ? "/" + encodeURIComponent(param) : ""}`;
}

/* ================================================================ table */

export function tableWrap(headers, rows, { empty = "Nothing here yet" } = {}) {
  if (!rows) return `<div class="empty-admin">${svg("grid", 44)}<p><strong>${esc(empty)}</strong></p></div>`;
  return `<div class="table-wrap"><table class="data">
    <thead><tr>${headers.map((h) => `<th ${h.num ? 'class="num"' : ""}>${esc(h.label ?? h)}</th>`).join("")}</tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

export function pager(current, pages, onGo) {
  if (pages <= 1) return "";
  const buttons = [];
  const push = (label, page, opts = {}) => buttons.push(
    `<button type="button" data-page="${page}" ${opts.active ? 'class="active"' : ""} ${opts.disabled ? "disabled" : ""}>${label}</button>`);
  push("‹", current - 1, { disabled: current <= 1 });
  const from = Math.max(1, current - 2);
  const to = Math.min(pages, from + 4);
  for (let p = from; p <= to; p++) push(String(p), p, { active: p === current });
  push("›", current + 1, { disabled: current >= pages });
  const html = `<div class="pager">${buttons.join("")}</div>`;
  queueMicrotask(() => $$("[data-page]").forEach((b) => (b.onclick = () => onGo(Number(b.dataset.page)))));
  return html;
}

export function statCard(label, value, sub = "", { accent = false } = {}) {
  return `<div class="stat-card ${accent ? "accent" : ""}">
    <span class="lbl">${esc(label)}</span>
    <div class="val">${esc(value)}</div>
    ${sub ? `<span class="sub">${sub}</span>` : ""}</div>`;
}
