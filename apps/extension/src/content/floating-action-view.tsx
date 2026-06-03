import { FileSearchIcon, InfoIcon, SparklesIcon, UserRoundIcon } from "lucide-react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { ComponentProps } from "react";

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
  tooltipPortalContainer?: ComponentProps<typeof TooltipContent>["portalContainer"];
}

type FloatingTooltipSide = NonNullable<ComponentProps<typeof TooltipContent>["side"]>;

export function FloatingActionView({
  alignRight,
  menuOpen,
  onClient,
  onInfo,
  onLauncherClick,
  onLauncherPointerDown,
  onList,
  openUp,
  tooltipPortalContainer
}: FloatingActionViewProps) {
  const launcherTooltipSide: FloatingTooltipSide = alignRight ? "left" : "right";
  const actionTooltipSide: FloatingTooltipSide = openUp ? "top" : "bottom";

  return (
    <TooltipProvider>
      <div className="linvo-floating-root relative size-[52px] font-sans">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Abrir acoes Linvo AI"
              className="linvo-floating-launcher size-[52px]"
              data-linvo-role="launcher"
              size="icon"
              type="button"
              variant="ghost"
              onClick={onLauncherClick}
              onPointerDown={onLauncherPointerDown}
            >
              <SparklesIcon className="size-6" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            className="linvo-floating-tooltip"
            portalContainer={tooltipPortalContainer}
            side={launcherTooltipSide}
            sideOffset={10}
          >
            Linvo AI
          </TooltipContent>
        </Tooltip>
        <div
          aria-label="Acoes de identificacao"
          className={[
            "linvo-floating-menu absolute z-10 transition-opacity",
            menuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
            alignRight ? "right-0" : "left-0",
            openUp ? "bottom-[calc(100%+10px)]" : "top-[calc(100%+10px)]"
          ].join(" ")}
          role="menu"
        >
          <OverlayAction
            action="client"
            label="Identificar cliente"
            tooltipPortalContainer={tooltipPortalContainer}
            tooltipSide={actionTooltipSide}
            onClick={onClient}
          >
            <UserRoundIcon className="size-5" />
          </OverlayAction>
          <OverlayAction
            action="list"
            label="Identificar lista"
            tooltipPortalContainer={tooltipPortalContainer}
            tooltipSide={actionTooltipSide}
            onClick={onList}
          >
            <FileSearchIcon className="size-5" />
          </OverlayAction>
          <OverlayAction
            action="info"
            label="Abrir info"
            tooltipPortalContainer={tooltipPortalContainer}
            tooltipSide={actionTooltipSide}
            onClick={onInfo}
          >
            <InfoIcon className="size-5" />
          </OverlayAction>
        </div>
      </div>
    </TooltipProvider>
  );
}

function OverlayAction({
  action,
  children,
  label,
  tooltipPortalContainer,
  tooltipSide,
  onClick
}: {
  action: "client" | "info" | "list";
  children: ReactNode;
  label: string;
  tooltipPortalContainer?: ComponentProps<typeof TooltipContent>["portalContainer"];
  tooltipSide: FloatingTooltipSide;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className="linvo-floating-action size-10"
          data-linvo-action={action}
          role="menuitem"
          size="icon"
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
      <TooltipContent
        className="linvo-floating-tooltip"
        portalContainer={tooltipPortalContainer}
        side={tooltipSide}
        sideOffset={8}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
