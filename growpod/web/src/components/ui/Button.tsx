"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-grow-600 hover:bg-grow-500 text-white border-grow-500 disabled:bg-grow-800",
  secondary:
    "bg-ink-700 hover:bg-ink-600 text-gray-100 border-ink-600 disabled:opacity-50",
  ghost: "bg-transparent hover:bg-ink-700 text-gray-300 border-transparent disabled:opacity-50",
  danger: "bg-red-700 hover:bg-red-600 text-white border-red-600 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "px-3 py-2 text-xs min-h-[36px]",
  md: "px-4 py-2.5 text-sm min-h-[42px]",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
