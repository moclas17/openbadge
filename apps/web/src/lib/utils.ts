import { clsx, type ClassValue } from "clsx";
import { format } from "date-fns";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatDate(
  value: string | Date | null | undefined,
  pattern = "MMM d, yyyy",
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, pattern);
}

export function formatDateTime(value: string | Date | null | undefined): string {
  return formatDate(value, "MMM d, yyyy h:mm a");
}

export function truncateAddress(address: string | null | undefined): string {
  if (!address) return "";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function explorerTxUrl(chainId: number, hash: string): string {
  const bases: Record<number, string> = {
    8453: "https://basescan.org",
    84532: "https://sepolia.basescan.org",
  };
  const baseUrl = bases[chainId] ?? "https://basescan.org";
  return `${baseUrl}/tx/${hash}`;
}

export function explorerAddressUrl(chainId: number, address: string): string {
  const bases: Record<number, string> = {
    8453: "https://basescan.org",
    84532: "https://sepolia.basescan.org",
  };
  const baseUrl = bases[chainId] ?? "https://basescan.org";
  return `${baseUrl}/address/${address}`;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
