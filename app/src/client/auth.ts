async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json();
  if (!response.ok || !json.success) {
    throw new Error(json.message || `Request failed (${response.status})`);
  }
  return json;
}

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
      next: String(formData.get("next") || "/games/slot-machine"),
    };

    try {
      const result = await postJson("/api/auth/login", payload);
      window.location.href = result.data?.redirect || "/games/slot-machine";
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
      next: String(formData.get("next") || "/games/slot-machine"),
    };

    try {
      const result = await postJson("/api/auth/register", payload);
      window.location.href = result.data?.redirect || "/games/slot-machine";
    } catch (error) {
      setError(error.message || "Register failed");
    }
  });
}

bindLoginForm();
bindRegisterForm();
