/* ==========================================================================
   Jeena Resort & Spa - admin front desk screens
   Bookings, kitchen orders, enquiries, newsletter, users and the audit log.
   ========================================================================== */

import {
  $, $$, api, esc, money, num, fmtDate, fmtDateTime, relTime, toast,
  confirmDialog, openPanel, closePanel, tableWrap, pager, statCard, donutChart,
  renderForm, readForm, wireForm, primeFields, svg,
  toOptions, copyText, downloadCsv, page
} from "./core.js";
import { loadDashboardCounts } from "./shell.js";
import { badge } from "./views.crud.js";

const BOOKING_STATUSES = ["Pending", "Confirmed", "CheckedIn", "CheckedOut", "Cancelled"];
const PAYMENT_STATUSES = ["Unpaid", "Partial", "Paid", "Refunded"];
const ORDER_STATUSES = ["New", "Preparing", "Ready", "Served", "Billed", "Cancelled"];
const ROLES = ["Admin", "Staff", "Customer"];

function kind(status) {
  return {
    Pending: "amber", Confirmed: "blue", CheckedIn: "green", CheckedOut: "gray", Cancelled: "red",
    Unpaid: "red", Partial: "amber", Paid: "green", Refunded: "gray",
    New: "amber", Preparing: "blue", Ready: "purple", Served: "green", Billed: "gray",
    Admin: "purple", Staff: "blue", Customer: "gray"
  }[status] || "gray";
}

let roomCache = null;
async function rooms() {
  roomCache = await api("/api/admin/rooms");
  return roomCache;
}
export const bustRoomCache = () => { roomCache = null; };

const bookingFields = () => [
  { k: "guestName", l: "Guest name", t: "text", required: true },
  { k: "guestPhone", l: "Phone", t: "text", required: true },
  { k: "guestEmail", l: "Email", t: "text", required: true, span: 2 },
  { k: "roomId", l: "Room", t: "select", numeric: true, options: () => toOptions(roomCache || [], { blank: "— choose a room —" }) },
  { k: "roomCount", l: "Rooms", t: "number", min: 1, def: 1 },
  { k: "checkIn", l: "Check-in", t: "date", required: true },
  { k: "checkOut", l: "Check-out", t: "date", required: true },
  { k: "adults", l: "Adults", t: "number", min: 1, def: 2 },
  { k: "children", l: "Children", t: "number", min: 0, def: 0 },
  { k: "status", l: "Booking status", t: "select", options: () => BOOKING_STATUSES },
  { k: "paymentStatus", l: "Payment status", t: "select", options: () => PAYMENT_STATUSES },
  { k: "paymentMethod", l: "Payment method", t: "text", placeholder: "UPI, card, cash…" },
  { k: "roomAmount", l: "Room amount", t: "decimal", def: 0, hint: "Leave 0 to let the server price the room." },
  { k: "foodAmount", l: "Food amount", t: "decimal", def: 0 },
  { k: "taxAmount", l: "Tax", t: "decimal", def: 0, hint: "Leave 0 to auto-calculate." },
  { k: "totalAmount", l: "Total", t: "decimal", def: 0, hint: "Leave 0 to auto-calculate." },
  { k: "specialRequest", l: "Guest requests", t: "textarea", rows: 2, span: 2 },
  { k: "adminNote", l: "Internal note (guests never see this)", t: "textarea", rows: 2, span: 2 }
];

/* ================================================================ bookings */

const bstate = { status: "All", search: "", page: 1, roomId: "", from: "", to: "" };

page("bookings", async (param, host) => {
  await rooms();
  await load();
  if (param) openDetail(Number(param), host);

  async function load() {
    host.innerHTML = `<div class="admin-spinner"></div>`;
    const q = new URLSearchParams({ page: bstate.page, pageSize: 25 });
    if (bstate.status && bstate.status !== "All") q.set("status", bstate.status);
    if (bstate.search) q.set("search", bstate.search);
    if (bstate.roomId) q.set("roomId", bstate.roomId);
    if (bstate.from) q.set("from", bstate.from);
    if (bstate.to) q.set("to", bstate.to);

    let data;
    try {
      data = await api("/api/admin/bookings?" + q.toString());
    } catch (err) {
      host.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
      return;
    }

    const chips = (data.summary || []).map((s) => `<button type="button" class="settings-tab ${bstate.status === s.status ? "active" : ""}" data-status="${esc(s.status)}">
        ${esc(s.status)} <span class="muted">(${num(s.count)})</span></button>`).join("");

    host.innerHTML = `
      <div class="settings-tabs">
        <button type="button" class="settings-tab ${bstate.status === "All" ? "active" : ""}" data-status="All">All (${num(data.total)})</button>
        ${chips}
      </div>
      <div class="toolbar">
        <div class="field grow"><label>Search</label><input type="text" id="bSearch" value="${esc(bstate.search)}" placeholder="Code, guest name, email or phone…"></div>
        <div class="field"><label>Room</label><select id="bRoom">${toOptions(roomCache || [], { blank: "All rooms" }).map((o) => `<option value="${esc(o.value)}" ${String(bstate.roomId) === String(o.value) ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select></div>
        <div class="field"><label>From</label><input type="date" id="bFrom" value="${esc(bstate.from)}"></div>
        <div class="field"><label>To</label><input type="date" id="bTo" value="${esc(bstate.to)}"></div>
        <div class="field"><label>&nbsp;</label><button class="btn" type="button" id="bNew">+ New booking</button></div>
        <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="bClear">Clear</button></div>
      </div>

      <div class="panel"><div class="panel-body flush">${tableWrap(
        [{ label: "Code" }, { label: "Guest" }, { label: "Room" }, { label: "Stay" }, { label: "Guests", num: true }, { label: "Total", num: true }, { label: "Status" }, { label: "Payment" }, { label: "Actions" }],
        (data.items || []).map((b) => `<tr>
          <td class="strong">${esc(b.bookingCode)}<br><span class="muted-sm">${esc(relTime(b.createdAt))}</span></td>
          <td>${esc(b.guestName)}<br><span class="muted-sm">${esc(b.guestEmail)}<br>${esc(b.guestPhone || "")}</span></td>
          <td>${esc(b.roomName || "—")}<br><span class="muted-sm">${num(b.roomCount)} room(s)</span></td>
          <td>${esc(fmtDate(b.checkIn))} → ${esc(fmtDate(b.checkOut))}<br><span class="muted-sm">${num(b.nights)} night(s)</span></td>
          <td class="num">${num(b.adults) + num(b.children)}</td>
          <td class="num strong">${esc(money(b.totalAmount))}</td>
          <td>${badge(b.status, kind(b.status))}</td>
          <td>${badge(b.paymentStatus, kind(b.paymentStatus))}<br><span class="muted-sm">${esc(b.paymentMethod || "")}</span></td>
          <td><div class="actions">
            <button class="icon-btn" type="button" data-view="${num(b.id)}">Open</button>
            <button class="icon-btn ok" type="button" data-confirm="${num(b.id)}">Confirm</button>
            <button class="icon-btn" type="button" data-edit="${num(b.id)}">Edit</button>
            <button class="icon-btn danger" type="button" data-del="${num(b.id)}">Delete</button>
          </div></td>
        </tr>`).join(""), { empty: "No bookings match these filters" })}</div>
      ${pager(num(data.page, 1), num(data.pages, 1), (p) => { bstate.page = p; load(); })}</div>`;

    $$("[data-status]", host).forEach((b) => (b.onclick = () => { bstate.status = b.dataset.status; bstate.page = 1; load(); }));
    $("#bSearch").onchange = (e) => { bstate.search = e.target.value; bstate.page = 1; load(); };
    $("#bRoom").onchange = (e) => { bstate.roomId = e.target.value; bstate.page = 1; load(); };
    $("#bFrom").onchange = (e) => { bstate.from = e.target.value; bstate.page = 1; load(); };
    $("#bTo").onchange = (e) => { bstate.to = e.target.value; bstate.page = 1; load(); };
    $("#bClear").onclick = () => { bstate.status = "All"; bstate.search = ""; bstate.roomId = ""; bstate.from = ""; bstate.to = ""; bstate.page = 1; load(); };
    $("#bNew").onclick = () => openBookingForm(null, host);
    $$("[data-view]", host).forEach((b) => (b.onclick = () => openDetail(Number(b.dataset.view), host)));
    $$("[data-edit]", host).forEach((b) => (b.onclick = () => openBookingForm(Number(b.dataset.edit), host)));
    $$("[data-confirm]", host).forEach((b) => (b.onclick = async () => {
      try {
        const res = await api(`/api/admin/bookings/${b.dataset.confirm}/status`, { method: "PUT", body: { status: "Confirmed" } });
        toast(res.message, "success");
        await load();
        await loadDashboardCounts();
      } catch (err) { toast(err.message, "error"); }
    }));
    $$("[data-del]", host).forEach((b) => (b.onclick = async () => {
      const ok = await confirmDialog("Delete this booking permanently? Food orders attached to it stay in the kitchen list.", { title: "Delete booking", ok: "Delete it" });
      if (!ok) return;
      try {
        const res = await api(`/api/admin/bookings/${b.dataset.del}`, { method: "DELETE" });
        toast(res.message, "success");
        await load();
      } catch (err) { toast(err.message, "error"); }
    }));
  }

  async function openDetail(id, host) {
    openPanel(`<div class="modal lg"><div class="modal-body"><div class="admin-spinner"></div></div></div>`, { wide: true });
    let b;
    try {
      b = await api(`/api/admin/bookings/${id}`);
    } catch (err) {
      toast(err.message, "error");
      closePanel();
      return;
    }

    openPanel(`<div class="modal lg">
      <div class="modal-head">
        <div><h3 class="mb-0">${esc(b.bookingCode)}</h3>
          <span class="small muted">${esc(b.roomName || "Room")} · booked ${esc(fmtDateTime(b.createdAt))}</span></div>
        <button class="modal-close" data-close-modal>&times;</button>
      </div>
      <div class="modal-body">
        <div class="flex items-center flex-wrap" style="gap:8px;margin-bottom:16px">
          ${badge(b.status, kind(b.status))} ${badge(b.paymentStatus, kind(b.paymentStatus))}
          ${b.userId ? badge("Registered member", "blue") : badge("Guest checkout", "gray")}
          ${b.updatedAt ? `<span class="muted-sm">updated ${esc(relTime(b.updatedAt))}</span>` : ""}
        </div>

        <div class="kv" style="margin-bottom:18px">
          <div><span>Guest</span><strong>${esc(b.guestName)}</strong></div>
          <div><span>Phone</span><strong>${esc(b.guestPhone || "—")}</strong></div>
          <div><span>Email</span><strong>${esc(b.guestEmail)}</strong></div>
          <div><span>Stay</span><strong>${esc(fmtDate(b.checkIn))} → ${esc(fmtDate(b.checkOut))}</strong></div>
          <div><span>Nights / rooms</span><strong>${num(b.nights)} night(s) · ${num(b.roomCount)} room(s)</strong></div>
          <div><span>Guests</span><strong>${num(b.adults)} adults, ${num(b.children)} children</strong></div>
          <div><span>Payment method</span><strong>${esc(b.paymentMethod || "—")}</strong></div>
          <div><span>Room type</span><strong>${esc(b.roomName || "—")}</strong></div>
        </div>

        <div class="summary">
          <div class="summary-row"><span>Room charges</span><span>${esc(money(b.roomAmount))}</span></div>
          <div class="summary-row"><span>Food</span><span>${esc(money(b.foodAmount))}</span></div>
          <div class="summary-row"><span>Taxes</span><span>${esc(money(b.taxAmount))}</span></div>
          <div class="summary-row total"><span>Total</span><span>${esc(money(b.totalAmount))}</span></div>
        </div>

        ${b.specialRequest ? `<h4 style="margin-top:18px">Guest requests</h4><p>${esc(b.specialRequest)}</p>` : ""}

        <h4 style="margin-top:18px">Change status</h4>
        <div class="toolbar">
          <div class="field"><label>Booking</label>
            <select id="dStatus">${BOOKING_STATUSES.map((s) => `<option ${s === b.status ? "selected" : ""}>${s}</option>`).join("")}</select></div>
          <div class="field"><label>Payment</label>
            <select id="dPay">${PAYMENT_STATUSES.map((s) => `<option ${s === b.paymentStatus ? "selected" : ""}>${s}</option>`).join("")}</select></div>
          <div class="field"><label>&nbsp;</label><button class="btn" type="button" id="dSaveStatus">Apply</button></div>
        </div>

        <h4 style="margin-top:18px">Internal note</h4>
        <div class="admin-form"><div class="field">
          <textarea id="dNote" rows="3" placeholder="Only staff can see this">${esc(b.adminNote || "")}</textarea></div></div>
        <button class="btn btn-outline btn-sm" type="button" id="dSaveNote" style="margin-top:10px">Save note</button>

        ${b.foodOrders?.length ? `<h4 style="margin-top:22px">Food orders attached to this stay</h4>
          ${b.foodOrders.map((o) => `<div class="card" style="padding:14px;margin-bottom:10px">
            <div class="flex items-center justify-between flex-wrap" style="gap:8px">
              <strong>${esc(o.orderCode)}</strong>
              <span>${badge(o.status, kind(o.status))} <span class="badge badge-gray">${esc(o.orderType)}</span></span>
            </div>
            <div class="summary" style="margin-top:10px">
              ${(o.items || []).map((i) => `<div class="summary-row"><span>${esc(i.name)} × ${num(i.quantity)}</span><span>${esc(money(i.unitPrice * i.quantity))}</span></div>`).join("")}
              <div class="summary-row total"><span>Total</span><span>${esc(money(o.totalAmount))}</span></div>
            </div></div>`).join("")}` : ""}
      </div>
      <div class="modal-foot">
        <button class="btn btn-outline" data-close-modal>Close</button>
        <button class="btn" id="dEdit">Edit booking</button>
      </div>
    </div>`, {
      wide: true,
      onReady: (root) => {
        $("#dSaveStatus", root).onclick = async (e) => {
          e.target.classList.add("is-loading");
          try {
            const newStatus = $("#dStatus", root).value;
            const newPay = $("#dPay", root).value;

            // The status endpoint also notifies the guest, so use it for real
            // status changes. The follow-up PUT carries the same status along,
            // otherwise it would overwrite the change with the value we loaded.
            if (newStatus !== b.status)
              await api(`/api/admin/bookings/${id}/status`, { method: "PUT", body: { status: newStatus } });

            await api(`/api/admin/bookings/${id}`, {
              method: "PUT",
              body: { ...b, status: newStatus, paymentStatus: newPay, checkIn: b.checkIn, checkOut: b.checkOut }
            });
            toast("Booking updated", "success");
            closePanel();
            await load();
            await loadDashboardCounts();
          } catch (err) { toast(err.message, "error"); } finally { e.target.classList.remove("is-loading"); }
        };
        $("#dSaveNote", root).onclick = async (e) => {
          e.target.classList.add("is-loading");
          try {
            await api(`/api/admin/bookings/${id}`, { method: "PUT", body: { ...b, checkIn: b.checkIn, checkOut: b.checkOut, adminNote: $("#dNote", root).value } });
            toast("Note saved", "success");
          } catch (err) { toast(err.message, "error"); } finally { e.target.classList.remove("is-loading"); }
        };
        $("#dEdit", root).onclick = () => { closePanel(); openBookingForm(id, host); };
      }
    });
  }

  async function openBookingForm(id, host) {
    let row;
    if (id) {
      row = await api(`/api/admin/bookings/${id}`);
    } else {
      const d = new Date();
      const iso = (dt) => dt.toISOString().slice(0, 10);
      const tomorrow = new Date(d.getTime() + 86400000);
      const dayAfter = new Date(d.getTime() + 2 * 86400000);
      row = { checkIn: iso(tomorrow), checkOut: iso(dayAfter), adults: 2, children: 0, roomCount: 1, status: "Confirmed", paymentStatus: "Unpaid", roomAmount: 0, foodAmount: 0, taxAmount: 0, totalAmount: 0 };
    }
    primeFields(bookingFields());
    openPanel(`<div class="modal lg">
      <div class="modal-head"><div><h3 class="mb-0">${id ? "Edit booking" : "New booking"}</h3>
        <span class="small muted">Totals left at 0 are calculated by the server from the room price and tax setting.</span></div>
        <button class="modal-close" data-close-modal>&times;</button></div>
      <div class="modal-body" id="bkForm">${renderForm(bookingFields(), row)}</div>
      <div class="modal-foot"><button class="btn btn-outline" data-close-modal>Cancel</button>
        <button class="btn" id="bkSave">${id ? "Save booking" : "Create booking"}</button></div>
    </div>`, {
      wide: true,
      onReady: (root) => {
        wireForm(root);
        $("#bkSave", root).onclick = async (e) => {
          const body = readForm($("#bkForm", root), bookingFields());
          if (!body.guestName || !body.guestEmail || !body.guestPhone) { toast("Guest name, email and phone are required", "warn"); return; }
          if (!body.roomId) { toast("Choose a room", "warn"); return; }
          e.target.classList.add("is-loading");
          try {
            const res = id
              ? await api(`/api/admin/bookings/${id}`, { method: "PUT", body })
              : await api("/api/admin/bookings", { method: "POST", body });
            toast(res.message, "success");
            closePanel();
            await load();
            await loadDashboardCounts();
          } catch (err) { toast(err.message, "error"); } finally { e.target.classList.remove("is-loading"); }
        };
      }
    });
  }
});

/* ============================================================= food orders */

const fstate = { status: "All", search: "" };

page("food-orders", async (_param, host) => {
  await load();

  async function load() {
    host.innerHTML = `<div class="admin-spinner"></div>`;
    const q = new URLSearchParams();
    if (fstate.status && fstate.status !== "All") q.set("status", fstate.status);
    if (fstate.search) q.set("search", fstate.search);
    let data;
    try {
      data = await api("/api/admin/food-orders?" + q.toString());
    } catch (err) {
      host.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
      return;
    }
    const orders = data.items || [];
    const byStatus = ORDER_STATUSES.map((s) => ({ label: s, count: orders.filter((o) => o.status === s).length }));
    const byType = ["DineIn", "RoomService", "Takeaway"].map((t) => ({ label: t, count: orders.filter((o) => o.orderType === t).length })).filter((x) => x.count);

    host.innerHTML = `
      <div class="stat-grid">
        ${statCard("Orders in view", num(data.total), `${esc(fmtDate(new Date()))}`, { accent: true })}
        ${statCard("Revenue", money(data.revenue), "Live orders only")}
        ${statCard("Waiting on the kitchen", num(orders.filter((o) => o.status === "New" || o.status === "Preparing").length), "New and preparing")}
        ${statCard("Average order", money(orders.length ? data.revenue / orders.length : 0), "Across the orders shown")}
      </div>
      <div class="grid-2">
        <div class="panel"><div class="panel-head"><div><h2>Kitchen pipeline</h2><p>Orders by status</p></div></div>
          <div class="panel-body">${donutChart(byStatus.filter((s) => s.count), { labelKey: "label", valueKey: "count", format: (v) => num(v) + " orders" })}</div></div>
        <div class="panel"><div class="panel-head"><div><h2>Service channel</h2><p>Where the order is served</p></div></div>
          <div class="panel-body">${donutChart(byType, { labelKey: "label", valueKey: "count", format: (v) => num(v) + " orders" })}</div></div>
      </div>
      <div class="settings-tabs">
        <button type="button" class="settings-tab ${fstate.status === "All" ? "active" : ""}" data-status="All">All (${num(data.total)})</button>
        ${ORDER_STATUSES.map((s) => `<button type="button" class="settings-tab ${fstate.status === s ? "active" : ""}" data-status="${s}">${s} (${orders.filter((o) => o.status === s).length})</button>`).join("")}
      </div>
      <div class="toolbar">
        <div class="field grow"><label>Search</label><input type="text" id="fSearch" value="${esc(fstate.search)}" placeholder="Order code, customer or phone…"></div>
        <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="fRefresh">Refresh</button></div>
      </div>
      <div class="panel"><div class="panel-body flush">${orders.length ? orders.map((o) => `<div class="msg-row">
        <div class="flex items-center justify-between flex-wrap" style="gap:10px">
          <div>
            <strong>${esc(o.orderCode)}</strong> ${badge(o.orderType, "gray")} ${badge(o.status, kind(o.status))}
            <span class="muted-sm" style="display:block">${esc(o.customerName)} · ${esc(o.phone || o.email || "")} · ${esc(relTime(o.createdAt))}${o.bookingId ? " · attached to a stay" : ""}</span>
          </div>
          <div class="flex items-center" style="gap:10px;flex-wrap:wrap">
            <strong>${esc(money(o.totalAmount))}</strong>
            <select data-order-status="${num(o.id)}" style="padding:7px 10px;border-radius:9px;border:1px solid var(--border)">
              ${ORDER_STATUSES.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}
            </select>
            <button class="icon-btn danger" type="button" data-order-del="${num(o.id)}">Delete</button>
          </div>
        </div>
        <div class="summary" style="margin:12px 0 0">
          ${(o.items || []).map((i) => `<div class="summary-row"><span>${esc(i.name)} × ${num(i.quantity)}</span><span>${esc(money(i.lineTotal))}</span></div>`).join("")}
        </div>
        ${o.notes ? `<p class="small muted mb-0" style="margin-top:8px">Note: ${esc(o.notes)}</p>` : ""}
      </div>`).join("") : `<div class="empty-admin">${svg("bowl", 44)}<p><strong>No orders match this filter</strong></p></div>`}</div></div>`;

    $$("[data-status]", host).forEach((b) => (b.onclick = () => { fstate.status = b.dataset.status; load(); }));
    $("#fSearch").onchange = (e) => { fstate.search = e.target.value; load(); };
    $("#fRefresh").onclick = () => load();
    $$("[data-order-status]", host).forEach((sel) => (sel.onchange = async () => {
      try {
        const res = await api(`/api/admin/food-orders/${sel.dataset.orderStatus}/status`, { method: "PUT", body: { status: sel.value } });
        toast(res.message, "success");
        await loadDashboardCounts();
      } catch (err) { toast(err.message, "error"); }
    }));
    $$("[data-order-del]", host).forEach((b) => (b.onclick = async () => {
      const ok = await confirmDialog("Delete this food order?", { title: "Delete order", ok: "Delete it" });
      if (!ok) return;
      try { await api(`/api/admin/food-orders/${b.dataset.orderDel}`, { method: "DELETE" }); toast("Order deleted", "success"); await load(); }
      catch (err) { toast(err.message, "error"); }
    }));
  }
});

/* =============================================================== enquiries */

const mstate = { unreadOnly: false };

page("messages", async (_param, host) => {
  await load();

  async function load() {
    host.innerHTML = `<div class="admin-spinner"></div>`;
    let data;
    try {
      data = await api("/api/admin/messages" + (mstate.unreadOnly ? "?unreadOnly=true" : ""));
    } catch (err) {
      host.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
      return;
    }
    const items = data.items || [];

    host.innerHTML = `
      <div class="stat-grid">
        ${statCard("Total enquiries", num(data.total), "Last 300 messages", { accent: true })}
        ${statCard("Unread", num(data.unread), "Waiting for a reply")}
        ${statCard("Replied", num(items.filter((m) => m.reply).length), "A reply has been sent")}
        ${statCard("Today", num(items.filter((m) => new Date(m.createdAt).toDateString() === new Date().toDateString()).length), "Arrived today")}
      </div>
      <div class="toolbar">
        <div class="field"><label>Show</label>
          <select id="mFilter">
            <option value="all" ${mstate.unreadOnly ? "" : "selected"}>All messages</option>
            <option value="unread" ${mstate.unreadOnly ? "selected" : ""}>Unread only</option>
          </select></div>
        <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="mRefresh">Refresh</button></div>
        <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="mExport">Export CSV</button></div>
      </div>
      <div class="panel"><div class="panel-body flush">
        ${items.length ? items.map((m) => `<div class="msg-row ${m.isRead ? "" : "unread"}">
          <div class="flex items-center justify-between flex-wrap" style="gap:10px">
            <div>
              <strong>${esc(m.name)}</strong>
              <span class="muted-sm" style="display:block">${esc(m.email)}${m.phone ? " · " + esc(m.phone) : ""} · ${esc(relTime(m.createdAt))}</span>
            </div>
            <div class="flex items-center" style="gap:8px;flex-wrap:wrap">
              ${m.isRead ? badge("Read", "gray") : badge("Unread", "amber")}
              ${m.reply ? badge("Replied", "green") : ""}
              <button class="icon-btn" type="button" data-open="${num(m.id)}">Open</button>
              <button class="icon-btn" type="button" data-mark="${num(m.id)}" data-read="${m.isRead ? "false" : "true"}">${m.isRead ? "Mark unread" : "Mark read"}</button>
              <button class="icon-btn danger" type="button" data-del="${num(m.id)}">Delete</button>
            </div>
          </div>
          <p class="mb-0" style="margin-top:8px"><strong>${esc(m.subject || "(no subject)")}</strong></p>
          <p class="small muted mb-0">${esc((m.message || "").slice(0, 220))}${(m.message || "").length > 220 ? "…" : ""}</p>
        </div>`).join("") : `<div class="empty-admin">${svg("mail", 44)}<p><strong>No messages</strong></p></div>`}
      </div></div>`;

    $("#mFilter").onchange = (e) => { mstate.unreadOnly = e.target.value === "unread"; load(); };
    $("#mRefresh").onclick = () => load();
    $("#mExport").onclick = () => {
      downloadCsv(`enquiries-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Date", "Name", "Email", "Phone", "Subject", "Message", "Read", "Reply"],
        items.map((m) => [m.createdAt, m.name, m.email, m.phone || "", m.subject || "", m.message, m.isRead ? "yes" : "no", m.reply || ""]));
      toast("CSV exported", "success");
    };
    $$("[data-open]", host).forEach((b) => (b.onclick = () => openMessage(items.find((m) => m.id === Number(b.dataset.open)), load)));
    $$("[data-mark]", host).forEach((b) => (b.onclick = async () => {
      try {
        await api(`/api/admin/messages/${b.dataset.mark}/read?read=${b.dataset.read}`, { method: "PUT" });
        await load();
        await loadDashboardCounts();
      } catch (err) { toast(err.message, "error"); }
    }));
    $$("[data-del]", host).forEach((b) => (b.onclick = async () => {
      const ok = await confirmDialog("Delete this enquiry?", { title: "Delete message", ok: "Delete it" });
      if (!ok) return;
      try { await api(`/api/admin/messages/${b.dataset.del}`, { method: "DELETE" }); toast("Message deleted", "success"); await load(); await loadDashboardCounts(); }
      catch (err) { toast(err.message, "error"); }
    }));
  }
});

function openMessage(m, after) {
  if (!m) return;
  openPanel(`<div class="modal lg">
    <div class="modal-head"><div><h3 class="mb-0">${esc(m.subject || "(no subject)")}</h3>
      <span class="small muted">${esc(m.name)} · ${esc(m.email)}${m.phone ? " · " + esc(m.phone) : ""}</span></div>
      <button class="modal-close" data-close-modal>&times;</button></div>
    <div class="modal-body">
      <p class="small muted">Received ${esc(fmtDateTime(m.createdAt))}</p>
      <div class="card" style="padding:16px;white-space:pre-wrap">${esc(m.message)}</div>
      ${m.reply ? `<h4 style="margin-top:18px">Your reply</h4><div class="card" style="padding:16px;white-space:pre-wrap">${esc(m.reply)}</div>` : ""}
      <h4 style="margin-top:18px">Reply</h4>
      <div class="admin-form"><div class="field">
        <textarea id="mReply" rows="5" placeholder="Write your reply. It is emailed to the guest (or written to App_Data/outbox in developer mode)."></textarea>
      </div></div>
      <div id="mReplyResult"></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-outline" data-close-modal>Close</button>
      <a class="btn btn-outline" href="mailto:${esc(m.email)}">Open in mail app</a>
      <button class="btn" id="mSend">Send reply</button>
    </div>
  </div>`, {
    wide: true,
    onReady: (root) => {
      $("#mSend", root).onclick = async (e) => {
        const message = $("#mReply", root).value.trim();
        if (!message) { toast("Write a reply first", "warn"); return; }
        e.target.classList.add("is-loading");
        try {
          const res = await api(`/api/admin/messages/${m.id}/reply`, { method: "POST", body: { message } });
          toast(res.message, "success");
          closePanel();
          after?.();
          await loadDashboardCounts();
        } catch (err) { toast(err.message, "error"); } finally { e.target.classList.remove("is-loading"); }
      };
    }
  });
  // mark read as soon as it is opened
  api(`/api/admin/messages/${m.id}/read?read=true`, { method: "PUT" }).then(() => after?.()).catch(() => {});
}

/* ============================================================== newsletter */

page("newsletter", async (_param, host) => {
  let list = [];
  host.innerHTML = `<div class="admin-spinner"></div>`;
  try {
    list = await api("/api/admin/newsletter");
  } catch (err) {
    host.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    return;
  }

  host.innerHTML = `
    <div class="stat-grid">
      ${statCard("Subscribers", num(list.length), "Everyone on the list", { accent: true })}
      ${statCard("Active", num(list.filter((s) => s.isActive).length), "Receiving campaigns")}
      ${statCard("This month", num(list.filter((s) => new Date(s.createdAt).getMonth() === new Date().getMonth()).length), "New this month")}
      ${statCard("Latest", list[0] ? esc(fmtDate(list[0].createdAt)) : "—", list[0] ? esc(list[0].email) : "No subscribers yet")}
    </div>
    <div class="toolbar">
      <div class="field grow"><label>Search</label><input type="text" id="nSearch" placeholder="Email address…"></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="nExport">Export CSV</button></div>
      <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="nCopy">Copy all emails</button></div>
    </div>
    <div class="panel"><div class="panel-body flush" id="nBody"></div></div>`;

  function paint(filter = "") {
    const q = filter.trim().toLowerCase();
    const rows = list.filter((s) => !q || s.email.toLowerCase().includes(q));
    $("#nBody").innerHTML = tableWrap(
      [{ label: "Email" }, { label: "Status" }, { label: "Subscribed" }, { label: "Actions" }],
      rows.map((s) => `<tr>
        <td class="strong">${esc(s.email)}</td>
        <td>${s.isActive ? badge("Active", "green") : badge("Unsubscribed", "gray")}</td>
        <td>${esc(fmtDateTime(s.createdAt))}</td>
        <td><div class="actions">
          <button class="icon-btn" type="button" data-copy="${esc(s.email)}">Copy</button>
          <button class="icon-btn danger" type="button" data-del="${num(s.id)}">Remove</button>
        </div></td></tr>`).join(""),
      { empty: "No subscribers yet" });

    $$("[data-copy]", $("#nBody")).forEach((b) => (b.onclick = () => copyText(b.dataset.copy)));
    $$("[data-del]", $("#nBody")).forEach((b) => (b.onclick = async () => {
      const ok = await confirmDialog("Remove this subscriber?", { title: "Remove subscriber", ok: "Remove" });
      if (!ok) return;
      try {
        await api(`/api/admin/newsletter/${b.dataset.del}`, { method: "DELETE" });
        list = list.filter((s) => String(s.id) !== String(b.dataset.del));
        paint($("#nSearch").value);
        toast("Subscriber removed", "success");
      } catch (err) { toast(err.message, "error"); }
    }));
  }
  paint();

  $("#nSearch").oninput = (e) => paint(e.target.value);
  $("#nExport").onclick = () => {
    downloadCsv(`newsletter-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Email", "Active", "Subscribed"], list.map((s) => [s.email, s.isActive ? "yes" : "no", s.createdAt]));
    toast("CSV exported", "success");
  };
  $("#nCopy").onclick = () => copyText(list.map((s) => s.email).join(", "));
});

/* =================================================================== users */

const ustate = { search: "", role: "All", status: "", page: 1 };

page("users", async (_param, host) => {
  await load();

  async function load() {
    host.innerHTML = `<div class="admin-spinner"></div>`;
    const q = new URLSearchParams({ page: ustate.page, pageSize: 25 });
    if (ustate.search) q.set("search", ustate.search);
    if (ustate.role && ustate.role !== "All") q.set("role", ustate.role);
    if (ustate.status) q.set("status", ustate.status);

    let data;
    try {
      data = await api("/api/admin/users?" + q.toString());
    } catch (err) {
      host.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
      return;
    }

    host.innerHTML = `
      <div class="stat-grid">
        ${statCard("Accounts", num(data.total), "Matching the current filters", { accent: true })}
        ${statCard("Page", `${num(data.page)} of ${num(data.pages)}`, `${num(data.pageSize)} per page`)}
        ${statCard("Administrators", num((data.items || []).filter((u) => u.role === "Admin").length), "On this page")}
        ${statCard("Unverified", num((data.items || []).filter((u) => !u.isEmailVerified).length), "On this page")}
      </div>
      <div class="toolbar">
        <div class="field grow"><label>Search</label><input type="text" id="uSearch" value="${esc(ustate.search)}" placeholder="Name, email or phone…"></div>
        <div class="field"><label>Role</label><select id="uRole"><option value="All">All roles</option>
          ${ROLES.map((r) => `<option ${ustate.role === r ? "selected" : ""}>${r}</option>`).join("")}</select></div>
        <div class="field"><label>Status</label><select id="uStatus">
          <option value="" ${ustate.status === "" ? "selected" : ""}>Any</option>
          <option value="active" ${ustate.status === "active" ? "selected" : ""}>Active</option>
          <option value="disabled" ${ustate.status === "disabled" ? "selected" : ""}>Disabled</option>
          <option value="unverified" ${ustate.status === "unverified" ? "selected" : ""}>Unverified</option>
        </select></div>
        <div class="field"><label>&nbsp;</label><button class="btn" type="button" id="uNew">+ New user</button></div>
      </div>
      <div class="panel"><div class="panel-body flush">${tableWrap(
        [{ label: "Name" }, { label: "Contact" }, { label: "Role" }, { label: "Verified" }, { label: "Bookings", num: true }, { label: "Spent", num: true }, { label: "Joined" }, { label: "Actions" }],
        (data.items || []).map((u) => `<tr>
          <td class="strong">${esc(u.fullName)}<br><span class="muted-sm">${u.isActive ? "" : "disabled · "}${u.lastLoginAt ? "last seen " + esc(relTime(u.lastLoginAt)) : "never signed in"}</span></td>
          <td>${esc(u.email)}<br><span class="muted-sm">${esc(u.phone || "")}</span></td>
          <td>${badge(u.role, kind(u.role))}</td>
          <td>${u.isEmailVerified ? badge("Yes", "green") : badge("No", "amber")}</td>
          <td class="num">${num(u.bookings)}</td>
          <td class="num">${esc(money(u.spent))}</td>
          <td>${esc(fmtDate(u.createdAt))}</td>
          <td><div class="actions">
            <button class="icon-btn" type="button" data-open="${num(u.id)}">Open</button>
            <button class="icon-btn" type="button" data-edit="${num(u.id)}">Edit</button>
            <button class="icon-btn" type="button" data-pw="${num(u.id)}">Reset password</button>
            <button class="icon-btn danger" type="button" data-del="${num(u.id)}">Delete</button>
          </div></td>
        </tr>`).join(""), { empty: "No users match these filters" })}</div>
      ${pager(num(data.page, 1), num(data.pages, 1), (p) => { ustate.page = p; load(); })}</div>`;

    $("#uSearch").onchange = (e) => { ustate.search = e.target.value; ustate.page = 1; load(); };
    $("#uRole").onchange = (e) => { ustate.role = e.target.value; ustate.page = 1; load(); };
    $("#uStatus").onchange = (e) => { ustate.status = e.target.value; ustate.page = 1; load(); };
    $("#uNew").onclick = () => openUserForm(null, load);
    const byId = (id) => (data.items || []).find((u) => String(u.id) === String(id));
    $$("[data-open]", host).forEach((b) => (b.onclick = () => openUserDetail(byId(b.dataset.open))));
    $$("[data-edit]", host).forEach((b) => (b.onclick = () => openUserForm(byId(b.dataset.edit), load)));
    $$("[data-pw]", host).forEach((b) => (b.onclick = () => openPasswordReset(byId(b.dataset.pw), load)));
    $$("[data-del]", host).forEach((b) => (b.onclick = async () => {
      const u = byId(b.dataset.del);
      const ok = await confirmDialog(`Delete ${u?.fullName}? Their bookings stay but are no longer linked to an account.`, { title: "Delete user", ok: "Delete user" });
      if (!ok) return;
      try { await api(`/api/admin/users/${b.dataset.del}`, { method: "DELETE" }); toast("User deleted", "success"); await load(); }
      catch (err) { toast(err.message, "error"); }
    }));
  }
});

function openUserForm(u, after) {
  const fields = u
    ? [
        { k: "fullName", l: "Full name", t: "text", required: true },
        { k: "phone", l: "Phone", t: "text" },
        { k: "role", l: "Role", t: "select", options: () => ROLES },
        { k: "isActive", l: "Account is active", t: "checkbox", def: true }
      ]
    : [
        { k: "fullName", l: "Full name", t: "text", required: true },
        { k: "email", l: "Email", t: "text", required: true },
        { k: "phone", l: "Phone", t: "text" },
        { k: "password", l: "Password", t: "text", required: true, hint: "At least 6 characters. Share it with the user securely." },
        { k: "role", l: "Role", t: "select", options: () => ROLES },
        { k: "isEmailVerified", l: "Mark email as verified", t: "checkbox", def: true }
      ];
  primeFields(fields);

  openPanel(`<div class="modal">
    <div class="modal-head"><h3 class="mb-0">${u ? `Edit ${esc(u.fullName)}` : "New user"}</h3>
      <button class="modal-close" data-close-modal>&times;</button></div>
    <div class="modal-body" id="uForm">${renderForm(fields, u ? { ...u, isActive: u.isActive } : { role: "Customer", isEmailVerified: true, isActive: true })}</div>
    <div class="modal-foot"><button class="btn btn-outline" data-close-modal>Cancel</button>
      <button class="btn" id="uSave">${u ? "Save user" : "Create user"}</button></div>
  </div>`, {
    onReady: (root) => {
      wireForm(root);
      $("#uSave", root).onclick = async (e) => {
        const body = readForm($("#uForm", root), fields);
        if (!body.fullName) { toast("A name is required", "warn"); return; }
        e.target.classList.add("is-loading");
        try {
          const res = u
            ? await api(`/api/admin/users/${u.id}`, { method: "PUT", body })
            : await api("/api/admin/users", { method: "POST", body });
          toast(res.message, "success");
          closePanel();
          after?.();
        } catch (err) { toast(err.message, "error"); } finally { e.target.classList.remove("is-loading"); }
      };
    }
  });
}

function openUserDetail(u) {
  if (!u) return;
  openPanel(`<div class="modal lg"><div class="modal-body"><div class="admin-spinner"></div></div></div>`, { wide: true });
  api(`/api/admin/users/${u.id}`).then((d) => {
    openPanel(`<div class="modal lg">
      <div class="modal-head"><div><h3 class="mb-0">${esc(d.fullName)}</h3><span class="small muted">${esc(d.email)}</span></div>
        <button class="modal-close" data-close-modal>&times;</button></div>
      <div class="modal-body">
        <div class="kv" style="margin-bottom:18px">
          <div><span>Role</span><strong>${esc(d.role)}</strong></div>
          <div><span>Status</span><strong>${d.isActive ? "Active" : "Disabled"}</strong></div>
          <div><span>Email verified</span><strong>${d.isEmailVerified ? "Yes" : "No"}</strong></div>
          <div><span>Phone</span><strong>${esc(d.phone || "—")}</strong></div>
          <div><span>Joined</span><strong>${esc(fmtDate(d.createdAt))}</strong></div>
          <div><span>Last sign-in</span><strong>${d.lastLoginAt ? esc(fmtDateTime(d.lastLoginAt)) : "never"}</strong></div>
        </div>
        <h4>Bookings (${(d.bookings || []).length})</h4>
        ${(d.bookings || []).length ? tableWrap(
          [{ label: "Code" }, { label: "Room" }, { label: "Stay" }, { label: "Total", num: true }, { label: "Status" }],
          d.bookings.map((b) => `<tr><td class="strong">${esc(b.bookingCode)}</td><td>${esc(b.room || "—")}</td>
            <td>${esc(fmtDate(b.checkIn))} → ${esc(fmtDate(b.checkOut))}</td>
            <td class="num">${esc(money(b.totalAmount))}</td><td>${badge(b.status, kind(b.status))}</td></tr>`).join("")
        ) : `<p class="muted">No bookings yet.</p>`}
        <h4 style="margin-top:20px">Food orders (${(d.orders || []).length})</h4>
        ${(d.orders || []).length ? tableWrap(
          [{ label: "Order" }, { label: "When" }, { label: "Total", num: true }, { label: "Status" }],
          d.orders.map((o) => `<tr><td class="strong">${esc(o.orderCode)}</td><td>${esc(fmtDateTime(o.createdAt))}</td>
            <td class="num">${esc(money(o.totalAmount))}</td><td>${badge(o.status, kind(o.status))}</td></tr>`).join("")
        ) : `<p class="muted">No orders yet.</p>`}
      </div>
      <div class="modal-foot"><button class="btn btn-outline" data-close-modal>Close</button></div>
    </div>`, { wide: true });
  }).catch((err) => { toast(err.message, "error"); closePanel(); });
}

function openPasswordReset(u, after) {
  if (!u) return;
  openPanel(`<div class="modal sm">
    <div class="modal-head"><h3 class="mb-0">Reset password</h3><button class="modal-close" data-close-modal>&times;</button></div>
    <div class="modal-body">
      <p class="muted">Set a new password for <strong>${esc(u.fullName)}</strong> (${esc(u.email)}). Leave it blank to generate a strong random one.</p>
      <div class="admin-form"><div class="field"><label>New password</label>
        <input type="text" id="newPw" placeholder="Leave blank to auto-generate"></div></div>
      <div id="pwResult"></div>
    </div>
    <div class="modal-foot"><button class="btn btn-outline" data-close-modal>Close</button>
      <button class="btn" id="pwSave">Reset password</button></div>
  </div>`, {
    onReady: (root) => {
      $("#pwSave", root).onclick = async (e) => {
        e.target.classList.add("is-loading");
        try {
          const res = await api(`/api/admin/users/${u.id}/reset-password`, { method: "POST", body: { newPassword: $("#newPw", root).value || null } });
          $("#pwResult", root).innerHTML = `<div class="alert alert-success" style="margin-top:14px">${esc(res.message || "Password reset.")}
            ${res.password ? `<div style="margin-top:8px;font-family:ui-monospace,Menlo,monospace;font-size:1.05rem;word-break:break-all">${esc(res.password)}</div>
              <button class="icon-btn" type="button" id="copyPw" style="margin-top:8px">Copy password</button>` : ""}</div>`;
          const copy = $("#copyPw", root);
          if (copy) copy.onclick = () => copyText(res.password);
          after?.();
        } catch (err) { $("#pwResult", root).innerHTML = `<div class="alert alert-error" style="margin-top:14px">${esc(err.message)}</div>`; }
        finally { e.target.classList.remove("is-loading"); }
      };
    }
  });
}

/* ================================================================ audit log */

page("audit", async (_param, host) => {
  let take = 100;
  host.innerHTML = `<div class="admin-spinner"></div>`;
  const render = async () => {
    let logs = [];
    try {
      logs = await api(`/api/admin/audit-logs?take=${take}`);
    } catch (err) {
      host.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
      return;
    }
    host.innerHTML = `
      <div class="stat-grid">
        ${statCard("Entries shown", num(logs.length), `Most recent ${take}`, { accent: true })}
        ${statCard("Different actions", num(new Set(logs.map((l) => l.action)).size), "Distinct action types")}
        ${statCard("Staff involved", num(new Set(logs.map((l) => l.userEmail).filter(Boolean)).size), "Accounts that made changes")}
        ${statCard("Latest", logs[0] ? esc(relTime(logs[0].createdAt)) : "—", logs[0] ? esc(logs[0].action) : "")}
      </div>
      <div class="toolbar">
        <div class="field"><label>Show</label>
          <select id="aTake">
            ${[50, 100, 200, 500].map((n) => `<option value="${n}" ${n === take ? "selected" : ""}>${n} entries</option>`).join("")}
          </select></div>
        <div class="field grow"><label>Search</label><input type="text" id="aSearch" placeholder="Action, entity, id or staff email…"></div>
        <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="aExport">Export CSV</button></div>
      </div>
      <div class="panel"><div class="panel-body flush" id="aBody"></div></div>`;

    function paint(filter = "") {
      const q = filter.trim().toLowerCase();
      const rows = logs.filter((l) => !q
        || String(l.action).toLowerCase().includes(q)
        || String(l.entity || "").toLowerCase().includes(q)
        || String(l.entityId || "").toLowerCase().includes(q)
        || String(l.userEmail || "").toLowerCase().includes(q)
        || String(l.details || "").toLowerCase().includes(q));
      $("#aBody").innerHTML = tableWrap(
        [{ label: "When" }, { label: "Staff" }, { label: "Action" }, { label: "Entity" }, { label: "Details" }],
        rows.map((l) => `<tr>
          <td>${esc(fmtDateTime(l.createdAt))}<br><span class="muted-sm">${esc(relTime(l.createdAt))}</span></td>
          <td>${esc(l.userEmail || "system")}</td>
          <td class="strong">${esc(l.action)}</td>
          <td>${esc(l.entity || "—")}${l.entityId ? `<br><span class="muted-sm">#${esc(l.entityId)}</span>` : ""}</td>
          <td class="muted-sm">${esc(l.details || "")}</td>
        </tr>`).join(""), { empty: "Nothing logged yet" });
    }
    paint();

    $("#aTake").onchange = (e) => { take = Number(e.target.value); render(); };
    $("#aSearch").oninput = (e) => paint(e.target.value);
    $("#aExport").onclick = () => {
      downloadCsv(`audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
        ["When", "Staff", "Action", "Entity", "EntityId", "Details"],
        logs.map((l) => [l.createdAt, l.userEmail || "", l.action, l.entity || "", l.entityId || "", l.details || ""]));
      toast("CSV exported", "success");
    };
  };
  await render();
});
