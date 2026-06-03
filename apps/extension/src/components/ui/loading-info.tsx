import { LoaderCircleIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface LoadingInfoProps {
  className?: string;
  compact?: boolean;
  description?: string;
  skeletonLines?: number;
  title: string;
}

export function LoadingInfo({
  className,
  compact = false,
  description,
  skeletonLines = 0,
  title
}: LoadingInfoProps) {
  return (
    <div
      aria-live="polite"
      className={cn(
        "linvo-loading-info",
        compact && "linvo-loading-info-compact",
        className
      )}
      role="status"
    >
      <span className="linvo-loading-orb" aria-hidden="true">
        <LoaderCircleIcon className="linvo-loading-spinner size-4" />
      </span>
      <span className="linvo-loading-copy">
        <strong>{title}</strong>
        {description ? <span>{description}</span> : null}
      </span>
      {skeletonLines > 0 ? (
        <span className="linvo-loading-skeletons" aria-hidden="true">
          {Array.from({ length: skeletonLines }, (_, index) => (
            <span className="linvo-loading-bar" key={index} />
          ))}
        </span>
      ) : null}
    </div>
  );
}
