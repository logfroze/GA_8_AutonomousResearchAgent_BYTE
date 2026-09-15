import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-medium transition-[background-color,color,box-shadow,transform,opacity] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pine/40 disabled:pointer-events-none disabled:opacity-45 active:not-disabled:scale-[0.96]",
  {
    variants: {
      variant: {
        primary: "bg-pine text-pine-fg hover:bg-pine-hover shadow-[var(--shadow-border)]",
        secondary:
          "bg-surface text-ink shadow-[var(--shadow-border)] hover:bg-surface-2",
        ghost: "bg-transparent text-ink-soft hover:bg-surface-2 hover:text-ink",
        danger: "bg-danger text-pine-fg hover:opacity-90",
      },
      size: {
        md: "h-11 min-h-11 rounded-[10px] px-4 text-sm",
        lg: "h-12 min-h-12 rounded-md px-5 text-[0.9375rem]",
        sm: "h-9 min-h-9 rounded-[8px] px-3 text-sm",
        icon: "size-11 min-h-11 rounded-[10px]",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants>;

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
