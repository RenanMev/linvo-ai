import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full gap-1 rounded-lg border px-3 py-2 text-sm [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    defaultVariants: {
      variant: "default"
    },
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        destructive:
          "border-destructive/30 text-destructive bg-destructive/5 [&>svg]:text-destructive",
        info: "border-teal-200 bg-teal-50 text-teal-900",
        warning: "border-amber-200 bg-amber-50 text-amber-900"
      }
    }
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      data-slot="alert"
      className={cn(alertVariants({ className, variant }))}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-title"
      className={cn("font-medium leading-none", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm leading-relaxed", className)}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
