import { FileSearchIcon, InfoIcon, SparklesIcon, UserRoundIcon } from "lucide-react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

interface FloatingActionViewProps {
  alignRight: boolean;
  menuOpen: boolean;
  onClient: () => void;
  onInfo: () => void;
  onLauncherClick: () => void;
  onLauncherPointerDown: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onList: () => void;
  openUp: boolean;
}

export function FloatingActionView({
  alignRight,
  menuOpen,
  onClient,
  onInfo,
  onLauncherClick,
  onLauncherPointerDown,
  onList,
  openUp
}: FloatingActionViewProps) {
  return (
    <TooltipProvider>
      <div className="relative size-[52px] font-sans">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Abrir acoes Linvo AI"
              className="linvo-gradient linvo-shadow size-[52px] rounded-full border-white/20 text-white hover:scale-[1.02] hover:bg-teal-700"
              data-linvo-role="launcher"
              title="Linvo AI"
              type="button"
              variant="linvo"
              onClick={onLauncherClick}
              onPointerDown={onLauncherPointerDown}
            >
              <SparklesIcon className="size-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Linvo AI</TooltipContent>
        </Tooltip>
        <div
          aria-label="Acoes de identificacao"
          className={[
            "absolute z-10 grid grid-flow-col gap-1 rounded-full border border-white/15 bg-slate-950/95 p-1.5 shadow-2xl transition-opacity",
            menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
            alignRight ? "right-0" : "left-0",
            openUp ? "bottom-[calc(100%+10px)]" : "top-[calc(100%+10px)]"
          ].join(" ")}
          role="menu"
        >
          <OverlayAction label="Identificar cliente" tone="teal" onClick={onClient}>
            <UserRoundIcon className="size-5" />
          </OverlayAction>
          <OverlayAction label="Identificar lista" tone="amber" onClick={onList}>
            <FileSearchIcon className="size-5" />
          </OverlayAction>
          <OverlayAction label="Abrir info" tone="blue" onClick={onInfo}>
            <InfoIcon className="size-5" />
          </OverlayAction>
        </div>
      </div>
    </TooltipProvider>
  );
}

function OverlayAction({
  children,
  label,
  onClick,
  tone
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  tone: "amber" | "blue" | "teal";
}) {
  const toneClass = {
    amber: "border-orange-300/30 bg-orange-500/20 hover:bg-orange-500/30",
    blue: "border-blue-300/30 bg-blue-500/20 hover:bg-blue-500/30",
    teal: "border-teal-300/30 bg-teal-500/20 hover:bg-teal-500/30"
  }[tone];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className={`size-10 rounded-full text-white ${toneClass}`}
          data-linvo-action={tone === "teal" ? "client" : tone === "amber" ? "list" : "info"}
          role="menuitem"
          size="icon"
          title={label}
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
          }}
        >
          {children}
          <span className="sr-only">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}
