import type { Metadata } from "next";
import type { ReactNode } from "react";
import { WalletProvider } from "@/components/wallet/WalletProvider";
import { Header } from "@/components/layout/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OpenBadge — digital participation credentials",
    template: "%s | OpenBadge",
  },
  description:
    "OpenBadge is an open-source platform for issuing and collecting onchain participation credentials.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <WalletProvider>
          <Header />
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
