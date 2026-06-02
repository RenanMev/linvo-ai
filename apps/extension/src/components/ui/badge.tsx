import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
  {
    defaultVariants: {
      variant: "default"
    },
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        destructive: "border-transparent bg-destructive text-white",
        linvo: "border-transparent bg-teal-100 text-teal-800",
        outline: "text-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground"
      }
    }
  }
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ className, variant }))}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
