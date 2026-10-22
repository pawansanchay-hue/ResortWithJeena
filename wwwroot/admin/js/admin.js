/* ==========================================================================
   Jeena Resort & Spa - admin panel entry point
   Importing the screen modules registers their routes, then we boot the shell.
   ========================================================================== */

import "./views.crud.js";     // rooms, room types, food, menu categories, carousel, gallery, facilities, testimonials
import "./views.dash.js";     // dashboard + reports
import "./views.content.js";  // page text, settings, media library
import "./views.desk.js";     // bookings, kitchen, enquiries, newsletter, users, audit

import { boot } from "./shell.js";
import { S, auth } from "./core.js";

/* Keep the shared user object fresh so the sidebar shows the right name. */
S.me = auth.user;

/* If the session expires mid-use, bounce back to the gate rather than showing
   a stack of failed requests. */
window.addEventListener("unhandledrejection", (e) => {
  const err = e.reason;
  if (err?.status === 401 || err?.status === 403) {
    auth.clear();
    location.reload();
  }
});

/* Warn before leaving with unsaved settings, if the settings screen is open. */
window.addEventListener("beforeunload", (e) => {
  if (S.route === "settings" && document.querySelector("#setRows [data-k]")) {
    const changed = [...document.querySelectorAll("#setRows [data-k]")].some((el) => el.dataset.dirty === "1");
    if (changed) { e.preventDefault(); e.returnValue = ""; }
  }
});

boot();
