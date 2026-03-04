import { postJson } from "./http.js";

interface AuthRedirectData {
  redirect?: string;
}

function toErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function setError(message: string): void {
  const el = document.getElementById("authError");
  if (el) {
    el.textContent = message || "";
  }
}

function bindLoginForm(): void {
  const form = document.getElementById("loginForm") as HTMLFormElement | null;
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event: Event) => {
    event.preventDefault();
    setError("");

    const formData = new FormData(form);
    const payload = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      next: String(formData.get("next") || "/"),
    };

    try {
      const result = await postJson<AuthRedirectData>("/api/auth/login", payload);
      window.location.href = result.data?.redirect || "/";
    } catch (error: unknown) {
      setError(toErrorMessage(error, "Login failed"));
    }
  });
}

function bindRegisterForm(): void {
  const form = document.getElementById("registerForm") as HTMLFormElement | null;
  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event: Event) => {
    event.preventDefault();
    setError("");

    const formData = new FormData(form);
    const payload = {
      email: String(formData.get("email") || ""),
      password: String(formData.get("password") || ""),
      next: String(formData.get("next") || "/"),
    };

    try {
      const result = await postJson<AuthRedirectData>("/api/auth/register", payload);
      window.location.href = result.data?.redirect || "/";
    } catch (error: unknown) {
      setError(toErrorMessage(error, "Register failed"));
    }
  });
}

bindLoginForm();
bindRegisterForm();
