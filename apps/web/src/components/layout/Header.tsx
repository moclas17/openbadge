import Link from "next/link";
import { Award } from "lucide-react";
import { ConnectButton } from "@/components/wallet/ConnectButton";

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <Award className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-lg font-bold text-slate-900">OpenBadge</span>
          </Link>
          <nav className="hidden items-center gap-6 sm:flex">
            <Link
              href="/"
              className="text-sm font-medium text-slate-600 hover:text-indigo-600"
            >
              Events
            </Link>
            <Link
              href="/verify"
              className="text-sm font-medium text-slate-600 hover:text-indigo-600"
            >
              Verify
            </Link>
          </nav>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
