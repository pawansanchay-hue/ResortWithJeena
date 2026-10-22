/* ==========================================================================
   Jeena Resort & Spa - admin dashboard and reporting screens
   ========================================================================== */

import {
  $, $$, S, api, auth, esc, money, num, fmtDate, fmtDateTime, relTime, toast,
  barChart, lineChart, donutChart, barList, emptyChart, statCard, tableWrap,
  pct, page, go, ROUTES
} from "./core.js";
import { refreshNavSoon, loadDashboardCounts } from "./shell.js";
import { badge } from "./views.crud.js";

/* ================================================================ dashboard */

page("dashboard", async (_param, host) => {
  const d = await api("/api/admin/dashboard");
  S.dash = d;
  refreshNavSoon();

  const c = d.cards;
  const today = new Date().toISOString().slice(0, 10);

  host.innerHTML = `
    <div class="stat-grid">
      ${statCard("Revenue this month", money(c.monthRevenue), `All time <b>${esc(money(c.totalRevenue))}</b>`, { accent: true })}
      ${statCard("Bookings", num(c.totalBookings), `<b>${num(c.pendingBookings)}</b> awaiting confirmation`)}
      ${statCard("Occupancy today", num(c.occupancyPercent) + "%", `${num(c.occupiedUnits)} of ${num(c.totalUnits)} units occupied`)}
      ${statCard("Arrivals today", num(c.arrivalsToday), `<b>${num(c.activeStays)}</b> guests in house`)}
      ${statCard("Food orders", num(c.foodOrders), `<b>${num(c.pendingFoodOrders)}</b> in the kitchen · ${esc(money(c.foodRevenue))}`)}
      ${statCard("Members", num(c.totalUsers), `<b>${num(c.newUsersThisMonth)}</b> joined this month`)}
      ${statCard("Unread enquiries", num(c.unreadMessages), `<b>${num(c.subscribers)}</b> newsletter subscribers`)}
      ${statCard("Today's revenue", money(c.todayRevenue), `${num(c.departuresToday)} departures today`)}
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div><h2>Revenue trend</h2><p>Bookings by check-in date over the last 14 days</p></div>
          <button class="icon-btn" type="button" data-goto="reports">Full report</button>
        </div>
        <div class="panel-body">${barChart((d.revenueTrend || []).map((p) => ({ label: p.label, revenue: num(p.total) })), { keys: ["revenue"] })}</div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Booking status</h2><p>Where every reservation sits right now</p></div></div>
        <div class="panel-body">${donutChart(d.statusSplit || [], { labelKey: "status", valueKey: "count", format: (v) => num(v) + " bookings" })}</div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head">
        <div><h2>Latest bookings</h2><p>Newest reservations in the system</p></div>
        <button class="icon-btn" type="button" data-goto="bookings">Manage bookings</button>
      </div>
      <div class="panel-body flush">
        ${tableWrap(
          [{ label: "Code" }, { label: "Guest" }, { label: "Room" }, { label: "Stay" }, { label: "Total", num: true }, { label: "Status" }, { label: "Booked" }],
          (d.recentBookings || []).map((b) => `<tr>
            <td class="strong">${esc(b.bookingCode)}</td>
            <td>${esc(b.guestName)}<br><span class="muted-sm">${esc(b.guestEmail)}</span></td>
            <td>${esc(b.roomName)}</td>
            <td>${esc(fmtDate(b.checkIn))} → ${esc(fmtDate(b.checkOut))}<br><span class="muted-sm">${num(b.nights)} night(s)</span></td>
            <td class="num">${esc(money(b.totalAmount))}</td>
            <td>${badge(b.status, statusKind(b.status))} ${badge(b.paymentStatus, statusKind(b.paymentStatus))}</td>
            <td class="muted-sm">${esc(relTime(b.createdAt))}</td>
          </tr>`).join(""),
          { empty: "No bookings yet" })}
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head"><div><h2>Arrivals &amp; departures</h2><p>Front desk worklist for today</p></div></div>
        <div class="panel-body flush">
          ${(d.upcomingArrivals || []).length ? `<div class="table-wrap"><table class="data" style="min-width:auto">
            <thead><tr><th>Guest</th><th>Room</th><th>Check-in</th><th>Status</th></tr></thead>
            <tbody>${d.upcomingArrivals.map((a) => `<tr>
              <td>${esc(a.guestName)}<br><span class="muted-sm">${num(a.adults)} adults, ${num(a.children)} children</span></td>
              <td>${esc(a.roomName)}</td>
              <td>${esc(fmtDate(a.checkIn))}${a.checkIn?.slice(0, 10) === today ? " <span class='badge badge-amber'>today</span>" : ""}</td>
              <td>${badge(a.status, statusKind(a.status))}</td></tr>`).join("")}</tbody></table></div>`
            : emptyChart("No arrivals in the next few days")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><div><h2>Top performing rooms</h2><p>Revenue leaders all time</p></div></div>
        <div class="panel-body">${barList((d.topRooms || []).map((r) => ({ label: r.room, value: r.revenue })), { format: money })}</div>
      </div>
    </div>

    <div class="grid-2">
      <div class="panel">
        <div class="panel-head">
          <div><h2>Recent kitchen orders</h2><p>Newest food and room-service orders</p></div>
          <button class="icon-btn" type="button" data-goto="food-orders">Open kitchen</button>
        </div>
        <div class="panel-body flush">
          ${(d.recentOrders || []).length ? `<div class="table-wrap"><table class="data" style="min-width:auto">
            <thead><tr><th>Order</th><th>Customer</th><th>Type</th><th class="num">Total</th><th>Status</th></tr></thead>
            <tbody>${d.recentOrders.map((o) => `<tr>
              <td class="strong">${esc(o.orderCode)}<br><span class="muted-sm">${esc(relTime(o.createdAt))}</span></td>
              <td>${esc(o.customerName)}</td>
              <td><span class="badge badge-gray">${esc(o.orderType)}</span></td>
              <td class="num">${esc(money(o.totalAmount))}</td>
              <td>${badge(o.status, statusKind(o.status))}</td></tr>`).join("")}</tbody></table></div>`
            : emptyChart("No food orders yet")}
        </div>
      </div>
      <div class="panel">
        <div class="panel-head">
          <div><h2>Recent enquiries</h2><p>Contact form messages</p></div>
          <button class="icon-btn" type="button" data-goto="messages">Inbox</button>
        </div>
        <div class="panel-body flush">
          ${(d.recentMessages || []).length ? `<div>${d.recentMessages.map((m) => `<div class="msg-row ${m.isRead ? "" : "unread"}">
              <div class="flex items-center justify-between flex-wrap" style="gap:8px">
                <strong>${esc(m.name)}</strong>
                <span class="muted-sm">${esc(relTime(m.createdAt))}</span>
              </div>
              <p class="small mb-0">${esc(m.subject || "(no subject)")} · <span class="muted">${esc(m.email)}</span></p>
            </div>`).join("")}</div>` : emptyChart("Inbox is empty")}
        </div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><div><h2>Activity log</h2><p>The last things that happened in the admin panel</p></div></div>
      <div class="panel-body">
        ${(d.recentActivity || []).length ? `<ul class="timeline">${d.recentActivity.slice(0, 12).map((a) => `<li>
          <strong>${esc(a.action)}</strong>
          <span>${esc(a.entity || "")}${a.entityId ? " · " + esc(a.entityId) : ""} — ${esc(a.userEmail || "system")} · ${esc(relTime(a.createdAt))}</span>
          ${a.details ? `<span style="display:block;color:var(--muted)">${esc(a.details)}</span>` : ""}
        </li>`).join("")}</ul>` : emptyChart("No activity recorded yet")}
      </div>
    </div>`;

  $$("[data-goto]", host).forEach((b) => (b.onclick = () => go(b.dataset.goto)));
  $(".stat-grid").insertAdjacentHTML("beforebegin",
    `<div class="panel"><div class="panel-body" style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;justify-content:space-between">
      <div><strong>Welcome back${S.me ? ", " + esc(S.me.fullName) : ""}.</strong>
      <span class="muted small" style="display:block">Snapshot generated ${esc(fmtDateTime(d.generatedAt))}.</span></div>
      <div class="toolbar" style="margin:0">
        <button class="btn btn-sm" type="button" id="dashRefresh">Refresh data</button>
        <button class="btn btn-sm btn-outline" type="button" id="dashReports">Open reports</button>
      </div></div></div>`);
  $("#dashRefresh").onclick = async () => { await loadDashboardCounts(); await ROUTES.dashboard(null, host); };
  $("#dashReports").onclick = () => go("reports");
});

export function statusKind(status) {
  return {
    Pending: "amber", Confirmed: "blue", CheckedIn: "green", CheckedOut: "gray", Cancelled: "red",
    Unpaid: "red", Partial: "amber", Paid: "green", Refunded: "gray",
    New: "amber", Preparing: "blue", Ready: "purple", Served: "green", Billed: "gray",
    Admin: "purple", Staff: "blue", Customer: "gray"
  }[status] || "gray";
}

/* ================================================================= reports */

const rstate = { type: "summary", from: "", to: "", groupBy: "day", cache: {} };

page("reports", async (_param, host) => {
  if (!rstate.from) {
    rstate.from = todayOffsetISODate(-29);
    rstate.to = todayOffsetISODate(0);
  }

  host.innerHTML = `
    <div class="panel">
      <div class="panel-body">
        <div class="toolbar" style="margin-bottom:0">
          <div class="field"><label>From</label><input type="date" id="rFrom" value="${esc(rstate.from)}"></div>
          <div class="field"><label>To</label><input type="date" id="rTo" value="${esc(rstate.to)}"></div>
          <div class="field"><label>Group revenue by</label>
            <select id="rGroup"><option value="day" ${rstate.groupBy === "day" ? "selected" : ""}>Day</option>
            <option value="month" ${rstate.groupBy === "month" ? "selected" : ""}>Month</option></select></div>
          <div class="field"><label>Quick range</label>
            <select id="rQuick">
              <option value="">Custom</option>
              <option value="7">Last 7 days</option>
              <option value="30" selected>Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
              <option value="ytd">Year to date</option>
            </select></div>
          <div class="field"><label>&nbsp;</label><button class="btn" type="button" id="rApply">Apply</button></div>
          <div class="field"><label>&nbsp;</label><button class="btn btn-outline" type="button" id="rExport">Export CSV</button></div>
        </div>
      </div>
    </div>

    <div class="settings-tabs" id="rTabs">
      ${[["summary", "Summary"], ["revenue", "Revenue"], ["bookings", "Bookings"], ["food", "Dining"], ["occupancy", "Occupancy"], ["users", "Members"]]
        .map(([k, l]) => `<button class="settings-tab ${rstate.type === k ? "active" : ""}" type="button" data-type="${k}">${l}</button>`).join("")}
    </div>

    <div id="rBody"><div class="admin-spinner"></div></div>`;

  $("#rFrom").onchange = (e) => { rstate.from = e.target.value; $("#rQuick").value = ""; load(); };
  $("#rTo").onchange = (e) => { rstate.to = e.target.value; $("#rQuick").value = ""; load(); };
  $("#rGroup").onchange = (e) => { rstate.groupBy = e.target.value; load(); };
  $("#rQuick").onchange = (e) => {
    const v = e.target.value;
    if (!v) return;
    if (v === "ytd") { rstate.from = new Date().getFullYear() + "-01-01"; rstate.to = todayOffsetISODate(0); }
    else { rstate.from = todayOffsetISODate(-(Number(v) - 1)); rstate.to = todayOffsetISODate(0); }
    $("#rFrom").value = rstate.from;
    $("#rTo").value = rstate.to;
    load();
  };
  $("#rApply").onclick = () => load();
  $("#rExport").onclick = () => downloadReport(rstate.type);
  $$("#rTabs [data-type]").forEach((b) => (b.onclick = () => {
    rstate.type = b.dataset.type;
    $$("#rTabs [data-type]").forEach((x) => x.classList.toggle("active", x === b));
    load();
  }));

  await load();

  async function load() {
    const body = $("#rBody");
    body.innerHTML = `<div class="admin-spinner"></div>`;
    const q = `?from=${rstate.from}&to=${rstate.to}`;
    try {
      if (rstate.type === "summary") body.innerHTML = await renderSummary(q);
      else if (rstate.type === "revenue") body.innerHTML = await renderRevenue(q);
      else if (rstate.type === "bookings") body.innerHTML = await renderBookings(q);
      else if (rstate.type === "food") body.innerHTML = await renderFood(q);
      else if (rstate.type === "occupancy") body.innerHTML = await renderOccupancy(q);
      else body.innerHTML = await renderUsers(q);
    } catch (err) {
      body.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  }
});

function todayOffsetISODate(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

async function renderSummary(q) {
  const s = await api("/api/admin/reports/summary" + q);
  return `
    <div class="stat-grid">
      ${statCard("Total revenue", money(s.revenue.total), `Room ${esc(money(s.revenue.room))} · Food ${esc(money(s.revenue.food))} · Tax ${esc(money(s.revenue.tax))}`, { accent: true })}
      ${statCard("Bookings", num(s.bookings.total), `${num(s.bookings.roomNights)} room nights · avg ${num(s.bookings.averageStay)} nights`)}
      ${statCard("Average booking", money(s.bookings.averageValue), `${num(s.bookings.cancelled)} cancelled in period`)}
      ${statCard("Occupancy", num(s.occupancy.percent) + "%", `${num(s.occupancy.roomNights)} of ${num(s.occupancy.capacityNights)} unit nights`)}
      ${statCard("Guests", num(s.guests.adults) + num(s.guests.children), `${num(s.guests.adults)} adults · ${num(s.guests.children)} children`)}
      ${statCard("Food orders", num(s.foodOrders.total), `avg ${esc(money(s.foodOrders.averageValue))} · ${num(s.foodOrders.served)} served`)}
      ${statCard("Collected", money(s.revenue.collected), `${esc(money(s.revenue.pending))} still outstanding`)}
      ${statCard("New members", num(s.guests.newUsers), `${num(s.enquiries)} enquiries received`)}
    </div>
    <div class="panel"><div class="panel-body">
      <div class="kv">
        <div><span>Period</span><strong>${esc(fmtDate(s.from))} → ${esc(fmtDate(s.to))}</strong></div>
        <div><span>Days covered</span><strong>${num(s.days)}</strong></div>
        <div><span>Confirmed</span><strong>${num(s.bookings.confirmed)}</strong></div>
        <div><span>Checked in</span><strong>${num(s.bookings.checkedIn)}</strong></div>
        <div><span>Checked out</span><strong>${num(s.bookings.checkedOut)}</strong></div>
        <div><span>Pending</span><strong>${num(s.bookings.pending)}</strong></div>
        <div><span>Refunded</span><strong>${esc(money(s.revenue.refunded))}</strong></div>
        <div><span>Kitchen queue</span><strong>${num(s.foodOrders.pending)}</strong></div>
      </div>
    </div></div>`;
}

async function renderRevenue(q) {
  const r = await api(`/api/admin/reports/revenue${q}&groupBy=${rstate.groupBy}`);
  const points = r.points || [];
  return `
    <div class="stat-grid">
      ${statCard("Total revenue", money(r.totalRevenue), `Bookings ${esc(money(r.bookingRevenue))}`, { accent: true })}
      ${statCard("Online food orders", money(r.onlineFoodRevenue), "Paid directly from the dining page")}
      ${statCard("Data points", num(points.length), rstate.groupBy === "month" ? "Monthly buckets" : "Daily buckets")}
      ${statCard("Best bucket", points.length ? money(Math.max(...points.map((p) => num(p.total)))) : money(0), points.length ? esc(points.reduce((a, b) => (num(a.total) > num(b.total) ? a : b)).label) : "")}
    </div>
    <div class="panel"><div class="panel-head"><div><h2>Revenue by ${esc(rstate.groupBy)}</h2><p>Room, food and tax split</p></div></div>
      <div class="panel-body">${barChart(points, { keys: ["room", "food", "tax"] })}</div></div>
    <div class="grid-2">
      <div class="panel"><div class="panel-head"><div><h2>Totals over time</h2><p>Overall value per ${esc(rstate.groupBy)}</p></div></div>
        <div class="panel-body">${lineChart(points, { keys: ["total"] })}</div></div>
      <div class="panel"><div class="panel-head"><div><h2>Payment status</h2><p>Value by payment state</p></div></div>
        <div class="panel-body">${donutChart(r.statusSplit || [], { labelKey: "label", valueKey: "value", format: money })}</div></div>
    </div>
    <div class="panel"><div class="panel-head"><div><h2>Revenue by room</h2><p>Which rooms earn the most</p></div></div>
      <div class="panel-body flush">${tableWrap(
        [{ label: "Room" }, { label: "Bookings", num: true }, { label: "Room nights", num: true }, { label: "Revenue", num: true }, { label: "Share" }],
        (r.topRooms || []).map((t) => `<tr>
          <td class="strong">${esc(t.room)}</td><td class="num">${num(t.bookings)}</td><td class="num">${num(t.nights)}</td>
          <td class="num">${esc(money(t.revenue))}</td>
          <td><span class="track" style="display:block;height:8px;border-radius:99px;background:var(--section-bg)"><span class="fill" style="display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--primary),var(--secondary));width:${pct(t.revenue, r.totalRevenue || 1)}%"></span></span></td>
        </tr>`).join(""), { empty: "No revenue in this period" })}</div></div>`;
}

async function renderBookings(q) {
  const r = await api("/api/admin/reports/bookings" + q);
  const rows = r.rows || [];
  return `
    <div class="stat-grid">
      ${statCard("Bookings", num(r.count), `${esc(fmtDate(r.from))} → ${esc(fmtDate(r.to))}`, { accent: true })}
      ${statCard("Total value", money(r.totals.total), `Tax ${esc(money(r.totals.tax))}`)}
      ${statCard("Room revenue", money(r.totals.roomAmount), `${num(r.totals.nights)} room nights`)}
      ${statCard("Food revenue", money(r.totals.foodAmount), "Pre-ordered with a stay")}
    </div>
    <div class="panel">
      <div class="panel-head">
        <div><h2>All bookings in range</h2><p>${rows.length} row(s) — use the toolbar above to change the period</p></div>
        <button class="icon-btn" type="button" id="csvBookings">Download CSV</button>
      </div>
      <div class="panel-body flush">${tableWrap(
        [{ label: "Code" }, { label: "Guest" }, { label: "Room" }, { label: "Check-in" }, { label: "Check-out" }, { label: "Nights", num: true }, { label: "Guests", num: true }, { label: "Room", num: true }, { label: "Food", num: true }, { label: "Tax", num: true }, { label: "Total", num: true }, { label: "Status" }, { label: "Payment" }],
        rows.map((b) => `<tr>
          <td class="strong">${esc(b.bookingCode)}</td>
          <td>${esc(b.guest)}<br><span class="muted-sm">${esc(b.email || b.phone || "")}</span></td>
          <td>${esc(b.room)}</td>
          <td>${esc(fmtDate(b.checkIn))}</td>
          <td>${esc(fmtDate(b.checkOut))}</td>
          <td class="num">${num(b.nights)}</td>
          <td class="num">${num(b.guests)}</td>
          <td class="num">${esc(money(b.roomAmount))}</td>
          <td class="num">${esc(money(b.foodAmount))}</td>
          <td class="num">${esc(money(b.taxAmount))}</td>
          <td class="num strong">${esc(money(b.totalAmount))}</td>
          <td>${badge(b.status, statusKind(b.status))}</td>
          <td>${badge(b.paymentStatus, statusKind(b.paymentStatus))}</td>
        </tr>`).join(""), { empty: "No bookings in this period" })}</div>
    </div>`;
}

async function renderFood(q) {
  const f = await api("/api/admin/reports/food" + q);
  return `
    <div class="stat-grid">
      ${statCard("Food revenue", money(f.revenue), `${num(f.orderCount)} order(s)`, { accent: true })}
      ${statCard("Average order", money(f.averageOrder), "Across all live orders")}
      ${statCard("Items sold", num(f.totalItemsSold), `${(f.topItems || []).length} distinct dishes`)}
      ${statCard("Order channels", num((f.byType || []).length), (f.byType || []).map((t) => `${t.type}: ${t.count}`).join(" · "))}
    </div>
    <div class="grid-2">
      <div class="panel"><div class="panel-head"><div><h2>Orders by channel</h2><p>Dine-in, room service, takeaway</p></div></div>
        <div class="panel-body">${donutChart(f.byType || [], { labelKey: "type", valueKey: "count", format: (v) => num(v) + " orders" })}</div></div>
      <div class="panel"><div class="panel-head"><div><h2>Kitchen pipeline</h2><p>Orders by status</p></div></div>
        <div class="panel-body">${donutChart(f.byStatus || [], { labelKey: "status", valueKey: "count", format: (v) => num(v) + " orders" })}</div></div>
    </div>
    <div class="panel"><div class="panel-head"><div><h2>Best selling dishes</h2><p>Ranked by revenue</p></div></div>
      <div class="panel-body flush">${tableWrap(
        [{ label: "#" }, { label: "Dish" }, { label: "Quantity", num: true }, { label: "Revenue", num: true }],
        (f.topItems || []).map((i, n) => `<tr><td>${n + 1}</td><td class="strong">${esc(i.name)}</td>
          <td class="num">${num(i.quantity)}</td><td class="num">${esc(money(i.revenue))}</td></tr>`).join(""),
        { empty: "No food orders in this period" })}</div></div>`;
}

async function renderOccupancy(q) {
  const o = await api("/api/admin/reports/occupancy" + q);
  const rooms = o.rooms || [];
  return `
    <div class="stat-grid">
      ${statCard("Average occupancy", num(o.averageOccupancy) + "%", `${num(o.days)} day(s) in range`, { accent: true })}
      ${statCard("Rooms tracked", num(rooms.length), "Active room types")}
      ${statCard("Room nights sold", num(rooms.reduce((s, r) => s + num(r.roomNights), 0)), "Across all room types")}
      ${statCard("Capacity nights", num(rooms.reduce((s, r) => s + num(r.capacityNights), 0)), "Units × days in range")}
    </div>
    <div class="panel"><div class="panel-head"><div><h2>Occupancy by room type</h2><p>Percentage of available unit nights booked</p></div></div>
      <div class="panel-body">${barList(rooms.map((r) => ({ label: r.room, value: r.occupancy })), { format: (v) => v + "%" })}</div></div>
    <div class="panel"><div class="panel-head"><div><h2>Detail</h2><p>Unit nights versus capacity</p></div></div>
      <div class="panel-body flush">${tableWrap(
        [{ label: "Room" }, { label: "Units", num: true }, { label: "Room nights", num: true }, { label: "Capacity", num: true }, { label: "Occupancy", num: true }],
        rooms.map((r) => `<tr>
          <td class="strong">${esc(r.room)}</td><td class="num">${num(r.units)}</td>
          <td class="num">${num(r.roomNights)}</td><td class="num">${num(r.capacityNights)}</td>
          <td class="num"><strong>${num(r.occupancy)}%</strong></td></tr>`).join(""),
        { empty: "No rooms configured" })}</div></div>`;
}

async function renderUsers(q) {
  const u = await api("/api/admin/reports/users" + q);
  return `
    <div class="stat-grid">
      ${statCard("New members", num(u.total), `${esc(fmtDate(u.from))} → ${esc(fmtDate(u.to))}`, { accent: true })}
      ${statCard("Email verified", num(u.verified), `${num(u.total - u.verified)} still to verify`)}
      ${statCard("Roles", num((u.byRole || []).length), (u.byRole || []).map((r) => `${r.role}: ${r.count}`).join(" · "))}
      ${statCard("Active", num((u.rows || []).filter((r) => r.isActive).length), "Accounts that can sign in")}
    </div>
    <div class="grid-2">
      <div class="panel"><div class="panel-head"><div><h2>Sign-ups by role</h2><p>How new members are distributed</p></div></div>
        <div class="panel-body">${donutChart(u.byRole || [], { labelKey: "role", valueKey: "count", format: (v) => num(v) + " users" })}</div></div>
      <div class="panel"><div class="panel-head"><div><h2>Verification</h2><p>Email verification progress</p></div></div>
        <div class="panel-body">${donutChart([
          { label: "Verified", count: num(u.verified) },
          { label: "Unverified", count: Math.max(0, num(u.total) - num(u.verified)) }
        ], { labelKey: "label", valueKey: "count", format: (v) => num(v) + " users" })}</div></div>
    </div>
    <div class="panel"><div class="panel-head"><div><h2>New accounts</h2><p>Everyone who registered in this period</p></div></div>
      <div class="panel-body flush">${tableWrap(
        [{ label: "Name" }, { label: "Email" }, { label: "Phone" }, { label: "Role" }, { label: "Verified" }, { label: "Joined" }, { label: "Last sign-in" }],
        (u.rows || []).map((r) => `<tr>
          <td class="strong">${esc(r.fullName)}</td>
          <td>${esc(r.email)}</td>
          <td>${esc(r.phone || "—")}</td>
          <td>${badge(r.role, statusKind(r.role))}</td>
          <td>${r.isEmailVerified ? badge("Yes", "green") : badge("No", "amber")}</td>
          <td>${esc(fmtDate(r.createdAt))}</td>
          <td>${r.lastLoginAt ? esc(fmtDateTime(r.lastLoginAt)) : "never"}</td></tr>`).join(""),
        { empty: "No new members in this period" })}</div></div>`;
}

/* --------------------------------------------------------- CSV download */

async function downloadReport(type) {
  const map = { summary: "bookings", revenue: "revenue", bookings: "bookings", food: "food", occupancy: "bookings", users: "users" };
  const endpoint = map[type] || "bookings";
  const url = `/api/admin/reports/export?type=${endpoint}&from=${rstate.from}&to=${rstate.to}`;
  try {
    const res = await fetch(url, { headers: { Authorization: "Bearer " + auth.token } });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const name = (res.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1]) || `${endpoint}-${rstate.from}-to-${rstate.to}.csv`;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    toast("CSV exported", "success");
  } catch (err) {
    toast(err.message, "error");
  }
}
