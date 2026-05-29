const TOAST_ID = "linvo-ai-toast";

export type ToastTone = "error" | "info" | "success";

export function showToast(message: string, tone: ToastTone = "info"): void {
  let toast = document.getElementById(TOAST_ID);

  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    toast.setAttribute("role", "status");
    toast.style.position = "fixed";
    toast.style.right = "18px";
    toast.style.bottom = "82px";
    toast.style.zIndex = "2147483647";
    toast.style.maxWidth = "320px";
    toast.style.padding = "10px 12px";
    toast.style.borderRadius = "8px";
    toast.style.boxShadow = "0 12px 32px rgba(15, 23, 42, 0.24)";
    toast.style.fontFamily = "Inter, system-ui, sans-serif";
    toast.style.fontSize = "13px";
    toast.style.lineHeight = "1.35";
    document.documentElement.append(toast);
  }

  toast.textContent = message;
  toast.style.background =
    tone === "error" ? "#7f1d1d" : tone === "success" ? "#064e3b" : "#111827";
  toast.style.color = "#f8fafc";
  window.setTimeout(() => toast?.remove(), 4200);
}
