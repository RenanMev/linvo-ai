import { createShadowReactMount, type ShadowReactMount } from "./shadow-ui";
import { ToastView } from "./toast-view";

const TOAST_ID = "linvo-ai-toast";

export type ToastTone = "error" | "info" | "success";

let toastMount: ShadowReactMount | null = null;
let dismissTimer: number | null = null;

export function showToast(message: string, tone: ToastTone = "info"): void {
  if (!toastMount) {
    toastMount = createShadowReactMount(TOAST_ID);
  }

  toastMount.host.setAttribute("role", "status");
  toastMount.render(<ToastView message={message} tone={tone} />);

  if (dismissTimer !== null) {
    window.clearTimeout(dismissTimer);
  }

  dismissTimer = window.setTimeout(() => {
    toastMount?.unmount();
    toastMount = null;
    dismissTimer = null;
  }, 4200);
}
