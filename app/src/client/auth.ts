import { postJson } from "./http.js";

function setError(message) {
  const el = document.getElementById("authError");
  if (el) {
    el.textContent = message || "";
  }
}

function bindLoginForm() {
  const form = document.getElementById("loginForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");

    const formData = new FormData(form);
    const payload = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      next: String(formData.get("next") || "/"),
    };

    try {
      const result = await postJson("/api/auth/login", payload);
      window.location.href = result.data?.redirect || "/";
    } catch (error) {
      setError(error.message || "Login failed");
    }
  });
}

function bindRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");

    const formData = new FormData(form);
    const payload = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      next: String(formData.get("next") || "/"),
    };

    try {
      const result = await postJson("/api/auth/register", payload);
      window.location.href = result.data?.redirect || "/";
    } catch (error) {
      setError(error.message || "Register failed");
    }
  });
}

bindLoginForm();
bindRegisterForm();
