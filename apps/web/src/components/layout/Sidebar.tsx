"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Building2, LayoutDashboard, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/organizations/new", label: "New organization", icon: Plus, exact: true },
  { href: "/me/claims", label: "My claims", icon: Award, exact: false },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full shrink-0 border-b border-slate-200 bg-white md:min-h-[calc(100vh-4rem)] md:w-60 md:border-b-0 md:border-r">
      <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col md:overflow-visible">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </Link>
          );
        })}
        <div className="hidden pt-4 md:block">
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Organizations
          </p>
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
              pathname.startsWith("/organizations") && !pathname.startsWith("/organizations/new")
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            )}
          >
            <Building2 className="h-4 w-4" aria-hidden />
            Browse organizations
          </Link>
        </div>
      </nav>
    </aside>
  );
}
