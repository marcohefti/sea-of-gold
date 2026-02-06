"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-[color:var(--sog-border)] bg-[color:var(--sog-bg-elev-1)] px-3 py-1 text-sm text-[color:var(--sog-text)] shadow-sm",
          "transition-colors",
          "placeholder:text-[color:var(--sog-text-muted)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
