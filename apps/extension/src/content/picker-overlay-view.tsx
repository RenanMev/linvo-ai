interface PickerOverlayViewProps {
  highlight: {
    height: number;
    left: number;
    top: number;
    visible: boolean;
    width: number;
  };
  hint: string;
  tone: "amber" | "teal";
}

export function PickerOverlayView({ highlight, hint, tone }: PickerOverlayViewProps) {
  return (
    <div className="fixed inset-0 pointer-events-none z-[2147483646] font-sans">
      <div
        className="linvo-picker-highlight fixed rounded-lg border-2"
        data-tone={tone}
        style={{
          display: highlight.visible ? "block" : "none",
          height: `${highlight.height}px`,
          left: `${highlight.left}px`,
          top: `${highlight.top}px`,
          width: `${highlight.width}px`
        }}
      />
      <div className="linvo-picker-hint fixed left-1/2 top-4 max-w-[min(360px,calc(100vw-24px))] -translate-x-1/2 px-3 py-2 text-center text-sm leading-snug">
        {hint}
      </div>
    </div>
  );
}
