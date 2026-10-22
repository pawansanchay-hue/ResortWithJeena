import {
  api, initSite, state, esc, qs, icon, settingValue, mapIframe, initRevealWithin,
  renderPageHead, content, toast
} from "./app.js";

await initSite({ page: "contact" });

const head = content("contact", "header");
renderPageHead({
  title: head?.title || "Contact Us",
  subtitle: head?.subtitle || "",
  image: "/assets/page-header.svg",
  crumbs: [{ label: "Home", href: "/index.html" }, { label: "Contact" }]
});

qs("#contactCards").innerHTML = `
  <a class="card" style="padding:24px" href="tel:${esc(settingValue("site.phone"))}" data-anim="up">
    <div class="feature-icon">${icon("phone")}</div>
    <h4 class="mt-2 mb-0">Call reservations</h4>
    <p class="small muted mb-0">${esc(settingValue("site.phone"))}${settingValue("site.phone2") ? `<br>${esc(settingValue("site.phone2"))}` : ""}</p>
  </a>
  <a class="card" style="padding:24px" href="mailto:${esc(settingValue("site.email"))}" data-anim="up" data-delay="1">
    <div class="feature-icon">${icon("mail")}</div>
    <h4 class="mt-2 mb-0">Email us</h4>
    <p class="small muted mb-0">${esc(settingValue("site.email"))}</p>
  </a>
  <a class="card" style="padding:24px" href="${esc(state.mapEmbedUrl)}" target="_blank" rel="noopener" data-anim="up" data-delay="2">
    <div class="feature-icon">${icon("pin")}</div>
    <h4 class="mt-2 mb-0">Visit the resort</h4>
    <p class="small muted mb-0">${esc(settingValue("site.address"))}</p>
  </a>`;

qs("#contactMap").innerHTML = mapIframe(320);

// responsive stacking for the contact grid
const layout = qs("#contactLayout");
const mq = window.matchMedia("(max-width: 900px)");
const apply = () => { layout.style.gridTemplateColumns = mq.matches ? "1fr" : "1.25fr 1fr"; };
apply();
mq.addEventListener("change", apply);

qs("#contactForm").onsubmit = async (e) => {
  e.preventDefault();
  const btn = qs("#contactSubmit");
  const alertBox = qs("#contactAlert");
  alertBox.innerHTML = "";

  const payload = Object.fromEntries(new FormData(e.target).entries());
  if (!payload.name?.trim() || !payload.email?.trim() || !payload.message?.trim()) {
    alertBox.innerHTML = `<div class="alert alert-error">Please fill in your name, email and message.</div>`;
    return;
  }

  btn.classList.add("is-loading");
  try {
    const res = await api("/api/public/contact", { method: "POST", body: payload });
    alertBox.innerHTML = `<div class="alert alert-success">${esc(res.message)}</div>`;
    e.target.reset();
    toast("Message sent. We will be in touch shortly.", "success");
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  } finally {
    btn.classList.remove("is-loading");
  }
};

const faqs = [
  ["What are the check-in and check-out times?", `Check-in from ${settingValue("site.checkInTime", "2:00 PM")} and check-out by ${settingValue("site.checkOutTime", "11:00 AM")}. Early check-in is subject to availability.`],
  ["Is breakfast included?", "Yes, a farmhouse breakfast for two is included with every room booking."],
  ["Do you allow pets?", "Small, well behaved pets are welcome in the garden cottages. Please mention it while booking."],
  ["Can I cancel my reservation?", "Free cancellation up to 48 hours before check-in. Cancel from your account page or call the resort."],
  ["Is there parking and Wi-Fi?", "Both are complimentary across the property, including the restaurant and spa."],
  ["Do you host weddings and corporate events?", "Yes. Our lawn seats 180 guests and the conference hall seats 80. Send an enquiry for packages."]
];

qs("#faqGrid").innerHTML = faqs.map(([q, a], i) => `
  <div class="card" style="padding:24px" data-anim="up" data-delay="${(i % 2) + 1}">
    <h4 class="mb-1">${esc(q)}</h4>
    <p class="muted mb-0">${esc(a)}</p>
  </div>`).join("");

initRevealWithin(document);
