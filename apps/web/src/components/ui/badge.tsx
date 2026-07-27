import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
  success: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  muted: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

/** Maps common event/claim/code statuses to a badge variant. */
export function statusVariant(status: string): BadgeVariant {
  switch (status) {
    case "published":
    case "completed":
    case "active":
    case "verified":
      return "success";
    case "paused":
    case "pending":
    case "queued":
    case "validated":
      return "warning";
    case "minting":
      return "info";
    case "failed":
    case "revoked":
    case "expired":
      return "danger";
    case "draft":
    case "archived":
    case "used":
      return "muted";
    default:
      return "default";
  }
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  ),
);

Badge.displayName = "Badge";
