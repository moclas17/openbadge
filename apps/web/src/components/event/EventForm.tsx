"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArtworkUpload } from "@/components/event/ArtworkUpload";
import { api, ApiError, type EventDetail } from "@/lib/api";
import { supportedChains } from "@/lib/wagmi";
import { slugify } from "@/lib/utils";

function toInputDateTime(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function EventForm({
  organizationId,
  event,
}: {
  organizationId: string;
  event?: EventDetail;
}) {
  const router = useRouter();
  const isEdit = !!event;

  const [title, setTitle] = useState(event?.title ?? "");
  const [slug, setSlug] = useState(event?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(event?.websiteUrl ?? "");
  const [startsAt, setStartsAt] = useState(toInputDateTime(event?.startsAt));
  const [endsAt, setEndsAt] = useState(toInputDateTime(event?.endsAt));
  const [claimStartsAt, setClaimStartsAt] = useState(
    toInputDateTime(event?.claimStartsAt),
  );
  const [claimEndsAt, setClaimEndsAt] = useState(
    toInputDateTime(event?.claimEndsAt),
  );
  const [chainId, setChainId] = useState<number>(event?.chainId ?? 84532);
  const [maximumClaims, setMaximumClaims] = useState(
    event?.maximumClaims != null ? String(event.maximumClaims) : "",
  );
  const [visibility, setVisibility] = useState(event?.visibility ?? "public");
  const [artworkMediaId, setArtworkMediaId] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      title,
      slug,
      description: description || undefined,
      location: location || undefined,
      websiteUrl: websiteUrl || undefined,
      startsAt: toIso(startsAt),
      endsAt: toIso(endsAt),
      claimStartsAt: toIso(claimStartsAt),
      claimEndsAt: toIso(claimEndsAt),
      chainId,
      maximumClaims: maximumClaims ? Number(maximumClaims) : undefined,
      visibility,
    };
    if (artworkMediaId) payload.artworkMediaId = artworkMediaId;

    try {
      if (isEdit && event) {
        await api.events.update(event.id, payload);
        router.push(`/organizations/${organizationId}/events/${event.id}`);
      } else {
        payload.organizationId = organizationId;
        const created = await api.events.create(payload);
        router.push(`/organizations/${organizationId}/events/${created.data.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save event");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Edit event" : "Create event"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="ev-title">Title</Label>
              <Input
                id="ev-title"
                required
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="ETH Denver 2026 Attendee"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="ev-slug">Slug</Label>
              <Input
                id="ev-slug"
                required
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="eth-denver-2026-attendee"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="ev-description">Description</Label>
              <Textarea
                id="ev-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this credential represent?"
              />
            </div>

            <div>
              <Label htmlFor="ev-location">Location</Label>
              <Input
                id="ev-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Denver, CO"
              />
            </div>

            <div>
              <Label htmlFor="ev-website">Website URL</Label>
              <Input
                id="ev-website"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </div>

            <div>
              <Label htmlFor="ev-starts">Event starts</Label>
              <Input
                id="ev-starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="ev-ends">Event ends</Label>
              <Input
                id="ev-ends"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="ev-claim-starts">Claims open</Label>
              <Input
                id="ev-claim-starts"
                type="datetime-local"
                value={claimStartsAt}
                onChange={(e) => setClaimStartsAt(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="ev-claim-ends">Claims close</Label>
              <Input
                id="ev-claim-ends"
                type="datetime-local"
                value={claimEndsAt}
                onChange={(e) => setClaimEndsAt(e.target.value)}
              />
            </div>

            <div>
              <Label htmlFor="ev-chain">Chain</Label>
              <select
                id="ev-chain"
                value={chainId}
                disabled={isEdit}
                onChange={(e) => setChainId(Number(e.target.value))}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:bg-slate-50 disabled:text-slate-500"
              >
                {supportedChains.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="ev-max">Maximum claims</Label>
              <Input
                id="ev-max"
                type="number"
                min={1}
                value={maximumClaims}
                onChange={(e) => setMaximumClaims(e.target.value)}
                placeholder="Unlimited"
              />
            </div>

            <div>
              <Label htmlFor="ev-visibility">Visibility</Label>
              <select
                id="ev-visibility"
                value={visibility}
                onChange={(e) =>
                  setVisibility(e.target.value as "public" | "unlisted" | "private")
                }
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="public">Public</option>
                <option value="unlisted">Unlisted</option>
                <option value="private">Private</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <Label>Artwork</Label>
              <ArtworkUpload
                initialUrl={event?.artworkUrl ?? event?.artwork?.url ?? null}
                onUploaded={(mediaId) => setArtworkMediaId(mediaId)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {isEdit ? "Save changes" : "Create event"}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
