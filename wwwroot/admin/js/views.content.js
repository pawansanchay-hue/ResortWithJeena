/* ==========================================================================
   Jeena Resort & Spa - admin content screens
   Website text (page blocks), the auto-rendered settings catalogue and the
   media library.
   ========================================================================== */

import {
  $, $$, S, api, esc, num, toast, confirmDialog,
  fieldHtml, renderForm, readForm, wireForm, primeFields, openPanel, closePanel,
  svg, bytes, relTime, uploadFile, copyText, page
} from "./core.js";
import { setTitle } from "./shell.js";
import { badge } from "./views.crud.js";

/* ============================================================ page content */

const pageLabels = {
  home: "Home", rooms: "Rooms", food: "Dining", gallery: "Gallery", about: "About",
  contact: "Contact", booking: "Booking", global: "Site-wide", footer: "Footer", header: "Header"
};

page("pages", async (param, host) => {
  const data = await api("/api/admin/pages");
  const keys = data.pageKeys || [];
  if (!keys.length) {
    host.innerHTML = `<div class="panel"><div class="panel-body"><div class="empty-admin">${svg("text", 46)}
      <p><strong>No editable content blocks yet</strong></p></div></div></div>`;
    return;
  }

  const active = keys.includes(param) ? param : keys[0];
  const blocks = (data.items || []).filter((i) => i.pageKey === active);

  host.innerHTML = `
    <div class="toolbar">
      <div class="field grow"><label>Page</label>
        <select id="pagePick">${keys.map((k) => `<option value="${esc(k)}" ${k === active ? "selected" : ""}>${esc(pageLabels[k] || k)} (${esc(k)})</option>`).join("")}</select></div>
      <div class="field"><label>&nbsp;</label><button class="btn" type="button" id="addBlock">+ Add a section</button></div>
      <div class="field"><label>&nbsp;</label><a class="btn btn-outline" href="/index.html" target="_blank" rel="noopener">Preview website</a></div>
    </div>
    <div class="panel"><div class="panel-body">
      <div class="alert alert-info" style="margin:0">
        Every heading, paragraph and button on the website can be edited here. Blank fields keep the built-in text.
        Use <strong>data-section</strong> naming like <em>home/hero</em> if you are adding a new block for a developer.
      </div>
    </div></div>
    <div id="blockList"></div>`;

  $("#pagePick").onchange = (e) => { location.hash = `#/pages/${encodeURIComponent(e.target.value)}`; };
  $("#addBlock").onclick = () => openBlockEditor(null, active, () => reload(active));

  paintBlocks(blocks);

  async function reload(pageKey) {
    const fresh = await api("/api/admin/pages");
    const list = (fresh.items || []).filter((i) => i.pageKey === pageKey);
    paintBlocks(list);
  }

  function paintBlocks(list) {
    const host2 = $("#blockList");
    if (!list.length) {
      host2.innerHTML = `<div class="panel"><div class="panel-body"><div class="empty-admin">${svg("text", 44)}
        <p><strong>No sections on this page yet</strong></p><p class="small muted">Add one to start overriding the built-in copy.</p></div></div></div>`;
      return;
    }

    host2.innerHTML = list.map((b, i) => `<div class="panel" data-block="${b.id}">
      <div class="panel-head">
        <div>
          <h3 class="mb-0">${esc(b.title || b.sectionKey)}</h3>
          <p><code>${esc(b.pageKey)}/${esc(b.sectionKey)}</code> · order ${num(b.sortOrder)}</p>
        </div>
        <div class="toolbar" style="margin:0">
          ${b.isVisible ? badge("Visible", "green") : badge("Hidden", "gray")}
          <button class="icon-btn" type="button" data-save="${b.id}">Save</button>
          <button class="icon-btn danger" type="button" data-del="${b.id}">Delete</button>
        </div>
      </div>
      <div class="panel-body">
        <div id="bf_${b.id}">${renderForm(blockFields(), b)}</div>
      </div>
    </div>`).join("");

    list.forEach((b) => {
      const scope = $(`#bf_${b.id}`);
      wireForm(scope);
      $(`[data-save="${b.id}"]`).onclick = async (e) => {
        const btn = e.target;
        btn.classList.add("is-loading");
        try {
          const body = { ...b, ...readForm(scope, blockFields()) };
          const res = await api(`/api/admin/pages/${b.id}`, { method: "PUT", body });
          toast(res.message || "Content block saved", "success");
          await reload(active);
        } catch (err) { toast(err.message, "error"); } finally { btn.classList.remove("is-loading"); }
      };
      $(`[data-del="${b.id}"]`).onclick = async () => {
        const ok = await confirmDialog(`Delete the “${b.sectionKey}” block from ${b.pageKey}?`, { title: "Delete section", ok: "Delete it" });
        if (!ok) return;
        try {
          await api(`/api/admin/pages/${b.id}`, { method: "DELETE" });
          toast("Section deleted", "success");
          await reload(active);
        } catch (err) { toast(err.message, "error"); }
      };
    });
  }

  function blockFields() {
    return [
      { k: "title", l: "Heading", t: "text", span: 2 },
      { k: "subtitle", l: "Sub heading", t: "text", span: 2 },
      { k: "body", l: "Paragraph", t: "textarea", rows: 4, span: 2 },
      { k: "items", l: "List items", t: "textarea", rows: 3, span: 2, hint: "One per line, or a JSON array of {icon,title,text} objects." },
      { k: "imageUrl", l: "Image", t: "image", folder: "content", span: 2 },
      { k: "buttonText", l: "Button text", t: "text" },
      { k: "buttonLink", l: "Button link", t: "text", placeholder: "/booking.html" },
      { k: "sortOrder", l: "Sort order", t: "number", def: 0 },
      { k: "isVisible", l: "Show this section", t: "checkbox", def: true }
    ];
  }

  function openBlockEditor(block, pageKey, done) {
    primeFields(blockFields());
    const row = block || { pageKey, sectionKey: "", isVisible: true, sortOrder: 0 };
    openPanel(`<div class="modal lg">
      <div class="modal-head"><div><h3 class="mb-0">${block ? "Edit section" : "New content section"}</h3>
        <span class="small muted">Blocks override the built-in copy on the website.</span></div>
        <button class="modal-close" data-close-modal>&times;</button></div>
      <div class="modal-body">
        <div class="admin-form">
          <div class="form-row">
            <div class="field"><label>Page key</label><input type="text" data-k="pageKey" value="${esc(row.pageKey)}"></div>
            <div class="field"><label>Section key</label><input type="text" data-k="sectionKey" value="${esc(row.sectionKey)}" placeholder="hero"></div>
          </div>
        </div>
        <div id="newBlockForm" style="margin-top:18px">${renderForm(blockFields(), row)}</div>
      </div>
      <div class="modal-foot"><button class="btn btn-outline" data-close-modal>Cancel</button>
        <button class="btn" id="saveBlock">${block ? "Save section" : "Create section"}</button></div>
    </div>`, {
      wide: true,
      onReady: (root) => {
        wireForm(root);
        const scope = $("#newBlockForm", root);
        $("#saveBlock", root).onclick = async (e) => {
          const extra = { pageKey: root.querySelector('[data-k="pageKey"]').value.trim(), sectionKey: root.querySelector('[data-k="sectionKey"]').value.trim() };
          if (!extra.pageKey || !extra.sectionKey) { toast("Both the page key and section key are required", "warn"); return; }
          const btn = e.target;
          btn.classList.add("is-loading");
          try {
            const body = { ...row, ...extra, ...readForm(scope, blockFields()) };
            const res = block
              ? await api(`/api/admin/pages/${block.id}`, { method: "PUT", body })
              : await api("/api/admin/pages", { method: "POST", body });
            toast(res.message || "Section saved", "success");
            closePanel();
            done?.();
          } catch (err) { toast(err.message, "error"); } finally { btn.classList.remove("is-loading"); }
        };
      }
    });
  }
});

/* =============================================================== settings */

const checkboxKeys = new Set();

page("settings", async (_param, host) => {
  const data = await api("/api/admin/settings");
  S.settings = data;
  const groups = (data.groups || []).sort((a, b) => a.order - b.order);
  let activeGroup = groups[0]?.name || "";

  host.innerHTML = `
    <div class="toolbar">
      <div class="field grow"><label>Search settings</label><input type="text" id="setSearch" placeholder="Try 'colour', 'logo', 'smtp', 'otp'…"></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="setTest">Send test email</button></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="setNew">+ New setting</button></div>
      <div class="field"><label>&nbsp;</label><button class="btn" type="button" id="setSave">Save all changes</button></div>
    </div>
    <div class="settings-tabs" id="setTabs">
      ${groups.map((g) => `<button class="settings-tab ${g.name === activeGroup ? "active" : ""}" type="button" data-group="${esc(g.name)}">${esc(g.name)} <span class="muted">(${g.items.length})</span></button>`).join("")}
    </div>
    <div class="alert alert-info">Colours, logos, backgrounds, videos and visibility toggles all live here. Changes apply to the public website straight away.</div>
    <div id="setBody"></div>`;

  const body = $("#setBody");

  function paint(groupName, filter = "") {
    const group = groups.find((g) => g.name === groupName) || groups[0];
    if (!group) { body.innerHTML = `<div class="panel"><div class="panel-body">No settings found.</div></div>`; return; }

    const q = filter.trim().toLowerCase();
    const items = group.items
      .filter((i) => !q || i.key.toLowerCase().includes(q) || (i.label || "").toLowerCase().includes(q))
      .sort((a, b) => a.sortOrder - b.sortOrder);

    body.innerHTML = `<div class="panel">
      <div class="panel-head"><div><h2>${esc(group.name)}</h2><p>${items.length} setting(s)${q ? ` matching “${esc(filter)}”` : ""}</p></div>
        <button class="icon-btn" type="button" id="saveGroup">Save ${esc(group.name)}</button></div>
      <div class="panel-body" id="setRows">
        ${items.length ? items.map((it) => rowHtml(it)).join("") : `<div class="empty-admin">${svg("cog", 40)}<p><strong>Nothing matches that search</strong></p></div>`}
      </div></div>`;

    wireForm(body);
    $$("[data-toggle-secret]", body).forEach((b) => (b.onclick = () => {
      const input = b.parentElement.querySelector("input");
      const isPw = input.type === "password";
      input.type = isPw ? "text" : "password";
      b.textContent = isPw ? "Hide" : "Show";
    }));
    $$("[data-remove-setting]", body).forEach((b) => (b.onclick = async () => {
      const ok = await confirmDialog("Remove this setting from the catalogue?", { title: "Delete setting", ok: "Delete it" });
      if (!ok) return;
      try {
        await api(`/api/admin/settings/${b.dataset.removeSetting}`, { method: "DELETE" });
        toast("Setting removed", "success");
        await refresh();
      } catch (err) { toast(err.message, "error"); }
    }));

    const save = async (btn) => {
      const values = collect();
      if (!Object.keys(values).length) { toast("Nothing changed yet", "info"); return; }
      btn.classList.add("is-loading");
      try {
        const res = await api("/api/admin/settings", { method: "PUT", body: { values } });
        toast(res.message, "success");
        await refresh();
      } catch (err) { toast(err.message, "error"); } finally { btn.classList.remove("is-loading"); }
    };
    $("#saveGroup", body).onclick = (e) => save(e.target);
  }

  function rowHtml(it) {
    checkboxKeys.delete(it.key);
    const t = { color: "color", image: "image", video: "video", password: "password", number: "number", textarea: "textarea", select: "select", checkbox: "checkbox" }[it.inputType] || "text";
    const f = { k: it.key, l: it.label || it.key, t, required: false };
    if (it.hint) f.hint = it.hint;
    if (t === "select") {
      f.options = (it.options || []).length
        ? [{ value: "", label: "— default —" }, ...it.options.map((o) => ({ value: o, label: o }))]
        : [{ value: "", label: "— default —" }];
    }
    if (t === "image" || t === "video") f.folder = "settings";
    if (t === "checkbox") checkboxKeys.add(it.key);

    let control = fieldHtml(f, it.inputType === "checkbox" ? String(it.value).toLowerCase() === "true" : it.value);
    if (t === "password") {
      control = control.replace("</div>", `<div style="margin-top:6px"><button type="button" class="icon-btn" data-toggle-secret>Show</button></div></div>`);
    }
    return `<div class="setting-row">
      <div class="sr-head">
        <label>${esc(it.label || it.key)} <code>${esc(it.key)}</code></label>
        <button type="button" class="icon-btn danger" data-remove-setting="${num(it.id)}">Remove</button>
      </div>
      ${control}
      ${it.hint ? "" : `<span class="hint">Type: ${esc(it.inputType)}</span>`}
    </div>`;
  }

  function collect() {
    const values = {};
    groups.flatMap((g) => g.items).forEach((it) => {
      const el = body.querySelector(`[data-k="${CSS.escape(it.key)}"]`);
      if (!el) return;
      let v;
      if (it.inputType === "checkbox") v = el.checked ? "true" : "false";
      else v = el.value;
      const original = it.inputType === "checkbox" ? String(it.value).toLowerCase() === "true" ? "true" : "false" : (it.value ?? "");
      if (String(v ?? "") !== String(original ?? "")) values[it.key] = v;
    });
    return values;
  }

  async function refresh() {
    const fresh = await api("/api/admin/settings");
    S.settings = fresh;
    groups.length = 0;
    groups.push(...(fresh.groups || []).sort((a, b) => a.order - b.order));
    paint(activeGroup, $("#setSearch", host).value);
  }

  $$("#setTabs [data-group]").forEach((b) => (b.onclick = () => {
    activeGroup = b.dataset.group;
    $$("#setTabs [data-group]").forEach((x) => x.classList.toggle("active", x === b));
    paint(activeGroup, $("#setSearch", host).value);
  }));

  $("#setSearch").oninput = (e) => {
    const q = e.target.value;
    if (q) {
      // search across every group and show the matches together
      const all = groups.flatMap((g) => g.items.filter((i) => i.key.toLowerCase().includes(q.toLowerCase()) || (i.label || "").toLowerCase().includes(q.toLowerCase())));
      if (all.length) {
        body.innerHTML = `<div class="panel">
          <div class="panel-head"><div><h2>Search results</h2><p>${all.length} setting(s) matching “${esc(q)}”</p></div>
            <button class="icon-btn" type="button" id="saveSearch">Save changes</button></div>
          <div class="panel-body" id="setRows">${all.map(rowHtml).join("")}</div></div>`;
        wireForm(body);
        $$("[data-toggle-secret]", body).forEach((b) => (b.onclick = () => {
          const input = b.parentElement.querySelector("input");
          const isPw = input.type === "password"; input.type = isPw ? "text" : "password"; b.textContent = isPw ? "Hide" : "Show";
        }));
        $("#saveSearch", body).onclick = async (e2) => {
          const values = {};
          all.forEach((it) => {
            const el = body.querySelector(`[data-k="${CSS.escape(it.key)}"]`);
            if (!el) return;
            const v = it.inputType === "checkbox" ? (el.checked ? "true" : "false") : el.value;
            const original = it.inputType === "checkbox" ? (String(it.value).toLowerCase() === "true" ? "true" : "false") : (it.value ?? "");
            if (String(v ?? "") !== String(original ?? "")) values[it.key] = v;
          });
          if (!Object.keys(values).length) { toast("Nothing changed yet", "info"); return; }
          e2.target.classList.add("is-loading");
          try {
            const res = await api("/api/admin/settings", { method: "PUT", body: { values } });
            toast(res.message, "success");
            await refresh();
          } catch (err) { toast(err.message, "error"); }
        };
        return;
      }
    }
    paint(activeGroup, q);
  };

  $("#setSave").onclick = async (e) => {
    const values = collect();
    if (!Object.keys(values).length) { toast("Nothing changed yet", "info"); return; }
    e.target.classList.add("is-loading");
    try {
      const res = await api("/api/admin/settings", { method: "PUT", body: { values } });
      toast(res.message, "success");
      await refresh();
    } catch (err) { toast(err.message, "error"); } finally { e.target.classList.remove("is-loading"); }
  };

  $("#setTest").onclick = () => {
    openPanel(`<div class="modal sm">
      <div class="modal-head"><h3>Send a test email</h3><button class="modal-close" data-close-modal>&times;</button></div>
      <div class="modal-body">
        <div class="admin-form"><div class="field"><label>Send to</label>
          <input type="email" id="testTo" value="${esc(S.me?.email || "")}" placeholder="you@example.com"></div></div>
        <p class="small muted" style="margin-top:12px">If developer mode is on, the message is written to <code>App_Data/outbox</code> instead of being sent.</p>
        <div id="testResult"></div>
      </div>
      <div class="modal-foot"><button class="btn btn-outline" data-close-modal>Close</button>
        <button class="btn" id="testSend">Send test</button></div>
    </div>`, {
      onReady: (root) => {
        $("#testSend", root).onclick = async (e) => {
          const to = $("#testTo", root).value.trim();
          if (!to) { toast("Enter a destination address", "warn"); return; }
          e.target.classList.add("is-loading");
          try {
            const res = await api("/api/admin/settings/test-email", { method: "POST", body: { to } });
            $("#testResult", root).innerHTML = `<div class="alert ${res.sent ? "alert-success" : "alert-warn"}">${esc(res.message)}</div>`;
          } catch (err) { $("#testResult", root).innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`; }
          finally { e.target.classList.remove("is-loading"); }
        };
      }
    });
  };

  $("#setNew").onclick = () => {
    const fields = [
      { k: "key", l: "Key", t: "text", required: true, placeholder: "home.ctaTitle" },
      { k: "group", l: "Group", t: "select", options: () => ["General", "Theme", "Hero", "Home Sections", "Booking", "Email / OTP", "SEO", "Social Links"] },
      { k: "label", l: "Label", t: "text", placeholder: "Call to action heading" },
      { k: "value", l: "Value", t: "textarea", rows: 3, span: 2 },
      { k: "inputType", l: "Input type", t: "select", options: () => ["text", "textarea", "color", "number", "checkbox", "image", "video", "url", "password", "select"] },
      { k: "options", l: "Select options (pipe separated)", t: "text", placeholder: "Option A|Option B" },
      { k: "hint", l: "Hint", t: "text", span: 2 },
      { k: "sortOrder", l: "Sort order", t: "number", def: 0 }
    ];
    primeFields(fields);
    openPanel(`<div class="modal lg">
      <div class="modal-head"><div><h3 class="mb-0">New setting</h3><span class="small muted">Only useful if the front end reads this key.</span></div>
        <button class="modal-close" data-close-modal>&times;</button></div>
      <div class="modal-body" id="newSetForm">${renderForm(fields, { group: "Home Sections", inputType: "text", sortOrder: 0 })}</div>
      <div class="modal-foot"><button class="btn btn-outline" data-close-modal>Cancel</button>
        <button class="btn" id="createSet">Create setting</button></div>
    </div>`, {
      wide: true,
      onReady: (root) => {
        wireForm(root);
        $("#createSet", root).onclick = async (e) => {
          const body2 = readForm($("#newSetForm", root), fields);
          if (!body2.key) { toast("A key is required", "warn"); return; }
          e.target.classList.add("is-loading");
          try {
            const res = await api("/api/admin/settings", { method: "POST", body: body2 });
            toast(res.message, "success");
            closePanel();
            await refresh();
          } catch (err) { toast(err.message, "error"); } finally { e.target.classList.remove("is-loading"); }
        };
      }
    });
  };

  paint(activeGroup);
  setTitle("Settings", `${groups.reduce((n, g) => n + g.items.length, 0)} settings across ${groups.length} groups`);
});

/* ================================================================ media */

page("media", async (_param, host) => {
  let folder = "";
  let search = "";

  host.innerHTML = `
    <div class="panel">
      <div class="panel-head">
        <div><h2>Upload media</h2><p>Images up to 20 MB, video up to 300 MB, documents up to 30 MB.</p></div>
      </div>
      <div class="panel-body">
        <div class="dropzone" id="drop">
          <strong>Drop files here or click to browse</strong>
          <span class="small">They are stored in <code>wwwroot/uploads</code> and can be used anywhere in the site.</span>
          <input type="file" id="filePick" multiple hidden accept="image/*,video/*,.pdf,.doc,.docx">
        </div>
        <div class="toolbar" style="margin-top:16px">
          <div class="field"><label>Folder</label>
            <select id="folderPick"><option value="">general</option></select></div>
          <div class="field grow"><label>Search</label><input type="text" id="mediaSearch" placeholder="File name…"></div>
          <div class="field"><label>Filter</label>
            <select id="kindPick">
              <option value="">All files</option><option value="image">Images</option><option value="video">Video</option>
            </select></div>
          <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="refreshMedia">Refresh</button></div>
        </div>
        <div id="upProgress"></div>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><div><h2>Library</h2><p id="mediaStats"></p></div></div>
      <div class="panel-body"><div class="media-grid" id="mediaGrid"></div></div>
    </div>`;

  const drop = $("#drop");
  const pick = $("#filePick");

  drop.onclick = () => pick.click();
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    handleFiles([...e.dataTransfer.files]);
  };
  pick.onchange = () => handleFiles([...pick.files]);

  async function handleFiles(files) {
    if (!files.length) return;
    const box = $("#upProgress");
    box.innerHTML = "";
    for (const file of files) {
      const id = "up_" + Math.random().toString(36).slice(2);
      box.insertAdjacentHTML("beforeend", `<div class="alert alert-info" id="${id}">Uploading <strong>${esc(file.name)}</strong> (${bytes(file.size)})…</div>`);
      try {
        await uploadFile(file, $("#folderPick").value || "general");
        $(`#${id}`).className = "alert alert-success";
        $(`#${id}`).innerHTML = `Uploaded <strong>${esc(file.name)}</strong>`;
      } catch (err) {
        $(`#${id}`).className = "alert alert-error";
        $(`#${id}`).innerHTML = `${esc(file.name)}: ${esc(err.message)}`;
      }
    }
    pick.value = "";
    await load();
  }

  $("#folderPick").onchange = (e) => { folder = e.target.value; load(); };
  $("#kindPick").onchange = () => load();
  $("#mediaSearch").oninput = (e) => { search = e.target.value; paint(); };
  $("#refreshMedia").onclick = () => load();

  let cache = { total: 0, folders: [], totalBytes: 0, items: [] };

  async function load() {
    const grid = $("#mediaGrid");
    grid.innerHTML = `<div class="admin-spinner"></div>`;
    try {
      cache = await api("/api/admin/media" + (folder ? `?folder=${encodeURIComponent(folder)}` : ""));
    } catch (err) {
      grid.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
      return;
    }
    const sel = $("#folderPick");
    const current = sel.value;
    sel.innerHTML = `<option value="">All folders</option>` + (cache.folders || []).map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join("");
    sel.value = current;
    $("#mediaStats").textContent = `${cache.total} file(s) · ${bytes(cache.totalBytes)} on disk`;
    paint();
  }

  function paint() {
    const grid = $("#mediaGrid");
    const kind = $("#kindPick").value;
    const q = search.trim().toLowerCase();
    const items = (cache.items || []).filter((m) => {
      if (kind === "image" && !m.isImage) return false;
      if (kind === "video" && !m.isVideo) return false;
      if (q && !String(m.name).toLowerCase().includes(q)) return false;
      return true;
    });

    grid.innerHTML = items.length
      ? items.map((m) => `<div class="media-cell">
          <div class="thumb">${m.isImage
            ? `<img src="${esc(m.url)}" alt="${esc(m.name)}" loading="lazy">`
            : m.isVideo
              ? `<video src="${esc(m.url)}" muted preload="metadata"></video>`
              : `<span style="font-size:.8rem;color:var(--muted)">${esc((m.name.split(".").pop() || "file").toUpperCase())}</span>`}</div>
          <div class="meta">
            <strong>${esc(m.name)}</strong>
            <span>${bytes(m.size)} · ${esc(m.folder)} · ${esc(relTime(m.modified))}</span>
            <div class="row">
              <button class="icon-btn" type="button" data-copy="${esc(m.url)}">Copy URL</button>
              <button class="icon-btn danger" type="button" data-delurl="${esc(m.url)}">Delete</button>
            </div>
          </div></div>`).join("")
      : `<div class="empty-admin">${svg("folder", 44)}<p><strong>No files here yet</strong></p><p class="small muted">Upload something above to get started.</p></div>`;

    $$("[data-copy]", grid).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
    $$("[data-delurl]", grid).forEach((b) => (b.onclick = async () => {
      const ok = await confirmDialog("Delete this file permanently? Anything using it will break.", { title: "Delete file", ok: "Delete it" });
      if (!ok) return;
      try {
        await api("/api/admin/media?url=" + encodeURIComponent(b.dataset.delurl), { method: "DELETE" });
        toast("File deleted", "success");
        await load();
      } catch (err) { toast(err.message, "error"); }
    }));
  }

  await load();
  setTitle("Media library", "Upload images and video once, then pick them anywhere in the site");
});
