import Link from "next/link";
import { ArrowRight, BadgeCheck, QrCode, ShieldCheck } from "lucide-react";
import { API_URL, type ApiEnvelope, type EventSummary } from "@/lib/api";
import { EventCard } from "@/components/event/EventCard";

async function getPublishedEvents(): Promise<EventSummary[]> {
  try {
    const res = await fetch(`${API_URL}/events?status=published`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as ApiEnvelope<EventSummary[]>;
    return json.data ?? [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const events = await getPublishedEvents();

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="pt-8 text-center sm:pt-16">
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
          Proof you were there,{" "}
          <span className="text-indigo-600">owned by you</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
          OpenBadge lets organizers issue onchain participation credentials on
          Base, and lets attendees claim them in seconds with a QR code.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-indigo-600 px-6 text-base font-medium text-white hover:bg-indigo-700"
          >
            Start issuing <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/verify"
            className="inline-flex h-12 items-center gap-2 rounded-lg border border-slate-300 bg-white px-6 text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            Verify a credential
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid gap-6 sm:grid-cols-3">
        {[
          {
            icon: QrCode,
            title: "Claim with a scan",
            text: "Attendees scan a QR code, connect a wallet, and receive their credential — no seed phrases on stage.",
          },
          {
            icon: BadgeCheck,
            title: "Onchain on Base",
            text: "Credentials are minted on Base, portable across apps and provable forever.",
          },
          {
            icon: ShieldCheck,
            title: "Verifiable by anyone",
            text: "Anyone can verify ownership and authenticity of a credential in one click.",
          },
        ].map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="rounded-xl border border-slate-200 bg-white p-6"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </div>
        ))}
      </section>

      {/* Recent events */}
      <section>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Recent events</h2>
        </div>
        {events.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            No published events yet. Check back soon!
          </p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 9).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
