import { api, initSite, auth, esc, qs, qsa, toast, num } from "./app.js";

await initSite({ page: "register" });

const params = new URLSearchParams(location.search);
const verifyEmail = params.get("verify");

const session = { email: "", otpLength: 6, expiresAt: 0 };

/* =========================================================== password meter */

const pwInput = qs("#rgPassword");
pwInput.oninput = () => {
  const v = pwInput.value;
  let score = 0;
  if (v.length >= 6) score++;
  if (v.length >= 10) score++;
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
  if (/\d/.test(v) && /[^A-Za-z0-9]/.test(v)) score++;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  const meter = qs("#pwMeter");
  meter.dataset.score = String(score);
  qsa("i", meter).forEach((bar, i) => bar.classList.toggle("on", i < score));
  qs("#pwLabel").textContent = v ? labels[score] : "Password strength";
};

qs("#togglePw1").onclick = () => {
  const isPw = pwInput.type === "password";
  pwInput.type = isPw ? "text" : "password";
  qs("#togglePw1").innerHTML = isPw ? "&#128584;" : "&#128065;";
};

/* ================================================================ step 1 */

qs("#registerForm").onsubmit = async (e) => {
  e.preventDefault();
  const alertBox = qs("#registerAlert");
  const btn = qs("#registerBtn");
  alertBox.innerHTML = "";

  const payload = {
    fullName: qs("#rgName").value.trim(),
    email: qs("#rgEmail").value.trim(),
    phone: qs("#rgPhone").value.trim(),
    password: qs("#rgPassword").value,
    confirmPassword: qs("#rgConfirm").value
  };

  if (!payload.fullName || !payload.email || !payload.phone) {
    alertBox.innerHTML = `<div class="alert alert-error">Please fill in your name, email and mobile number.</div>`;
    return;
  }
  if (payload.password.length < 6) {
    alertBox.innerHTML = `<div class="alert alert-error">Your password must be at least 6 characters long.</div>`;
    return;
  }
  if (payload.password !== payload.confirmPassword) {
    alertBox.innerHTML = `<div class="alert alert-error">The two passwords do not match.</div>`;
    return;
  }
  if (!qs("#rgTerms").checked) {
    alertBox.innerHTML = `<div class="alert alert-error">Please accept the terms of service to continue.</div>`;
    return;
  }

  btn.classList.add("is-loading");
  try {
    const res = await api("/api/auth/register", { method: "POST", body: payload });

    if (payload.email && qs("#rgNews").checked) {
      api("/api/public/newsletter", { method: "POST", body: { email: payload.email } }).catch(() => {});
    }

    if (res.requiresOtp === false && res.token) {
      auth.save(res.token, res.user);
      finish(res.message);
      return;
    }

    session.email = res.email || payload.email;
    session.otpLength = res.devOtp ? String(res.devOtp).length : 6;
    qs("#verifyEmail").textContent = session.email;
    qs("#verifyExpiry").textContent = "10";
    qs("#devOtpHint").innerHTML = res.devOtp
      ? `<div class="alert alert-info">
          <div><strong>Development mode:</strong> SMTP is not configured yet, so here is your code.
          <div class="otp-preview">${esc(res.devOtp)}</div>
          <span class="small muted">Configure SMTP under Admin &gt; Settings &gt; Email &amp; OTP to send real emails.</span></div>
        </div>`
      : `<div class="alert alert-info">${esc(res.message || "We emailed you a verification code.")}</div>`;

    buildOtpInputs(session.otpLength);
    showStage("verify");
    startCountdown(10 * 60);
    toast("Verification code sent", "success");
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  } finally {
    btn.classList.remove("is-loading");
  }
};

/* ================================================================ step 2 */

function buildOtpInputs(len) {
  const host = qs("#otpInputs");
  host.innerHTML = Array.from({ length: len }, (_, i) =>
    `<input inputmode="numeric" maxlength="1" aria-label="Digit ${i + 1}" data-otp="${i}">`).join("");
  const inputs = qsa("[data-otp]", host);

  inputs.forEach((input, i) => {
    input.oninput = () => {
      input.value = input.value.replace(/\D/g, "").slice(0, 1);
      if (input.value && i < inputs.length - 1) inputs[i + 1].focus();
      if (inputs.every((n) => n.value)) qs("#verifyBtn").focus();
    };
    input.onkeydown = (e) => {
      if (e.key === "Backspace" && !input.value && i > 0) inputs[i - 1].focus();
      if (e.key === "ArrowLeft" && i > 0) inputs[i - 1].focus();
      if (e.key === "ArrowRight" && i < inputs.length - 1) inputs[i + 1].focus();
    };
    input.onpaste = (e) => {
      const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      if (!text) return;
      e.preventDefault();
      inputs.forEach((n, k) => (n.value = text[k] || ""));
      inputs[Math.min(text.length, inputs.length - 1)].focus();
    };
  });
  inputs[0]?.focus();
}

function otpValue() {
  return qsa("[data-otp]").map((n) => n.value).join("");
}

qs("#verifyBtn").onclick = verifyNow;
qs("#otpInputs").addEventListener("keydown", (e) => {
  if (e.key === "Enter") verifyNow();
});

async function verifyNow() {
  const btn = qs("#verifyBtn");
  const alertBox = qs("#otpAlert");
  alertBox.innerHTML = "";
  const code = otpValue();

  if (code.length < session.otpLength) {
    alertBox.innerHTML = `<div class="alert alert-error">Please enter all ${session.otpLength} digits of the code.</div>`;
    return;
  }

  btn.classList.add("is-loading");
  try {
    const res = await api("/api/auth/verify-otp", { method: "POST", body: { email: session.email, code } });
    if (res.token) {
      auth.save(res.token, res.user);
      finish(res.message);
    } else {
      alertBox.innerHTML = `<div class="alert alert-success">${esc(res.message)}</div>`;
      setTimeout(() => (location.href = "/login.html"), 1200);
    }
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
    qsa("[data-otp]").forEach((n) => (n.value = ""));
    qs("[data-otp]")?.focus();
  } finally {
    btn.classList.remove("is-loading");
  }
}

qs("#resendBtn").onclick = async () => {
  const alertBox = qs("#otpAlert");
  alertBox.innerHTML = "";
  try {
    const res = await api("/api/auth/resend-otp", { method: "POST", body: { email: session.email, purpose: "Register" } });
    alertBox.innerHTML = `<div class="alert alert-success">${esc(res.message)}${
      res.devOtp ? ` Development code: <strong>${esc(res.devOtp)}</strong>` : ""
    }</div>`;
    if (res.devOtp) {
      session.otpLength = String(res.devOtp).length;
      buildOtpInputs(session.otpLength);
      qsa("[data-otp]").forEach((n, i) => (n.value = res.devOtp[i] || ""));
    }
    startCountdown(num(res.expiryMinutes, 10) * 60);
  } catch (err) {
    alertBox.innerHTML = `<div class="alert alert-error">${esc(err.message)}</div>`;
  }
};

qs("#changeEmail").onclick = () => {
  showStage("form");
  qs("#rgEmail").focus();
};

let timer;
function startCountdown(seconds) {
  clearInterval(timer);
  const label = qs("#otpTimer");
  let left = seconds;
  const paint = () => {
    const m = String(Math.floor(left / 60)).padStart(2, "0");
    const s = String(left % 60).padStart(2, "0");
    label.textContent = left > 0 ? `Code expires in ${m}:${s}` : "The code has expired - request a new one.";
    qs("#verifyExpiry").textContent = Math.ceil(left / 60);
  };
  paint();
  timer = setInterval(() => {
    left--;
    paint();
    if (left <= 0) clearInterval(timer);
  }, 1000);
}

/* ================================================================ helpers */

function showStage(stage) {
  qs("#regForm").hidden = stage !== "form";
  qs("#verifyStage").hidden = stage !== "verify";
  qs("#doneStage").hidden = stage !== "done";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function finish(message) {
  clearInterval(timer);
  qs("#doneMessage").textContent = message || "Your account is ready.";
  showStage("done");
  toast("Account created. Welcome aboard!", "success");
  setTimeout(() => {
    if (auth.isAdmin) location.href = "/admin/";
    else location.href = "/my-account.html";
  }, 1800);
}

/* ============================================================ entry point */

if (verifyEmail) {
  session.email = verifyEmail;
  qs("#rgEmail").value = verifyEmail;
  qs("#verifyEmail").textContent = verifyEmail;
  buildOtpInputs(session.otpLength);
  showStage("verify");
  startCountdown(10 * 60);
  api("/api/auth/resend-otp", { method: "POST", body: { email: verifyEmail, purpose: "Register" } })
    .then((res) => {
      if (res.devOtp) {
        session.otpLength = String(res.devOtp).length;
        buildOtpInputs(session.otpLength);
        qs("#devOtpHint").innerHTML = `<div class="alert alert-info"><div><strong>Development mode:</strong>
          your code is <div class="otp-preview">${esc(res.devOtp)}</div></div></div>`;
        qsa("[data-otp]").forEach((n, i) => (n.value = res.devOtp[i] || ""));
      }
    })
    .catch(() => {});
}

if (auth.isLoggedIn && !verifyEmail) {
  toast("You are already signed in.", "info", 2600);
  setTimeout(() => (location.href = "/my-account.html"), 900);
}
