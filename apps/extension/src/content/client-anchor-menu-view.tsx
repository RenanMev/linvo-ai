import { FileSearchIcon, InfoIcon, MoreHorizontalIcon, UserRoundIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

interface ClientAnchorMenuViewProps {
  menuOpen: boolean;
  onIdentifyClient: () => void;
  onIdentifyList: () => void;
  onOpenInfo: () => void;
  onToggleMenu: () => void;
}

export function ClientAnchorMenuView({
  menuOpen,
  onIdentifyClient,
  onIdentifyList,
  onOpenInfo,
  onToggleMenu
}: ClientAnchorMenuViewProps) {
  return (
    <TooltipProvider>
      <div className="relative size-10 font-sans">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="Abrir menu do cliente"
              className="linvo-gradient size-10 rounded-full border border-white/20 text-white shadow-xl"
              data-linvo-anchor-button="true"
              size="icon"
              title="Acoes do cliente"
              type="button"
              variant="linvo"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleMenu();
              }}
            >
              <MoreHorizontalIcon className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Acoes do cliente</TooltipContent>
        </Tooltip>
        {menuOpen ? (
          <div
            className="absolute left-[calc(100%+8px)] top-1/2 grid min-w-44 -translate-y-1/2 gap-1 rounded-lg border border-white/15 bg-slate-950/95 p-1.5 text-slate-50 shadow-2xl"
            data-linvo-anchor-menu="true"
            role="menu"
          >
            <MenuAction label="Identificar cliente" onClick={onIdentifyClient}>
              <UserRoundIcon className="size-4" />
            </MenuAction>
            <MenuAction label="Identificar lista" onClick={onIdentifyList}>
              <FileSearchIcon className="size-4" />
            </MenuAction>
            <MenuAction label="Abrir info" onClick={onOpenInfo}>
              <InfoIcon className="size-4" />
            </MenuAction>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function MenuAction({
  children,
  label,
  onClick
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={label}
      className="justify-start text-slate-50 hover:bg-teal-500/20 hover:text-slate-50"
      role="menuitem"
      size="sm"
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
      {label}
    </Button>
  );
}
