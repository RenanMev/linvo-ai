import { AlertCircleIcon, CheckCircle2Icon, InfoIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

import type { ToastTone } from "./toast";

interface ToastViewProps {
  message: string;
  tone: ToastTone;
}

export function ToastView({ message, tone }: ToastViewProps) {
  const Icon = tone === "error"
    ? AlertCircleIcon
    : tone === "success"
      ? CheckCircle2Icon
      : InfoIcon;
  return (
    <div className="linvo-toast-shell fixed bottom-[82px] right-[18px] z-[2147483647] w-[min(320px,calc(100vw-36px))] font-sans">
      <Alert
        className="linvo-toast-card grid-cols-[auto_1fr] items-start gap-2"
        data-tone={tone}
        variant="default"
      >
        <Icon className="size-4" />
        <AlertDescription>{message}</AlertDescription>
      </Alert>
    </div>
  );
}
