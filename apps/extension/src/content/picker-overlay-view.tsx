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
  const toneClass = tone === "teal"
    ? "border-teal-500 bg-teal-500/15"
    : "border-orange-500 bg-orange-500/15";

  return (
    <div className="fixed inset-0 pointer-events-none z-[2147483646] font-sans">
      <div
        className={`fixed rounded-lg border-2 shadow-[0_0_0_9999px_rgba(15,23,42,0.08)] ${toneClass}`}
        style={{
          display: highlight.visible ? "block" : "none",
          height: `${highlight.height}px`,
          left: `${highlight.left}px`,
          top: `${highlight.top}px`,
          width: `${highlight.width}px`
        }}
      />
      <div className="fixed left-1/2 top-4 max-w-[min(360px,calc(100vw-24px))] -translate-x-1/2 rounded-lg bg-slate-950 px-3 py-2 text-center text-sm leading-snug text-slate-50 shadow-2xl">
        {hint}
      </div>
    </div>
  );
}
