import designSystemHtml from "./design-system-preview.html?raw";

interface DesignSystemViewProps {
  onBack: () => void;
}

export function DesignSystemView({ onBack }: DesignSystemViewProps) {
  void onBack;

  return (
    <main className="design-system-replica-screen">
      <iframe
        className="design-system-replica-frame"
        srcDoc={designSystemHtml}
        title="Auxia System Design"
      />
    </main>
  );
}
