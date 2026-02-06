"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium",
    "transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        default:
          "border border-[color:var(--sog-accent-soft)] bg-[color:var(--sog-accent)] text-zinc-950 hover:bg-[#dfb66a] hover:border-[#c89c41]",
        secondary:
          "border border-[color:var(--sog-border)] bg-[color:var(--sog-bg-elev-2)] text-[color:var(--sog-text)] hover:bg-[color:var(--sog-bg-elev-1)]",
        ghost: "text-[color:var(--sog-text)] hover:bg-[color:var(--sog-bg-elev-1)]",
        destructive: "bg-red-600 text-white hover:bg-red-500",
      },
      size: {
        default: "h-9 px-3",
        sm: "h-8 rounded-md px-2 text-xs",
        lg: "h-10 rounded-md px-4",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
