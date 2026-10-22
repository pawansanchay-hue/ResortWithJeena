import { api, initSite, auth, esc, qs, qsa, toast } from "./app.js";

await initSite({ page: "login" });

const params = new URLSearchParams(location.search);
const next = params.get("next") || "/my-account.html";

/* Already signed in? Offer the shortcut straight away. */
if (auth.isLoggedIn) {
  toast("You are already signed in.", "info", 2600);
  setTimeout(() => (location.href = next), 900);
}

/* ------------------------------------------------------------------- tabs */

qsa("#authTabs .tab-btn").forEach((btn) => {
  btn.onclick = () => showTab(btn.dataset.tab);
});

qsa("[data-goto]").forEach((btn) => {
  btn.onclick = () => showTab(btn.dataset.goto);
});

function showTab(name) {
  qsa("#authTabs .tab-btn").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  qsa("[data-tab-panel]").forEach((p) => (p.hidden = p.dataset.tabPanel !== name));
}

/* -------------------------------------------------------------- sign in */

qs("#togglePw").onclick = () => {
  const input = qs("#liPassword");
  const isPw = input.type === "password";
  input.type = isPw ? "text" : "password";
  qs("#togglePw").innerHTML = isPw ? "&#128584;" : "&#128065;";
};

qs("#signinForm").onsubmit = async (e) => {
  e.preventDefault();
  const alertBox = qs("#signinAlert");
  const btn = qs("#signinBtn");
  alertBox.innerHTML = "";

  const email = qs("#liEmail").value.trim();
  const password = qs("#liPassword").value;

  if (!email || !password) {
    alertBox.innerHTML = `<div class="alert alert-error">Please enter your email and password.</div>`;
    return;
  }

  btn.classList.add("is-loading");
  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: { email, password, rememberMe: qs("#liRemember").checked }
    });
    auth.save(res.token, res.user);
    toast(res.message || "Signed in successfully.", "success");
    setTimeout(() => (location.href = res.user?.role === "Admin" ? "/admin/" : next), 650);
  } catch (err) {
    const data = err.data;
    if (data?.requiresOtp) {
      alertBox.innerHTML = `<div class="alert alert-warn">
        <div><strong>Your email is not verified yet.</strong>
        <p class="small mb-1">${esc(data.message)}</p>
        ${data.devOtp ? `<p class="small mb-1">Development code: <strong>${esc(data.devOtp)}</strong></p>` : ""}
        <a class="btn btn-sm mt-1" href="/register.html?verify=${encodeURIComponent(data.email || email)}">Verify now</a></div></div>`;
    } else {
      alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    }
  } finally {
    btn.classList.remove("is-loading");
  }
};

/* ------------------------------------------------------- forgot password */

qs("#forgotForm").onsubmit = async (e) => {
  e.preventDefault();
  const alertBox = qs("#forgotAlert");
  const btn = qs("#forgotBtn");
  alertBox.innerHTML = "";
  const email = qs("#fpEmail").value.trim();
  if (!email) {
    alertBox.innerHTML = `<div class="alert alert-error">Please enter your email address.</div>`;
    return;
  }

  btn.classList.add("is-loading");
  try {
    const res = await api("/api/auth/forgot-password", { method: "POST", body: { email } });
    alertBox.innerHTML = `<div class="alert alert-success">${esc(res.message)}${
      res.devOtp ? ` Development code: <strong>${esc(res.devOtp)}</strong>` : ""
    }</div>`;
    if (res.devOtp) qs("#rpCode").value = res.devOtp;
    qs("#resetForm").hidden = false;
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  } finally {
    btn.classList.remove("is-loading");
  }
};

qs("#resetForm").onsubmit = async (e) => {
  e.preventDefault();
  const alertBox = qs("#resetAlert");
  const btn = qs("#resetBtn");
  alertBox.innerHTML = "";

  const email = qs("#fpEmail").value.trim();
  const code = qs("#rpCode").value.trim();
  const newPassword = qs("#rpPassword").value;

  if (!code || newPassword.length < 6) {
    alertBox.innerHTML = `<div class="alert alert-error">Enter the reset code and a password of at least 6 characters.</div>`;
    return;
  }

  btn.classList.add("is-loading");
  try {
    const res = await api("/api/auth/reset-password", { method: "POST", body: { email, code, newPassword } });
    alertBox.innerHTML = `<div class="alert alert-success">${esc(res.message)}</div>`;
    qs("#liEmail").value = email;
    qs("#liPassword").value = "";
    qs("#resetForm").hidden = true;
    showTab("signin");
    toast("Password updated. Please sign in.", "success");
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  } finally {
    btn.classList.remove("is-loading");
  }
};

/* prefill the email from a redirect */
if (params.get("email")) qs("#liEmail").value = params.get("email");
if (params.get("tab") === "forgot" || params.get("forgot")) {
  showTab("forgot");
  qs("#fpEmail").value = params.get("email") || "";
}
